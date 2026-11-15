import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { JobRepository } from '@main/db/repositories/jobs'
import { UsageRepository } from '@main/db/repositories/usage'
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { ProductRepository } from '@main/db/repositories/products'
import { PackRepository } from '@main/db/repositories/packs'
import { SettingsStore } from '@main/settings'
import { MediaService } from '@main/media/service'
import { JobQueue } from '@main/jobs/queue'
import { exportPackProject } from '@main/media/packExport'
import { createPackFromPreset, createShotFromPreset } from '@shared/prompts/packPresets'
import type { ImageProvider } from '@main/muse/provider'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let jobs: JobRepository
let usage: UsageRepository
let packs: PackRepository
let media: MediaService
let queue: JobQueue
const edits: Array<{ prompt: string; images: number }> = []
const generations: string[] = []

const libraryPath = (): string => path.join(dir, 'library')
const logger = () => new Logger(path.join(dir, 'logs'))

async function placeholder(): Promise<Buffer> {
  return sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 90, g: 110, b: 80 } } })
    .webp()
    .toBuffer()
}

function provider(): ImageProvider {
  return {
    validateKey: async () => ({ ok: true }),
    generate: async (input) => {
      generations.push(input.prompt)
      return {
        ok: true,
        images: [await placeholder()],
        returnedCount: 1,
        outputFormat: 'webp',
        revisedPrompts: [null],
        usage: null,
        requestId: 'fake-generate',
        status: 200
      }
    },
    edit: async (input) => {
      edits.push({ prompt: input.prompt, images: input.images.length })
      return {
        ok: true,
        images: [await placeholder()],
        returnedCount: 1,
        outputFormat: 'webp',
        revisedPrompts: [null],
        usage: null,
        requestId: 'fake-edit',
        status: 200
      }
    }
  }
}

async function waitForJob(jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = queue.state(jobId)
    if (state && state.status !== 'running') {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('job timeout')
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-pack-'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger: logger() })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  jobs = new JobRepository(db)
  usage = new UsageRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  const products = new ProductRepository(db)
  packs = new PackRepository(db)
  const settings = new SettingsStore(db)
  media = new MediaService({ projects, images, people, brand, packs, libraryPath, logger: logger() })
  queue = new JobQueue({
    projects,
    images,
    jobs,
    usage,
    brand,
    people,
    products,
    packs,
    settings,
    secrets: {
      hasKey: () => true,
      read: async () => 'LLM|integration-pack'
    } as never,
    license: { canGenerate: async () => true } as never,
    provider: provider(),
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources'),
    logger: logger(),
    onUpdate: () => undefined
  })
  edits.length = 0
  generations.length = 0
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function sourceProject(): Promise<{ projectId: string; project: ReturnType<ProjectRepository['get']> }> {
  const project = projects.create({ type: 'pack', name: 'Mug pack' })
  const bytes = await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 120, g: 130, b: 110 } } }).jpeg().toBuffer()
  await media.importSource({ projectId: project.id, bytes, name: 'mug.jpg' })
  return { projectId: project.id, project: projects.get(project.id) }
}

