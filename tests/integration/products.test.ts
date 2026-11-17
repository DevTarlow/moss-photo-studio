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
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { ProductRepository } from '@main/db/repositories/products'
import { SceneRepository } from '@main/db/repositories/scenes'
import { SetRepository } from '@main/db/repositories/sets'
import { MediaService } from '@main/media/service'
import { ProductService } from '@main/products/service'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let products: ProductRepository
let sets: SetRepository
let media: MediaService
let productService: ProductService

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-products-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  const scenes = new SceneRepository(db)
  products = new ProductRepository(db)
  sets = new SetRepository(db)
  media = new MediaService({ projects, images, people, scenes, brand, libraryPath, logger })
  productService = new ProductService({
    products,
    images,
    projects,
    media,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources')
  })
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 120, g: 130, b: 110 } } })
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function imageProject(name = 'Mug photo'): Promise<{ projectId: string; imageId: string }> {
  const project = projects.create({ type: 'photo', name })
  const imported = await media.importSource({ projectId: project.id, bytes: await jpeg(), name: `${name}.jpg` })
  return { projectId: project.id, imageId: imported.imageId! }
}

describe('products', () => {
  it('saves an image, survives deleting its project, and keeps working', async () => {
    const source = await imageProject()
    const product = await productService.saveFromImage({ imageId: source.imageId, name: 'Ceramic mug' })
    expect(products.list()).toHaveLength(1)
    expect(fs.existsSync(path.join(libraryPath(), 'products', `${product.id}.webp`))).toBe(true)

    await media.deleteProjectFiles(source.projectId)
    projects.delete(source.projectId)
    expect(products.list()[0]?.name).toBe('Ceramic mug')

    const target = await imageProject('Target')
    const imported = await productService.importIntoProject({ productId: product.id, projectId: target.projectId })
    expect(imported.imageId).toBeTruthy()
  })

  it('copies a library image into another project as a new source', async () => {
    const source = await imageProject('Source photo')
    const target = projects.create({ type: 'photo', name: 'Target photo' })
    const imported = await media.importFromImage({ projectId: target.id, imageId: source.imageId })
    expect(imported.imageId).toBeTruthy()
    expect(images.list(target.id)).toHaveLength(1)
    expect(projects.get(target.id)?.sourceImageId).toBe(imported.imageId)
    expect(images.list(source.projectId)).toHaveLength(1)
  })

  it('adds a product from bytes, renames it, and removes its files on delete', async () => {
    const product = await productService.addFromBytes({ bytes: await jpeg(), name: '  Vase  ' })
    expect(product.name).toBe('Vase')
    const renamed = products.rename(product.id, 'Clay vase')
    expect(renamed?.name).toBe('Clay vase')
    const withNotes = products.update(product.id, { notes: '  matte clay, oatmeal glaze  ' })
    expect(withNotes?.notes).toBe('matte clay, oatmeal glaze')
    expect(products.get(product.id)?.notes).toBe('matte clay, oatmeal glaze')
    expect(products.update(product.id, { notes: null })?.notes).toBeNull()
    await productService.delete(product.id)
    expect(products.list()).toHaveLength(0)
    expect(fs.existsSync(path.join(libraryPath(), 'products', `${product.id}.webp`))).toBe(false)
  })

  it('creates photo and image projects from a product', async () => {
    const product = await productService.addFromBytes({ bytes: await jpeg(), name: 'Mug' })
    const photo = await productService.createProject({ productId: product.id, type: 'photo', shape: 'square', format: 'webp' })
    expect(projects.get(photo.projectId)?.type).toBe('photo')
    expect(projects.get(photo.projectId)?.productId).toBe(product.id)
    expect(images.get(photo.imageId)?.status).toBe('ready')
    expect(projects.get(photo.projectId)?.sourceImageId).toBe(photo.imageId)

    const image = await productService.createProject({ productId: product.id, type: 'image', shape: 'square', format: 'webp' })
    expect(projects.get(image.projectId)?.type).toBe('image')
  })

  it('groups work into a product, links unfiled work, and archives without deleting it', async () => {
    const product = await productService.addFromBytes({ bytes: await jpeg(), name: 'Candle' })
    const photo = await productService.createProject({ productId: product.id, type: 'photo', shape: 'square', format: 'webp' })
    const loose = await imageProject('Loose edit')
    expect(productService.detail(product.id).counts.projects).toBe(1)
    productService.linkProject(product.id, loose.projectId)
    const detail = productService.detail(product.id)
    expect(detail.counts.projects).toBe(2)
    expect(detail.projects.some((project) => project.id === photo.projectId)).toBe(true)
    productService.unlinkProject(loose.projectId)
    expect(projects.get(loose.projectId)?.productId).toBeNull()

    const archived = products.archive(product.id)
    expect(archived?.status).toBe('archived')
    expect(products.list()).toHaveLength(0)
    expect(products.list({ includeArchived: true })).toHaveLength(1)
    expect(projects.get(photo.projectId)?.productId).toBe(product.id)
  })

  it('creates a product from an existing project and links it', async () => {
    const source = await imageProject('Unfiled mug')
    expect(projects.get(source.projectId)?.productId).toBeNull()
    const product = await productService.createFromProject({ projectId: source.projectId, name: 'Mug' })
    expect(projects.get(source.projectId)?.productId).toBe(product.id)
    expect(productService.detail(product.id).counts.projects).toBe(1)
  })

  it('lists ready library images across projects with search and hides failed or deleted images', async () => {
    const first = await imageProject('Mug photos')
    await imageProject('Vase photos')
    const deleted = await imageProject('Deleted photos')
    images.softDelete(deleted.imageId)
    expect(images.listLibrary().total).toBe(2)

    const found = images.listLibrary({ search: 'Vase' })
    expect(found.total).toBe(1)
    expect(found.items[0]?.projectName).toBe('Vase photos')

    const fromFirst = images.listLibrary({ search: 'Mug' })
    expect(fromFirst.items.some((image) => image.projectId === first.projectId)).toBe(true)
  })
})

