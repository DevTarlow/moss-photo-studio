import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { startFakeMuse } from '../fake-muse/server'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { SettingsStore } from '@main/settings'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { PlanRepository } from '@main/db/repositories/plans'
import { JobRepository } from '@main/db/repositories/jobs'
import { UsageRepository } from '@main/db/repositories/usage'
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { ProductRepository } from '@main/db/repositories/products'
import { ProductService } from '@main/products/service'
import { MediaService } from '@main/media/service'
import { MuseClient } from '@main/muse/client'
import { JobQueue, JobStartError } from '@main/jobs/queue'
import type { SecretStore } from '@main/secrets'
import type { LicenseController } from '@main/license/controller'
import type { JobState } from '@shared/types'
import { createDefaultPlan } from '@shared/plans'
import { GIFT_CLAUSE } from '@shared/prompts/guards'
import { RECIPES } from '@shared/prompts/recipes'
import { planSetPrompts } from '@shared/prompts/setPlan'
import { monthBounds, monthKey } from '@shared/cost'
import { MAX_PROMPT } from '@shared/constants'

let server: Awaited<ReturnType<typeof startFakeMuse>>
let dir = ''
let db: Db
let logger: Logger
let settings: SettingsStore
let projects: ProjectRepository
let images: ImageRepository
let plans: PlanRepository
let jobs: JobRepository
let usage: UsageRepository
let brand: BrandRepository
let people: PeopleRepository
let products: ProductRepository
let productService: ProductService
let media: MediaService
let queue: JobQueue
let keyPresent = true
let licensed = true
let updates: JobState[] = []

const libraryPath = (): string => path.join(dir, 'library')

beforeAll(async () => {
  server = await startFakeMuse({ delayMs: 5, slowMs: 1800 })
})
afterAll(async () => {
  await server.close()
})

beforeEach(async () => {
  server.reset()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-jobs-'))
  logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  settings = new SettingsStore(db)
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  plans = new PlanRepository(db)
  jobs = new JobRepository(db)
  usage = new UsageRepository(db)
  brand = new BrandRepository(db)
  people = new PeopleRepository(db)
  products = new ProductRepository(db)
  media = new MediaService({ projects, images, plans, people, brand, libraryPath, logger })
  productService = new ProductService({
    products,
    images,
    projects,
    plans,
    media,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources')
  })
  keyPresent = true
  licensed = true
  updates = []
  const provider = new MuseClient({
    apiKey: () => (keyPresent ? 'LLM|queue-integration-key' : null),
    userId: () => settings.deviceId(),
    baseUrl: server.baseUrl,
    logger
  })
  queue = new JobQueue({
    projects,
    images,
    plans,
    jobs,
    usage,
    brand,
    people,
    products,
    settings,
    secrets: {
      hasKey: () => keyPresent,
      read: async () => (keyPresent ? 'LLM|queue-integration-key' : null)
    } as unknown as SecretStore,
    license: { canGenerate: async () => licensed } as unknown as LicenseController,
    provider,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources'),
    logger,
    onUpdate: (state) => updates.push(state)
  })
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function waitForJob(jobId: string, timeoutMs = 12000): Promise<JobState> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = queue.state(jobId)
    if (state && state.status !== 'running') return state
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('job timeout')
}

function imageProject(name = 'Create project') {
  return projects.create({ type: 'image', name })
}

async function setProject() {
  const project = projects.create({ type: 'set', name: 'Test set', category: 'ceramics' })
  const bytes = await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 180, g: 170, b: 150 } } }).jpeg().toBuffer()
  await media.importSource({ projectId: project.id, bytes, name: 'mug.jpg' })
  const plan = createDefaultPlan({
    category: 'ceramics',
    productName: 'Test mug',
    shape: 'square',
    format: 'webp'
  })
  plans.save(project.id, plan)
  return projects.get(project.id)!
}

function monthEvents() {
  const bounds = monthBounds(monthKey(new Date()))
  return usage.list({ monthStart: bounds.start, monthEnd: bounds.end })
}

