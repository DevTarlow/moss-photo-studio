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
import { ImageImportError, assertImportable, normaliseToWorking } from '@main/media/import'
import { exportSetProject } from '@main/media/export'
import { createDefaultPlan } from '@shared/plans'
import { shotDefinition } from '@shared/prompts/shots'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let plans: PlanRepository
let media: MediaService

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-media-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  plans = new PlanRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  media = new MediaService({
    projects,
    images,
    plans,
    people,
    brand,
    libraryPath: () => path.join(dir, 'library'),
    logger
  })
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function jpeg(width = 1200, height = 900, withExif = false): Promise<Buffer> {
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 130, b: 110 } } })
  if (withExif) pipeline = pipeline.withExif({ IFD0: { ImageDescription: 'moss test' } })
  return pipeline.jpeg({ quality: 92 }).toBuffer()
}

describe('import pipeline', () => {
  it('rejects a text file', () => {
    const bytes = new Uint8Array(Buffer.from('hello, this is not a photo'))
    expect(() => assertImportable(bytes)).toThrow(ImageImportError)
  })

  it('rejects a file over forty megabytes', () => {
    const bytes = new Uint8Array(40 * 1024 * 1024 + 2)
    bytes.set([0xff, 0xd8, 0xff], 0)
    expect(() => assertImportable(bytes)).toThrow(/larger than 40 MB/)
  })

  it('rejects an image under 256 px', async () => {
    const small = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer()
    await expect(
      normaliseToWorking({ libraryPath: path.join(dir, 'library'), projectId: 'p', imageId: 'i', bytes: small })
    ).rejects.toThrow(/too small/)
  })

  it('keeps the original byte for byte, strips EXIF from the working copy, and makes a thumb', async () => {
    const bytes = await jpeg(1200, 900, true)
    const project = projects.create({ type: 'photo', name: 'Mug photo' })
    const result = await media.importSource({ projectId: project.id, bytes, name: 'mug.jpg' })
    const image = images.get(result.imageId!)!
    expect(image.isOriginal).toBe(true)
    expect(image.origin).toBe('upload')
    expect(image.label).toBe('Original photo')
    const originalRelative = decodeURI(image.url!.replace('moss-media://library/', ''))
    const original = fs.readFileSync(path.join(dir, 'library', originalRelative))
    expect(Buffer.compare(original, bytes)).toBe(0)
    const working = path.join(dir, 'library', 'projects', project.id, 'working', `${image.id}.webp`)
    expect(fs.existsSync(working)).toBe(true)
    const meta = await sharp(working).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
    expect(meta.width).toBeLessThanOrEqual(2048)
    const thumb = decodeURI(image.thumbUrl!.replace('moss-media://library/', ''))
    expect(fs.existsSync(path.join(dir, 'library', thumb))).toBe(true)
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBeGreaterThan(0)
  })

  it('accepts a JPEG larger than five megabytes', async () => {
    const raw = crypto.randomBytes(1600 * 1600 * 3)
    const bytes = await sharp(raw, { raw: { width: 1600, height: 1600, channels: 3 } })
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toBuffer()
    expect(bytes.length).toBeGreaterThan(5 * 1024 * 1024)
    expect(bytes.length).toBeLessThan(40 * 1024 * 1024)
    const project = projects.create({ type: 'photo', name: 'Large JPEG' })
    const result = await media.importSource({ projectId: project.id, bytes, name: 'large.jpg' })
    expect(result.imageId).toBeTruthy()
    const image = images.get(result.imageId!)!
    const working = path.join(dir, 'library', 'projects', project.id, 'working', `${image.id}.webp`)
    const meta = await sharp(working).metadata()
    expect(meta.width).toBe(1600)
    expect(meta.height).toBe(1600)
  })

  it('does not overwrite the first original when another source is added', async () => {
    const project = projects.create({ type: 'photo', name: 'Two photos' })
    const firstBytes = await jpeg(600, 600)
    const secondBytes = await jpeg(700, 700)
    const first = await media.importSource({ projectId: project.id, bytes: firstBytes, name: 'one.jpg' })
    const second = await media.importSource({ projectId: project.id, bytes: secondBytes, name: 'two.jpg' })
    const firstImage = images.get(first.imageId!)!
    const firstRelative = decodeURI(firstImage.url!.replace('moss-media://library/', ''))
    expect(Buffer.compare(fs.readFileSync(path.join(dir, 'library', firstRelative)), firstBytes)).toBe(0)
    const secondImage = images.get(second.imageId!)!
    expect(secondImage.url).not.toBe(firstImage.url)
    expect(projects.get(project.id)!.sourceImageId).toBe(second.imageId)
  })

  it('keeps both originals when two imports arrive at once', async () => {
    const project = projects.create({ type: 'photo', name: 'Concurrent photos' })
    const firstBytes = await jpeg(620, 620)
    const secondBytes = await jpeg(720, 720)
    const [first, second] = await Promise.all([
      media.importSource({ projectId: project.id, bytes: firstBytes, name: 'one.jpg' }),
      media.importSource({ projectId: project.id, bytes: secondBytes, name: 'two.jpg' })
    ])
    expect(first.imageId).not.toBe(second.imageId)
    const rows = images.list(project.id, true)
    expect(rows).toHaveLength(2)
    for (const [row, bytes] of [[rows[0]!, firstBytes], [rows[1]!, secondBytes]] as const) {
      const relative = decodeURI(row.url!.replace('moss-media://library/', ''))
      expect(Buffer.compare(fs.readFileSync(path.join(dir, 'library', relative)), bytes)).toBe(0)
    }
  })
})

