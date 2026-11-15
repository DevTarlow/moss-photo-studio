import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { PlanRepository } from '@main/db/repositories/plans'
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { MediaService } from '@main/media/service'
import { createKitFolder, exportKit } from '@main/media/kit'
import { createDefaultPlan } from '@shared/plans'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let plans: PlanRepository
let media: MediaService

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-kit-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  plans = new PlanRepository(db)
  media = new MediaService({
    projects,
    images,
    plans,
    people: new PeopleRepository(db),
    brand: new BrandRepository(db),
    libraryPath,
    logger
  })
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function setupSet(): Promise<{ projectId: string; plan: ReturnType<typeof createDefaultPlan> }> {
  const project = projects.create({ type: 'set', name: 'Candle set', category: 'candles' })
  const sourceBytes = await sharp({
    create: { width: 800, height: 800, channels: 3, background: { r: 210, g: 190, b: 160 } }
  })
    .jpeg()
    .toBuffer()
  await media.importSource({ projectId: project.id, bytes: sourceBytes, name: 'candle.jpg' })
  const plan = createDefaultPlan({
    category: 'candles',
    productName: 'Amber candle',
    shape: 'square',
    format: 'webp'
  })
  plan.shots = plan.shots.slice(0, 2)
  plan.shots[0] = { ...plan.shots[0]!, direction: 'a clean shot on a pale table' }
  plans.save(project.id, plan)
  for (const [index, shot] of plan.shots.entries()) {
    const id = crypto.randomUUID()
    const relative = path.posix.join('projects', project.id, 'images', `${id}.webp`)
    const absolute = path.join(dir, 'library', relative)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    await sharp({
      create: { width: 700, height: 700, channels: 3, background: index === 0 ? { r: 190, g: 160, b: 120 } : { r: 120, g: 90, b: 70 } }
    })
      .webp()
      .toFile(absolute)
    images.create({
      id,
      projectId: project.id,
      kind: 'render',
      status: 'ready',
      label: `${index + 1}`,
      shotId: shot.id,
      file: relative,
      format: 'webp',
      costCents: 1
    })
  }
  return { projectId: project.id, plan }
}

