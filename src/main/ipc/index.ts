import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app, clipboard, dialog, nativeImage, shell } from 'electron'
import sharp from 'sharp'
import { z } from 'zod'
import type { AppContext } from '../context'
import type {
  AppInfo,
  Brand,
  Image,
  ImportResult,
  JobState,
  LicenseState,
  PlanJson,
  Project,
  ProjectDetail,
  SettingsAll,
  UsageAction,
  UsageEvent
} from '@shared/types'
import { monthBounds } from '@shared/cost'
import { MAX_LOGO_BYTES, MAX_PERSON_BYTES, MAX_PROMPT } from '@shared/constants'
import { shapeForImage } from '@shared/shapes'
import { createDefaultPlan, normalisePlan } from '@shared/plans'
import { nextCountedLabel } from '@shared/labels'
import { workingFor } from '../media/paths'
import { applyLocalAdjust } from '../media/transform'
import { exportImageToPath, exportOneImage, exportSetProject } from '../media/export'
import { openExternalSafely } from '../security'
import { registerIpc, registerRaw, IpcFault } from './helpers'
import { SETTING_KEYS, type SettingKey } from '../settings'

const shapeSchema = z.enum(['square', 'portrait', 'landscape'])
const formatSchema = z.enum(['webp', 'jpeg', 'png'])
const projectTypeSchema = z.enum(['set', 'photo', 'image'])
const idSchema = z.string().min(1).max(120)
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const voidSchema = z.undefined()
const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, {
  message: 'Expected bytes'
})
const shotTypeSchema = z.enum(['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift', 'feature', 'onmodel'])
const adjustSchema = z.object({
  crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  brightness: z.number().min(-100).max(100).optional(),
  contrast: z.number().min(-100).max(100).optional(),
  saturation: z.number().min(-100).max(100).optional(),
  warmth: z.number().min(-100).max(100).optional(),
  sharpen: z.number().min(0).max(100).optional(),
  vignette: z.number().min(0).max(100).optional()
})
const planShotSchema = z.object({
  id: idSchema,
  type: shotTypeSchema,
  enabled: z.boolean(),
  direction: z.string().max(400),
  personId: z.string().nullable(),
  label: z.string().max(80),
  featureText: z.string().max(60).optional()
})
const planSchema = z.object({
  version: z.number().int().min(0),
  category: z.string().min(1).max(40),
  productName: z.string().max(160),
  shape: shapeSchema,
  format: formatSchema,
  createdAt: z.number().int(),
  shots: z.array(planShotSchema).max(8)
})
const exportOptionsSchema = z.object({
  format: formatSchema,
  quality: z.number().int().min(60).max(100),
  maxDimension: z.number().int().positive().nullable(),
  folder: z.string().optional(),
  includeVersions: z.boolean().optional(),
  filename: z.string().max(120).optional()
})
const brandPatchSchema = z.object({
  name: z.string().max(120).optional(),
  sells: z.string().max(80).optional(),
  marketplaces: z.array(z.string().max(40)).max(20).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(6).optional(),
  logoUrl: z.string().nullable().optional(),
  badgeEnabled: z.boolean().optional(),
  badgeCorner: z.enum(['br', 'bl', 'tr', 'tl']).optional(),
  badgeScale: z.enum(['s', 'm', 'l']).optional(),
  badgeOpacity: z.number().int().min(60).max(100).optional()
})

const rendererSettingKeys = [
  'theme', 'density', 'onboardingStep', 'onboardingDone', 'setupDismissed',
  'firstRunConfirmShown', 'licenseGraceNotified', 'concurrency', 'budgetCents',
  'defaultFormat', 'defaultShape', 'lastProjectId', 'exportDefaults', 'reduceMotion'
] as const

const settingSchemas: Partial<Record<SettingKey, z.ZodTypeAny>> = {
  theme: z.enum(['system', 'light', 'dark']),
  density: z.enum(['comfortable', 'compact']),
  onboardingStep: z.number().int().min(0).max(10),
  onboardingDone: z.boolean(),
  setupDismissed: z.boolean(),
  firstRunConfirmShown: z.boolean(),
  licenseGraceNotified: z.boolean(),
  concurrency: z.number().int().min(1).max(4),
  budgetCents: z.number().int().min(0).nullable(),
  defaultFormat: formatSchema,
  defaultShape: shapeSchema,
  lastProjectId: z.string().nullable(),
  exportDefaults: exportOptionsSchema,
  reduceMotion: z.enum(['system', 'reduce', 'full']),
  windowState: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number(),
    height: z.number(),
    isMaximized: z.boolean()
  }).nullable()
}