describe('set export', () => {
  it('names files in shot order, adds versions, writes set.txt, and never overwrites', async () => {
    const project = projects.create({ type: 'set', name: 'Candle set', category: 'ceramics' })
    const sourceBytes = await jpeg(640, 640)
    await media.importSource({ projectId: project.id, bytes: sourceBytes, name: 'candle.jpg' })
    const plan = createDefaultPlan({ category: 'ceramics', productName: 'Candle', shape: 'square', format: 'webp' })
    const shotOne = plan.shots[0]!
    const shotTwo = plan.shots[1]!
    plan.shots = [shotOne, shotTwo]
    plan.shots[0] = { ...shotOne, direction: 'a warm table' }
    plans.save(project.id, plan)
    const folder = path.join(dir, 'exports')
    const writeImage = async (id: string, resultColor: { r: number; g: number; b: number }, workingColor: { r: number; g: number; b: number }) => {
      const imagesDir = path.join(dir, 'library', 'projects', project.id, 'images')
      const workingDir = path.join(dir, 'library', 'projects', project.id, 'working')
      fs.mkdirSync(imagesDir, { recursive: true })
      fs.mkdirSync(workingDir, { recursive: true })
      const write = async (target: string, color: { r: number; g: number; b: number }) => {
        const buffer = await sharp({ create: { width: 500, height: 500, channels: 3, background: color } }).webp().toBuffer()
        fs.writeFileSync(target, buffer)
      }
      await write(path.join(imagesDir, `${id}.webp`), resultColor)
      await write(path.join(workingDir, `${id}.webp`), workingColor)
    }
    const oldId = crypto.randomUUID()
    const newId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    await writeImage(oldId, { r: 200, g: 100, b: 100 }, { r: 20, g: 20, b: 40 })
    await writeImage(newId, { r: 100, g: 200, b: 100 }, { r: 40, g: 20, b: 20 })
    await writeImage(otherId, { r: 100, g: 100, b: 200 }, { r: 20, g: 40, b: 20 })
    const now = Date.now()
    images.create({ id: oldId, projectId: project.id, kind: 'render', status: 'ready', label: 'Main shot', shotId: shotOne.id, file: `projects/${project.id}/images/${oldId}.webp`, format: 'webp', costCents: 1, now: now - 2000 })
    images.create({ id: newId, projectId: project.id, kind: 'render', status: 'ready', label: 'Main shot 2', shotId: shotOne.id, file: `projects/${project.id}/images/${newId}.webp`, format: 'webp', costCents: 1, now: now - 1000 })
    images.create({ id: otherId, projectId: project.id, kind: 'render', status: 'ready', label: 'In use', shotId: shotTwo.id, file: `projects/${project.id}/images/${otherId}.webp`, format: 'webp', costCents: 1, now })
    const ready = images.list(project.id, false)
    const workingPathFor = (image: (typeof ready)[number]): string =>
      path.join(dir, 'library', 'projects', project.id, 'working', `${image.id}.webp`)
    const centerPixel = async (file: string): Promise<{ r: number; g: number; b: number }> => {
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
      const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
      return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]! }
    }
    const result = await exportSetProject({
      libraryPath: path.join(dir, 'library'),
      projectName: project.name,
      plan: plans.getActive(project.id)!.json,
      images: ready,
      options: { format: 'webp', quality: 90, maxDimension: null, includeVersions: true },
      folder,
      workingPathFor
    })
    // The stored result (which carries the badge) must win over the
    // pre-badge working copy used for model requests.
    const newestPixel = await centerPixel(path.join(folder, '01-main-shot.webp'))
    expect(newestPixel.g).toBeGreaterThan(newestPixel.r)
    expect(newestPixel.g).toBeGreaterThan(newestPixel.b)
    const olderPixel = await centerPixel(path.join(folder, '01-main-shot-v1.webp'))
    expect(olderPixel.r).toBeGreaterThan(olderPixel.g)
    expect(olderPixel.r).toBeGreaterThan(olderPixel.b)
    expect(result.paths.map((file) => path.basename(file)).sort()).toEqual([
      '01-main-shot-v1.webp',
      '01-main-shot.webp',
      '02-in-use.webp'
    ])
    // Assert content names separately; the manifest is not in paths.
    const written = fs.readdirSync(folder).sort()
    expect(written).toContain('01-main-shot.webp')
    expect(written).toContain('01-main-shot-v1.webp')
    expect(written).toContain('02-in-use.webp')
    expect(written).toContain('set.txt')
    expect(written).not.toContain('source.jpg')
    const manifest = fs.readFileSync(path.join(folder, 'set.txt'), 'utf8')
    expect(manifest).toContain('Candle set')
    expect(manifest).toContain('Main shot')
    expect(manifest).toContain('Shot: Main shot')
    expect(manifest).toContain('Direction: a warm table')
    expect(manifest).toContain(shotDefinition('lifestyle').defaultDirection)

    // A pinned older version becomes the unsuffixed main image; the newer
    // version is exported beside it.
    const pinnedPlan = {
      ...plans.getActive(project.id)!.json,
      shots: plans.getActive(project.id)!.json.shots.map((shot) =>
        shot.id === shotOne.id ? { ...shot, selectedImageId: oldId } : shot
      )
    }
    plans.save(project.id, pinnedPlan)
    const pinnedFolder = path.join(dir, 'pinned-exports')
    const pinned = await exportSetProject({
      libraryPath: path.join(dir, 'library'),
      projectName: project.name,
      plan: pinnedPlan,
      images: ready,
      options: { format: 'webp', quality: 90, maxDimension: null, includeVersions: true },
      folder: pinnedFolder,
      workingPathFor
    })
    const pinnedMain = await centerPixel(path.join(pinnedFolder, '01-main-shot.webp'))
    expect(pinnedMain.r).toBeGreaterThan(pinnedMain.g)
    expect(pinnedMain.r).toBeGreaterThan(pinnedMain.b)
    const other = pinned.paths.find((file) => path.basename(file).startsWith('01-main-shot-'))!
    const otherPixel = await centerPixel(other)
    expect(otherPixel.g).toBeGreaterThan(otherPixel.r)
    expect(otherPixel.g).toBeGreaterThan(otherPixel.b)

    const second = await exportSetProject({
      libraryPath: path.join(dir, 'library'),
      projectName: project.name,
      plan: pinnedPlan,
      images: ready,
      options: { format: 'webp', quality: 90, maxDimension: null, includeVersions: false },
      folder,
      workingPathFor
    })
    const after = fs.readdirSync(folder)
    expect(after).toContain('01-main-shot-2.webp')
    expect(after).toContain('set-2.txt')
    expect(second.paths.length).toBe(2)
  })
})

