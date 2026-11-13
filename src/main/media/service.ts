import fs from 'node:fs/promises'
import path from 'node:path'
import type { Image, ImportResult, PhotoCheck, Project } from '@shared/types'
import { shapeForImage } from '@shared/shapes'
import { uploadLabel } from '@shared/labels'
import type { ProjectRepository } from '../db/repositories/projects'
import type { ImageRepository } from '../db/repositories/images'
import type { PeopleRepository } from '../db/repositories/people'
import type { BrandRepository } from '../db/repositories/brand'
import type { PlanRepository } from '../db/repositories/plans'
import type { Logger } from '../logger'
import {
  ImageImportError,
  assertImportable,
  normaliseLogo,
  normalisePersonReference,
  normaliseToWorking,
  writeOriginal
} from './import'
import { absoluteInLibrary, originalRelative, workingFor } from './paths'
import { inspectPhoto } from './preflight'

export class MediaService {
  constructor(
    private readonly deps: {
      projects: ProjectRepository
      images: ImageRepository
      people: PeopleRepository
      brand: BrandRepository
      plans: PlanRepository
      libraryPath: () => string
      logger: Logger
    }
  ) {}

  private readonly importChains = new Map<string, Promise<unknown>>()

  async inspectImage(imageId: string): Promise<PhotoCheck | null> {
    const image = this.deps.images.get(imageId)
    if (!image) return null
    let bytes: Buffer | null = null
    try {
      bytes = await fs.readFile(workingFor(this.deps.libraryPath(), image.projectId, image.id))
    } catch {
      // A failed or partial import may only have the original.
    }
    if (!bytes && image.url) {
      try {
        bytes = await fs.readFile(
          absoluteInLibrary(this.deps.libraryPath(), decodeURI(image.url.replace('moss-media://library/', '')))
        )
      } catch {
        // Report no check below.
      }
    }
    if (!bytes) return null
    try {
      return await inspectPhoto(bytes)
    } catch {
      return null
    }
  }

  /**
   * A project's first source is named `source.<ext>`. Two imports racing each
   * other would both see an empty project and choose that name, so the second
   * would overwrite the first original. Serialize imports per project.
   */
  async importSource(input: {
    projectId: string
    bytes: Uint8Array
    name?: string
    label?: string
    personId?: string | null
  }): Promise<ImportResult> {
    const previous = this.importChains.get(input.projectId) ?? Promise.resolve()
    const next = previous.then(
      () => this.importSourceNow(input),
      () => this.importSourceNow(input)
    )
    const tail = next.then(
      () => undefined,
      () => undefined
    )
    this.importChains.set(input.projectId, tail)
    void tail.finally(() => {
      if (this.importChains.get(input.projectId) === tail) this.importChains.delete(input.projectId)
    })
    return next
  }

  private async importSourceNow(input: {
    projectId: string
    bytes: Uint8Array
    name?: string
    label?: string
    personId?: string | null
  }): Promise<ImportResult> {
    const project = this.deps.projects.get(input.projectId)
    if (!project) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    const format = assertImportable(input.bytes)
    const imageId = crypto.randomUUID()
    const existingRows = this.deps.images.list(input.projectId, true)
    const first = existingRows.length === 0
    let relative = originalRelative(input.projectId, imageId, format, first)
    try {
      await fs.access(absoluteInLibrary(this.deps.libraryPath(), relative))
      relative = originalRelative(input.projectId, imageId, format, false)
    } catch {
      // Expected: the source name is free.
    }
    await writeOriginal({
      libraryPath: this.deps.libraryPath(),
      relative,
      bytes: input.bytes
    })
    let normalised
    try {
      normalised = await normaliseToWorking({
        libraryPath: this.deps.libraryPath(),
        projectId: input.projectId,
        imageId,
        bytes: input.bytes
      })
    } catch (error) {
      await fs.rm(absoluteInLibrary(this.deps.libraryPath(), relative), { force: true })
      throw error
    }
    const labels = existingRows.map((image) => image.label)
    const image = this.deps.images.create({
      id: imageId,
      projectId: input.projectId,
      kind: 'upload',
      status: 'ready',
      file: relative,
      thumb: normalised.thumbRelative,
      width: normalised.width,
      height: normalised.height,
      format,
      personId: input.personId ?? null,
      label: input.label ?? uploadLabel(labels),
      isOriginal: first,
      costCents: 0
    })
    if (first && project.type === 'photo') {
      this.deps.projects.update(project.id, { shape: shapeForImage(normalised.width, normalised.height) })
    }
    if (first && input.name) {
      const base = input.name.replace(/\.[^.]+$/, '')
      const clean = base.trim().slice(0, 120)
      if (clean) this.deps.projects.rename(project.id, clean)
    }
    this.deps.logger.info('media', 'source_imported', {
      count: 1,
      durationMs: 0
    })
    return {
      projectId: input.projectId,
      imageId: image.id,
      width: normalised.width,
      height: normalised.height
    }
  }