describe('job queue create', () => {
  it('makes four images, writes four files, and records one four-cent row', async () => {
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'A mug on white',
      count: 4,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    const stored = images.list(project.id, true)
    expect(stored).toHaveLength(4)
    for (const image of stored) {
      expect(image.url).toBeTruthy()
      const file = path.join(libraryPath(), decodeURI(image.url!.replace('moss-media://library/', '')))
      expect(fs.existsSync(file)).toBe(true)
    }
    const ledger = monthEvents()
    expect(ledger.total).toBe(1)
    expect(ledger.items[0]).toMatchObject({
      action: 'create',
      requested: 4,
      returned: 4,
      costCents: 4,
      result: 'ok'
    })
  })

  it('keeps two paid images and marks a short count partial', async () => {
    server.control('short-count')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'A short run',
      count: 4,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.items[0]?.status).toBe('partial')
    expect(state.done).toBe(2)
    expect(images.list(project.id, true)).toHaveLength(2)
    const event = monthEvents().items[0]!
    expect(event).toMatchObject({ requested: 4, returned: 2, costCents: 2, result: 'ok' })
  })

  it('stores nothing and records zero when no image comes back', async () => {
    server.control('short-count')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'Zero images',
      count: 2,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('failed')
    expect(images.list(project.id, true)).toHaveLength(0)
    const event = monthEvents().items[0]!
    expect(event).toMatchObject({ requested: 2, returned: 0, costCents: 0, result: 'failed' })
    expect(event.errorCode).toBe('provider_error')
    expect(event.uncertainBilling).toBe(true)
  })

  it('does not retry a 401 and records zero cents', async () => {
    server.control('401')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'One image',
      count: 1,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.items[0]?.errorCode).toBe('invalid_key')
    expect(server.requests()).toHaveLength(1)
    expect(monthEvents().items[0]).toMatchObject({ returned: 0, costCents: 0, errorCode: 'invalid_key', uncertainBilling: false })
  })

  it('does not retry a 503 and leaves a failed item with zero cents', async () => {
    server.control('503')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'One image',
      count: 1,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.items[0]?.errorCode).toBe('provider_error')
    expect(server.requests()).toHaveLength(1)
    expect(monthEvents().items[0]).toMatchObject({ returned: 0, costCents: 0, result: 'failed', uncertainBilling: true })
  })

  it('retries a 429 and bills only the returned image', async () => {
    server.control('429')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'One image',
      count: 1,
      shape: 'square',
      format: 'webp'
    })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    expect(server.requests()).toHaveLength(3)
    expect(monthEvents().items[0]).toMatchObject({ returned: 1, costCents: 1, result: 'ok' })
  })

  it('records a policy refusal as zero cents', async () => {
    server.control('policy')
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'Something refused',
      count: 1,
      shape: 'square',
      format: 'webp'
    })
    await waitForJob(jobId)
    expect(monthEvents().items[0]).toMatchObject({ returned: 0, costCents: 0, errorCode: 'content_policy' })
  })

  it('checks the budget before it starts and spends nothing', async () => {
    settings.set('budgetCents', 0)
    const project = imageProject()
    await expect(
      queue.startCreate({ projectId: project.id, prompt: 'x', count: 1, shape: 'square', format: 'webp' })
    ).rejects.toBeInstanceOf(JobStartError)
    expect(server.requests()).toHaveLength(0)
    expect(monthEvents().total).toBe(0)
  })

  it('refuses without a key or a license', async () => {
    keyPresent = false
    await expect(
      queue.startCreate({ projectId: imageProject().id, prompt: 'x', count: 1, shape: 'square', format: 'webp' })
    ).rejects.toMatchObject({ code: 'no_key' })
    keyPresent = true
    licensed = false
    await expect(
      queue.startCreate({ projectId: imageProject().id, prompt: 'x', count: 1, shape: 'square', format: 'webp' })
    ).rejects.toMatchObject({ code: 'unlicensed' })
  })

  it('sends a product and a person reference together', async () => {
    const product = await productService.addFromBytes({
      bytes: await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 140, g: 120, b: 100 } } }).jpeg().toBuffer(),
      name: 'Ceramic mug'
    })
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'Hold the mug',
      count: 1,
      shape: 'square',
      format: 'webp',
      productId: product.id,
      personId: 'maya'
    })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    const request = server.requests()[0]!
    expect(request.path).toContain('/edits')
    expect((request.body ?? {}).images as unknown[]).toHaveLength(2)
    expect(String((request.body ?? {}).prompt)).toContain('@Image1 as the product')
    expect(String((request.body ?? {}).prompt)).toContain('@Image2 as the person')
  })

  it('sends the chosen person look as the reference', async () => {
    const project = imageProject()
    const { jobId } = await queue.startCreate({
      projectId: project.id,
      prompt: 'A studio portrait',
      count: 1,
      shape: 'portrait',
      format: 'webp',
      personId: 'maya',
      personLook: 'seated'
    })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    const request = server.requests()[0]!
    expect(request.path).toContain('/edits')
    const images = (request.body ?? {}).images as Array<{ image_url: string }>
    expect(images).toHaveLength(1)
    const sent = Buffer.from(images[0]!.image_url.split(',')[1]!, 'base64')
    const expected = fs.readFileSync(path.resolve(__dirname, '../../resources/people/maya-seated.webp'))
    expect(sent.equals(expected)).toBe(true)
  })

  it('rejects an unknown person look before spending', async () => {
    const project = imageProject()
    await expect(
      queue.startCreate({
        projectId: project.id,
        prompt: 'A studio portrait',
        count: 1,
        shape: 'portrait',
        format: 'webp',
        personId: 'maya',
        personLook: 'missing'
      })
    ).rejects.toMatchObject({ code: 'invalid_payload' })
    expect(server.requests()).toHaveLength(0)
  })

  it('refuses more than one image when a reference is present', async () => {
    const project = imageProject()
    await expect(
      queue.startCreate({
        projectId: project.id,
        prompt: 'Hold the mug',
        count: 2,
        shape: 'square',
        format: 'webp',
        personId: 'maya'
      })
    ).rejects.toMatchObject({ code: 'invalid_payload' })
    expect(server.requests()).toHaveLength(0)
  })

  it('refuses mega prompts before spending', async () => {
    await expect(
      queue.startCreate({ projectId: imageProject().id, prompt: 'x'.repeat(MAX_PROMPT + 1), count: 1, shape: 'square', format: 'webp' })
    ).rejects.toMatchObject({ code: 'invalid_payload' })
  })
})