describe('pack jobs', () => {
  it('makes one image per shot with a saved pack and records pack usage', async () => {
    const { projectId, project } = await sourceProject()
    packs.save(projectId, createPackFromPreset('studio-essentials'))
    expect(project?.sourceImageId).toBeTruthy()
    const { jobId } = await queue.startPack({ projectId, mode: 'missing' })
    await waitForJob(jobId)
    expect(edits).toHaveLength(6)
    expect(edits[0]?.images).toBe(1)
    expect(edits[0]?.prompt).toContain('Keep the product exactly as pictured')
    expect(edits.some((edit) => edit.prompt.includes('a clean, well-lit hero image'))).toBe(true)
    const savedImages = images.list(projectId).filter((image) => image.shotId)
    expect(savedImages).toHaveLength(6)
    const pack = packs.get(projectId)!
    expect(savedImages.every((image) => pack.shots.some((shot) => shot.id === image.shotId))).toBe(true)
    expect(new Set(savedImages.map((image) => image.shotId)).size).toBe(6)
    expect(projects.get(projectId)?.coverImageId).toBeTruthy()
    const events = usage.list({ monthStart: 0, monthEnd: Date.now() + 1000, limit: 20 })
    expect(events.items.some((event) => event.action === 'pack' && event.costCents === 1)).toBe(true)
  })

  it('makes only missing shots and can remake one shot', async () => {
    const { projectId } = await sourceProject()
    packs.save(projectId, createPackFromPreset('studio-essentials'))
    const first = await queue.startPack({ projectId, mode: 'missing' })
    await waitForJob(first.jobId)
    expect(edits).toHaveLength(6)
    await expect(queue.startPack({ projectId, mode: 'missing' })).rejects.toMatchObject({ code: 'invalid_payload' })
    expect(edits).toHaveLength(6)
    const pack = packs.get(projectId)!
    const third = await queue.startPack({ projectId, mode: 'remake', shotIds: [pack.shots[0]!.id] })
    await waitForJob(third.jobId)
    expect(edits).toHaveLength(7)
    const heroImages = images.readyForShot(projectId, pack.shots[0]!.id)
    expect(heroImages).toHaveLength(2)
    expect(heroImages.at(-1)?.label).toBe('Hero 2')
  })

  it('runs a prompt-only pack through generations', async () => {
    const project = projects.create({ type: 'pack', name: 'Concept pack' })
    const pack = createPackFromPreset('custom')
    pack.shots = [pack.shots[0]!, createShotFromPreset({ templateId: 'negative-space' })]
    packs.save(project.id, pack)
    const { jobId } = await queue.startPack({ projectId: project.id, mode: 'missing' })
    await waitForJob(jobId)
    expect(generations).toHaveLength(2)
    expect(edits).toHaveLength(0)
    expect(images.list(project.id)).toHaveLength(2)
  })

  it('keeps a configured pack draft and duplicates its shot plan', async () => {
    const project = projects.create({ type: 'pack', name: 'Draft pack', draft: true })
    packs.save(project.id, createPackFromPreset('lifestyle-story'))
    expect(projects.deleteEmptyDrafts()).toBe(0)
    expect(projects.get(project.id)).toBeTruthy()
    const duplicate = await media.duplicateProject(project)
    expect(duplicate.projectId).not.toBe(project.id)
    const copy = packs.get(duplicate.projectId)
    expect(copy?.presetId).toBe('lifestyle-story')
    expect(copy?.shots).toHaveLength(6)
    expect(copy?.shots.map((shot) => shot.id)).toEqual(packs.get(project.id)?.shots.map((shot) => shot.id))
  })

  it('exports selected or latest shot images with a pack manifest', async () => {
    const { projectId } = await sourceProject()
    packs.save(projectId, createPackFromPreset('studio-essentials'))
    const { jobId } = await queue.startPack({ projectId, mode: 'missing' })
    await waitForJob(jobId)
    const pack = packs.get(projectId)!
    const first = images.readyForShot(projectId, pack.shots[0]!.id).at(-1)!
    const chosen = { ...pack, shots: pack.shots.map((shot, index) => index === 0 ? { ...shot, selectedImageId: first.id } : shot) }
    packs.save(projectId, chosen)
    const parent = path.join(dir, 'exports')
    const result = await exportPackProject({
      libraryPath: libraryPath(),
      projectName: 'Mug pack',
      pack: chosen,
      images: images.list(projectId),
      options: { format: 'webp', quality: 90, maxDimension: null },
      parentFolder: parent,
      workingPathFor: (image) => path.join(dir, 'library', 'projects', image.projectId, 'working', `${image.id}.webp`)
    })
    expect(result.count).toBe(6)
    const files = fs.readdirSync(result.folder)
    expect(files.filter((file) => file.endsWith('.webp'))).toHaveLength(6)
    expect(files).toContain('pack.json')
    const manifest = JSON.parse(fs.readFileSync(path.join(result.folder, 'pack.json'), 'utf8')) as { shots: Array<{ imageId: string }> }
    expect(manifest.shots[0]?.imageId).toBe(first.id)
  })
})