  async importFromImage(input: { projectId: string; imageId: string }): Promise<ImportResult> {
    const target = this.deps.projects.get(input.projectId)
    if (!target) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    const image = this.deps.images.get(input.imageId)
    if (!image || image.status !== 'ready') {
      throw new ImageImportError('unreadable', 'That photo is not here anymore.')
    }
    let bytes: Buffer | null = null
    try {
      bytes = await fs.readFile(workingFor(this.deps.libraryPath(), image.projectId, image.id))
    } catch {
      // Older rows may only have their original file.
    }
    if (!bytes && image.url) {
      try {
        bytes = await fs.readFile(
          absoluteInLibrary(this.deps.libraryPath(), decodeURI(image.url.replace('moss-media://library/', '')))
        )
      } catch {
        // Report not_found below.
      }
    }
    if (!bytes) throw new ImageImportError('unreadable', 'That photo is not here anymore.')
    return this.importSource({
      projectId: input.projectId,
      bytes,
      label: image.label,
      personId: image.personId
    })
  }

  async importPerson(input: { name: string; bytes: Uint8Array }): Promise<{ personId: string }> {
    assertImportable(input.bytes)
    const id = crypto.randomUUID()
    const normalised = await normalisePersonReference({
      libraryPath: this.deps.libraryPath(),
      personId: id,
      bytes: input.bytes
    })
    this.deps.people.create({
      id,
      name: input.name.trim().slice(0, 80) || 'New person',
      refFile: normalised.ref,
      thumb: normalised.thumb
    })
    return { personId: id }
  }

  async setLogo(input: { bytes: Uint8Array; mime: string }): Promise<{ logoFile: string }> {
    const result = await normaliseLogo({
      libraryPath: this.deps.libraryPath(),
      bytes: input.bytes,
      mime: input.mime
    })
    this.deps.brand.setLogo(result.file)
    return { logoFile: result.file }
  }

  async clearLogo(): Promise<void> {
    await fs.rm(absoluteInLibrary(this.deps.libraryPath(), 'brand/logo.png'), { force: true })
    await fs.rm(absoluteInLibrary(this.deps.libraryPath(), 'brand/logo.webp'), { force: true })
    this.deps.brand.setLogo(null)
  }

  async deleteProjectFiles(projectId: string): Promise<void> {
    await fs.rm(absoluteInLibrary(this.deps.libraryPath(), path.posix.join('projects', projectId)), {
      recursive: true,
      force: true
    })
  }

  async deleteImages(images: Image[]): Promise<void> {
    for (const image of images) {
      for (const relative of this.relativeFilesForImage(image)) {
        await fs.rm(absoluteInLibrary(this.deps.libraryPath(), relative), { force: true })
      }
    }
  }