describe('listing kit', () => {
  it('writes Etsy-sized images, alt text, the original, and a manifest', async () => {
    const { projectId, plan } = await setupSet()
    const project = projects.get(projectId)!
    const folder = await createKitFolder(path.join(dir, 'kits'))
    const result = await exportKit({
      libraryPath: libraryPath(),
      folder,
      project,
      plan,
      images: images.list(projectId, false),
      platform: 'etsy',
      includeOriginal: true,
      listing: {
        platform: 'etsy',
        titles: ['Amber candle - hand poured'],
        description: 'A hand-poured amber candle for slow evenings.',
        features: ['Hand poured', 'Amber glass'],
        tags: ['candle', 'handmade'],
        altTexts: ['Amber candle'],
        createdAt: Date.now(),
        costMicros: 0
      }
    })
    expect(result.count).toBe(2)
    expect(result.includesOriginal).toBe(true)
    expect(result.warnings).toEqual([])
    const files = fs.readdirSync(folder)
    expect(files).toContain('kit.json')
    expect(files).toContain('listing.csv')
    expect(files).toContain('listing.md')
    expect(files).toContain('README.txt')
    expect(files.some((file) => file === 'original.jpg')).toBe(true)
    const listing = files.filter((file) => file.endsWith('.jpg') && file !== 'original.jpg').sort()
    expect(listing).toHaveLength(2)
    const meta = await sharp(path.join(folder, listing[0]!)).metadata()
    expect(meta.width).toBe(2000)
    expect(meta.height).toBe(2000)
    expect(fs.statSync(path.join(folder, listing[0]!)).size).toBeLessThanOrEqual(1_000_000)
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'kit.json'), 'utf8')) as {
      images: Array<{ altText: string; direction: string }>
    }
    expect(manifest.images[0]?.direction).toBe('a clean shot on a pale table')
    expect(manifest.images[0]?.altText).toContain('Amber candle')
    const listingCopy = fs.readFileSync(path.join(folder, 'listing.md'), 'utf8')
    expect(listingCopy).toContain('Amber candle - hand poured')
    expect(listingCopy).toContain('A hand-poured amber candle')
    const csv = fs.readFileSync(path.join(folder, 'listing.csv'), 'utf8')
    expect(csv).toContain('Alt text')
    expect(csv).toContain('Amber candle')
    const readme = fs.readFileSync(path.join(folder, 'README.txt'), 'utf8')
    expect(readme).toContain('AI disclosure')
    expect(readme).toContain('unedited')
  })

  it('uses the pinned version for the kit main image', async () => {
    const { projectId, plan } = await setupSet()
    const all = images.list(projectId, false)
    const firstShot = plan.shots[0]!
    const older = all.find((image) => image.shotId === firstShot.id)!
    const newerId = crypto.randomUUID()
    const relative = path.posix.join('projects', projectId, 'images', `${newerId}.webp`)
    await sharp({ create: { width: 700, height: 700, channels: 3, background: { r: 20, g: 200, b: 80 } } })
      .webp()
      .toFile(path.join(dir, 'library', relative))
    images.create({
      id: newerId,
      projectId,
      kind: 'render',
      status: 'ready',
      label: 'newer',
      shotId: firstShot.id,
      file: relative,
      format: 'webp',
      costCents: 1
    })
    const pinnedPlan = {
      ...plan,
      shots: plan.shots.map((shot) =>
        shot.id === firstShot.id ? { ...shot, selectedImageId: older.id } : shot
      )
    }
    plans.save(projectId, pinnedPlan)
    const folder = await createKitFolder(path.join(dir, 'kits'))
    const result = await exportKit({
      libraryPath: libraryPath(),
      folder,
      project: projects.get(projectId)!,
      plan: pinnedPlan,
      images: images.list(projectId, false),
      platform: 'etsy',
      includeOriginal: false
    })
    expect(result.count).toBe(2)
    const main = fs.readdirSync(folder).find((file) => file.startsWith('01-main-shot'))!
    const pixel = await sharp(path.join(folder, main)).raw().toBuffer({ resolveWithObject: true })
    const offset = Math.floor((pixel.info.height / 2) * pixel.info.width + pixel.info.width / 2) * pixel.info.channels
    expect(pixel.data[offset]).toBeGreaterThan(pixel.data[offset + 1] ?? 0)
  })

  it('packs one selected ready image for a project without a plan', async () => {
    const project = projects.create({ type: 'image', name: 'Mug studio shot' })
    const imageId = crypto.randomUUID()
    const relative = path.posix.join('projects', project.id, 'images', `${imageId}.webp`)
    const absolute = path.join(dir, 'library', relative)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 180, g: 120, b: 80 } } })
      .webp()
      .toFile(absolute)
    images.create({
      id: imageId,
      projectId: project.id,
      kind: 'render',
      status: 'ready',
      label: 'Mug front 2',
      prompt: 'a mug on a pale table',
      file: relative,
      format: 'webp',
      costCents: 1
    })
    const folder = await createKitFolder(path.join(dir, 'kits'))
    const result = await exportKit({
      libraryPath: libraryPath(),
      folder,
      project: projects.get(project.id)!,
      images: images.list(project.id, false),
      imageIds: [imageId],
      productName: 'Glazed mug',
      platform: 'etsy',
      includeOriginal: false
    })
    expect(result.count).toBe(1)
    expect(result.includesOriginal).toBe(false)
    const files = fs.readdirSync(folder)
    expect(files).toContain('kit.json')
    expect(files).toContain('listing.csv')
    expect(files).toContain('README.txt')
    expect(files).not.toContain('listing.md')
    const listing = files.filter((file) => file.endsWith('.jpg'))
    expect(listing).toHaveLength(1)
    expect(listing[0]).toMatch(/^01-mug-front-2-etsy\.jpg$/)
    const meta = await sharp(path.join(folder, listing[0]!)).metadata()
    expect(meta.width).toBe(2000)
    expect(meta.height).toBe(2000)
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'kit.json'), 'utf8')) as {
      product: string
      project: string
      images: Array<{ shot: string; direction: string; altText: string }>
    }
    expect(manifest.product).toBe('Glazed mug')
    expect(manifest.project).toBe('Mug studio shot')
    expect(manifest.images[0]?.shot).toBe('Mug front 2')
    expect(manifest.images[0]?.direction).toBe('a mug on a pale table')
    expect(manifest.images[0]?.altText).toContain('Glazed mug')
    expect(manifest.images[0]?.altText).toContain('Mug front 2')
  })
})
