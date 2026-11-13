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
import type { TextProvider, TextRequest } from '@main/muse/text'

let dir = ''
let db: Db
let productService: ProductService
let usage: UsageRepository
let request: TextRequest | null = null
let fail = false

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-analysis-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  const projects = new ProjectRepository(db)
  const images = new ImageRepository(db)
  const plans = new PlanRepository(db)
  const brand = new BrandRepository(db)
  const products = new ProductRepository(db)
  usage = new UsageRepository(db)
  const media = new MediaService({ projects, images, plans, people: new PeopleRepository(db), brand, libraryPath, logger })
  const provider: TextProvider = {
    async generate(input) {
      request = input
      if (fail) return { ok: false, code: 'invalid_key', status: 401, requestId: 'req' }
      return {
        ok: true,
        requestId: 'req',
        costMicros: 42,
        content: JSON.stringify({
          product: 'Speckled mug',
          category: 'Ceramics and pottery',
          audience: 'People setting up a calm home office',
          points: ['Speckled glaze', 'Wide handle', 'Holds about 350 ml']
        })
      }
    }
  }
  productService = new ProductService({
    products,
    images,
    projects,
    plans,
    media,
    libraryPath,
    resourceRoot: () => path.resolve(__dirname, '../../resources'),
    provider,
    usage
  })
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function productId(): Promise<string> {
  const product = await productService.addFromBytes({
    bytes: await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 180, g: 160, b: 140 } } }).webp().toBuffer(),
    name: 'Mug'
  })
  return product.id
}

describe('product photo read', () => {
  it('fills the blanks from the photo, stores the points, and records the text cost', async () => {
    const id = await productId()
    const detail = await productService.analyze(id)
    expect(detail.product.category).toBe('Ceramics and pottery')
    expect(detail.product.audience).toBe('People setting up a calm home office')
    expect(detail.product.analysis?.points).toEqual(['Speckled glaze', 'Wide handle', 'Holds about 350 ml'])
    expect(request?.image?.mime).toBe('image/webp')
    const event = usage.list({ monthStart: 0, monthEnd: Date.now() + 1 }).items[0]
    expect(event).toMatchObject({ action: 'analyze', costCents: 0, costMicros: 42, result: 'ok' })
  })

  it('records a failed read without charging the ledger', async () => {
    fail = true
    const id = await productId()
    await expect(productService.analyze(id)).rejects.toMatchObject({ code: 'unreadable' })
    const event = usage.list({ monthStart: 0, monthEnd: Date.now() + 1 }).items[0]
    expect(event).toMatchObject({ action: 'analyze', costMicros: 0, result: 'failed', errorCode: 'invalid_key' })
  })
})