async function folderSize(dir: string): Promise<number> {
  let total = 0
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) total += await folderSize(full)
      else if (entry.isFile()) {
        try {
          total += (await fs.stat(full)).size
        } catch {
          // Skip unreadable files: the size is informational.
        }
      }
    }
  } catch {
    return total
  }
  return total
}

function isoMonthLabel(month: string): string {
  return month
}

function asProject(project: Project | null): Project {
  if (!project) throw new IpcFault('not_found')
  return project
}

function buildDetail(context: AppContext, project: Project): ProjectDetail {
  const detail = context.projects.get(project.id) ?? project
  let activeJob: JobState | null = null
  const activeId = context.queue.active().find((job) => job.projectId === project.id)?.id
  if (activeId) activeJob = context.queue.state(activeId)
  else activeJob = context.jobs.latestInterrupted(project.id)
  return {
    project: detail,
    images: context.images.list(project.id, false),
    plan: context.plans.getActive(project.id),
    activeJob,
    usageCents: context.usage.projectTotal(project.id)
  }
}

async function importSourceUse(context: AppContext, input: {
  projectId?: string
  type?: 'set' | 'photo' | 'image'
  bytes: Uint8Array
  name?: string
}): Promise<ImportResult> {
  let projectId = input.projectId
  let createdProject = false
  if (!projectId) {
    const type = input.type === 'set' ? 'set' : 'photo'
    projectId = context.projects.create({
      type,
      name: type === 'set' ? 'Untitled set' : 'Untitled photo'
    }).id
    createdProject = true
  }
  try {
    const result = await context.media.importSource({
      projectId,
      bytes: input.bytes,
      name: input.name
    })
    if (createdProject && input.name) {
      // The media service renames first uploads from the file name already.
    }
    return result
  } catch (error) {
    if (createdProject) {
      await context.media.deleteProjectFiles(projectId)
      context.projects.delete(projectId)
    }
    throw error
  }
}

async function openFolderDialog(context: AppContext, options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const window = context.getWindow()
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
}

async function saveFileDialog(context: AppContext, options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  const window = context.getWindow()
  return window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options)
}

