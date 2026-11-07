import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Logger, redactText } from '@main/logger'
import { cropPixels } from '@main/media/transform'
import { applyBadge, badgePadding, badgePosition, badgeWidth } from '@main/media/badge'
import sharp from 'sharp'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-unit-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('log redaction', () => {
  it('removes bearer tokens and Muse keys from strings', () => {
    expect(redactText('Authorization: Bearer abc.def.123')).not.toContain('abc.def.123')
    expect(redactText('the key LLM|super-secret-value is gone')).not.toContain('super-secret-value')
    expect(redactText('license_key=MOSS-1234-5678')).not.toContain('MOSS-1234-5678')
  })

  it('never writes a key from the message or a blocked field', () => {
    const logger = new Logger(dir)
    const fakeMuse = 'LLM|fake-muse-key-123456'
    const fakeLicense = 'MOSS-fake-license-123456'
    logger.info('test', `bearer Bearer ${fakeMuse}`, { key: fakeMuse, licenseKey: fakeLicense, count: 3 })
    logger.error('test', `license_key=${fakeLicense}`, { authorization: `Bearer ${fakeMuse}` })
    const contents = fs.readFileSync(path.join(dir, 'main.log'), 'utf8')
    expect(contents).not.toContain(fakeMuse)
    expect(contents).not.toContain(fakeLicense)
    expect(contents).toContain('"count":3')
  })
})

describe('image transform math', () => {
  it('converts fractional crop to pixels after rotation size is known', () => {
    expect(cropPixels(1000, 500, { x: 0.1, y: 0.2, width: 0.5, height: 0.6 })).toEqual({
      left: 100,
      top: 100,
      width: 500,
      height: 300
    })
  })

  it('clamps out-of-range crop values', () => {
    expect(cropPixels(1000, 1000, { x: 0.8, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      left: 800,
      top: 900,
      width: 200,
      height: 100
    })
  })

  it('never upscales a badge beyond the logo width', () => {
    expect(badgeWidth(1000, 'm', 500)).toBe(120)
    expect(badgeWidth(1000, 'l', 100)).toBe(100)
    expect(badgeWidth(1000, 's', 500)).toBe(80)
  })

  it('pads four percent of the shorter edge and lands in the right corner', () => {
    expect(badgePadding(1000)).toBe(40)
    expect(badgePosition({ width: 1000, height: 800, logoWidth: 100, logoHeight: 50, corner: 'br' })).toEqual({ left: 868, top: 718 })
    expect(badgePosition({ width: 1000, height: 800, logoWidth: 100, logoHeight: 50, corner: 'tl' })).toEqual({ left: 32, top: 32 })
  })
})

describe('renderer constraints', () => {
  const renderer = path.resolve(__dirname, '../../src/renderer/src')
  const files: string[] = []
  const walk = (folder: string): void => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full)
    }
  }
  walk(renderer)

  it('keeps every color in tokens.css', () => {
    const violations = files
      .filter((file) => path.basename(file) !== 'tokens.css')
      .flatMap((file) => {
        const text = fs.readFileSync(file, 'utf8')
        const matches = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
        return matches.map((match) => `${path.relative(renderer, file)}: ${match}`)
      })
    expect(violations).toEqual([])
  })

  it('does not hardcode cents in the interface', () => {
    const violations = files
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) => {
        const text = fs.readFileSync(file, 'utf8')
        const matches = text.match(/\$\d+\.\d{2}/g) ?? []
        return matches.map((match) => `${path.relative(renderer, file)}: ${match}`)
      })
    expect(violations).toEqual([])
  })

  it('never uses text below eleven pixels', () => {
    const violations = files
      .filter((file) => file.endsWith('.tsx') || file.endsWith('.css'))
      .flatMap((file) => {
        const text = fs.readFileSync(file, 'utf8')
        const matches = text.match(/font-size:\s*([0-9.]+)px|text-\[([0-9.]+)px\]/g) ?? []
        return matches
          .filter((match) => {
            const number = Number(match.match(/([0-9.]+)px/)?.[1] ?? '99')
            return number < 11
          })
          .map((match) => `${path.relative(renderer, file)}: ${match}`)
      })
    expect(violations).toEqual([])
  })
})


describe('logo badge compositing', () => {
  it('places the logo at four percent padding without changing the canvas size', async () => {
    const library = path.join(dir, 'library')
    fs.mkdirSync(path.join(library, 'brand'), { recursive: true })
    fs.mkdirSync(path.join(library, 'projects', 'p'), { recursive: true })
    const base = path.join(library, 'projects', 'p', 'base.webp')
    const logo = path.join(library, 'brand', 'logo.png')
    await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } } }).webp().toFile(base)
    await sharp({ create: { width: 100, height: 50, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 1 } } }).png().toFile(logo)
    const result = await applyBadge({
      imagePath: base,
      libraryPath: library,
      logoRelative: 'brand/logo.png',
      format: 'webp',
      brand: {
        colors: [],
        colorsEnabled: true,
        logoUrl: 'moss-media://library/brand/logo.png',
        badgeEnabled: true,
        badgeCorner: 'br',
        badgeScale: 'm',
        badgeOpacity: 100
      }
    })
    expect(result.applied).toBe(true)
    const meta = await sharp(base).metadata()
    expect(meta.width).toBe(800)
    expect(meta.height).toBe(600)
    // Bypass libvips' filename operation cache after the in-place badge write.
    const raw = await sharp(fs.readFileSync(base)).raw().toBuffer()
    const pixel = (x: number, y: number): [number, number, number] => {
      const offset = (y * 800 + x) * (raw.length / (800 * 600))
      return [raw[offset]!, raw[offset + 1]!, raw[offset + 2]!]
    }
    expect(pixel(760, 560)[0]).toBeGreaterThan(150)
    expect(pixel(760, 560)[1]).toBeLessThan(80)
    expect(pixel(400, 300)[0]).toBeGreaterThan(240)
  })
})
