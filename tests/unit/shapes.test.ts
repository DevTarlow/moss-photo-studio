import { describe, expect, it } from 'vitest'
import { formatLabel, shapeForImage, shapeLabel } from '@shared/shapes'

describe('shape and format labels', () => {
  it('uses the display spelling for each format', () => {
    expect(formatLabel('webp')).toBe('WebP')
    expect(formatLabel('jpeg')).toBe('JPEG')
    expect(formatLabel('png')).toBe('PNG')
  })

  it('fits an image back to the nearest shape preset', () => {
    expect(shapeForImage(1024, 1024)).toBe('square')
    expect(shapeForImage(1024, 1536)).toBe('portrait')
    expect(shapeForImage(1536, 1024)).toBe('landscape')
    expect(shapeLabel('portrait')).toBe('Portrait')
  })
})
