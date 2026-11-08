import { describe, expect, it } from 'vitest'
import { isIdentity, previewFilter, previewTransform } from '@renderer/lib/adjustPreview'

describe('local adjust preview', () => {
  it('applies rotation before flips so the preview matches the exporter', () => {
    expect(previewTransform({})).toBe('scale(1, 1) rotate(0deg)')
    expect(previewTransform({ rotate: 90 })).toBe('scale(1, 1) rotate(90deg)')
    expect(previewTransform({ rotate: 270, flipH: true, flipV: true })).toBe('scale(-1, -1) rotate(270deg)')
  })

  it('treats reset transforms as identity and crop as a change', () => {
    expect(isIdentity({})).toBe(true)
    expect(isIdentity({ brightness: 0, rotate: 0 })).toBe(true)
    expect(isIdentity({ brightness: 4 })).toBe(false)
    expect(isIdentity({ crop: { x: 0, y: 0, width: 1, height: 1 } })).toBe(false)
  })

  it('keeps the filter expression stable for the default transform', () => {
    expect(previewFilter({})).toBe('brightness(1) contrast(1) saturate(1) sepia(0) hue-rotate(0deg)')
  })
})
