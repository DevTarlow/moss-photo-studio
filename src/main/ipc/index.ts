import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app, clipboard, ClipboardItem, dialog, shell } from 'electron'
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
  Product,
  ProductDetail,
  SetDetail,
  Project,
  ProjectDetail,
  SettingsAll
} from '@shared/types'
import { monthBounds } from '@shared/cost'
import { MAX_LOGO_BYTES, MAX_PERSON_BYTES, MAX_PROMPT } from '@shared/constants'
import { nextCountedLabel } from '@shared/labels'
import { safeBaseName } from '@shared/files'
import { isBundledProduct } from '@shared/products'
import { absoluteInLibrary, workingFor } from '../media/paths'
import { applyLocalAdjust } from '../media/transform'
import { addSizeLabel } from '../media/label'
import { exportImageToPath, exportOneImage } from '../media/export'
import { exportSetImages } from '../media/setExport'
import { openExternalSafely } from '../security'
import { SCHEMA_VERSION } from '../db/connection'
import { createBackup, createDiagnostics, inspectBackup, stageRestore } from '../backup'
import { runtimeEnv } from '../env'
import { registerIpc, registerRaw, IpcFault } from './helpers'
import { type SettingKey } from '../settings'

const shapeSchema = z.enum(['square', 'portrait', 'landscape'])
const formatSchema = z.enum(['webp', 'jpeg', 'png'])
const projectTypeSchema = z.enum(['photo', 'image'])
const idSchema = z.string().min(1).max(120)
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const voidSchema = z.undefined()
const bytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, {
  message: 'Expected bytes'
})
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
const exportOptionsSchema = z.object({
  format: formatSchema,
  quality: z.number().int().min(60).max(100),
  maxDimension: z.number().int().positive().nullable(),
  includeVersions: z.boolean().optional(),
  filename: z.string().max(120).optional()
})
const brandPatchSchema = z.object({
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(6).optional(),
  colorsEnabled: z.boolean().optional(),
  logoUrl: z.string().nullable().optional(),
  badgeEnabled: z.boolean().optional(),
  badgeCorner: z.enum(['br', 'bl', 'tr', 'tl']).optional(),
  badgeScale: z.enum(['s', 'm', 'l']).optional(),
  badgeOpacity: z.number().int().min(60).max(100).optional(),
})

const rendererSettingKeys = [
  'theme', 'density', 'onboardingStep', 'onboardingDone', 'onboardingDismissed', 'setupDismissed',
  'firstRunConfirmShown', 'licenseGraceNotified', 'concurrency', 'budgetCents',
  'defaultFormat', 'defaultShape', 'lastProjectId', 'exportDefaults', 'reduceMotion'
] as const

const settingSchemas: Partial<Record<SettingKey, z.ZodTypeAny>> = {
  theme: z.enum(['system', 'light', 'dark']),
  density: z.enum(['comfortable', 'compact']),
  onboardingStep: z.number().int().min(0).max(4),
  onboardingDone: z.boolean(),
  onboardingDismissed: z.boolean(),
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
  const activeId = context.queue.active().find((job) => job.projectId === project.id)?.id
  const activeJob: JobState | null = activeId
    ? context.queue.state(activeId)
    : context.jobs.latestInterrupted(project.id)
  return {
    project: detail,
    images: context.images.list(project.id, false),
    activeJob,
    usageCents: context.usage.projectTotal(project.id)
  }
}

