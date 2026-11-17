import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { applyLocalAdjust } from '@main/media/transform'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-adjust-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('local adjust rendering', () => {
  it('rotates, crops, sharpens and writes a new file without touching the source', async () => {
    const source = path.join(dir, 'source.webp')
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 120, g: 130, b: 110 } } }).webp().toFile(source)
    const before = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
    const imageId = crypto.randomUUID()
    const result = await applyLocalAdjust({
      libraryPath: dir,
      sourcePath: source,
      imageId,
      projectId: 'project-1',
      transform: {
        rotate: 90,
        flipH: true,
        crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
        brightness: 25,
        contrast: 10,
        highlights: 20,
        shadows: 15,
        saturation: 12,
        warmth: 10,
        sharpen: 35,
        vignette: 20
      }
    })
    const after = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
    expect(after).toBe(before)
    expect(result.width).toBe(400)
    expect(result.height).toBe(480)
    const file = path.join(dir, 'projects', 'project-1', 'images', `${imageId}.webp`)
    expect(fs.existsSync(file)).toBe(true)
    const meta = await sharp(file).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(480)
    expect(fs.existsSync(path.join(dir, 'projects', 'project-1', 'working', `${imageId}.webp`))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'projects', 'project-1', 'thumbs', `${imageId}.webp`))).toBe(true)
  })
})
