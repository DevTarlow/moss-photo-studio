import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Sharp } from 'sharp'
import type { AdjustTransform } from '@shared/types'
import { absoluteInLibrary, imageRelative, thumbRelative } from './paths'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export function cropPixels(
  width: number,
  height: number,
  crop: NonNullable<AdjustTransform['crop']>
): { left: number; top: number; width: number; height: number } {
  const x = clamp(crop.x, 0, 1)
  const y = clamp(crop.y, 0, 1)
  const w = clamp(crop.width, 0.01, 1 - x)
  const h = clamp(crop.height, 0.01, 1 - y)
  return {
    left: Math.round(x * width),
    top: Math.round(y * height),
    width: Math.max(1, Math.round(w * width)),
    height: Math.max(1, Math.round(h * height))
  }
}

/**
 * A luminance-weighted tone pass for highlights and shadows. Highlights move
 * the bright end; shadows move the dark end. Alpha is preserved when present.
 */
export function applyTonePixels(
  data: Uint8Array,
  highlights: number,
  shadows: number,
  channels = 4
): void {
  const highlight = clamp(highlights, -100, 100)
  const shadow = clamp(shadows, -100, 100)
  if (highlight === 0 && shadow === 0) return
  for (let i = 0; i + 2 < data.length; i += channels) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const shadowWeight = (1 - luminance / 255) ** 2
    const highlightWeight = (luminance / 255) ** 2
    const delta = (shadow / 100) * shadowWeight * 64 + (highlight / 100) * highlightWeight * 64
    if (delta === 0) continue
    data[i] = clamp(Math.round(r + delta), 0, 255)
    data[i + 1] = clamp(Math.round(g + delta), 0, 255)
    data[i + 2] = clamp(Math.round(b + delta), 0, 255)
  }
}

export async function applyLocalAdjust(input: {
  libraryPath: string
  sourcePath: string
  imageId: string
  projectId: string
  transform: AdjustTransform
}): Promise<{ relative: string; thumb: string; width: number; height: number; bytes: number }> {
  const t = input.transform
  let oriented = sharp(input.sourcePath, { failOn: 'none' }).rotate(t.rotate ?? 0)
  if (t.flipH) oriented = oriented.flop()
  if (t.flipV) oriented = oriented.flip()
  const firstBuffer = await oriented.png().toBuffer()
  let cropped = firstBuffer
  if (t.crop) {
    const firstMeta = await sharp(firstBuffer).metadata()
    const region = cropPixels(firstMeta.width ?? 0, firstMeta.height ?? 0, t.crop)
    cropped = await sharp(firstBuffer)
      .extract(region)
      .png()
      .toBuffer()
  }
  const meta = await sharp(cropped).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const highlights = clamp(t.highlights ?? 0, -100, 100)
  const shadows = clamp(t.shadows ?? 0, -100, 100)
  let pipeline: Sharp
  if (highlights !== 0 || shadows !== 0) {
    const raw = await sharp(cropped).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    applyTonePixels(raw.data, highlights, shadows, raw.info.channels)
    pipeline = sharp(raw.data, {
      raw: { width: raw.info.width, height: raw.info.height, channels: raw.info.channels }
    }).toColorspace('srgb')
  } else {
    pipeline = sharp(cropped).toColorspace('srgb')
  }
  const brightness = clamp(t.brightness ?? 0, -100, 100)
  const contrast = clamp(t.contrast ?? 0, -100, 100)
  const factor = 1 + contrast / 100
  const offset = -(128 * factor) + 128 + (brightness / 100) * 128
  if (brightness !== 0 || contrast !== 0) pipeline = pipeline.linear(factor, offset)
  pipeline = pipeline.modulate({
    saturation: clamp(1 + (t.saturation ?? 0) / 100, 0, 2.5),
    brightness: 1
  })
  const warmth = clamp(t.warmth ?? 0, -100, 100)
  if (warmth !== 0) {
    pipeline = pipeline.recomb([
      [1 + warmth * 0.0015, 0, 0],
      [0, 1 + warmth * 0.0003, 0],
      [0, 0, 1 - warmth * 0.0015]
    ])
  }
  const sharpen = clamp(t.sharpen ?? 0, 0, 100)
  if (sharpen > 0) pipeline = pipeline.sharpen({ sigma: 0.5 + (sharpen / 100) * 1.5 })
  const vignette = clamp(t.vignette ?? 0, 0, 100)
  if (vignette > 0) {
    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
          <stop offset="45%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="${(vignette / 100) * 0.65}"/>
        </radialGradient></defs>
        <rect width="100%" height="100%" fill="url(#v)"/>
      </svg>`
    )
    const overlay = await sharp(svg).png().toBuffer()
    pipeline = pipeline.composite([{ input: overlay, blend: 'over' }])
  }
  const outputRelative = imageRelative(input.projectId, input.imageId, 'webp')
  const workingRelative = path.posix.join('projects', input.projectId, 'working', `${input.imageId}.webp`)
  const output = absoluteInLibrary(input.libraryPath, outputRelative)
  const working = absoluteInLibrary(input.libraryPath, workingRelative)
  const thumbRel = thumbRelative(input.projectId, input.imageId)
  const thumb = absoluteInLibrary(input.libraryPath, thumbRel)
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.mkdir(path.dirname(working), { recursive: true })
  await fs.mkdir(path.dirname(thumb), { recursive: true })
  await pipeline.webp({ quality: 90 }).toFile(output)
  await sharp(output).webp({ quality: 88 }).toFile(working)
  await sharp(output)
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumb)
  const stat = await fs.stat(output)
  return { relative: outputRelative, thumb: thumbRel, width, height, bytes: stat.size }
}

/** CSS approximation for the live canvas preview. */
export function previewFilter(t: AdjustTransform): string {
  const brightness = 1 + (t.brightness ?? 0) / 100
  const contrast = 1 + (t.contrast ?? 0) / 100
  const saturation = Math.max(0, 1 + (t.saturation ?? 0) / 100)
  const warmth = (t.warmth ?? 0) / 300
  const sepia = t.warmth && t.warmth > 0 ? Math.min(0.25, t.warmth / 400) : 0
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia}) hue-rotate(${-warmth * 30}deg)`
}

export function previewTransform(t: AdjustTransform): string {
  const rotate = t.rotate ?? 0
  const scaleX = t.flipH ? -1 : 1
  const scaleY = t.flipV ? -1 : 1
  return `scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)`
}