async function importSourceUse(context: AppContext, input: {
  projectId?: string
  type?: 'photo'
  bytes: Uint8Array
  name?: string
}): Promise<ImportResult> {
  let projectId = input.projectId
  let createdProject = false
  if (!projectId) {
    projectId = context.projects.create({
      type: 'photo',
      name: 'Untitled photo'
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

async function confirmRestore(context: AppContext, summary: { projects: number; images: number; createdAt: number }): Promise<boolean> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: 'Restore this backup?',
    message: `Restore ${summary.projects} ${summary.projects === 1 ? 'project' : 'projects'} and ${summary.images} ${summary.images === 1 ? 'image' : 'images'}?`,
    detail:
      'The restored library opens in the folder you choose. The current library stays where it is until the restore finishes. The app restarts to complete it, and your Meta key must be entered again.',
    buttons: ['Restore', 'Cancel'],
    defaultId: 1,
    cancelId: 1
  }
  const window = context.getWindow()
  const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)
  return result.response === 0
}

function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  // A spreadsheet treats these prefixes as formulas. Quote the cell as text.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  if (/[",\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}

export function registerIpcHandlers(context: AppContext): void {
  const { logger, settings } = context
  let lastTestedKeyHash: { hash: string; at: number } | null = null

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
    e2e: runtimeEnv.e2e,
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
    'app:setMenuContext',
    z.object({
      editor: z.boolean(),
      adjust: z.boolean(),
      canUndo: z.boolean(),
      canRedo: z.boolean(),
      hasSelection: z.boolean(),
      canExport: z.boolean(),
      canZoom: z.boolean()
    }),
    (next) => {
      context.updateMenuContext(next)
      return { ok: true as const }
    }
  )

  registerIpc(
    context,
    'app:openPath',
    z.object({ kind: z.enum(['library', 'logs', 'project', 'exports']), projectId: z.string().optional(), setId: z.string().optional() }),
    async ({ kind, projectId, setId }) => {
      let target: string
      if (kind === 'library') target = context.libraryPath()
      else if (kind === 'logs') target = path.join(context.userDataDir, 'logs')
      else if (kind === 'exports') {
        const key = projectId ?? (setId ? `set:${setId}` : null)
        if (!key) throw new IpcFault('invalid_payload')
        const folder = settings.exportFolderFor(key)
        if (!folder) throw new IpcFault('not_found')
        target = folder
      } else {
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

  registerIpc(context, 'app:copyLibraryPath', voidSchema, async () => {
    await clipboard.writeText(context.libraryPath())
    return { ok: true as const }
  })

  registerIpc(context, 'backup:create', voidSchema, async () => {
    if (context.queue.active().some((job) => job.status === 'running')) {
      throw new IpcFault('already_running', 'Finish the images in progress before backing up.')
    }
    const pick = await openFolderDialog(context, {
      title: 'Choose where to save the backup',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (pick.canceled || !pick.filePaths[0]) return { created: false }
    let result
    try {
      result = await createBackup({
        db: context.db,
        userDataDir: context.userDataDir,
        libraryPath: context.libraryPath(),
        appVersion: app.getVersion(),
        schemaVersion: SCHEMA_VERSION,
        parentDir: pick.filePaths[0],
        logger: context.logger
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'backup_inside_library') {
        throw new IpcFault('invalid_payload', 'Choose a folder outside the library for the backup.')
      }
      throw error
    }
    settings.set('lastBackupAt', Date.now())
    settings.set('lastBackupDir', path.join(pick.filePaths[0], result.folderName))
    return { created: true, ...result }
  })

  registerIpc(context, 'backup:restore', voidSchema, async () => {
    if (context.queue.active().some((job) => job.status === 'running')) {
      throw new IpcFault('already_running', 'Finish the images in progress before restoring.')
    }
    const pick = await openFolderDialog(context, {
      title: 'Choose a Moss Photo Studio backup folder',
      defaultPath: settings.get<string | null>('lastBackupDir', null) ?? app.getPath('documents'),
      properties: ['openDirectory']
    })
    if (pick.canceled || !pick.filePaths[0]) return { started: false }
    let inspected
    try {
      inspected = await inspectBackup(pick.filePaths[0])
    } catch {
      throw new IpcFault('invalid_payload', 'That folder is not a complete Moss Photo Studio backup.')
    }
    if (inspected.summary.schemaVersion > SCHEMA_VERSION) {
      throw new IpcFault('invalid_payload', 'That backup was made by a newer version of Moss Photo Studio.')
    }
    if (!(await confirmRestore(context, inspected.summary))) return { started: false }
    const target = await openFolderDialog(context, {
      title: 'Choose an empty folder for the restored library',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (target.canceled || !target.filePaths[0]) return { started: false }
    const targetPath = path.resolve(target.filePaths[0])
    const currentLibrary = path.resolve(context.libraryPath())
    const backupPath = path.resolve(pick.filePaths[0])
    const nested = (a: string, b: string): boolean => a === b || a.startsWith(`${b}${path.sep}`) || b.startsWith(`${a}${path.sep}`)
    if (nested(targetPath, currentLibrary) || nested(targetPath, backupPath)) {
      throw new IpcFault('invalid_payload', 'Choose a folder away from the current library and the backup.')
    }
    try {
      await stageRestore({
        backupDir: pick.filePaths[0],
        targetLibrary: target.filePaths[0],
        userDataDir: context.userDataDir,
        logger: context.logger
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'restore_target_not_empty') {
        throw new IpcFault('invalid_payload', 'Choose an empty folder for the restored library.')
      }
      throw error
    }
    // The renderer may show a toast, then the app restarts to swap the database.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 500)
    return { started: true, folderName: inspected.folderName, summary: inspected.summary }
  })

  registerIpc(context, 'backup:openLast', voidSchema, async () => {
    const folder = settings.get<string | null>('lastBackupDir', null)
    if (!folder) throw new IpcFault('not_found')
    const error = await shell.openPath(folder)
    if (error) throw new IpcFault('not_found')
    return { ok: true as const }
  })

  registerIpc(context, 'backup:status', voidSchema, () => ({
    lastBackupAt: settings.get<number | null>('lastBackupAt', null)
  }))

  registerIpc(context, 'diagnostics:create', voidSchema, async () => {
    let documents = app.getPath('documents')
    try {
      await fs.mkdir(documents, { recursive: true })
    } catch {
      documents = app.getPath('temp')
    }
    const result = await createDiagnostics({
      userDataDir: context.userDataDir,
      libraryPath: context.libraryPath(),
      documentsDir: documents,
      appVersion: app.getVersion(),
      buildDate: context.buildDate,
      schemaVersion: SCHEMA_VERSION,
      db: context.db,
      logger: context.logger
    })
    settings.set('lastDiagnosticsDir', result.folder)
    await shell.openPath(result.folder)
    return { folderName: result.folderName }
  })

  registerIpc(context, 'app:copyImage', z.object({ imageId: idSchema }), async ({ imageId }) => {
    const image = context.images.get(imageId)
    if (!image || image.status !== 'ready' || !image.url) throw new IpcFault('not_found')
    const relative = decodeURI(image.url.replace('moss-media://library/', ''))
    const png = await sharp(absoluteInLibrary(context.libraryPath(), relative)).png().toBuffer()
    await clipboard.write([
      new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })
    ])
    return { ok: true as const }
  })

  registerIpc(context, 'app:readClipboardImage', voidSchema, async () => {
    // The OS clipboard can lag the write promise by a frame. Give a paste
    // request three short chances before reporting an empty clipboard.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const items = await clipboard.read()
      for (const item of items) {
        const type = item.types.find((entry) => entry.startsWith('image/'))
        if (!type) continue
        const value = await item.getType(type)
        if (value instanceof Blob) {
          return { bytes: new Uint8Array(await value.arrayBuffer()), mime: type }
        }
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return { bytes: null, mime: null }
  })

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
    await fs.mkdir(current, { recursive: true })
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

  registerIpc(context, 'secrets:setMuseKey', z.object({ key: z.string().min(1).max(500) }), async ({ key }) => {
    const { last4 } = await context.secrets.set(key)
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

  registerIpc(context, 'secrets:status', voidSchema, async () => {
    const status = await context.secrets.status()
    return {
      hasKey: status.hasKey,
      last4: status.last4,
      validatedAt: status.validatedAt,
      backend: status.backend
    }
  })

  registerIpc(context, 'license:state', voidSchema, async (): Promise<LicenseState> => context.license.state())
  registerIpc(context, 'license:activate', z.object({ key: z.string().min(1).max(500) }), async ({ key }) =>
    context.license.activate(key)
  )
  registerIpc(context, 'license:validate', voidSchema, async () => context.license.validate())
  registerIpc(context, 'license:deactivate', voidSchema, async () => context.license.deactivate())
  registerIpc(context, 'updates:check', voidSchema, async () => context.updates.check())
  registerIpc(context, 'updates:autoState', voidSchema, async () => context.autoUpdates.state())
  registerIpc(context, 'updates:autoCheck', voidSchema, async () => context.autoUpdates.check())
  registerIpc(context, 'updates:autoInstall', voidSchema, async () => context.autoUpdates.install())

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
      filter: z.enum(['all', 'photos', 'images']).optional(),
      sort: z.enum(['recent', 'oldest', 'name']).optional(),
      search: z.string().max(200).optional(),
      productId: z.string().nullable().optional(),
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
      productId: idSchema.optional(),
      draft: z.boolean().optional()
    }),
    ({ type, name, productId, draft }): ProjectDetail => {
      if (productId && !context.products.exists(productId)) throw new IpcFault('not_found')
      const defaults = settings.all()
      const project = context.projects.create({
        type,
        name: name?.trim() || (type === 'photo' ? 'Untitled photo' : 'Untitled image'),
        productId: productId ?? null,
        shape: defaults.defaultShape,
        format: defaults.defaultFormat,
        draft
      })
      context.refreshMenu()
      return buildDetail(context, project)
    }
  )

  registerIpc(context, 'projects:createFromImage', z.object({ sourceImageId: idSchema, name: z.string().max(140).optional(), type: projectTypeSchema.optional() }), async ({ sourceImageId, name, type }) => {
    const image = context.images.get(sourceImageId)
    if (!image || image.status !== 'ready' || !image.url) throw new IpcFault('not_found')
    const sourceProject = context.projects.get(image.projectId)
    if (!sourceProject) throw new IpcFault('not_found')
    const relative = decodeURI(image.url.replace('moss-media://library/', ''))
    const bytes = await fs.readFile(path.join(context.libraryPath(), relative))
    const createdType = type ?? 'photo'
    const defaults = settings.all()
    const project = context.projects.create({
      type: createdType,
      name: name?.trim() || sourceProject.name,
      productId: sourceProject.productId,
      shape: defaults.defaultShape,
      format: defaults.defaultFormat
    })
    try {
      await context.media.importSource({
        projectId: project.id,
        bytes,
        name: `${project.name}.${image.format === 'jpeg' ? 'jpg' : image.format}`,
        setId: image.setId
      })
      context.refreshMenu()
    } catch (error) {
      await context.media.deleteProjectFiles(project.id)
      context.projects.delete(project.id)
      throw error
    }
    context.refreshMenu()
    return buildDetail(context, context.projects.get(project.id)!)
  })

  registerIpc(context, 'products:list', voidSchema, (): Product[] => context.products.list())
  registerIpc(context, 'products:listArchived', voidSchema, (): Product[] => context.products.listArchived())

  registerIpc(context, 'products:detail', z.object({ id: idSchema }), ({ id }): ProductDetail => {
    if (isBundledProduct(id)) throw new IpcFault('invalid_payload', 'Included products do not have a product page.')
    return context.productService.detail(id)
  })

  registerIpc(
    context,
    'products:update',
    z.object({
      id: idSchema,
      patch: z.object({
        name: z.string().trim().min(1).max(80).optional(),
        category: z.string().max(40).nullable().optional(),
        status: z.enum(['active', 'archived']).optional()
      })
    }),
    ({ id, patch }): Product => {
      if (isBundledProduct(id)) throw new IpcFault('invalid_payload')
      const product = context.products.update(id, patch)
      if (!product) throw new IpcFault('not_found')
      return product
    }
  )

  registerIpc(context, 'products:archive', z.object({ id: idSchema }), ({ id }): Product => {
    if (isBundledProduct(id)) throw new IpcFault('invalid_payload')
    const product = context.products.archive(id)
    if (!product) throw new IpcFault('not_found')
    return product
  })

  registerIpc(context, 'products:unarchive', z.object({ id: idSchema }), ({ id }): Product => {
    if (isBundledProduct(id)) throw new IpcFault('invalid_payload')
    const product = context.products.unarchive(id)
    if (!product) throw new IpcFault('not_found')
    return product
  })

  registerIpc(
    context,
    'products:createFromProject',
    z.object({ projectId: idSchema, name: z.string().max(80).optional() }),
    ({ projectId, name }) => context.productService.createFromProject({ projectId, name })
  )

  registerIpc(
    context,
    'products:linkProject',
    z.object({ productId: idSchema, projectId: idSchema }),
    ({ productId, projectId }) => context.productService.linkProject(productId, projectId)
  )

  registerIpc(context, 'products:unlinkProject', z.object({ projectId: idSchema }), ({ projectId }) =>
    context.productService.unlinkProject(projectId)
  )

  registerIpc(
    context,
    'products:createFromImage',
    z.object({ imageId: idSchema, name: z.string().trim().min(1).max(80) }),
    ({ imageId, name }) => context.productService.saveFromImage({ imageId, name })
  )

  registerIpc(
    context,
    'products:createFromBytes',
    z.object({ bytes: bytesSchema, name: z.string().trim().min(1).max(80) }),
    ({ bytes, name }) => context.productService.addFromBytes({ bytes, name })
  )

  registerIpc(context, 'dialog:pickProduct', voidSchema, async (): Promise<Product | null> => {
    const opened = await openFolderDialog(context, {
      title: 'Choose a product photo',
      properties: ['openFile'],
      filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    if (opened.canceled || !opened.filePaths[0]) return null
    const filePath = opened.filePaths[0]
    const stat = await fs.stat(filePath)
    if (stat.size > 40 * 1024 * 1024) throw new IpcFault('too_large')
    const bytes = await fs.readFile(filePath)
    return context.productService.addFromBytes({
      bytes,
      name: path.parse(filePath).name.slice(0, 80) || 'Product'
    })
  })

  registerIpc(
    context,
    'products:rename',
    z.object({ id: idSchema, name: z.string().trim().min(1).max(80) }),
    ({ id, name }): Product => {
      if (isBundledProduct(id)) throw new IpcFault('invalid_payload')
      const product = context.products.rename(id, name.trim())
      if (!product) throw new IpcFault('not_found')
      return product
    }
  )

  registerIpc(context, 'products:delete', z.object({ id: idSchema }), async ({ id }) => {
    await context.productService.delete(id)
    return { ok: true as const }
  })

  registerIpc(
    context,
    'products:assignSet',
    z.object({ productId: idSchema, setId: idSchema.nullable() }),
    ({ productId, setId }) => {
      const product = context.products.get(productId)
      if (!product) throw new IpcFault('not_found')
      if (setId && !context.sets.get(setId)) throw new IpcFault('not_found', 'That Set is not here anymore.')
      const updated = context.products.setSet(productId, setId)
      if (!updated) throw new IpcFault('not_found')
      return updated
    }
  )

  registerIpc(
    context,
    'products:createProject',
    z.object({ productId: idSchema, type: projectTypeSchema, name: z.string().max(140).optional() }),
    async ({ productId, type, name }) => {
      const defaults = settings.all()
      const created = await context.productService.createProject({
        productId,
        type,
        name,
        shape: defaults.defaultShape,
        format: defaults.defaultFormat
      })
      context.refreshMenu()
      return buildDetail(context, context.projects.get(created.projectId)!)
    }
  )

  registerIpc(
    context,
    'products:importIntoProject',
    z.object({ productId: idSchema, projectId: idSchema, label: z.string().max(120).optional() }),
    ({ productId, projectId, label }) => context.productService.importIntoProject({ productId, projectId, label })
  )

  registerIpc(
    context,
    'dialog:importImage',
    z.object({
      projectId: idSchema.optional(),
      kind: z.enum(['source', 'person']),
      type: z.enum(['photo']).optional(),
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
      type: z.enum(['photo']).optional(),
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
    'projects:update',
    z.object({
      id: idSchema,
      patch: z.object({
        name: z.string().min(1).max(140).optional(),
        shape: shapeSchema.optional(),
        format: formatSchema.optional(),
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

  registerIpc(context, 'sets:list', voidSchema, () => context.sets.list())

  registerIpc(
    context,
    'sets:create',
    z.object({ name: z.string().trim().min(1).max(80) }),
    ({ name }) => context.sets.create(name)
  )

  registerIpc(
    context,
    'sets:rename',
    z.object({ id: idSchema, name: z.string().trim().min(1).max(80) }),
    ({ id, name }): SetDetail['set'] => {
      const updated = context.sets.rename(id, name)
      if (!updated) throw new IpcFault('not_found')
      return updated
    }
  )

  registerIpc(context, 'sets:delete', z.object({ id: idSchema }), ({ id }) => {
    if (!context.sets.delete(id)) throw new IpcFault('not_found')
    return { ok: true as const }
  })

  registerIpc(context, 'sets:detail', z.object({ id: idSchema }), ({ id }): SetDetail => {
    const set = context.sets.get(id)
    if (!set) throw new IpcFault('not_found')
    const items = context.images.listBySet(id)
    const products = context.products.listBySet(id)
    return { set, images: items, products, total: items.length + products.length }
  })

  registerIpc(
    context,
    'sets:export',
    z.object({ id: idSchema, options: exportOptionsSchema }),
    async ({ id, options }) => {
      const set = context.sets.get(id)
      if (!set) throw new IpcFault('not_found')
      const images = context.images
        .listBySet(id)
        .map((item) => context.images.get(item.id))
        .filter((image): image is Image => image?.status === 'ready')
      const products = context.products.listBySet(id)
      if (!images.length && !products.length) throw new IpcFault('invalid_payload', 'This Set has no images yet.')
      const key = `set:${id}`
      const pick = await openFolderDialog(context, {
        title: 'Choose where to export the Set',
        defaultPath: settings.exportFolderFor(key) ?? app.getPath('pictures'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (pick.canceled || !pick.filePaths[0]) return { count: 0, folderName: '', warnings: [] }
      const result = await exportSetImages({
        libraryPath: context.libraryPath(),
        name: set.name,
        images,
        products,
        options,
        parentFolder: pick.filePaths[0],
        workingPathFor: (image) => workingFor(context.libraryPath(), image.projectId, image.id)
      })
      if (result.count > 0) settings.rememberExportFolder(key, result.folder)
      return { count: result.count, folderName: result.folderName, warnings: result.warnings }
    }
  )

  registerIpc(
    context,
    'media:inspect',
    z.object({ imageId: idSchema }),
    ({ imageId }) => context.media.inspectImage(imageId)
  )

  registerIpc(
    context,
    'media:importFromImage',
    z.object({ projectId: idSchema, imageId: idSchema }),
    ({ projectId, imageId }) => context.media.importFromImage({ projectId, imageId })
  )

  registerIpc(
    context,
    'images:list',
    z.object({ projectId: idSchema, includeFailed: z.boolean().optional() }),
    ({ projectId, includeFailed }) => {
      if (!context.projects.get(projectId)) throw new IpcFault('not_found')
      return context.images.list(projectId, includeFailed ?? false)
    }
  )

  registerIpc(
    context,
    'images:library',
    z.object({
      search: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional()
    }),
    (request) => context.images.listLibrary(request)
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
    const project = context.projects.get(image.projectId)
    context.images.softDelete(id)
    if (project?.coverImageId === id) {
      const ready = context.images.list(project.id, false)
      const next = ready[0]
      context.projects.update(project.id, { coverImageId: next?.id ?? null })
    }
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

  registerIpc(
    context,
    'images:assignSet',
    z.object({ imageId: idSchema, setId: idSchema.nullable() }),
    ({ imageId, setId }) => {
      const image = context.images.get(imageId)
      if (!image || image.status !== 'ready') throw new IpcFault('invalid_payload', 'That image is not ready yet.')
      if (setId && !context.sets.get(setId)) throw new IpcFault('not_found', 'That Set is not here anymore.')
      const updated = context.images.setSet(imageId, setId)
      if (!updated) throw new IpcFault('not_found')
      return updated
    }
  )

  registerIpc(
    context,
    'jobs:startCreate',
    z.object({
      projectId: idSchema,
      prompt: z.string().min(1).max(MAX_PROMPT),
      count: z.number().int().min(1).max(4),
      shape: shapeSchema,
      format: formatSchema,
      sourceImageId: z.string().optional(),
      productId: z.string().optional(),
      personId: z.string().optional(),
      personLook: z.string().max(80).optional(),
      sceneImageId: z.string().optional()
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
      sceneImageId: z.string().optional(),
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
    'adjust:applyBatch',
    z.object({ projectId: idSchema, transform: adjustSchema }),
    async ({ projectId, transform }): Promise<{ count: number }> => {
      const project = context.projects.get(projectId)
      if (!project) throw new IpcFault('not_found')
      if (context.images.list(projectId).length > 50) {
        throw new IpcFault('invalid_payload', 'That project has more than 50 ready images. Batch color is limited to 50 at a time.')
      }
      const colorOnly = {
        brightness: transform.brightness ?? 0,
        contrast: transform.contrast ?? 0,
        saturation: transform.saturation ?? 0,
        warmth: transform.warmth ?? 0,
        sharpen: transform.sharpen ?? 0,
        vignette: transform.vignette ?? 0
      }
      if (!Object.values(colorOnly).some((value) => value !== 0)) {
        throw new IpcFault('invalid_payload', 'Change a light or color control before applying the batch.')
      }
      const result = await context.media.applyBatchColor(projectId, colorOnly)
      context.usage.record({
        projectId,
        projectName: project.name,
        action: 'adjust',
        requestedN: result.count,
        returnedN: result.count,
        costCents: 0,
        costMicros: 0,
        durationMs: 0,
        result: 'ok'
      })
      return { count: result.count }
    }
  )

  registerIpc(
    context,
    'adjust:sizeLabel',
    z.object({
      imageId: idSchema,
      width: z.number().positive().max(10_000),
      height: z.number().positive().max(10_000),
      unit: z.enum(['cm', 'in'])
    }),
    async ({ imageId, width, height, unit }): Promise<{ imageId: string }> => {
      const source = context.images.get(imageId)
      if (!source || source.status !== 'ready') throw new IpcFault('not_found')
      const sourcePath = source.kind === 'upload'
        ? workingFor(context.libraryPath(), source.projectId, source.id)
        : path.join(context.libraryPath(), decodeURI(source.url!.replace('moss-media://library/', '')))
      const newId = crypto.randomUUID()
      const result = await addSizeLabel({
        libraryPath: context.libraryPath(),
        sourcePath,
        imageId: newId,
        projectId: source.projectId,
        width,
        height,
        unit
      })
      const label = nextCountedLabel('Size', context.images.labels(source.projectId))
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
        userText: 'Size label',
        personId: source.personId,
        setId: source.setId,
        label,
        parentId: source.id,
        rootId: source.rootId ?? source.id,
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
      const label = nextCountedLabel('Adjusted', labels)
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
        personId: source.personId,
        setId: source.setId,
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
  registerIpc(
    context,
    'people:createFromImage',
    z.object({ imageId: idSchema, name: z.string().trim().min(1).max(80) }),
    async ({ imageId, name }) => {
      const image = context.images.get(imageId)
      if (!image || image.status !== 'ready' || !image.url) throw new IpcFault('not_found')
      const relative = decodeURI(image.url.replace('moss-media://library/', ''))
      const bytes = await fs.readFile(path.join(context.libraryPath(), relative))
      const created = await context.media.importPerson({ name, bytes })
      const person = context.people.getUser(created.personId)
      if (!person) throw new IpcFault('unknown')
      return person
    }
  )
  registerIpc(context, 'people:rename', z.object({ id: idSchema, name: z.string().trim().min(1).max(80) }), ({ id, name }) => {
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
  registerIpc(
    context,
    'people:createImageProject',
    z.object({ id: idSchema, look: z.string().max(40).optional() }),
    async ({ id, look }) => {
      const person = context.people.list().find((entry) => entry.id === id)
      if (!person) throw new IpcFault('not_found')
      const requestedLook = look && look !== 'original' ? look : null
      const reference = requestedLook ? context.people.refFor(id, requestedLook) : null
      if (requestedLook && !reference) throw new IpcFault('invalid_payload')
      let bytes: Buffer
      if (person.source === 'user') {
        const row = context.people.getRow(id)
        if (!row?.thumb && !row?.ref_file) throw new IpcFault('not_found')
        bytes = await fs.readFile(absoluteInLibrary(context.libraryPath(), row.thumb ?? row.ref_file))
      } else {
        const file = reference?.file ?? `people/${id}.webp`
        bytes = await fs.readFile(path.join(context.resourceRoot(), file))
      }
      const project = context.projects.create({
        type: 'image',
        name: `${person.name} image`,
        personLook: requestedLook
      })
      try {
        const imported = await context.media.importSource({
          projectId: project.id,
          bytes,
          personId: person.id,
          label: person.name
        })
        if (!imported.imageId) throw new IpcFault('unknown')
        return { projectId: project.id, imageId: imported.imageId }
      } catch (error) {
        await context.media.deleteProjectFiles(project.id).catch(() => undefined)
        context.projects.delete(project.id)
        throw error
      }
    }
  )

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
    const header = 'date,project,action,requested,returned,cost_usd,cost_micros,duration_ms,result,error'
    const lines = rows.map((row) =>
      [
        new Date(row.at).toISOString(),
        csvField(row.projectName),
        row.action,
        row.requested,
        row.returned,
        row.uncertainBilling ? '' : (row.costCents / 100).toFixed(2),
        row.costMicros,
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
    if (result.canceled || !result.filePath) return { saved: false }
    await fs.writeFile(result.filePath, `${header}\n${lines.join('\n')}\n`, 'utf8')
    return { saved: true }
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
      const base = safeBaseName(options.filename?.replace(/\.[^.]+$/, '') || (images.length === 1 ? images[0]!.label : project.name), 'image')
      const workingPathFor = (image: Image): string => workingFor(context.libraryPath(), image.projectId, image.id)
      if (images.length === 1) {
        const defaultFolder = settings.exportFolderFor(projectId) ?? app.getPath('pictures')
        const picked = await saveFileDialog(context, {
          title: 'Export image',
          defaultPath: path.join(defaultFolder, `${base}.${extension}`),
          filters: [{ name: options.format.toUpperCase(), extensions: [extension] }]
        })
        if (picked.canceled || !picked.filePath) return { count: 0, folderName: '' }
        const destination = picked.filePath.endsWith(`.${extension}`) ? picked.filePath : `${picked.filePath}.${extension}`
        const written = await exportImageToPath({
          libraryPath: context.libraryPath(),
          image: images[0]!,
          workingPath: workingPathFor(images[0]!),
          options,
          destinationPath: destination
        })
        settings.rememberExportFolder(projectId, path.dirname(destination))
        return { count: 1, folderName: path.basename(path.dirname(written)) }
      }
      const pick = await openFolderDialog(context, { title: 'Choose an export folder', properties: ['openDirectory', 'createDirectory'] })
      if (pick.canceled || !pick.filePaths[0]) return { count: 0, folderName: '' }
      const folder = pick.filePaths[0]
      settings.rememberExportFolder(projectId, folder)
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
      return { count: paths.length, folderName: path.basename(folder!) }
    }
  )

  registerIpc(context, 'app:reset', voidSchema, async () => {
    // A development-only factory reset. Packaged builds hide the control and
    // refuse the channel so a renderer compromise cannot wipe a seller's data.
    if (app.isPackaged) throw new IpcFault('forbidden')
    const userDataDir = path.resolve(context.userDataDir)
    const sqlite = path.join(userDataDir, 'library.sqlite')
    const looksLikeAppData = await fs
      .stat(sqlite)
      .then((stat) => stat.isFile())
      .catch(() => false)
    if (
      userDataDir === path.parse(userDataDir).root ||
      userDataDir === path.resolve(app.getPath('home')) ||
      !looksLikeAppData
    ) {
      throw new IpcFault('unknown', 'The app data folder could not be verified.')
    }
    context.logger.info('app', 'reset')
    context.db.close()
    await fs.rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    setTimeout(() => app.exit(0), 100)
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
