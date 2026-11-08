import type { AdjustTransform } from '@shared/types'

export function previewFilter(transform: AdjustTransform): string {
  const brightness = 1 + (transform.brightness ?? 0) / 100
  const contrast = 1 + (transform.contrast ?? 0) / 100
  const saturation = Math.max(0, 1 + (transform.saturation ?? 0) / 100)
  const warmth = (transform.warmth ?? 0) / 300
  const sepia = transform.warmth && transform.warmth > 0 ? Math.min(0.25, transform.warmth / 400) : 0
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia}) hue-rotate(${-warmth * 30}deg)`
}

export function previewTransform(transform: AdjustTransform): string {
  const rotate = transform.rotate ?? 0
  const scaleX = transform.flipH ? -1 : 1
  const scaleY = transform.flipV ? -1 : 1
  return `scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)`
}

export function isIdentity(transform: AdjustTransform): boolean {
  const values = [
    transform.rotate ?? 0,
    transform.brightness ?? 0,
    transform.contrast ?? 0,
    transform.saturation ?? 0,
    transform.warmth ?? 0,
    transform.sharpen ?? 0,
    transform.vignette ?? 0
  ]
  return (
    !transform.crop &&
    values.every((value) => value === 0) &&
    !transform.flipH &&
    !transform.flipV
  )
}
