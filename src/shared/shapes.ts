export interface ShapePreset {
  id: Shape
  label: string
  size: string
  ratio: number
}

export const SHAPE_PRESETS: readonly ShapePreset[] = [
  { id: 'square', label: 'Square', size: '1024x1024', ratio: 1 },
  { id: 'portrait', label: 'Portrait', size: '1024x1536', ratio: 1024 / 1536 },
  { id: 'landscape', label: 'Landscape', size: '1536x1024', ratio: 1536 / 1024 }
]

export type Shape = 'square' | 'portrait' | 'landscape'
export type Format = 'webp' | 'jpeg' | 'png'

/** Nearest preset by distance in log space. Unknown dimensions become square. */
export function shapeForImage(width: number, height: number): Shape {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'square'
  }
  const target = Math.log(width / height)
  let best: Shape = 'square'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const preset of SHAPE_PRESETS) {
    const distance = Math.abs(target - Math.log(preset.ratio))
    if (distance < bestDistance) {
      bestDistance = distance
      best = preset.id
    }
  }
  return best
}

export function sizeForShape(shape: Shape): string {
  return SHAPE_PRESETS.find((preset) => preset.id === shape)?.size ?? SHAPE_PRESETS[0]!.size
}

export function shapeLabel(shape: Shape): string {
  return SHAPE_PRESETS.find((preset) => preset.id === shape)?.label ?? 'Square'
}

export function formatLabel(format: Format): string {
  if (format === 'jpeg') return 'JPEG'
  if (format === 'webp') return 'WebP'
  return 'PNG'
}

export function mimeForFormat(format: Format): string {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  return 'image/webp'
}

export function extensionForFormat(format: Format): string {
  return format === 'jpeg' ? 'jpg' : format
}