describe('HEIC guidance', () => {
  it('names an iPhone HEIC file instead of a generic unsupported error', () => {
    const bytes = new Uint8Array(64)
    bytes.set([0, 0, 0, 0x18], 0)
    bytes.set(Buffer.from('ftypheic'), 4)
    expect(() => assertImportable(bytes)).toThrow(/HEIC/)
  })
})

describe('batch color grade', () => {
  it('creates a local version of every ready image without touching crop or rotation', async () => {
    const project = projects.create({ type: 'photo', name: 'Batch grade' })
    for (const shade of [70, 120, 180]) {
      await media.importSource({
        projectId: project.id,
        bytes: await jpeg(700, 500, false),
        name: `shade-${shade}.jpg`
      })
    }
    const result = await media.applyBatchColor(project.id, { brightness: 10, contrast: 5 })
    expect(result.count).toBe(3)
    const all = images.list(project.id)
    expect(all).toHaveLength(6)
    const created = all.filter((image) => image.origin === 'local')
    expect(created).toHaveLength(3)
    expect(created.every((image) => image.kind === 'adjust' && Boolean(image.parentId))).toBe(true)
    expect(created.every((image) => image.adjust?.brightness === 10 && image.adjust?.contrast === 5)).toBe(true)
    expect(created.every((image) => !image.adjust?.crop && !image.adjust?.rotate)).toBe(true)
  })
})