  relativeFilesForImage(image: Image): string[] {
    const files: string[] = []
    const fromUrl = (url: string | null): string | null =>
      url ? decodeURI(url.replace('moss-media://library/', '')) : null
    const file = fromUrl(image.url)
    const thumb = fromUrl(image.thumbUrl)
    if (file) files.push(file)
    if (thumb) files.push(thumb)
    files.push(path.posix.join('projects', image.projectId, 'working', `${image.id}.webp`))
    return [...new Set(files)]
  }

  async duplicateProject(project: Project): Promise<{ projectId: string }> {
    const detail = this.deps.projects.get(project.id)
    if (!detail) throw new Error('project_missing')
    const newProject = this.deps.projects.create({
      type: detail.type,
      name: `${detail.name} copy`.slice(0, 140),
      category: detail.category,
      shape: detail.shape,
      format: detail.format
    })
    const newRoot = absoluteInLibrary(this.deps.libraryPath(), path.posix.join('projects', newProject.id))
    const oldRoot = absoluteInLibrary(this.deps.libraryPath(), path.posix.join('projects', project.id))
    await fs.mkdir(newRoot, { recursive: true })
    const entries = await fs.readdir(oldRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'exports') continue
      const source = path.join(oldRoot, entry.name)
      const target = path.join(newRoot, entry.name)
      await fs.cp(source, target, { recursive: true, force: false })
    }
    const images = this.deps.images.list(project.id, true)
    const idMap = new Map<string, string>()
    const oldPlan = this.deps.projects.row(project.id)
    const planRecord = oldPlan?.active_plan_id
      ? this.deps.plans.getById(String(oldPlan.active_plan_id))
      : null
    for (const image of images) {
      idMap.set(image.id, crypto.randomUUID())
    }
    for (const image of images) {
      const newId = idMap.get(image.id)!
      const parent = image.parentId ? idMap.get(image.parentId) ?? null : null
      const root = image.rootId ? idMap.get(image.rootId) ?? newId : newId
      const fileRelative = image.url ? decodeURI(image.url.replace('moss-media://library/', '')) : null
      const thumbRelative = image.thumbUrl ? decodeURI(image.thumbUrl.replace('moss-media://library/', '')) : null
      const newFile = fileRelative?.replace(`projects/${project.id}/`, `projects/${newProject.id}/`) ?? null
      const newThumb = thumbRelative?.replace(`projects/${project.id}/`, `projects/${newProject.id}/`) ?? null
      const oldWorking = absoluteInLibrary(this.deps.libraryPath(), path.posix.join('projects', project.id, 'working', `${image.id}.webp`))
      const newWorking = absoluteInLibrary(this.deps.libraryPath(), path.posix.join('projects', newProject.id, 'working', `${newId}.webp`))
      await fs.mkdir(path.dirname(newWorking), { recursive: true })
      await fs.copyFile(oldWorking, newWorking).catch(() => undefined)
      this.deps.images.create({
        id: newId,
        projectId: newProject.id,
        kind: image.kind,
        status: image.status,
        file: newFile,
        thumb: newThumb,
        width: image.width,
        height: image.height,
        format: image.format,
        prompt: image.prompt,
        userText: image.userText,
        revisedPrompt: image.revisedPrompt,
        templateId: image.templateId,
        shotId: image.shotId,
        personId: image.personId,
        label: image.label,
        parentId: parent,
        rootId: root,
        adjust: image.adjust,
        badge: image.badge,
        isOriginal: image.isOriginal,
        costCents: 0
      })
    }
    if (planRecord) {
      this.deps.plans.save(newProject.id, planRecord.json)
    }
    const newCover = detail.coverImageId ? idMap.get(detail.coverImageId) ?? null : null
    const newSource = detail.sourceImageId ? idMap.get(detail.sourceImageId) ?? null : null
    const updated = this.deps.projects.update(newProject.id, {
      coverImageId: newCover,
      sourceImageId: newSource
    })
    if (!updated) throw new Error('duplicate_failed')
    return { projectId: updated.id }
  }
}
