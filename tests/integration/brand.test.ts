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

describe('brand settings', () => {
  it('saves colors, badge and default look without business fields', () => {
    const initial = brand.get()
    expect(initial).toMatchObject({ colors: [], colorsEnabled: true, badgeEnabled: false, stylePreset: 'none' })
    expect(initial).not.toHaveProperty('businessName')
    brand.update({
      colors: ['#14532d', '#9a3412'],
      badgeEnabled: true,
      badgeCorner: 'bl',
      badgeScale: 'l',
      badgeOpacity: 80,
      stylePreset: 'warm-home'
    })
    const saved = brand.get()
    expect(saved).toMatchObject({
      colors: ['#14532d', '#9a3412'],
      badgeEnabled: true,
      badgeCorner: 'bl',
      badgeScale: 'l',
      badgeOpacity: 80,
      stylePreset: 'warm-home'
    })
    brand.update({ colorsEnabled: false })
    expect(brand.get().colorsEnabled).toBe(false)
    expect(brand.get().colors).toEqual(['#14532d', '#9a3412'])
  })
})
