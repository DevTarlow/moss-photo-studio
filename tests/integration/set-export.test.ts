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
import { SetRepository } from '@main/db/repositories/sets'
import { ProductRepository } from '@main/db/repositories/products'
import { exportSetImages } from '@main/media/setExport'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let sets: SetRepository
let products: ProductRepository

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-set-export-'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: new Logger(path.join(dir, 'logs')) })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  sets = new SetRepository(db)
  products = new ProductRepository(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Set export', () => {
  it('writes product sources into the Set folder', async () => {
    const set = sets.create('Product export')
    const file = 'products/mug.webp'
    const absolute = path.join(dir, 'library', file)
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true })
    await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 100, g: 120, b: 90 } } }).webp().toFile(absolute)
    const product = products.create({ id: 'mug-product', name: 'Mug product', file, thumb: file, width: 640, height: 640 })
    products.setSet(product.id, set.id)
    const result = await exportSetImages({
      libraryPath: path.join(dir, 'library'),
      name: set.name,
      images: [],
      products: products.listBySet(set.id),
      options: { format: 'webp', quality: 90, maxDimension: null },
      parentFolder: path.join(dir, 'exports'),
      workingPathFor: () => ''
    })
    expect(result.count).toBe(1)
    expect(fs.readdirSync(result.folder)[0]).toMatch(/^01-Mug-product\.webp$/)
  })

  it('writes a dedicated folder with numbered images in Set order', async () => {
    const set = sets.create('Spring collection')
    const project = projects.create({ type: 'image', name: 'Spring shoot' })
    const created = []
    for (const [index, label] of ['Hero', 'Detail'].entries()) {
      const id = `image-${index}`
      const relative = `projects/${project.id}/images/${id}.webp`
      const absolute = path.join(dir, 'library', relative)
      await fs.promises.mkdir(path.dirname(absolute), { recursive: true })
      await sharp({ create: { width: 640, height: 640, channels: 3, background: { r: 90 + index * 30, g: 120, b: 100 } } }).webp().toFile(absolute)
      created.push(images.create({
        id,
        projectId: project.id,
        kind: 'render',
        status: 'ready',
        file: relative,
        label,
        setId: set.id,
        now: 1000 + index * 1000
      }))
    }
    const ordered = images.listBySet(set.id).map((item) => images.get(item.id)!).filter(Boolean)
    const parent = path.join(dir, 'exports')
    const result = await exportSetImages({
      libraryPath: path.join(dir, 'library'),
      name: set.name,
      images: ordered,
      options: { format: 'webp', quality: 90, maxDimension: null },
      parentFolder: parent,
      workingPathFor: (image) => path.join(dir, 'library', 'projects', image.projectId, 'working', `${image.id}.webp`)
    })
    expect(result.count).toBe(2)
    expect(result.folderName).toMatch(/^Moss Set - Spring collection - /)
    const files = fs.readdirSync(result.folder)
    expect(files[0]).toMatch(/^01-Detail\.webp$/)
    expect(files[1]).toMatch(/^02-Hero\.webp$/)
    expect(created).toHaveLength(2)

    const second = await exportSetImages({
      libraryPath: path.join(dir, 'library'),
      name: set.name,
      images: ordered,
      options: { format: 'webp', quality: 90, maxDimension: null },
      parentFolder: parent,
      workingPathFor: (image) => path.join(dir, 'library', 'projects', image.projectId, 'working', `${image.id}.webp`)
    })
    expect(second.folderName).not.toBe(result.folderName)
    expect(fs.readdirSync(parent)).toHaveLength(2)
  })
})
