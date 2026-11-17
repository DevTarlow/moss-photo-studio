import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  CreateJobInput,
  EditJobInput,
  ErrorCode,
  Format,
  Image,
  JobItemState,
  JobKind,
  JobState,
  Project,
  Shape
} from '@shared/types'
import { estimateCents, monthBounds, monthKey } from '@shared/cost'
import { MAX_CREATE_VARIANTS, MAX_PROMPT } from '@shared/constants'
import { usedBrandColors } from '@shared/brandColors'
import { appendWithinCap, composeChange, composeCreatePrompt, productNotesClause, PROMPT_MAX } from '@shared/prompts/guards'
import { styleClause } from '@shared/stylePresets'
import { nextCountedLabel } from '@shared/labels'
import { templateById, templateWord } from '@shared/prompts/templates'
import { safeBaseName } from '@shared/files'
import { billingUncertain } from '@shared/errors'
import type { ImageProvider } from '../muse/provider'
import type { Logger } from '../logger'
import type { ProjectRepository } from '../db/repositories/projects'
import type { ImageRepository } from '../db/repositories/images'
import type { JobRepository, JobSnapshot } from '../db/repositories/jobs'
import type { UsageRepository } from '../db/repositories/usage'
import type { BrandRepository } from '../db/repositories/brand'
import type { PeopleRepository } from '../db/repositories/people'
import type { ProductRepository } from '../db/repositories/products'
import type { SceneRepository } from '../db/repositories/scenes'
import type { SettingsStore } from '../settings'
import type { SecretStore } from '../secrets'
import type { LicenseController } from '../license/controller'
import { absoluteInLibrary, workingFor, imageRelative } from '../media/paths'
import { applyBadge } from '../media/badge'
import { generateThumbnail, saveResultImage } from '../media/import'
import { hasDiskRoom } from '../media/disk'


export class JobStartError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'JobStartError'
  }
}

type Action = 'create' | 'edit'

interface WorkItemSpec {
  key: string
  label: string
  prompt: string
  requested: number
  sourceImageId: string | null
  productId: string | null
  personId: string | null
  personLook: string | null
  sceneImageId: string | null
  sceneId: string | null
  shape: Shape
  format: Format
  userText: string
  templateId: string | null
  setId: string | null
  action: Action
  labelWord: 'Scene' | 'Person' | 'Edit' | 'Image' | null
  pendingImageId?: string
  parentId: string | null
  rootId: string | null
  createMode: boolean
}

interface JobWork {
  kind: JobKind
  projectId: string
  projectName: string
  items: WorkItemSpec[]
  sourceImageId?: string | null
}

interface RuntimeItem {
  spec: WorkItemSpec
  state: JobItemState
  storedCount: number
  imageIds: string[]
  pendingRowId: string | null
}

interface JobRun {
  state: JobState
  work: JobWork
  items: RuntimeItem[]
  cancelRequested: boolean
  finished: boolean
  activeCount: number
  reservation: string | null
}

interface QueueDeps {
  projects: ProjectRepository
  images: ImageRepository
  jobs: JobRepository
  usage: UsageRepository
  brand: BrandRepository
  people: PeopleRepository
  products: ProductRepository
  scenes: SceneRepository
  settings: SettingsStore
  secrets: SecretStore
  license: LicenseController
  provider: ImageProvider
  libraryPath: () => string
  resourceRoot: () => string
  logger: Logger
  onUpdate: (state: JobState) => void
  now?: () => number
}

interface PersistResult {
  storedCount: number
  returnedCount: number
  imageIds: string[]
  error: ErrorCode | null
}

export class JobQueue {
  private readonly runs = new Map<string, JobRun>()
  private readonly waiting: Array<{ run: JobRun; item: RuntimeItem }> = []
  private inFlight = 0
  /** Estimated cents held by jobs that are running or waiting to start. */
  private reservedCents = 0
  private readonly reservations = new Map<string, number>()
  private readonly now: () => number

  constructor(private readonly deps: QueueDeps) {
    this.now = deps.now ?? (() => Date.now())
  }

  active(): JobState[] {
    return [...this.runs.values()].map((run) => this.snapshotState(run))
  }

  state(jobId: string): JobState | null {
    const run = this.runs.get(jobId)
    if (run) return this.snapshotState(run)
    const row = this.deps.jobs.getRow(jobId)
    return row ? this.deps.jobs.toState(row) : null
  }

  isRunning(projectId: string): boolean {
    return [...this.runs.values()].some((run) => run.state.projectId === projectId && !run.finished)
  }