describe('product Sets', () => {
  it('inherits the product Set when starting new work', async () => {
    const source = await imageProject()
    const product = await productService.saveFromImage({ imageId: source.imageId, name: 'Set product' })
    const set = sets.create('Product set')
    products.setSet(product.id, set.id)
    const created = await productService.createProject({
      productId: product.id,
      type: 'image',
      shape: 'square',
      format: 'webp'
    })
    expect(images.get(created.imageId)?.setId).toBe(set.id)
    const target = projects.create({ type: 'photo', name: 'Product import target' })
    const imported = await productService.importIntoProject({ productId: product.id, projectId: target.id })
    expect(images.get(imported.imageId!)?.setId).toBe(set.id)
  })
})

describe('bundled products', () => {
  it('uses the resource asset as a starting point without a saved row', async () => {
    const created = await productService.createProject({
      productId: 'dropper-bottle',
      type: 'image',
      shape: 'square',
      format: 'webp'
    })
    const source = images.get(created.imageId)
    expect(source?.label).toBe('Amber dropper bottle')
    expect(source?.width).toBe(1024)
    expect(products.list()).toHaveLength(0)
    expect(projects.get(created.projectId)?.sourceImageId).toBe(created.imageId)
    expect(projects.get(created.projectId)?.productId).toBeNull()

    const target = projects.create({ type: 'photo', name: 'Bundled target' })
    const imported = await productService.importIntoProject({
      productId: 'dropper-bottle',
      projectId: target.id
    })
    expect(imported.imageId).toBeTruthy()
    expect(products.list()).toHaveLength(0)
  })

  it('refuses to delete an included product', async () => {
    await expect(productService.delete('dropper-bottle')).rejects.toMatchObject({ code: 'unreadable' })
  })
})
