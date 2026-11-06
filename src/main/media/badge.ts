import sharp from 'sharp'
import type { Brand } from '@shared/types'
import { absoluteInLibrary } from './paths'

const CORNERS = {
  br: { left: 1 - 0.04, top: 1 - 0.04, anchor: 'right-bottom' },
  bl: { left: 0.04, top: 1 - 0.04, anchor: 'left-bottom' },
  tr: { left: 1 - 0.04, top: 0.04, anchor: 'right-top' },
  tl: { left: 0.04, top: 0.04, anchor: 'left-top' }
} as const

const SCALE_PERCENT = { s: 0.08, m: 0.12, l: 0.18 } as const

export interface BadgeResult {
  applied: boolean
}

/**
 * Composite the shop logo in the chosen corner. Deterministic, free, and
 * never upscaled beyond the logo's native width.
 */
export async function applyBadge(input: {
  imagePath: string
  libraryPath: string
  brand: Brand
  logoRelative: string | null
  format: 'webp' | 'jpeg' | 'png'
}): Promise<BadgeResult> {
  if (!input.brand.badgeEnabled || !input.brand.logoUrl || !input.logoRelative) return { applied: false }
  const logoPath = absoluteInLibrary(input.libraryPath, input.logoRelative)
  const image = sharp(input.imagePath)
  const baseMeta = await image.metadata()
  const width = baseMeta.width ?? 0
  const height = baseMeta.height ?? 0
  if (!width || !height) return { applied: false }
  const shorter = Math.min(width, height)
  const logoMeta = await sharp(logoPath).metadata()
  const nativeWidth = logoMeta.width ?? 0
  if (!nativeWidth) return { applied: false }
  const targetWidth = Math.min(Math.round(shorter * SCALE_PERCENT[input.brand.badgeScale]), nativeWidth)
  const padding = Math.round(shorter * 0.04)
  const opacity = Math.max(60, Math.min(100, input.brand.badgeOpacity)) / 100
  const logo = await sharp(logoPath)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer()
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round((data[index] ?? 0) * opacity)
  }
  const logoWithOpacity = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer()
  const logoMetaFinal = await sharp(logoWithOpacity).metadata()
  const logoW = logoMetaFinal.width ?? targetWidth
  const logoH = logoMetaFinal.height ?? targetWidth
  const corner = CORNERS[input.brand.badgeCorner]
  const left = corner.anchor.startsWith('right') ? width - padding - logoW : padding
  const top = corner.anchor.endsWith('bottom') ? height - padding - logoH : padding
  const composited = await image
    .composite([{ input: logoWithOpacity, left: Math.max(0, left), top: Math.max(0, top) }])
    .toFormat(input.format === 'jpeg' ? 'jpeg' : input.format, input.format === 'jpeg' ? { quality: 92 } : {})
    .toBuffer()
  const fs = await import('node:fs/promises')
  const tmp = `${input.imagePath}.badge`
  await fs.writeFile(tmp, composited)
  await fs.rename(tmp, input.imagePath)
  return { applied: true }
}

export function badgePadding(shorterEdge: number): number {
  return Math.round(shorterEdge * 0.04)
}

export function badgeWidth(shorterEdge: number, scale: 's' | 'm' | 'l', nativeWidth: number): number {
  return Math.min(Math.round(shorterEdge * SCALE_PERCENT[scale]), nativeWidth)
}

export function badgePosition(input: {
  width: number
  height: number
  logoWidth: number
  logoHeight: number
  corner: 'br' | 'bl' | 'tr' | 'tl'
}): { left: number; top: number } {
  const padding = badgePadding(Math.min(input.width, input.height))
  const left = input.corner === 'br' || input.corner === 'tr'
    ? input.width - padding - input.logoWidth
    : padding
  const top = input.corner === 'br' || input.corner === 'bl'
    ? input.height - padding - input.logoHeight
    : padding
  return { left: Math.max(0, left), top: Math.max(0, top) }
}
