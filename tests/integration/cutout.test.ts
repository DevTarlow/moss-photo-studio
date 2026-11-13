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
import { UsageRepository } from '@main/db/repositories/usage'
import { MediaService } from '@main/media/service'
import { ProductService } from '@main/products/service'
import { FakeSamProvider } from '@main/muse/sam'

let dir = ''
let db: Db
let products: ProductRepository
let images: ImageRepository
let productService: ProductService
let usage: UsageRepository

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-cutout-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  const projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  const plans = new PlanRepository(db)
  const brand = new BrandRepository(db)
  products = new ProductRepository(db)
  usage = new UsageRepository(db)
  const media = new MediaService({ projects, images, plans, people: new PeopleRepository(db), brand, libraryPath, logger })
  productService = new ProductService({
    products,
    images,
    projects,
    plans,
    media,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources'),
    usage,
    sam: new FakeSamProvider()
  })
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('clean shot', () => {
  it('cuts out the product pixels and creates a linked 2048 clean photo', async () => {
    const product = await productService.addFromBytes({
      bytes: await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 190, g: 170, b: 140 } } }).webp().toBuffer(),
      name: 'Speckled mug'
    })
    const result = await productService.cleanShot(product.id)
    expect(result.projectId).toBeTruthy()
    const detail = productService.detail(product.id)
    expect(detail.projects.some((project) => project.id === result.projectId && project.type === 'photo')).toBe(true)
    expect(detail.product.cutoutUrl).toBeTruthy()
    expect(detail.product.cutoutConfidence).toBeGreaterThan(0.9)
    const rows = images.list(result.projectId)
    expect(rows).toHaveLength(1)
    const relative = decodeURI(rows[0]!.url!.replace('moss-media://library/', ''))
    const meta = await sharp(path.join(dir, 'library', relative)).metadata()
    expect(meta.width).toBe(2048)
    expect(meta.height).toBe(2048)
    const event = usage.list({ monthStart: 0, monthEnd: Date.now() + 1 }).items[0]
    expect(event).toMatchObject({ action: 'cutout', costMicros: 2500, result: 'ok' })
  })
})
