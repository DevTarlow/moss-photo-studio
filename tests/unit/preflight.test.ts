import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { inspectPhoto } from '@main/media/preflight'

async function checker(size: number): Promise<Buffer> {
  const pixels = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = (x + y) % 2 === 0 ? 225 : 30
      const at = (y * size + x) * 3
      pixels[at] = value
      pixels[at + 1] = value
      pixels[at + 2] = value
    }
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
}

describe('local photo preflight', () => {
  it('flags a dark, flat, tiny photo', async () => {
    const bytes = await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 20, g: 20, b: 20 } } }).png().toBuffer()
    const check = await inspectPhoto(bytes)
    expect(check.warnings.map((warning) => warning.code)).toEqual(['small', 'dark', 'low_contrast', 'soft'])
  })

  it('does not call a sharp, full-size checkerboard soft', async () => {
    const check = await inspectPhoto(await checker(512))
    expect(check.warnings.map((warning) => warning.code)).not.toContain('soft')
  })
})
