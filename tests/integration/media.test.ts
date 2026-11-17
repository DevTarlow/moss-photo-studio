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
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { MediaService } from '@main/media/service'
import { SceneRepository } from '@main/db/repositories/scenes'
import { SetRepository } from '@main/db/repositories/sets'
import { ImageImportError, assertImportable, normaliseToWorking } from '@main/media/import'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let media: MediaService
let sets: SetRepository

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-media-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  const scenes = new SceneRepository(db)
  sets = new SetRepository(db)
  media = new MediaService({
    projects,
    images,
    people,
    scenes,
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

describe('HEIC guidance', () => {
  it('names an iPhone HEIC file instead of a generic unsupported error', () => {
    const bytes = new Uint8Array(64)
    bytes.set([0, 0, 0, 0x18], 0)
    bytes.set(Buffer.from('ftypheic'), 4)
    expect(() => assertImportable(bytes)).toThrow(/HEIC/)
  })
})

describe('Set inheritance in media', () => {
  it('copies Set membership through import, duplication, and batch color', async () => {
    const set = sets.create('Set media')
    const sourceProject = projects.create({ type: 'photo', name: 'Source' })
    const imported = await media.importSource({
      projectId: sourceProject.id,
      bytes: await jpeg(700, 500),
      name: 'source.jpg',
      setId: set.id
    })
    expect(images.get(imported.imageId!)?.setId).toBe(set.id)

    const target = projects.create({ type: 'image', name: 'Target' })
    const copied = await media.importFromImage({ projectId: target.id, imageId: imported.imageId! })
    expect(images.get(copied.imageId!)?.setId).toBe(set.id)

    const duplicated = await media.duplicateProject(sourceProject)
    expect(images.list(duplicated.projectId).every((image) => image.setId === set.id)).toBe(true)

    const batch = await media.applyBatchColor(sourceProject.id, { brightness: 5 })
    expect(batch.count).toBe(1)
    const adjusted = images.list(sourceProject.id).filter((image) => image.origin === 'local')
    expect(adjusted).toHaveLength(1)
    expect(adjusted[0]?.setId).toBe(set.id)
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
