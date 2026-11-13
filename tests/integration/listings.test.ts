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
import { ListingRepository } from '@main/db/repositories/listings'
import { UsageRepository } from '@main/db/repositories/usage'
import { MediaService } from '@main/media/service'
import { ProductService } from '@main/products/service'
import { ListingsService } from '@main/listings/service'
import type { TextProvider, TextRequest } from '@main/muse/text'
import { createDefaultPlan } from '@shared/plans'

let dir = ''
let db: Db
let products: ProductRepository
let listings: ListingRepository
let brand: BrandRepository
let listingsService: ListingsService
let productService: ProductService
let plans: PlanRepository
let captured: TextRequest | null = null

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-listings-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  const projects = new ProjectRepository(db)
  const images = new ImageRepository(db)
  plans = new PlanRepository(db)
  brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  products = new ProductRepository(db)
  listings = new ListingRepository(db)
  const usage = new UsageRepository(db)
  const media = new MediaService({ projects, images, plans, people, brand, libraryPath, logger })
  productService = new ProductService({
    products,
    images,
    projects,
    plans,
    media,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources')
  })
  const provider: TextProvider = {
    async generate(input) {
      captured = input
      return {
        ok: true,
        requestId: 'req',
        costMicros: 57,
        content: JSON.stringify({
          titles: [
            'A warm ceramic mug for slow mornings',
            'Hand-finished stoneware mug',
            'The everyday mug you reach for first'
          ],
          description: 'A hand-finished mug with a soft speckled glaze, made for a slow morning.',
          features: ['Hand finished', 'Speckled glaze', 'Holds 350 ml', 'Dishwasher safe', 'Made in small batches'],
          tags: ['ceramic', 'mug', 'handmade', 'ceramic', 'stoneware']
        })
      }
    }
  }
  listingsService = new ListingsService({
    products,
    projects,
    plans,
    images,
    brand,
    listings,
    usage,
    provider,
    libraryPath,
    logger
  })
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function makeProductAndSet(): Promise<{ productId: string; projectId: string }> {
  const product = await productService.addFromBytes({
    bytes: await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 180, g: 160, b: 140 } } }).webp().toBuffer(),
    name: 'Speckled mug',
    category: 'Ceramics and pottery'
  })
  const set = await productService.createProject({ productId: product.id, type: 'set', shape: 'square', format: 'webp' })
  plans.save(set.projectId, createDefaultPlan({
    category: 'ceramics',
    productName: 'Speckled mug',
    shape: 'square',
    format: 'webp'
  }))
  products.update(product.id, { audience: 'People setting up a calm home office', notes: '350 ml, speckled glaze' })
  brand.update({
    businessName: 'Moss Pottery',
    sells: 'Hand-thrown ceramics',
    audience: 'People who like quiet mornings',
    voice: 'Warm, specific, no hype',
    policies: 'Ships in three days',
    marketplaces: ['Etsy'],
    defaultPlatform: 'etsy'
  })
  return { productId: product.id, projectId: set.projectId }
}

describe('listing writer', () => {
  it('writes a platform-clamped listing from the product, plan, and profile', async () => {
    const { productId } = await makeProductAndSet()
    const result = await listingsService.generate({ productId, platform: 'etsy' })
    expect(result.copy.titles).toHaveLength(3)
    expect(result.copy.titles.every((title) => title.length <= 140)).toBe(true)
    expect(result.copy.tags).toEqual(['ceramic', 'mug', 'handmade', 'stoneware'])
    expect(result.copy.altTexts).toHaveLength(6)
    expect(result.copy.costMicros).toBe(57)
    expect(captured?.image?.mime).toBe('image/webp')
    expect(captured?.user).toContain('Product: Speckled mug')
    expect(captured?.user).toContain('Shop: Moss Pottery')
    expect(captured?.user).toContain('Warm, specific, no hype')
    expect(listingsService.get(productId, 'etsy')?.copy.description).toContain('hand-finished mug')
    const usage = new UsageRepository(db).monthSummary(0, Date.now() + 1)
    expect(usage.micros).toBeGreaterThan(0)
    const event = new UsageRepository(db).list({ monthStart: 0, monthEnd: Date.now() + 1 }).items[0]
    expect(event).toMatchObject({ action: 'listing', costCents: 0, costMicros: 57, result: 'ok' })
  })

  it('clamps an edited listing and saves a new version', async () => {
    const { productId } = await makeProductAndSet()
    const first = await listingsService.generate({ productId, platform: 'etsy' })
    const saved = listingsService.save({
      productId,
      platform: 'etsy',
      copy: {
        titles: ['x'.repeat(200)],
        description: 'A'.repeat(3000),
        features: ['f'.repeat(200)],
        tags: ['tag', 'tag'],
        altTexts: first.copy.altTexts,
        costMicros: first.copy.costMicros
      }
    })
    expect(saved.version).toBe(2)
    expect(saved.copy.titles[0]?.length).toBe(140)
    expect(saved.copy.description.length).toBe(1200)
    expect(saved.copy.features[0]?.length).toBe(120)
    expect(saved.copy.tags).toEqual(['tag'])
    expect(saved.copy.altTexts).toHaveLength(6)
  })

  it('uses the own-site limits when the shop has no tags', async () => {
    const { productId } = await makeProductAndSet()
    const result = await listingsService.generate({ productId, platform: 'own' })
    expect(result.copy.platform).toBe('own')
    expect(result.copy.tags).toEqual([])
    expect(result.copy.titles.every((title) => title.length <= 90)).toBe(true)
  })
})
