import { describe, expect, it } from 'vitest'
import { paletteFromPixels } from '@shared/palette'

function pixels(entries: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(entries.length * 4)
  entries.forEach(([r, g, b, a = 255], index) => {
    data[index * 4] = r
    data[index * 4 + 1] = g
    data[index * 4 + 2] = b
    data[index * 4 + 3] = a
  })
  return data
}

describe('photo palette', () => {
  it('keeps the product colors and ignores a white backdrop', () => {
    const colors = paletteFromPixels(pixels([
      ...Array.from({ length: 80 }, () => [180, 40, 30] as [number, number, number]),
      ...Array.from({ length: 80 }, () => [30, 80, 160] as [number, number, number]),
      ...Array.from({ length: 160 }, () => [255, 255, 255] as [number, number, number])
    ]), 4)
    expect(colors.some((color) => color === '#b4281e')).toBe(true)
    expect(colors.some((color) => color === '#1e50a0')).toBe(true)
    expect(colors).not.toContain('#ffffff')
  })

  it('returns nothing for a transparent or pure white sample', () => {
    expect(paletteFromPixels(pixels([
      [255, 255, 255],
      [0, 0, 0, 0]
    ]))).toEqual([])
  })
})
