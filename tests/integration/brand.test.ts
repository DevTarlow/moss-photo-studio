import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { BrandRepository } from '@main/db/repositories/brand'

let dir = ''
let db: Db
let brand: BrandRepository

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-brand-'))
  db = openDatabase({
    file: path.join(dir, 'library.sqlite'),
    libraryPath: path.join(dir, 'library'),
    logger: new Logger(path.join(dir, 'logs'))
  })
  brand = new BrandRepository(db)
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('business profile', () => {
  it('saves the shop details and keeps them when colors change', () => {
    expect(brand.get()).toMatchObject({ businessName: '', sells: '', marketplaces: [], defaultPlatform: 'etsy' })
    brand.update({
      businessName: 'Moss Pottery',
      sells: 'Hand-thrown ceramics',
      audience: 'People setting up a calm home office',
      voice: 'Warm, specific, no hype.',
      policies: 'Ships in three days. Returns within 14.',
      marketplaces: ['Etsy', 'My own shop'],
      defaultPlatform: 'etsy',
      colors: ['#14532d', '#9a3412']
    })
    const saved = brand.get()
    expect(saved).toMatchObject({
      businessName: 'Moss Pottery',
      sells: 'Hand-thrown ceramics',
      audience: 'People setting up a calm home office',
      voice: 'Warm, specific, no hype.',
      policies: 'Ships in three days. Returns within 14.',
      marketplaces: ['Etsy', 'My own shop'],
      defaultPlatform: 'etsy',
      colors: ['#14532d', '#9a3412']
    })
    brand.update({ colorsEnabled: false })
    expect(brand.get().businessName).toBe('Moss Pottery')
    expect(brand.get().colorsEnabled).toBe(false)
  })
})
