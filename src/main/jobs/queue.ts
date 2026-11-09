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
  PlanJson,
  Project,
  SetJobInput,
  Shape
} from '@shared/types'
import { estimateCents, monthBounds, monthKey } from '@shared/cost'
import { MAX_CREATE_VARIANTS, MAX_PROMPT } from '@shared/constants'
import { usedBrandColors } from '@shared/brandColors'
import { composeChange, composeCreatePrompt, PROMPT_MAX } from '@shared/prompts/guards'
import { planSetPrompts } from '@shared/prompts/setPlan'
import { nextCountedLabel, setImageLabel } from '@shared/labels'
import { templateById, templateWord } from '@shared/prompts/templates'
import { safeBaseName } from '@shared/files'
import { billingUncertain } from '@shared/errors'
import type { ImageProvider } from '../muse/provider'
import type { Logger } from '../logger'
import type { ProjectRepository } from '../db/repositories/projects'
import type { ImageRepository } from '../db/repositories/images'
import type { PlanRepository } from '../db/repositories/plans'
import type { JobRepository, JobSnapshot } from '../db/repositories/jobs'
import type { UsageRepository } from '../db/repositories/usage'
import type { BrandRepository } from '../db/repositories/brand'
import type { PeopleRepository } from '../db/repositories/people'
import type { ProductRepository } from '../db/repositories/products'
import type { SettingsStore } from '../settings'
import type { SecretStore } from '../secrets'
import type { LicenseController } from '../license/controller'
import { absoluteInLibrary, workingFor, imageRelative } from '../media/paths'
import { applyBadge } from '../media/badge'
import { generateThumbnail, saveResultImage } from '../media/import'


export class JobStartError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'JobStartError'
  }
}

type Action = 'create' | 'set' | 'edit'

interface WorkItemSpec {
  key: string
  label: string
  prompt: string
  requested: number
  sourceImageId: string | null
  productId: string | null
  personId: string | null
  shape: Shape
  format: Format
  userText: string
  templateId: string | null
  shotId: string | null
  action: Action
  labelWord: 'Scene' | 'Model' | 'Edit' | 'Created' | null
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
  setPlan?: PlanJson
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
}

interface QueueDeps {
  projects: ProjectRepository
  images: ImageRepository
  plans: PlanRepository
  jobs: JobRepository
  usage: UsageRepository
  brand: BrandRepository
  people: PeopleRepository
  products: ProductRepository
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

  async startSet(input: SetJobInput): Promise<{ jobId: string }> {
    const project = this.requireProject(input.projectId, 'set')
    this.requireLicensed()
    this.requireKey()
    this.requireNoRunningProject(project.id)
    const planRecord = this.deps.plans.getActive(project.id)
    if (!planRecord) throw new JobStartError('invalid_payload', 'No plan yet. Add a photo and try again.')
    const plan = planRecord.json
    const sourceId = project.sourceImageId
    if (!sourceId) throw new JobStartError('invalid_payload', 'Add a photo of the product first.')
    let eligible = plan.shots.filter((shot) => shot.enabled)
    if (input.shotIds?.length) {
      eligible = eligible.filter((shot) => input.shotIds!.includes(shot.id))
    }
    if (input.mode === 'make') {
      eligible = eligible.filter((shot) => !this.deps.images.latestReadyForShot(project.id, shot.id))
    }
    if (!eligible.length) {
      throw new JobStartError(
        'invalid_payload',
        plan.shots.some((shot) => shot.enabled)
          ? 'Those shots are already made.'
          : 'Turn on at least one shot.'
      )
    }
    const brand = this.deps.brand.get()
    const palette = brand.colorsEnabled ? usedBrandColors(brand.colors) : []
    const source = this.deps.images.get(sourceId)
    if (!source || source.status !== 'ready') {
      throw new JobStartError('invalid_payload', 'Add a photo of the product first.')
    }
    const specs: WorkItemSpec[] = []
    for (const item of planSetPrompts({ plan, shots: eligible, palette })) {
      const personId = item.personId
      if (item.type === 'onmodel') {
        if (!personId || !this.deps.people.exists(personId)) {
          throw new JobStartError('invalid_payload', 'Add a person to use this shot.')
        }
      }
      const prompt = item.prompt
      if (!prompt) throw new JobStartError('invalid_payload', 'Add a direction for every shot.')
      if (prompt.length > MAX_PROMPT) {
        throw new JobStartError('invalid_payload', 'That direction is too long. Shorten it and try again.')
      }
      specs.push({
        key: item.shotId,
        label: item.label,
        prompt,
        requested: 1,
        sourceImageId: sourceId,
        productId: null,
        personId,
        shape: plan.shape,
        format: plan.format,
        userText: item.userText,
        templateId: item.type === 'gift' ? 'set-gift' : null,
        shotId: item.shotId,
        action: 'set',
        labelWord: null,
        parentId: sourceId,
        rootId: source.rootId ?? sourceId,
        createMode: false
      })
    }
    const estimate = estimateCents(specs.reduce((sum, item) => sum + item.requested, 0))
    this.requireBudget(estimate)
    const work: JobWork = {
      kind: 'set',
      projectId: project.id,
      projectName: project.name,
      items: specs,
      setPlan: plan,
      sourceImageId: sourceId
    }
    return this.createJob(work, 'set')
  }

