import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { addSizeLabel } from '@main/media/label'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-size-label-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('size label', () => {
  it('writes a new webp with a badge at the bottom and leaves the rest of the frame', async () => {
    const source = path.join(dir, 'source.webp')
    await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 190, b: 180 } } }).webp().toFile(source)
    const result = await addSizeLabel({
      libraryPath: dir,
      sourcePath: source,
      imageId: 'label-1',
      projectId: 'project-1',
      width: 18,
      height: 12,
      unit: 'cm'
    })
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
    const output = path.join(dir, result.relative)
    expect(fs.existsSync(output)).toBe(true)
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true })
    const top = (40 * info.width + 400) * info.channels
    const bottom = (560 * info.width + 400) * info.channels
    expect(data[top]).toBe(200)
    expect(data[bottom]).toBeLessThan(170)
    expect(fs.existsSync(path.join(dir, result.thumb))).toBe(true)
  })
})
