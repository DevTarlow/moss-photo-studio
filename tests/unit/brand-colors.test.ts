import { describe, expect, it } from 'vitest'
import {
  MAX_BRAND_COLORS,
  USED_BRAND_COLORS,
  isBrandColorUsed,
  toggleBrandColorUse,
  usedBrandColors
} from '@shared/brandColors'

const six = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']

describe('saved brand colors', () => {
  it('uses no more than the first three', () => {
    expect(usedBrandColors(six)).toEqual(['#111111', '#222222', '#333333'])
    expect(usedBrandColors(six.slice(0, 2))).toEqual(['#111111', '#222222'])
    expect(usedBrandColors([])).toEqual([])
    expect(USED_BRAND_COLORS).toBeLessThan(MAX_BRAND_COLORS)
  })

  it('marks only the first three as used', () => {
    expect(six.map((_, index) => isBrandColorUsed(index))).toEqual([true, true, true, false, false, false])
    expect(isBrandColorUsed(-1)).toBe(false)
    expect(isBrandColorUsed(6)).toBe(false)
  })

  it('swaps a saved color into the used three and demotes the previous third', () => {
    expect(toggleBrandColorUse(six, 4)).toEqual(['#111111', '#222222', '#555555', '#333333', '#444444', '#666666'])
    expect(usedBrandColors(toggleBrandColorUse(six, 4))).toEqual(['#111111', '#222222', '#555555'])
  })

  it('swaps a used color out and promotes the next saved one', () => {
    expect(toggleBrandColorUse(six, 0)).toEqual(['#222222', '#333333', '#444444', '#111111', '#555555', '#666666'])
    expect(usedBrandColors(toggleBrandColorUse(six, 0))).toEqual(['#222222', '#333333', '#444444'])
  })

  it('never drops a saved color, even after repeated swaps', () => {
    let colors = [...six]
    for (let index = 0; index < 12; index += 1) {
      colors = toggleBrandColorUse(colors, (index * 5) % 6)
      expect([...colors].sort()).toEqual([...six].sort())
    }
    expect(new Set(colors).size).toBe(six.length)
  })

  it('leaves short palettes and bad indexes alone', () => {
    const three = six.slice(0, 3)
    expect(toggleBrandColorUse(three, 2)).toEqual(three)
    expect(toggleBrandColorUse(six, 6)).toBe(six)
    expect(toggleBrandColorUse(six, -1)).toBe(six)
  })
})