  async startCreate(input: CreateJobInput): Promise<{ jobId: string }> {
    const project = this.requireProject(input.projectId, 'image')
    this.requireLicensed()
    this.requireKey()
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
      throw new JobStartError('invalid_payload', 'Choose one product reference, not two.')
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
    const legacyPerson = !input.personId && Boolean(source?.personId)
    const hasPerson = Boolean(input.personId) || legacyPerson
    const hasProduct = Boolean(source || input.productId) && !legacyPerson
    if ((hasPerson || hasProduct) && input.count !== 1) {
      throw new JobStartError('invalid_payload', 'References make one image at a time.')
    }
    const prompt = composeCreatePrompt({ text, hasProduct, hasPerson })
    if (prompt.length > PROMPT_MAX) {
      throw new JobStartError(
        'invalid_payload',
        `This reference adds ${prompt.length - text.length} characters. Shorten your description by ${prompt.length - PROMPT_MAX}.`
      )
    }
    this.requireBudget(estimateCents(input.count))
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
          shape: input.shape,
          format: input.format,
          userText: text,
          templateId: null,
          shotId: null,
          action: 'create',
          labelWord: 'Created',
          parentId: null,
          rootId: null,
          createMode: true
        }
      ]
    }
    return this.createJob(work, 'create')
  }

  async startEdit(input: EditJobInput): Promise<{ jobId: string }> {
    const project = this.requireProject(input.projectId, null)
    this.requireLicensed()
    this.requireKey()
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
    const template = input.templateId ? templateById(input.templateId) : undefined
    const brand = this.deps.brand.get()
    const palette = brand.colorsEnabled
      ? usedBrandColors(input.palette?.length ? input.palette : brand.colors)
      : []
    const prompt = composeChange({
      text,
      kind: input.kind,
      hasReference: true,
      isGiftShot: Boolean(input.isGiftShot || input.templateId === 'gift-ready'),
      palette
    })
    if (prompt.length > PROMPT_MAX) {
      throw new JobStartError(
        'invalid_payload',
        `That's ${text.length - MAX_PROMPT} characters over. Shorten it and try again.`
      )
    }
    this.requireBudget(estimateCents(1))
    const word = template ? templateWord(template) : input.kind === 'scene' ? 'Scene' : input.kind === 'model' ? 'Model' : 'Edit'
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
          shape: project.shape,
          format: project.format,
          userText: text,
          templateId: input.templateId ?? (input.kind === 'model' ? 'model-free' : null),
          shotId: null,
          action: 'edit',
          labelWord: word,
          parentId: source.id,
          rootId: source.rootId ?? source.id,
          createMode: false
        }
      ]
    }
    return this.createJob(work, 'edit')
  }

  async retryFailed(jobId: string): Promise<{ jobId: string }> {
    this.requireLicensed()
    this.requireKey()
    const row = this.deps.jobs.getRow(jobId)
    if (!row) throw new JobStartError('not_found', 'That run is not here anymore.')
    if (this.runs.has(jobId)) throw new JobStartError('already_running')
    const snapshot = this.deps.jobs.snapshot(jobId) as (JobSnapshot & { work?: JobWork }) | null
    const oldWork = snapshot?.work
    const oldItems = this.deps.jobs.toState(row).items
    if (!oldWork) {
      throw new JobStartError('invalid_request', 'Try that again from the project.')
    }
    const failedKeys = new Set(oldItems.filter((item) => item.status === 'failed').map((item) => item.key))
    if (!failedKeys.size) throw new JobStartError('invalid_payload', 'There are no failed images to try again.')
    const project = this.requireProject(oldWork.projectId, null)
    this.requireNoRunningProject(project.id)
    const specs = oldWork.items.filter((item) => failedKeys.has(item.key))
    if (!specs.length) throw new JobStartError('invalid_payload', 'There are no failed images to try again.')
    const estimate = estimateCents(specs.reduce((sum, item) => sum + item.requested, 0))
    this.requireBudget(estimate)
    const work: JobWork = {
      ...oldWork,
      projectName: project.name,
      items: specs.map((spec) => ({ ...spec, pendingImageId: undefined }))
    }
    return this.createJob(work, work.kind)
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

  private requireProject(projectId: string, expected: 'set' | 'image' | null): Project {
    const project = this.deps.projects.get(projectId)
    if (!project) throw new JobStartError('not_found', 'That project is not here anymore.')
    if (expected && project.type !== expected) {
      throw new JobStartError('invalid_payload', 'That project cannot make this kind of image.')
    }
    return project
  }

  private requireLicensed(): void {
    if (!this.deps.license.canGenerate()) {
      throw new JobStartError('unlicensed', 'Reactivate to make images.')
    }
  }

  private requireKey(): void {
    if (!this.deps.secrets.hasKey() || !this.deps.secrets.read()) {
      throw new JobStartError('no_key', 'Add your Muse key in Settings to make images.')
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

  private requireBudget(estimate: number): void {
    const cap = this.deps.settings.budgetCents()
    if (cap === null) return
    const bounds = monthBounds(monthKey(new Date(this.now())))
    const spent = this.deps.usage.monthTotal(bounds.start, bounds.end)
    if (spent + estimate > cap) {
      const limit = `$${(cap / 100).toFixed(2)}`
      throw new JobStartError(
        'budget',
        `This run would pass your ${limit} monthly limit. Raise it in Usage, or make fewer images.`
      )
    }
  }

  private async createJob(work: JobWork, kind: JobKind): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID()
    const items: RuntimeItem[] = []
    let labels = this.deps.images.labels(work.projectId)
    try {
      for (const spec of work.items) {
        let pendingRowId: string | null = null
        let label = spec.label
        if (!spec.createMode) {
          if (spec.action === 'set' && spec.shotId) {
            const shot = work.setPlan?.shots.find((entry) => entry.id === spec.shotId)
            if (shot) label = setImageLabel(shot.type, labels)
          } else {
            const word = spec.labelWord ?? 'Edit'
            label = word === 'Created' ? nextCountedLabel('Created', labels) : nextCountedLabel(word, labels)
          }
          labels = [...labels, label]
          const row = this.deps.images.create({
            projectId: work.projectId,
            kind: 'render',
            status: 'pending',
            label,
            prompt: spec.prompt,
            userText: spec.userText,
            templateId: spec.templateId,
            shotId: spec.shotId,
            personId: spec.personId,
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
      activeCount: 0
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
    if (!this.deps.secrets.hasKey() || !this.deps.secrets.read()) {
      this.failItem(run, item, 'invalid_key', 0, start)
      return
    }
    try {
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
        images.push(await fs.readFile(this.personPath(item.spec.personId)))
      }
      const onRateLimitWait = (waitMs: number): void => {
        item.state.waiting = waitMs > 0
        if (waitMs > 0) run.state.currentLabel = 'Waiting for Meta'
        else run.state.currentLabel = item.state.label
        this.persist(run)
        this.deps.onUpdate(this.snapshotState(run))
      }
      const result = item.spec.createMode && !item.spec.sourceImageId && !item.spec.productId && !item.spec.personId
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

  private personPath(personId: string): string {
    if (personId === 'maya' || this.deps.people.list().some((person) => person.id === personId && person.source === 'bundled')) {
      return path.join(this.deps.resourceRoot(), 'people', `${personId}.webp`)
    }
    const row = this.deps.people.getRow(personId)
    if (!row) throw new Error('person_missing')
    return path.join(this.deps.libraryPath(), row.ref_file)
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
          const label = nextCountedLabel('Created', labels)
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
      this.updateCoverAfterShot(run, item)
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

  private updateCoverAfterShot(run: JobRun, item: RuntimeItem): void {
    if (!item.spec.shotId) return
    const project = this.deps.projects.get(run.work.projectId)
    if (!project) return
    const cover = project.coverImageId ? this.deps.images.get(project.coverImageId) : null
    if (cover?.shotId) return
    const plan = this.deps.plans.getActive(run.work.projectId)
    const heroShot = plan?.json.shots.find((shot) => shot.type === 'hero' && shot.enabled)
    const hero = heroShot ? this.deps.images.latestReadyForShot(run.work.projectId, heroShot.id) : null
    const firstShot = this.deps.images.readyForProject(run.work.projectId).find((image) => image.shotId)
    const coverId = hero?.id ?? item.imageIds[0] ?? firstShot?.id
    if (coverId) this.deps.images.setCover(run.work.projectId, coverId)
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
    this.persist(run)
    this.runs.delete(run.state.id)
    this.deps.onUpdate(this.snapshotState(run))
    this.refreshProjectCoverAfterJob(run)
    this.deps.logger.info('jobs', 'job_finished', {
      count: run.state.done,
      errorCode: status
    })
  }

  private refreshProjectCoverAfterJob(run: JobRun): void {
    if (run.work.kind === 'set') {
      const project = this.deps.projects.get(run.work.projectId)
      if (!project) return
      if (!project.coverImageId) {
        const first = this.deps.images.readyForProject(run.work.projectId).find((image) => image.shotId)
        if (first) this.deps.images.setCover(project.id, first.id)
      }
    }
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
