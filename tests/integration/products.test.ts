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
import { PlanRepository } from '@main/db/repositories/plans'
import { BrandRepository } from '@main/db/repositories/brand'
import { PeopleRepository } from '@main/db/repositories/people'
import { ProductRepository } from '@main/db/repositories/products'
import { MediaService } from '@main/media/service'
import { ProductService } from '@main/products/service'
import { createDefaultPlan } from '@shared/plans'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let plans: PlanRepository
let products: ProductRepository
let media: MediaService
let productService: ProductService

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-products-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  plans = new PlanRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
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
    await productService.delete(product.id)
    expect(products.list()).toHaveLength(0)
    expect(fs.existsSync(path.join(libraryPath(), 'products', `${product.id}.webp`))).toBe(false)
  })

  it('creates set, photo, and image projects from a product', async () => {
    const product = await productService.addFromBytes({ bytes: await jpeg(), name: 'Mug' })
    const set = await productService.createProject({ productId: product.id, type: 'set', shape: 'square', format: 'webp' })
    expect(projects.get(set.projectId)?.type).toBe('set')
    expect(projects.get(set.projectId)?.productId).toBe(product.id)
    // The set asks what the seller sells before it gets a plan.
    expect(plans.getActive(set.projectId)).toBeNull()
    expect(projects.get(set.projectId)?.category).toBeNull()
    expect(images.get(set.imageId)?.status).toBe('ready')

    const plan = createDefaultPlan({
      category: 'clothing',
      productName: 'Mug',
      shape: 'square',
      format: 'webp'
    })
    plans.save(set.projectId, plan)
    expect(plans.getActive(set.projectId)?.json.category).toBe('clothing')
    expect(projects.get(set.projectId)?.category).toBe('clothing')

    const photo = await productService.createProject({ productId: product.id, type: 'photo', shape: 'square', format: 'webp' })
    expect(projects.get(photo.projectId)?.sourceImageId).toBe(photo.imageId)

    const image = await productService.createProject({ productId: product.id, type: 'image', shape: 'square', format: 'webp' })
    expect(projects.get(image.projectId)?.type).toBe('image')
  })

  it('groups work into a product, links unfiled work, and archives without deleting it', async () => {
    const product = await productService.addFromBytes({ bytes: await jpeg(), name: 'Candle' })
    const set = await productService.createProject({ productId: product.id, type: 'set', shape: 'square', format: 'webp' })
    const loose = await imageProject('Loose edit')
    expect(productService.detail(product.id).counts.projects).toBe(1)
    productService.linkProject(product.id, loose.projectId)
    const detail = productService.detail(product.id)
    expect(detail.counts.projects).toBe(2)
    expect(detail.counts.sets).toBe(1)
    expect(detail.projects.some((project) => project.id === set.projectId)).toBe(true)
    productService.unlinkProject(loose.projectId)
    expect(projects.get(loose.projectId)?.productId).toBeNull()

    const archived = products.archive(product.id)
    expect(archived?.status).toBe('archived')
    expect(products.list()).toHaveLength(0)
    expect(products.list({ includeArchived: true })).toHaveLength(1)
    expect(projects.get(set.projectId)?.productId).toBe(product.id)
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

describe('bundled products', () => {
  it('uses the resource asset as a starting point without a saved row', async () => {
    const set = await productService.createProject({
      productId: 'dropper-bottle',
      type: 'set',
      shape: 'square',
      format: 'webp'
    })
    const source = images.get(set.imageId)
    expect(source?.label).toBe('Amber dropper bottle')
    expect(source?.width).toBe(1024)
    expect(products.list()).toHaveLength(0)
    expect(projects.get(set.projectId)?.sourceImageId).toBe(set.imageId)
    expect(projects.get(set.projectId)?.productId).toBeNull()

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