  async startCreate(input: CreateJobInput): Promise<{ jobId: string }> {
    const project = this.requireProject(input.projectId, 'image')
    await this.requireLicensed()
    await this.requireKey()
    this.requireNoRunningProject(project.id)
    const text = input.prompt.trim()
    if (!text) throw new JobStartError('invalid_payload', 'Describe the image first.')
    if (text.length > MAX_PROMPT) {
      throw new JobStartError('invalid_payload', 'That description is too long. Shorten it and try again.')
    }
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_CREATE_VARIANTS) {
      throw new JobStartError('invalid_payload', 'Choose between 1 and 4 images.')
    }
    if (input.sourceImageId && input.productId) {
      throw new JobStartError('invalid_payload', 'Choose one product photo, not two.')
    }
    let source: Image | null = null
    if (input.sourceImageId) {
      source = this.deps.images.get(input.sourceImageId)
      if (!source || source.status !== 'ready') {
        throw new JobStartError('invalid_payload', 'That photo is not here anymore.')
      }
    }
    if (input.productId && !this.deps.products.exists(input.productId)) {
      throw new JobStartError('invalid_payload', 'That product is not here anymore.')
    }
    if (input.personId && !this.deps.people.exists(input.personId)) {
      throw new JobStartError('invalid_payload', 'Choose a person first.')
    }
    if (input.personLook && !input.personId) {
      throw new JobStartError('invalid_payload', 'Choose a person first.')
    }
    if (input.personId && input.personLook && !this.deps.people.refFor(input.personId, input.personLook)) {
      throw new JobStartError('invalid_payload', 'Choose a person photo first.')
    }
    const legacyPerson = !input.personId && Boolean(source?.personId)
    const hasPerson = Boolean(input.personId) || legacyPerson
    const hasProduct = Boolean(source || input.productId) && !legacyPerson
    if (input.sceneId && input.sceneImageId) {
      throw new JobStartError('invalid_payload', 'Choose one scene.')
    }
    const sceneAsset = input.sceneId ? this.deps.scenes.refFor(input.sceneId) : null
    if (input.sceneId && !sceneAsset) {
      throw new JobStartError('invalid_payload', 'That scene is not here anymore.')
    }
    const scene = input.sceneImageId ? this.deps.images.get(input.sceneImageId) : null
    if (input.sceneImageId && (!scene || scene.status !== 'ready')) {
      throw new JobStartError('invalid_payload', 'That scene is not here anymore.')
    }
    const hasScene = Boolean(input.sceneId || input.sceneImageId)
    if (hasScene && !hasProduct) {
      throw new JobStartError('invalid_payload', 'Choose a product photo before adding a scene.')
    }
    if ((hasPerson || hasProduct || hasScene) && input.count !== 1) {
      throw new JobStartError('invalid_payload', 'A product, person, or scene makes one image at a time.')
    }
    const productNotes = input.productId
      ? this.deps.products.getRow(input.productId)?.notes ?? null
      : project.productId
        ? this.deps.products.getRow(project.productId)?.notes ?? null
        : null
    const prompt = appendWithinCap(
      composeCreatePrompt({ text, hasProduct, hasPerson, hasScene }),
      productNotesClause(productNotes)
    )
    if (prompt.length > PROMPT_MAX) {
      throw new JobStartError(
        'invalid_payload',
        `This product, person, or scene adds ${prompt.length - text.length} characters. Shorten your description by ${prompt.length - PROMPT_MAX}.`
      )
    }
    await this.requireDiskRoom(input.count)
    const reservation = this.requireBudget(estimateCents(input.count))
    const work: JobWork = {
      kind: 'create',
      projectId: project.id,
      projectName: project.name,
      sourceImageId: source?.id ?? null,
      items: [
        {
          key: 'image-1',
          label: `Create ${input.count} ${input.count === 1 ? 'image' : 'images'}`,
          prompt,
          requested: input.count,
          sourceImageId: source?.id ?? null,
          productId: input.productId ?? null,
          personId: input.personId ?? null,
          personLook: input.personLook ?? null,
          sceneImageId: input.sceneImageId ?? null,
          sceneId: input.sceneId ?? null,
          shape: input.shape,
          format: input.format,
          userText: text,
          templateId: null,
          setId: source?.setId ?? null,
          action: 'create',
          labelWord: 'Image',
          parentId: null,
          rootId: null,
          createMode: true
        }
      ]
    }
    try {
      return await this.createJob(work, 'create', reservation)
    } catch (error) {
      this.releaseReservation(reservation)
      throw error
    }
  }

  async startEdit(input: EditJobInput): Promise<{ jobId: string }> {
    const project = this.requireProject(input.projectId, null)
    await this.requireLicensed()
    await this.requireKey()
    this.requireNoRunningProject(project.id)
    const source = this.deps.images.get(input.imageId)
    if (!source || source.status !== 'ready' || source.projectId !== project.id) {
      throw new JobStartError('invalid_payload', 'That version is not here anymore.')
    }
    const text = input.change.trim()
    if (!text) throw new JobStartError('invalid_payload', 'Describe the change first.')
    if (text.length > MAX_PROMPT) {
      throw new JobStartError(
        'invalid_payload',
        `That's ${text.length - MAX_PROMPT} characters over. Shorten it and try again.`
      )
    }
    if (input.kind === 'model' && !input.personId) {
      throw new JobStartError('invalid_payload', 'Choose a person for this change.')
    }
    if (input.personId && !this.deps.people.exists(input.personId)) {
      throw new JobStartError('invalid_payload', 'Choose a person for this change.')
    }
    if (input.sceneId && input.sceneImageId) {
      throw new JobStartError('invalid_payload', 'Choose one scene.')
    }
    if (input.sceneId && !this.deps.scenes.refFor(input.sceneId)) {
      throw new JobStartError('invalid_payload', 'That scene is not here anymore.')
    }
    if (input.sceneImageId) {
      const scene = this.deps.images.get(input.sceneImageId)
      if (!scene || scene.status !== 'ready') {
        throw new JobStartError('invalid_payload', 'That scene is not here anymore.')
      }
    }
    const template = input.templateId ? templateById(input.templateId) : undefined
    const brand = this.deps.brand.get()
    const palette = brand.colorsEnabled
      ? usedBrandColors(input.palette?.length ? input.palette : brand.colors)
      : []
    const prompt = appendWithinCap(
      composeChange({
        text,
        kind: input.kind,
        hasReference: true,
        hasPerson: Boolean(input.personId),
        hasScene: Boolean(input.sceneId || input.sceneImageId),
        isGiftShot: Boolean(input.isGiftShot || input.templateId === 'gift-ready'),
        palette
      }),
      productNotesClause(project.productId ? this.deps.products.getRow(project.productId)?.notes : null)
    )
    if (prompt.length > PROMPT_MAX) {
      throw new JobStartError(
        'invalid_payload',
        `That's ${text.length - MAX_PROMPT} characters over. Shorten it and try again.`
      )
    }
    await this.requireDiskRoom(1)
    const reservation = this.requireBudget(estimateCents(1))
    const word = template ? templateWord(template) : input.kind === 'scene' ? 'Scene' : input.kind === 'model' ? 'Person' : 'Edit'
    const work: JobWork = {
      kind: 'edit',
      projectId: project.id,
      projectName: project.name,
      sourceImageId: source.id,
      items: [
        {
          key: 'edit-1',
          label: word,
          prompt,
          requested: 1,
          sourceImageId: source.id,
          productId: null,
          personId: input.personId ?? null,
          personLook: null,
          sceneImageId: input.sceneImageId ?? null,
          sceneId: input.sceneId ?? null,
          shape: project.shape,
          format: project.format,
          userText: text,
          templateId: input.templateId ?? (input.kind === 'model' ? 'model-free' : null),
          setId: source.setId,
          action: 'edit',
          labelWord: word,
          parentId: source.id,
          rootId: source.rootId ?? source.id,
          createMode: false
        }
      ]
    }
    try {
      return await this.createJob(work, 'edit', reservation)
    } catch (error) {
      this.releaseReservation(reservation)
      throw error
    }
  }

  async retryFailed(jobId: string): Promise<{ jobId: string }> {
    await this.requireLicensed()
    await this.requireKey()
    const row = this.deps.jobs.getRow(jobId)
    if (!row) throw new JobStartError('not_found', 'That run is not here anymore.')
    if (this.runs.has(jobId)) throw new JobStartError('already_running')
    const snapshot = this.deps.jobs.snapshot(jobId) as (JobSnapshot & { work?: JobWork }) | null
    const oldWork = snapshot?.work
    const oldItems = this.deps.jobs.toState(row).items
    if (!oldWork) {
      throw new JobStartError('invalid_request', 'Try that again from the project.')
    }
    const missing = new Map<string, number>()
    for (const item of oldItems) {
      if (item.status === 'failed') {
        missing.set(item.key, Math.max(1, item.requested))
      } else if (item.status === 'partial') {
        const count = Math.max(0, item.requested - item.returned)
        if (count) missing.set(item.key, count)
      }
    }
    if (!missing.size) {
      throw new JobStartError('invalid_payload', 'There are no failed or incomplete images to try again.')
    }
    const project = this.requireProject(oldWork.projectId, null)
    this.requireNoRunningProject(project.id)
    const specs = oldWork.items
      .filter((item) => missing.has(item.key))
      .map((item) => {
        const requested = missing.get(item.key) ?? item.requested
        return {
          ...item,
          requested,
          label: item.createMode ? `Create ${requested} ${requested === 1 ? 'image' : 'images'}` : item.label,
          pendingImageId: undefined
        }
      })
    if (!specs.length) throw new JobStartError('invalid_payload', 'There are no failed or incomplete images to try again.')
    const estimate = estimateCents(specs.reduce((sum, item) => sum + item.requested, 0))
    await this.requireDiskRoom(estimate)
    const reservation = this.requireBudget(estimate)
    const work: JobWork = {
      ...oldWork,
      projectName: project.name,
      items: specs
    }
    try {
      return await this.createJob(work, work.kind, reservation)
    } catch (error) {
      this.releaseReservation(reservation)
      throw error
    }
  }

  cancel(jobId: string): void {
    const run = this.runs.get(jobId)
    if (!run || run.finished) return
    run.cancelRequested = true
    for (const item of run.items) {
      if (item.state.status === 'queued') {
        item.state.status = 'cancelled'
        item.state.finishedAt = this.now()
        this.removeWaiting(run, item)
        if (item.pendingRowId) {
          this.deps.images.removePending(item.pendingRowId)
          item.pendingRowId = null
        }
      }
    }
    this.persist(run)
    this.deps.onUpdate(this.snapshotState(run))
    if (run.activeCount === 0) this.finalise(run)
  }

  private requireProject(projectId: string, expected: 'photo' | 'image' | null): Project {
    const project = this.deps.projects.get(projectId)
    if (!project) throw new JobStartError('not_found', 'That project is not here anymore.')
    if (expected && project.type !== expected) {
      throw new JobStartError('invalid_payload', 'That project cannot make this kind of image.')
    }
    return project
  }

  private async requireLicensed(): Promise<void> {
    if (!(await this.deps.license.canGenerate())) {
      throw new JobStartError('unlicensed', 'Reactivate to make images.')
    }
  }

  private async requireKey(): Promise<void> {
    if (!this.deps.secrets.hasKey() || !(await this.deps.secrets.read())) {
      throw new JobStartError('no_key', 'Add your Meta key in Settings to make images.')
    }
  }

  private requireNoRunningProject(projectId: string): void {
    if (this.isRunning(projectId) || this.deps.jobs.runningForProject(projectId)) {
      throw new JobStartError('already_running', 'This project is already making images.')
    }
    if (this.runs.size >= 2) {
      throw new JobStartError('already_running', 'The studio is already making images in two projects. Wait for one to finish.')
    }
  }

  private async requireDiskRoom(images: number): Promise<void> {
    const needed = 64 * 1024 * 1024 + images * 8 * 1024 * 1024
    if (!(await hasDiskRoom(this.deps.libraryPath(), needed))) {
      throw new JobStartError(
        'disk_full',
        'There is not enough free space to save the next images. Free some space and try again.'
      )
    }
  }

  private requireBudget(estimate: number): string | null {
    const cap = this.deps.settings.budgetCents()
    if (cap === null) return null
    const bounds = monthBounds(monthKey(new Date(this.now())))
    const spent = this.deps.usage.monthTotal(bounds.start, bounds.end)
    if (spent + this.reservedCents + estimate > cap) {
      const limit = `$${(cap / 100).toFixed(2)}`
      throw new JobStartError(
        'budget',
        `This run would pass your ${limit} monthly limit. Raise it in Usage, or make fewer images.`
      )
    }
    const token = crypto.randomUUID()
    this.reservations.set(token, estimate)
    this.reservedCents += estimate
    return token
  }

  private releaseReservation(token: string | null): void {
    if (!token) return
    const amount = this.reservations.get(token)
    if (amount === undefined) return
    this.reservedCents = Math.max(0, this.reservedCents - amount)
    this.reservations.delete(token)
  }

  private async createJob(work: JobWork, kind: JobKind, reservation: string | null): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID()
    const items: RuntimeItem[] = []
    let labels = this.deps.images.labels(work.projectId)
    try {
      for (const spec of work.items) {
        let pendingRowId: string | null = null
        let label = spec.label
        if (!spec.createMode) {
          const word = spec.labelWord ?? 'Edit'
          label = nextCountedLabel(word, labels)
          labels = [...labels, label]
          const row = this.deps.images.create({
            projectId: work.projectId,
            kind: 'render',
            status: 'pending',
            label,
            prompt: spec.prompt,
            userText: spec.userText,
            templateId: spec.templateId,
            personId: spec.personId,
            setId: spec.setId,
            parentId: spec.parentId,
            rootId: spec.rootId,
            size: `${spec.shape}`,
            format: spec.format,
            jobId,
            costCents: 0
          })
          pendingRowId = row.id
        } else {
          label = spec.label
        }
        const stateItem: JobItemState = {
          key: spec.key,
          label,
          status: 'queued',
          requested: spec.requested,
          returned: 0
        }
        items.push({
          spec: { ...spec, label, pendingImageId: pendingRowId ?? undefined },
          state: stateItem,
          storedCount: 0,
          imageIds: [],
          pendingRowId
        })
      }
    } catch (error) {
      for (const item of items) {
        if (item.pendingRowId) this.deps.images.removePending(item.pendingRowId)
      }
      throw error
    }
    const total = work.items.reduce((sum, item) => sum + item.requested, 0)
    const state: JobState = {
      id: jobId,
      projectId: work.projectId,
      kind,
      status: 'running',
      total,
      done: 0,
      failed: 0,
      costCents: 0,
      startedAt: this.now(),
      items: items.map((item) => item.state)
    }
    const snapshot = { items: state.items, work: { ...work, items: items.map((item) => item.spec) } }
    this.deps.jobs.create({ id: jobId, projectId: work.projectId, kind, total, snapshot })
    const run: JobRun = {
      state,
      work,
      items,
      cancelRequested: false,
      finished: false,
      activeCount: 0,
      reservation
    }
    items.forEach((item) => this.waiting.push({ run, item }))
    this.runs.set(jobId, run)
    this.deps.onUpdate(this.snapshotState(run))
    this.tick()
    return { jobId }
  }

  private removeWaiting(run: JobRun, item: RuntimeItem): void {
    for (let index = this.waiting.length - 1; index >= 0; index -= 1) {
      const entry = this.waiting[index]
      if (entry?.run === run && entry.item === item) this.waiting.splice(index, 1)
    }
  }

  private tick(): void {
    if (!this.runs.size) return
    const concurrency = Math.max(1, Math.min(4, this.deps.settings.all().concurrency))
    while (this.inFlight < concurrency && this.waiting.length) {
      const next = this.waiting.shift()
      if (!next) break
      const { run, item } = next
      if (run.finished || item.state.status !== 'queued') continue
      if (run.cancelRequested) {
        item.state.status = 'cancelled'
        item.state.finishedAt = this.now()
        if (item.pendingRowId) this.deps.images.removePending(item.pendingRowId)
        this.persist(run)
        continue
      }
      this.inFlight += 1
      run.activeCount += 1
      item.state.status = 'running'
      item.state.startedAt = this.now()
      run.state.currentLabel = item.state.label
      this.persist(run)
      this.deps.onUpdate(this.snapshotState(run))
      void this.executeItem(run, item).finally(() => {
        this.inFlight -= 1
        run.activeCount -= 1
        if (run.activeCount === 0) run.state.currentLabel = undefined
        this.tick()
        if (run.activeCount === 0) this.finaliseIfComplete(run)
      })
    }
  }

  private async executeItem(run: JobRun, item: RuntimeItem): Promise<void> {
    const start = this.now()
    if (!this.deps.secrets.hasKey() || !(await this.deps.secrets.read())) {
      this.failItem(run, item, 'invalid_key', 0, start)
      return
    }
    try {
      const style = styleClause(this.deps.brand.get().stylePreset)
      if (style) item.spec.prompt = appendWithinCap(item.spec.prompt, style)
      const sourceImage = item.spec.sourceImageId ? this.deps.images.get(item.spec.sourceImageId) : null
      const productRow = item.spec.productId ? this.deps.products.getRow(item.spec.productId) : null
      const productPath = sourceImage
        ? this.productWorkingPath(sourceImage)
        : productRow
          ? absoluteInLibrary(this.deps.libraryPath(), productRow.file)
          : null
      const images: Buffer[] = []
      if (productPath) {
        images.push(await fs.readFile(productPath))
      }
      if (item.spec.personId) {
        images.push(await fs.readFile(this.personPath(item.spec.personId, item.spec.personLook)))
      }
      if (item.spec.sceneId) {
        const scene = this.deps.scenes.refFor(item.spec.sceneId)
        if (!scene) throw new Error('scene_missing')
        const root = scene.root === 'bundled' ? this.deps.resourceRoot() : this.deps.libraryPath()
        images.push(await fs.readFile(path.join(root, scene.file)))
      } else if (item.spec.sceneImageId) {
        const scene = this.deps.images.get(item.spec.sceneImageId)
        if (!scene || scene.status !== 'ready') throw new Error('scene_missing')
        images.push(await fs.readFile(workingFor(this.deps.libraryPath(), scene.projectId, scene.id)))
      }
      const onRateLimitWait = (waitMs: number): void => {
        item.state.waiting = waitMs > 0
        if (waitMs > 0) run.state.currentLabel = 'Waiting for Meta'
        else run.state.currentLabel = item.state.label
        this.persist(run)
        this.deps.onUpdate(this.snapshotState(run))
      }
      const result = item.spec.createMode && !item.spec.sourceImageId && !item.spec.productId && !item.spec.personId && !item.spec.sceneImageId && !item.spec.sceneId
        ? await this.deps.provider.generate({
            prompt: item.spec.prompt,
            count: item.spec.requested,
            shape: item.spec.shape,
            format: item.spec.format,
            onRateLimitWait
          })
        : await this.deps.provider.edit({
            prompt: item.spec.prompt,
            images,
            shape: item.spec.shape,
            format: item.spec.format,
            onRateLimitWait
          })
      const durationMs = this.now() - start
      if (!result.ok) {
        this.recordUsage(run, item, 'failed', durationMs, 0, 0, result.code)
        this.failItem(run, item, result.code, durationMs, start)
        return
      }
      const persisted = await this.persistImages(run, item, result.images, result.outputFormat, result.returnedCount)
      if (persisted.error) {
        this.recordUsage(
          run,
          item,
          'failed',
          durationMs,
          result.returnedCount,
          result.returnedCount,
          persisted.error
        )
        item.state.returned = result.returnedCount
        item.state.errorCode = persisted.error
        item.state.uncertainBilling = true
        item.storedCount = persisted.storedCount
        item.imageIds = persisted.imageIds
        if (persisted.imageIds[0]) item.state.imageId = persisted.imageIds[0]
        this.completeItem(run, item, persisted.storedCount > 0 ? 'partial' : 'failed', start)
        return
      }
      this.recordUsage(
        run,
        item,
        'ok',
        durationMs,
        result.returnedCount,
        result.returnedCount,
        null
      )
      item.state.returned = result.returnedCount
      item.storedCount = persisted.storedCount
      item.state.imageId = persisted.imageIds[0]
      const requested = item.spec.requested
      const itemStatus =
        persisted.storedCount <= 0
          ? 'failed'
          : persisted.storedCount < requested
            ? 'partial'
            : 'done'
      this.completeItem(run, item, itemStatus, start)
      this.deps.logger.info('jobs', 'item_finished', {
        count: persisted.storedCount,
        durationMs,
        status: result.status
      })
    } catch {
      const durationMs = this.now() - start
      this.recordUsage(run, item, 'failed', durationMs, 0, 0, 'unknown')
      this.failItem(run, item, 'unknown', durationMs, start)
    }
  }

  private productWorkingPath(image: Image): string {
    return workingFor(this.deps.libraryPath(), image.projectId, image.id)
  }

  private personPath(personId: string, personLook: string | null): string {
    const reference = this.deps.people.refFor(personId, personLook)
    if (!reference) throw new Error('person_missing')
    return reference.root === 'bundled'
      ? path.join(this.deps.resourceRoot(), reference.file)
      : path.join(this.deps.libraryPath(), reference.file)
  }

  private async persistImages(
    run: JobRun,
    item: RuntimeItem,
    buffers: Buffer[],
    format: Format,
    returnedCount: number
  ): Promise<PersistResult> {
    const storedIds: string[] = []
    try {
      if (item.spec.createMode) {
        let labels = this.deps.images.labels(run.work.projectId)
        for (const buffer of buffers) {
          const imageId = crypto.randomUUID()
          const relative = imageRelative(run.work.projectId, imageId, format)
          const saved = await saveResultImage({
            libraryPath: this.deps.libraryPath(),
            projectId: run.work.projectId,
            imageId,
            bytes: buffer,
            format,
            relative
          })
          const badge = await this.addBadge(run, imageId, relative)
          const thumb = await this.generateThumb(run, imageId, saved.path)
          const label = nextCountedLabel('Image', labels)
          labels = [...labels, label]
          this.deps.images.create({
            id: imageId,
            projectId: run.work.projectId,
            kind: 'render',
            status: 'ready',
            file: relative,
            thumb: thumb.thumbRelative,
            width: badge.width ?? saved.width,
            height: badge.height ?? saved.height,
            format,
            prompt: item.spec.prompt,
            userText: item.spec.userText,
            setId: item.spec.setId,
            label,
            parentId: null,
            rootId: imageId,
            size: item.spec.shape,
            badge: badge.applied,
            costCents: 1,
            durationMs: null,
            jobId: run.state.id
          })
          storedIds.push(imageId)
        }
        if (!storedIds.length) {
          return { storedCount: 0, returnedCount, imageIds: [], error: 'provider_error' }
        }
        this.updateCoverFromCreate(run.work.projectId, storedIds[storedIds.length - 1]!)
        return { storedCount: storedIds.length, returnedCount, imageIds: storedIds, error: null }
      }
      if (!item.pendingRowId) throw new Error('missing_pending')
      const buffer = buffers[0]
      if (!buffer) return { storedCount: 0, returnedCount, imageIds: [], error: 'provider_error' }
      const imageId = item.pendingRowId
      const relative = imageRelative(run.work.projectId, imageId, format)
      const saved = await saveResultImage({
        libraryPath: this.deps.libraryPath(),
        projectId: run.work.projectId,
        imageId,
        bytes: buffer,
        format,
        relative
      })
      const badge = await this.addBadge(run, imageId, relative)
      const thumb = await this.generateThumb(run, imageId, saved.path)
      this.deps.images.markReady(imageId, {
        file: relative,
        thumb: thumb.thumbRelative,
        width: badge.width ?? saved.width,
        height: badge.height ?? saved.height,
        bytes: saved.bytes,
        format,
        costCents: 1,
        durationMs: 0,
        badge: badge.applied,
        revisedPrompt: null
      })
      item.pendingRowId = null
      item.imageIds = [imageId]
      return { storedCount: 1, returnedCount, imageIds: [imageId], error: null }
    } catch (error) {
      const code: ErrorCode =
        (error as NodeJS.ErrnoException & { code?: string }).code === 'ENOSPC' ? 'disk_full' : 'not_saved'
      if (item.pendingRowId && !item.spec.createMode) {
        this.deps.images.markFailed(item.pendingRowId, code)
        item.pendingRowId = null
      }
      return { storedCount: storedIds.length, returnedCount, imageIds: storedIds, error: code }
    }
  }

  private async addBadge(
    run: JobRun,
    imageId: string,
    relative: string
  ): Promise<{ applied: boolean; width?: number; height?: number }> {
    const brand = this.deps.brand.get()
    const row = this.deps.brand.getRow()
    if (!brand.badgeEnabled || !row?.logo_file) return { applied: false }
    try {
      const absolute = path.join(this.deps.libraryPath(), relative)
      await applyBadge({
        imagePath: absolute,
        libraryPath: this.deps.libraryPath(),
        brand,
        logoRelative: row.logo_file,
        format: relative.endsWith('.png') ? 'png' : relative.endsWith('.jpg') ? 'jpeg' : 'webp'
      })
      return { applied: true }
    } catch {
      this.deps.logger.warn('media', 'badge_failed', { count: 1 })
      return { applied: false }
    }
  }

  private async generateThumb(
    run: JobRun,
    imageId: string,
    sourcePath: string
  ): Promise<{ thumbRelative: string; width: number; height: number }> {
    return generateThumbnail({
      libraryPath: this.deps.libraryPath(),
      projectId: run.work.projectId,
      imageId,
      sourcePath
    })
  }

  private updateCoverFromCreate(projectId: string, imageId: string): void {
    this.deps.images.setCover(projectId, imageId)
  }

  private completeItem(
    run: JobRun,
    item: RuntimeItem,
    status: 'done' | 'partial' | 'failed',
    startedAt: number
  ): void {
    item.state.status = status
    item.state.finishedAt = this.now()
    item.state.waiting = false
    if (status === 'failed' && !item.state.errorCode) item.state.errorCode = 'unknown'
    if (status !== 'failed') item.state.errorCode = undefined
    this.recomputeCounts(run)
    this.persist(run)
    this.deps.onUpdate(this.snapshotState(run))
    this.deps.logger.info('jobs', 'item_state', {
      durationMs: this.now() - startedAt,
      count: 1,
      errorCode: item.state.errorCode
    })
  }

  private failItem(
    run: JobRun,
    item: RuntimeItem,
    code: ErrorCode,
    _durationMs: number,
    startedAt: number
  ): void {
    item.state.errorCode = code
    item.state.returned = 0
    item.state.uncertainBilling = billingUncertain(code)
    if (item.pendingRowId) {
      this.deps.images.markFailed(item.pendingRowId, code)
      item.pendingRowId = null
    }
    this.completeItem(run, item, 'failed', startedAt)
  }

  private recomputeCounts(run: JobRun): void {
    let done = 0
    let failed = 0
    let cost = 0
    for (const item of run.items) {
      done += item.storedCount
      cost += item.state.returned
      if (item.state.status === 'failed') {
        failed += Math.max(0, item.spec.requested - item.storedCount)
      } else if (item.state.status === 'partial') {
        failed += Math.max(0, item.spec.requested - item.storedCount)
      }
    }
    run.state.done = done
    run.state.failed = failed
    run.state.costCents = cost
  }

  private finaliseIfComplete(run: JobRun): void {
    if (run.finished) return
    if (run.activeCount > 0) return
    if (run.items.some((item) => item.state.status === 'queued' || item.state.status === 'running')) return
    this.finalise(run)
  }

  private finalise(run: JobRun): void {
    if (run.finished) return
    run.finished = true
    this.recomputeCounts(run)
    const anySuccess = run.items.some((item) => item.state.status === 'done' || item.state.status === 'partial')
    const allCancelled = run.items.every((item) => item.state.status === 'cancelled')
    const status =
      allCancelled || (!anySuccess && run.cancelRequested && run.state.failed === 0)
        ? 'cancelled'
        : anySuccess
          ? 'done'
          : 'failed'
    run.state.status = status
    run.state.finishedAt = this.now()
    run.state.currentLabel = undefined
    this.deps.jobs.updateCounters(run.state.id, run.state.done, run.state.failed, status, run.state.finishedAt)
    this.releaseReservation(run.reservation)
    this.persist(run)
    this.runs.delete(run.state.id)
    this.deps.onUpdate(this.snapshotState(run))
    this.deps.logger.info('jobs', 'job_finished', {
      count: run.state.done,
      errorCode: status
    })
  }

  private recordUsage(
    run: JobRun,
    item: RuntimeItem,
    result: 'ok' | 'failed',
    durationMs: number,
    returned: number,
    costCents: number,
    errorCode: ErrorCode | null
  ): void {
    this.deps.usage.record({
      projectId: run.work.projectId,
      projectName: run.work.projectName,
      imageId: item.state.imageId ?? null,
      action: item.spec.action,
      requestedN: item.spec.requested,
      returnedN: returned,
      costCents,
      durationMs,
      result,
      errorCode
    })
  }

  private persist(run: JobRun): void {
    this.recomputeCounts(run)
    this.deps.jobs.updateSnapshot(run.state.id, {
      items: this.snapshotState(run).items,
      work: { ...run.work, items: run.items.map((item) => item.spec) }
    })
    this.deps.jobs.updateCounters(
      run.state.id,
      run.state.done,
      run.state.failed,
      run.state.status,
      run.state.finishedAt
    )
  }

  private snapshotState(run: JobRun): JobState {
    return {
      id: run.state.id,
      projectId: run.state.projectId,
      kind: run.state.kind,
      status: run.state.status,
      total: run.state.total,
      done: run.state.done,
      failed: run.state.failed,
      costCents: run.state.costCents,
      startedAt: run.state.startedAt,
      ...(run.state.finishedAt ? { finishedAt: run.state.finishedAt } : {}),
      ...(run.state.currentLabel ? { currentLabel: run.state.currentLabel } : {}),
      items: run.items.map((item) => ({ ...item.state, ...(item.state.waiting ? { waiting: true } : {}) }))
    }
  }
}

export function reconcileOnStartup(deps: {
  jobs: JobRepository
  images: ImageRepository
  logger: Logger
}): { interruptedJobs: number; pendingImages: number } {
  const interruptedJobs = deps.jobs.markInterruptedRunning()
  const pendingImages = deps.images.deleteAllPending()
  if (interruptedJobs || pendingImages) {
    deps.logger.info('recovery', 'reconciled', { count: interruptedJobs + pendingImages })
  }
  return { interruptedJobs, pendingImages }
}

export function setExportBaseName(projectName: string): string {
  return safeBaseName(projectName, 'project')
}
