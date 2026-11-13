import sharp from 'sharp'
import type { PhotoCheck, PhotoWarning } from '@shared/types'

function warning(code: PhotoWarning['code'], message: string): PhotoWarning {
  return { code, message }
}

/**
 * A local, inexpensive sanity check. It is not a guarantee and never calls a
 * model; thresholds are deliberately conservative so white-background product
 * photography is not marked as a problem.
 */
export async function inspectPhoto(bytes: Buffer): Promise<PhotoCheck> {
  const meta = await sharp(bytes).metadata()
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: 512, height: 512, fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = meta.width ?? info.width
  const height = meta.height ?? info.height
  let sum = 0
  let sumSquares = 0
  for (const value of data) {
    sum += value
    sumSquares += value * value
  }
  const brightness = sum / Math.max(1, data.length)
  const contrast = Math.sqrt(Math.max(0, sumSquares / Math.max(1, data.length) - brightness * brightness))
  let lapSum = 0
  let lapSquares = 0
  let count = 0
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const at = y * info.width + x
      const lap = 4 * data[at]! - data[at - 1]! - data[at + 1]! - data[at - info.width]! - data[at + info.width]!
      lapSum += lap
      lapSquares += lap * lap
      count += 1
    }
  }
  const sharpness = count ? Math.max(0, lapSquares / count - (lapSum / count) ** 2) : 0
  const warnings: PhotoWarning[] = []
  if (Math.max(width, height) < 800) {
    warnings.push(warning('small', 'This photo is small. A larger photo gives the studio more detail to work with.'))
  }
  if (brightness < 55) {
    warnings.push(warning('dark', 'This photo is dark. More light will show the product detail.'))
  }
  if (contrast < 12) {
    warnings.push(warning('low_contrast', 'This photo is flat. A little more light and shadow will give it shape.'))
  }
  if (sharpness < 8) {
    warnings.push(warning('soft', 'This photo looks soft. Steady the camera or tap to focus before using it.'))
  }
  return {
    width,
    height,
    brightness: Math.round(brightness * 10) / 10,
    contrast: Math.round(contrast * 10) / 10,
    sharpness: Math.round(sharpness * 10) / 10,
    warnings
  }
}