describe('job queue set', () => {
  it('makes one request per shot and streams updates', async () => {
    const project = await setProject()
    const { jobId } = await queue.startSet({ projectId: project.id, mode: 'make' })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    expect(state.done).toBe(6)
    expect(server.requests()).toHaveLength(6)
    const shots = images.list(project.id, true).filter((image) => image.shotId)
    expect(shots).toHaveLength(6)
    expect(new Set(shots.map((image) => image.label)).size).toBe(6)
    expect(monthEvents().items).toHaveLength(6)
    expect(updates.some((entry) => entry.status === 'running')).toBe(true)
  })

  it('sends the chosen look for an on-person shot', async () => {
    const project = projects.create({ type: 'set', name: 'Look set', category: 'clothing' })
    const bytes = await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 180, g: 170, b: 150 } } }).jpeg().toBuffer()
    await media.importSource({ projectId: project.id, bytes, name: 'shirt.jpg' })
    const plan = createDefaultPlan({
      category: 'clothing',
      productName: 'Shirt',
      shape: 'square',
      format: 'webp'
    })
    const onmodel = plan.shots.find((shot) => shot.type === 'onmodel')!
    plans.save(project.id, {
      ...plan,
      shots: plan.shots.map((shot) =>
        shot.id === onmodel.id
          ? { ...shot, enabled: true, personLook: 'angle' }
          : { ...shot, enabled: false }
      )
    })
    const { jobId } = await queue.startSet({ projectId: project.id, mode: 'make' })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    const request = server.requests()[0]!
    const sentImages = (request.body ?? {}).images as Array<{ image_url: string }>
    expect(sentImages).toHaveLength(2)
    const sent = Buffer.from(sentImages[1]!.image_url.split(',')[1]!, 'base64')
    const expected = fs.readFileSync(path.resolve(__dirname, '../../resources/people/maya-angle.webp'))
    expect(sent.equals(expected)).toBe(true)
  })

  it('makes only the shots left enabled in the saved plan', async () => {
    const project = await setProject()
    const plan = plans.getActive(project.id)!.json
    plans.save(project.id, {
      ...plan,
      shots: plan.shots.map((shot, index) => ({ ...shot, enabled: index < 3 }))
    })
    const { jobId } = await queue.startSet({ projectId: project.id, mode: 'make' })
    const state = await waitForJob(jobId)
    expect(state.status).toBe('done')
    expect(state.done).toBe(3)
    expect(server.requests()).toHaveLength(3)
    expect(images.list(project.id, true).filter((image) => image.shotId)).toHaveLength(3)
  })

  it('sends the category recipe prompts, including the category gift clause', async () => {
    const bytes = await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 180, g: 170, b: 150 } } }).jpeg().toBuffer()
    for (const recipe of RECIPES) {
      server.reset()
      const project = projects.create({ type: 'set', name: recipe.label, category: recipe.id })
      await media.importSource({ projectId: project.id, bytes, name: 'product.jpg' })
      plans.save(
        project.id,
        createDefaultPlan({
          category: recipe.id,
          productName: 'Product',
          shape: 'square',
          format: 'webp'
        })
      )
      const saved = plans.getActive(project.id)!.json
      const expected = planSetPrompts({ plan: saved, shots: saved.shots })
      const { jobId } = await queue.startSet({ projectId: project.id, mode: 'make' })
      const state = await waitForJob(jobId)
      expect(state.status, recipe.id).toBe('done')
      const prompts = server.requests().map((request) => String(request.body?.prompt))
      expect(prompts, recipe.id).toHaveLength(expected.length)
      expect(new Set(prompts), recipe.id).toEqual(new Set(expected.map((spec) => spec.prompt)))
      if (recipe.shots.includes('onmodel')) {
        const onmodel = expected.find((spec) => spec.type === 'onmodel')!
        const request = server.requests().find((entry) => String(entry.body?.prompt) === onmodel.prompt)!
        expect(request.body?.images, recipe.id).toHaveLength(2)
      }
      if (recipe.shots.includes('gift')) {
        const gift = expected.find((spec) => spec.type === 'gift')!
        const clause = (recipe.giftClause ?? GIFT_CLAUSE).trim()
        expect(gift.prompt, recipe.id).toContain(clause)
      }
    }
  })

  it('adds saved colors to a set prompt only while brand colors are on', async () => {
    brand.update({ colors: ['#112233'] })
    const project = await setProject()
    const shot = plans.getActive(project.id)!.json.shots.find((entry) => entry.type === 'hero')!

    const on = await queue.startSet({ projectId: project.id, mode: 'remake', shotIds: [shot.id] })
    await waitForJob(on.jobId)
    expect(String(server.requests()[0]?.body?.prompt)).toContain('#112233')

    server.reset()
    brand.update({ colorsEnabled: false })
    const off = await queue.startSet({ projectId: project.id, mode: 'remake', shotIds: [shot.id] })
    await waitForJob(off.jobId)
    const prompt = String(server.requests()[0]?.body?.prompt)
    expect(prompt).not.toContain('#112233')
    expect(prompt).not.toContain('this shop')
  })

  it('cancels queued items, lets the in-flight image finish, and bills once', async () => {
    settings.set('concurrency', 1)
    server.control('slow')
    const project = await setProject()
    const { jobId } = await queue.startSet({ projectId: project.id, mode: 'make' })
    for (let attempt = 0; attempt < 100 && server.requests().length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    queue.cancel(jobId)
    const state = await waitForJob(jobId, 15000)
    expect(state.items.filter((item) => item.status === 'cancelled').length).toBeGreaterThan(0)
    expect(server.requests()).toHaveLength(1)
    const stored = images.list(project.id, true)
    expect(stored.filter((image) => image.status === 'pending')).toHaveLength(0)
    expect(stored.filter((image) => image.status === 'ready' && image.shotId)).toHaveLength(1)
    expect(monthEvents().total).toBe(1)
    expect(monthEvents().items[0]).toMatchObject({ action: 'set', returned: 1, costCents: 1 })
  })
})

describe('people look references', () => {
  it('resolves bundled looks and rejects unknown or user looks', () => {
    expect(people.refFor('maya', null)).toEqual({ root: 'bundled', file: 'people/maya.webp' })
    expect(people.refFor('maya', 'original')).toEqual({ root: 'bundled', file: 'people/maya.webp' })
    expect(people.refFor('maya', 'angle')).toEqual({ root: 'bundled', file: 'people/maya-angle.webp' })
    expect(people.refFor('maya', 'missing')).toBeNull()

    people.create({ id: 'test-user', name: 'Test User', refFile: 'people/test-user.webp', thumb: 'people/test-user-thumb.webp' })
    expect(people.refFor('test-user', null)).toEqual({ root: 'library', file: 'people/test-user.webp' })
    expect(people.refFor('test-user', 'front')).toBeNull()
    expect(people.refFor('missing-person', null)).toBeNull()
  })
})