function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function registerIpcHandlers(context: AppContext): void {
  const { logger, settings } = context
  let lastTestedKeyHash: { hash: string; at: number } | null = null
  const activeExports = new Map<string, { cancelled: boolean }>()

  registerIpc(context, 'app:info', voidSchema, (): AppInfo => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    paths: {
      library: context.libraryPath(),
      logs: path.join(context.userDataDir, 'logs'),
      userData: context.userDataDir
    },
    fakeMode: context.fakeMode,
    devUnlock: context.devUnlock,
    buildDate: context.buildDate,
    releases: {
      electron: process.versions.electron ?? '',
      chromium: process.versions.chrome ?? '',
      node: process.versions.node ?? ''
    }
  }))

  registerIpc(context, 'app:libraryStats', voidSchema, async () => ({
    path: context.libraryPath(),
    images: context.images.countAll(),
    bytes: await folderSize(context.libraryPath())
  }))

  registerIpc(context, 'app:openExternal', z.object({ url: z.string().url().max(2000) }), async ({ url }) => {
    const opened = await openExternalSafely(url, logger)
    if (!opened) throw new IpcFault('invalid_payload')
    return { ok: true as const }
  })

  registerIpc(
    context,
    'app:openPath',
    z.object({ kind: z.enum(['library', 'logs', 'project']), projectId: z.string().optional() }),
    async ({ kind, projectId }) => {
      let target: string
      if (kind === 'library') target = context.libraryPath()
      else if (kind === 'logs') target = path.join(context.userDataDir, 'logs')
      else {
        if (!projectId) throw new IpcFault('invalid_payload')
        const project = context.projects.get(projectId)
        if (!project) throw new IpcFault('not_found')
        target = path.join(context.libraryPath(), 'projects', project.id)
      }
      const error = await shell.openPath(target)
      if (error) throw new IpcFault('not_found')
      return { ok: true as const }
    }
  )

  registerIpc(context, 'settings:get', z.object({ key: z.enum([...rendererSettingKeys, 'deviceId']) }), ({ key }) => ({
    value: key === 'deviceId'
      ? settings.deviceId()
      : settings.get(key as SettingKey, null)
  }))

  registerIpc(context, 'settings:set', z.object({ key: z.enum(rendererSettingKeys), value: z.unknown() }), ({ key, value }) => {
    const settingKey = key as SettingKey
    const schema = settingSchemas[settingKey]
    if (!schema) throw new IpcFault('invalid_payload')
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new IpcFault('invalid_payload')
    settings.set(settingKey, parsed.data)
    return { ok: true as const }
  })

  registerIpc(context, 'settings:all', voidSchema, (): SettingsAll => settings.all())

  registerIpc(context, 'settings:changeLibrary', voidSchema, async () => {
    const current = context.libraryPath()
    const result = await openFolderDialog(context, {
      title: 'Choose a new library folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { libraryPath: current }
    const target = path.resolve(result.filePaths[0])
    if (target === path.resolve(current)) return { libraryPath: current }
    const oldRoot = path.resolve(current)
    if (target.startsWith(`${oldRoot}${path.sep}`) || oldRoot.startsWith(`${target}${path.sep}`)) {
      throw new IpcFault('invalid_payload', 'Choose a folder outside the current library.')
    }
    try {
      const entries = await fs.readdir(target)
      if (entries.length) throw new IpcFault('invalid_payload', 'Choose an empty folder for the new library.')
    } catch (error) {
      if (error instanceof IpcFault) throw error
      await fs.mkdir(target, { recursive: true })
    }
    try {
      await fs.cp(current, target, { recursive: true, force: false, errorOnExist: false })
      const check = context.db.pragma('integrity_check', { simple: true })
      if (check !== 'ok') throw new IpcFault('invalid_payload', 'The library copy could not be verified. Nothing changed.')
      const sample = context.images.imagesWithFiles().slice(0, 3)
      for (const image of sample) {
        for (const relative of [image.file, image.thumb].filter(Boolean) as string[]) {
          await fs.access(path.join(target, relative))
        }
      }
      await fs.writeFile(
        path.join(current, 'README.txt'),
        'The library moved to a new folder. This copy is no longer used and is safe to delete.\n',
        'utf8'
      )
      settings.set('libraryPath', target)
      logger.info('settings', 'library_moved')
      return { libraryPath: target }
    } catch (error) {
      if (error instanceof IpcFault) throw error
      throw new IpcFault('export_failed', 'The library could not be copied. Nothing changed.')
    }
  })

  registerIpc(context, 'secrets:setMuseKey', z.object({ key: z.string().min(1).max(500) }), ({ key }) => {
    const { last4 } = context.secrets.set(key)
    if (lastTestedKeyHash && lastTestedKeyHash.hash === hashKey(key) && Date.now() - lastTestedKeyHash.at < 120_000) {
      context.secrets.markValidated()
      lastTestedKeyHash = null
    }
    return { ok: true as const, last4 }
  })

  registerIpc(context, 'secrets:clearMuseKey', voidSchema, () => {
    context.secrets.clear()
    return { ok: true as const }
  })

  registerIpc(context, 'secrets:testMuseKey', z.object({ key: z.string().min(1).max(500).optional() }), async ({ key }) => {
    const result = await context.provider.validateKey(key)
    if (result.ok) {
      if (key) lastTestedKeyHash = { hash: hashKey(key), at: Date.now() }
      else context.secrets.markValidated()
      return { ok: true, validatedAt: Date.now() }
    }
    return { ok: false, code: result.code }
  })

  registerIpc(context, 'secrets:status', voidSchema, () => {
    const status = context.secrets.status()
    return {
      hasKey: status.hasKey,
      last4: status.last4,
      validatedAt: status.validatedAt,
      backend: status.backend
    }
  })

  registerIpc(context, 'license:state', voidSchema, (): LicenseState => context.license.state())
  registerIpc(context, 'license:activate', z.object({ key: z.string().min(1).max(500) }), async ({ key }) =>
    context.license.activate(key)
  )
  registerIpc(context, 'license:validate', voidSchema, async () => context.license.validate())
  registerIpc(context, 'license:deactivate', voidSchema, async () => context.license.deactivate())

  registerIpc(context, 'brand:get', voidSchema, (): Brand => context.brand.get())
  registerIpc(context, 'brand:update', brandPatchSchema, (patch) => context.brand.update(patch))
  registerIpc(
    context,
    'brand:setLogo',
    z.object({ bytes: bytesSchema, mime: z.string().max(100) }),
    async ({ bytes, mime }) => {
      if (bytes.byteLength > MAX_LOGO_BYTES) throw new IpcFault('too_large', 'That logo is larger than 5 MB. Try a smaller one.')
      const result = await context.media.setLogo({ bytes, mime })
      return { logoFile: result.logoFile }
    }
  )
  registerIpc(context, 'brand:clearLogo', voidSchema, async () => {
    await context.media.clearLogo()
    return { ok: true as const }
  })

  registerIpc(context, 'dialog:pickLogo', voidSchema, async (): Promise<Brand | null> => {
    const opened = await openFolderDialog(context, {
      title: 'Choose a logo',
      properties: ['openFile'],
      filters: [{ name: 'Logo', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (opened.canceled || !opened.filePaths[0]) return null
    const filePath = opened.filePaths[0]
    const stat = await fs.stat(filePath)
    if (stat.size > MAX_LOGO_BYTES) throw new IpcFault('too_large', 'That logo is larger than 5 MB. Try a smaller one.')
    const bytes = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg'
    await context.media.setLogo({ bytes, mime })
    return context.brand.get()
  })

  registerIpc(context, 'app:deleteLogs', voidSchema, async () => {
    const logs = path.join(context.userDataDir, 'logs')
    for (const name of ['main.log', 'main.1.log']) {
      await fs.rm(path.join(logs, name), { force: true }).catch(() => undefined)
    }
    return { ok: true as const }
  })

  registerIpc(
    context,
    'projects:list',
    z.object({
      filter: z.enum(['all', 'sets', 'photos', 'images']).optional(),
      sort: z.enum(['recent', 'oldest', 'name']).optional(),
      search: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional()
    }),
    (request) => context.projects.list(request)
  )

  registerIpc(context, 'projects:get', z.object({ id: idSchema }), ({ id }) => {
    const project = context.projects.get(id)
    if (!project) throw new IpcFault('not_found')
    const now = Date.now()
    if (!project.lastOpenedAt || now - project.lastOpenedAt > 30_000) {
      context.projects.setLastOpened(id)
      settings.set('lastProjectId', id)
    }
    const refreshed = context.projects.get(id) ?? project
    context.refreshMenu()
    return buildDetail(context, refreshed)
  })

  registerIpc(
    context,
    'projects:create',
    z.object({
      type: projectTypeSchema,
      name: z.string().max(140).optional(),
      category: z.string().max(40).optional()
    }),
    ({ type, name, category }): ProjectDetail => {
      const defaults = settings.all()
      const project = context.projects.create({
        type,
        name: name?.trim() || (type === 'set' ? 'Untitled set' : type === 'photo' ? 'Untitled photo' : 'Untitled image'),
        category: category ?? null,
        shape: defaults.defaultShape,
        format: defaults.defaultFormat
      })
      context.refreshMenu()
      return buildDetail(context, project)
    }
  )

  registerIpc(context, 'projects:createFromImage', z.object({ sourceImageId: idSchema, name: z.string().max(140).optional() }), async ({ sourceImageId, name }) => {
    const image = context.images.get(sourceImageId)
    if (!image || image.status !== 'ready' || !image.url) throw new IpcFault('not_found')
    const sourceProject = context.projects.get(image.projectId)
    if (!sourceProject) throw new IpcFault('not_found')
    const relative = decodeURI(image.url.replace('moss-media://library/', ''))
    const bytes = await fs.readFile(path.join(context.libraryPath(), relative))
    const setProject = context.projects.create({
      type: 'set',
      name: name?.trim() || sourceProject.name,
      category: 'other',
      shape: image.width && image.height ? shapeForImage(image.width, image.height) : sourceProject.shape,
      format: sourceProject.format
    })
    try {
      await context.media.importSource({ projectId: setProject.id, bytes, name: `${setProject.name}.${image.format === 'jpeg' ? 'jpg' : image.format}` })
      const plan = createDefaultPlan({
        category: 'other',
        productName: setProject.name,
        shape: setProject.shape,
        format: setProject.format
      })
      context.plans.save(setProject.id, plan)
      context.refreshMenu()
    } catch (error) {
      await context.media.deleteProjectFiles(setProject.id)
      context.projects.delete(setProject.id)
      throw error
    }
    context.refreshMenu()
    return buildDetail(context, context.projects.get(setProject.id)!)
  })

  registerIpc(
    context,
    'dialog:importImage',
    z.object({
      projectId: idSchema.optional(),
      kind: z.enum(['source', 'person']),
      type: z.enum(['set', 'photo']).optional(),
      name: z.string().max(80).optional()
    }),
    async (request): Promise<ImportResult | null> => {
      if (request.kind === 'person' && !request.name?.trim()) {
        throw new IpcFault('invalid_payload', 'Give the person a name first.')
      }
      const opened = await openFolderDialog(context, {
        title: request.kind === 'person' ? 'Choose a portrait' : 'Choose a photo',
        properties: ['openFile'],
        filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      })
      if (opened.canceled || !opened.filePaths[0]) return null
      const filePath = opened.filePaths[0]
      const stat = await fs.stat(filePath)
      if (stat.size > 40 * 1024 * 1024) throw new IpcFault('too_large')
      const bytes = await fs.readFile(filePath)
      const name = path.basename(filePath)
      if (request.kind === 'person') {
        if (bytes.byteLength > MAX_PERSON_BYTES) throw new IpcFault('too_large')
        const created = await context.media.importPerson({ name: request.name!.trim(), bytes })
        return { personId: created.personId, width: 0, height: 0 }
      }
      return importSourceUse(context, {
        projectId: request.projectId,
        type: request.type,
        bytes,
        name
      })
    }
  )

  registerIpc(
    context,
    'media:importBytes',
    z.object({
      projectId: idSchema.optional(),
      kind: z.enum(['source', 'person']),
      type: z.enum(['set', 'photo']).optional(),
      bytes: bytesSchema,
      mime: z.string().max(100),
      name: z.string().max(255).optional()
    }),
    async (request): Promise<ImportResult | null> => {
      if (request.kind === 'person') {
        if (request.bytes.byteLength > MAX_PERSON_BYTES) throw new IpcFault('too_large')
        const created = await context.media.importPerson({
          name: request.name?.trim() || 'New person',
          bytes: request.bytes
        })
        return { personId: created.personId, width: 0, height: 0 }
      }
      return importSourceUse(context, {
        projectId: request.projectId,
        type: request.type,
        bytes: request.bytes,
        name: request.name
      })
    }
  )

  registerIpc(
    context,
    'dialog:pickExportFolder',
    z.object({ projectId: idSchema }),
    async ({ projectId }) => {
      const project = context.projects.get(projectId)
      if (!project) throw new IpcFault('not_found')
      const result = await openFolderDialog(context, {
        title: 'Choose an export folder',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: settings.exportFolderFor(projectId) ?? undefined
      })
      if (result.canceled || !result.filePaths[0]) return { path: null }
      const folder = result.filePaths[0]
      context.exportFolders.add(folder)
      settings.rememberExportFolder(projectId, folder)
      return { path: folder }
    }
  )

  registerIpc(
    context,
    'projects:update',
    z.object({
      id: idSchema,
      patch: z.object({
        name: z.string().min(1).max(140).optional(),
        shape: shapeSchema.optional(),
        format: formatSchema.optional(),
        category: z.string().max(40).optional(),
        sourceImageId: z.string().nullable().optional(),
        coverImageId: z.string().nullable().optional()
      })
    }),
    ({ id, patch }) => {
      if (!context.projects.get(id)) throw new IpcFault('not_found')
      if (patch.sourceImageId) {
        const image = context.images.get(patch.sourceImageId)
        if (!image || image.projectId !== id) throw new IpcFault('invalid_payload')
      }
      if (patch.coverImageId) {
        const image = context.images.get(patch.coverImageId)
        if (!image || image.projectId !== id) throw new IpcFault('invalid_payload')
      }
      return asProject(context.projects.update(id, patch))
    }
  )

  registerIpc(context, 'projects:duplicate', z.object({ id: idSchema }), async ({ id }) => {
    const project = context.projects.get(id)
    if (!project) throw new IpcFault('not_found')
    const duplicate = await context.media.duplicateProject(project)
    context.refreshMenu()
    return asProject(context.projects.get(duplicate.projectId))
  })

  registerIpc(context, 'projects:delete', z.object({ id: idSchema }), async ({ id }) => {
    const project = context.projects.get(id)
    if (!project) throw new IpcFault('not_found')
    if (context.queue.isRunning(id) || context.jobs.runningForProject(id)) {
      throw new IpcFault('already_running', 'This project is making images. Stop the run first.')
    }
    context.projects.delete(id)
    if (settings.get<string | null>('lastProjectId', null) === id) settings.set('lastProjectId', null)
    await context.media.deleteProjectFiles(id)
    context.refreshMenu()
    return { ok: true as const }
  })

  registerIpc(context, 'projects:recent', z.object({ limit: z.number().int().min(1).max(20) }), ({ limit }) =>
    context.projects.recent(limit)
  )

  registerIpc(context, 'plans:get', z.object({ projectId: idSchema }), ({ projectId }) => {
    if (!context.projects.get(projectId)) throw new IpcFault('not_found')
    return context.plans.getActive(projectId)
  })

  registerIpc(context, 'plans:save', z.object({ projectId: idSchema, plan: planSchema }), ({ projectId, plan }) => {
    const project = context.projects.get(projectId)
    if (!project) throw new IpcFault('not_found')
    if (project.type !== 'set') throw new IpcFault('invalid_payload')
    if (plan.shots.length > 8) throw new IpcFault('invalid_payload', 'A set holds eight images. Turn one off first.')
    return context.plans.save(projectId, normalisePlan(plan as PlanJson))
  })

  registerIpc(
    context,
    'images:list',
    z.object({ projectId: idSchema, includeFailed: z.boolean().optional() }),
    ({ projectId, includeFailed }) => {
      if (!context.projects.get(projectId)) throw new IpcFault('not_found')
      return context.images.list(projectId, includeFailed ?? false)
    }
  )

  registerIpc(context, 'images:get', z.object({ id: idSchema }), ({ id }) => {
    const image = context.images.get(id)
    if (!image) throw new IpcFault('not_found')
    return image
  })

  registerIpc(context, 'images:delete', z.object({ id: idSchema }), async ({ id }) => {
    const image = context.images.get(id)
    if (!image) throw new IpcFault('not_found')
    if (image.kind === 'upload') {
      const all = context.images.list(image.projectId, true)
      if (all.length > 1) {
        throw new IpcFault('conflict', "The original photo stays while other versions exist. Delete the project to remove it.")
      }
    }
    const files = context.media.relativeFilesForImage(image)
    context.images.softDelete(id)
    for (const relative of files) {
      await fs.rm(path.join(context.libraryPath(), relative), { force: true }).catch(() => undefined)
    }
    return { ok: true as const }
  })

  registerIpc(
    context,
    'images:setCover',
    z.object({ projectId: idSchema, imageId: idSchema }),
    ({ projectId, imageId }) => {
      const image = context.images.get(imageId)
      if (!image || image.projectId !== projectId || image.status !== 'ready') throw new IpcFault('invalid_payload')
      context.images.setCover(projectId, imageId)
      return { ok: true as const }
    }
  )

  registerIpc(
    context,
    'images:setSource',
    z.object({ projectId: idSchema, imageId: idSchema }),
    ({ projectId, imageId }) => {
      const image = context.images.get(imageId)
      if (!image || image.projectId !== projectId || image.status !== 'ready') throw new IpcFault('invalid_payload')
      context.images.setSource(projectId, imageId)
      return { ok: true as const }
    }
  )

  registerIpc(context, 'jobs:startSet', z.object({ projectId: idSchema, mode: z.enum(['make', 'remake']), shotIds: z.array(idSchema).max(8).optional() }), (request) => context.queue.startSet(request))
  registerIpc(
    context,
    'jobs:startCreate',
    z.object({
      projectId: idSchema,
      prompt: z.string().min(1).max(MAX_PROMPT),
      count: z.number().int().min(1).max(4),
      shape: shapeSchema,
      format: formatSchema,
      sourceImageId: z.string().optional()
    }),
    (request) => context.queue.startCreate(request)
  )
  registerIpc(
    context,
    'jobs:startEdit',
    z.object({
      projectId: idSchema,
      imageId: idSchema,
      change: z.string().min(1).max(MAX_PROMPT),
      kind: z.enum(['', 'scene', 'edit', 'model']),
      templateId: z.string().max(80).optional(),
      personId: z.string().max(80).optional(),
      palette: z.array(z.string()).max(3).optional(),
      isGiftShot: z.boolean().optional()
    }),
    (request) => context.queue.startEdit(request)
  )
  registerIpc(context, 'jobs:cancel', z.object({ jobId: idSchema }), ({ jobId }) => {
    context.queue.cancel(jobId)
    return { ok: true as const }
  })
  registerIpc(context, 'jobs:state', z.object({ jobId: idSchema }), ({ jobId }) => {
    const state = context.queue.state(jobId)
    if (!state) throw new IpcFault('not_found')
    return state
  })
  registerIpc(context, 'jobs:active', voidSchema, () => context.queue.active())
  registerIpc(context, 'jobs:retryFailed', z.object({ jobId: idSchema }), ({ jobId }) => context.queue.retryFailed(jobId))
  registerIpc(context, 'jobs:listForProject', z.object({ projectId: idSchema }), ({ projectId }) => {
    if (!context.projects.get(projectId)) throw new IpcFault('not_found')
    return context.jobs.recentForProject(projectId)
  })

  registerIpc(
    context,
    'adjust:apply',
    z.object({ imageId: idSchema, transform: adjustSchema }),
    async ({ imageId, transform }): Promise<{ imageId: string }> => {
      const source = context.images.get(imageId)
      if (!source || source.status !== 'ready') throw new IpcFault('not_found')
      const sourcePath = source.kind === 'upload'
        ? workingFor(context.libraryPath(), source.projectId, source.id)
        : path.join(context.libraryPath(), decodeURI(source.url!.replace('moss-media://library/', '')))
      const newId = crypto.randomUUID()
      const result = await applyLocalAdjust({
        libraryPath: context.libraryPath(),
        sourcePath,
        imageId: newId,
        projectId: source.projectId,
        transform
      })
      const labels = context.images.labels(source.projectId)
      const label = nextCountedLabel('Adjust', labels)
      context.images.create({
        id: newId,
        projectId: source.projectId,
        kind: 'adjust',
        status: 'ready',
        file: result.relative,
        thumb: result.thumb,
        width: result.width,
        height: result.height,
        format: 'webp',
        prompt: null,
        userText: 'Local adjust',
        templateId: null,
        shotId: source.shotId,
        personId: source.personId,
        label,
        parentId: source.id,
        rootId: source.rootId ?? source.id,
        adjust: transform,
        costCents: 0
      })
      const project = context.projects.get(source.projectId)
      context.usage.record({
        projectId: source.projectId,
        projectName: project?.name ?? 'Project',
        imageId: newId,
        action: 'adjust',
        requestedN: 1,
        returnedN: 1,
        costCents: 0,
        durationMs: 0,
        result: 'ok'
      })
      if (project?.type === 'image' || !project?.coverImageId) {
        context.images.setCover(source.projectId, newId)
      }
      return { imageId: newId }
    }
  )

  registerIpc(context, 'people:list', voidSchema, () => context.people.list())
  registerIpc(
    context,
    'people:create',
    z.object({ name: z.string().min(1).max(80), bytes: bytesSchema, mime: z.string().max(100) }),
    async ({ name, bytes }) => {
      if (bytes.byteLength > MAX_PERSON_BYTES) throw new IpcFault('too_large')
      const created = await context.media.importPerson({ name, bytes })
      const person = context.people.getUser(created.personId)
      if (!person) throw new IpcFault('unknown')
      return person
    }
  )
  registerIpc(context, 'people:rename', z.object({ id: idSchema, name: z.string().min(1).max(80) }), ({ id, name }) => {
    const person = context.people.rename(id, name.trim())
    if (!person) throw new IpcFault('not_found')
    return person
  })
  registerIpc(context, 'people:delete', z.object({ id: idSchema }), async ({ id }) => {
    const result = context.people.delete(id)
    if (!result) throw new IpcFault('not_found')
    for (const file of result.files) {
      await fs.rm(path.join(context.libraryPath(), file), { force: true }).catch(() => undefined)
    }
    return { ok: true as const }
  })

  registerIpc(context, 'usage:summary', z.object({ month: monthSchema }), ({ month }) => {
    const bounds = monthBounds(month)
    const totals = context.usage.monthSummary(bounds.start, bounds.end)
    return {
      month: isoMonthLabel(month),
      images: totals.images,
      spendCents: totals.cents,
      budgetCents: settings.budgetCents(),
      projects: context.usage.byProject(bounds.start, bounds.end).map((row) => ({
        projectId: row.projectId ?? '',
        name: row.name,
        images: row.images,
        spendCents: row.spendCents
      }))
    }
  })
  registerIpc(
    context,
    'usage:list',
    z.object({ month: monthSchema, projectId: z.string().optional(), limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() }),
    ({ month, projectId, limit, offset }) => {
      const bounds = monthBounds(month)
      return context.usage.list({ monthStart: bounds.start, monthEnd: bounds.end, projectId, limit, offset })
    }
  )
  registerIpc(context, 'usage:byProject', z.object({ month: monthSchema }), ({ month }) => {
    const bounds = monthBounds(month)
    return { items: context.usage.byProject(bounds.start, bounds.end) }
  })
  registerIpc(context, 'usage:deleteAll', voidSchema, () => {
    context.usage.deleteAll()
    return { ok: true as const }
  })

  registerIpc(context, 'usage:exportCsv', z.object({ month: monthSchema }), async ({ month }) => {
    const bounds = monthBounds(month)
    const rows = context.usage.allForCsv(bounds.start, bounds.end)
    const header = 'date,project,action,requested,returned,cost_usd,duration_ms,result,error'
    const lines = rows.map((row) =>
      [
        new Date(row.at).toISOString(),
        csvField(row.projectName),
        row.action,
        row.requested,
        row.returned,
        row.uncertainBilling ? '' : (row.costCents / 100).toFixed(2),
        row.durationMs ?? '',
        row.result,
        row.errorCode ?? ''
      ].join(',')
    )
    const filename = `moss-usage-${month}.csv`
    const result = await saveFileDialog(context, {
      title: 'Save usage CSV',
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return { path: null }
    await fs.writeFile(result.filePath, `${header}\n${lines.join('\n')}\n`, 'utf8')
    return { path: result.filePath }
  })

  registerIpc(
    context,
    'export:images',
    z.object({ projectId: idSchema, imageIds: z.array(idSchema).min(1).max(10), options: exportOptionsSchema }),
    async ({ projectId, imageIds, options }) => {
      const project = context.projects.get(projectId)
      if (!project) throw new IpcFault('not_found')
      const images = imageIds.map((id) => context.images.get(id)).filter((image): image is Image => Boolean(image && image.projectId === projectId && image.status === 'ready'))
      if (!images.length) throw new IpcFault('not_found')
      const extension = options.format === 'jpeg' ? 'jpg' : options.format
      const base = options.filename?.replace(/\.[^.]+$/, '') || (images.length === 1 ? images[0]!.label : project.name)
      const workingPathFor = (image: Image): string => workingFor(context.libraryPath(), image.projectId, image.id)
      if (images.length === 1) {
        const folder = options.folder
        if (folder) {
          if (!context.exportFolders.has(folder)) throw new IpcFault('invalid_payload')
        } else {
          const defaultFolder = settings.exportFolderFor(projectId) ?? app.getPath('pictures')
          const picked = await saveFileDialog(context, {
            title: 'Export image',
            defaultPath: path.join(defaultFolder, `${base}.${extension}`),
            filters: [{ name: options.format.toUpperCase(), extensions: [extension] }]
          })
          if (picked.canceled || !picked.filePath) return { paths: [] }
          const destination = picked.filePath.endsWith(`.${extension}`) ? picked.filePath : `${picked.filePath}.${extension}`
          const written = await exportImageToPath({
            libraryPath: context.libraryPath(),
            image: images[0]!,
            workingPath: workingPathFor(images[0]!),
            options,
            destinationPath: destination
          })
          settings.rememberExportFolder(projectId, path.dirname(destination))
          return { paths: [written] }
        }
        const pathWritten = await exportOneImage({
          libraryPath: context.libraryPath(),
          image: images[0]!,
          workingPath: workingPathFor(images[0]!),
          options,
          destinationFolder: folder!,
          baseName: base
        })
        settings.rememberExportFolder(projectId, folder!)
        return { paths: [pathWritten] }
      }
      let folder = options.folder
      if (folder) {
        if (!context.exportFolders.has(folder)) throw new IpcFault('invalid_payload')
      } else {
        const pick = await openFolderDialog(context, { title: 'Choose an export folder', properties: ['openDirectory', 'createDirectory'] })
        if (pick.canceled || !pick.filePaths[0]) return { paths: [] }
        folder = pick.filePaths[0]
        context.exportFolders.add(folder)
      }
      const paths: string[] = []
      const taken = new Set<string>()
      for (const image of images) {
        paths.push(await exportOneImage({
          libraryPath: context.libraryPath(),
          image,
          workingPath: workingPathFor(image),
          options,
          destinationFolder: folder!,
          baseName: images.length === 1 ? base : image.label,
          taken
        }))
      }
      settings.rememberExportFolder(projectId, folder!)
      return { paths }
    }
  )

  registerIpc(
    context,
    'export:set',
    z.object({ projectId: idSchema, options: exportOptionsSchema }),
    async ({ projectId, options }) => {
      const project = context.projects.get(projectId)
      if (!project) throw new IpcFault('not_found')
      const plan = context.plans.getActive(projectId)
      if (!plan) throw new IpcFault('invalid_payload', 'Add a photo and plan the set first.')
      let folder = options.folder
      if (folder) {
        if (!context.exportFolders.has(folder)) throw new IpcFault('invalid_payload')
      } else {
        const pick = await openFolderDialog(context, {
          title: 'Export set',
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: settings.exportFolderFor(projectId) ?? undefined
        })
        if (pick.canceled || !pick.filePaths[0]) return { folder: '', paths: [] }
        folder = pick.filePaths[0]
        context.exportFolders.add(folder)
      }
      const images = context.images.list(projectId, false)
      if (!images.length) throw new IpcFault('invalid_payload', 'Make an image first.')
      const token = { cancelled: false }
      activeExports.set(projectId, token)
      const result = await exportSetProject({
        libraryPath: context.libraryPath(),
        projectName: project.name,
        plan: plan.json,
        images,
        options,
        folder: folder!,
        workingPathFor: (image) => workingFor(context.libraryPath(), image.projectId, image.id),
        shouldCancel: () => token.cancelled
      }).finally(() => activeExports.delete(projectId))
      settings.rememberExportFolder(projectId, folder!)
      return { folder: folder!, paths: result.paths, cancelled: result.cancelled }
    }
  )

  registerIpc(context, 'export:cancel', z.object({ projectId: idSchema }), ({ projectId }) => {
    const token = activeExports.get(projectId)
    if (token) token.cancelled = true
    return { ok: true as const }
  })

  registerRaw('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}
