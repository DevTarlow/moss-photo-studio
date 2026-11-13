import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { absoluteInLibrary, imageRelative, thumbRelative } from './paths'

function display(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Add a clean size badge as a local version. The product is only covered at
 * the bottom edge; the rest of the image is untouched.
 */
export async function addSizeLabel(input: {
  libraryPath: string
  sourcePath: string
  imageId: string
  projectId: string
  width: number
  height: number
  unit: 'cm' | 'in'
}): Promise<{ relative: string; thumb: string; width: number; height: number; bytes: number }> {
  const meta = await sharp(input.sourcePath).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error('unreadable')
  const text = `${display(input.width)} × ${display(input.height)} ${input.unit}`
  let fontSize = Math.max(18, Math.min(72, Math.round(width * 0.032)))
  const maxTextWidth = width * 0.82
  const estimated = (chars: string) => chars.length * fontSize * 0.58
  if (estimated(text) > maxTextWidth) {
    fontSize = Math.max(14, Math.floor(fontSize * (maxTextWidth / estimated(text))))
  }
  const paddingX = Math.round(fontSize * 0.9)
  const badgeWidth = Math.min(width * 0.92, Math.round(estimated(text) + paddingX * 2))
  const badgeHeight = Math.round(fontSize * 2.1)
  const left = Math.round((width - badgeWidth) / 2)
  const top = Math.max(0, height - badgeHeight - Math.round(fontSize * 0.8))
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${left}" y="${top}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="#141414" fill-opacity="0.78"/>
      <text x="${width / 2}" y="${top + Math.round(badgeHeight * 0.64)}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff">${text}</text>
    </svg>`
  )
  const outputRelative = imageRelative(input.projectId, input.imageId, 'webp')
  const workingRelative = path.posix.join('projects', input.projectId, 'working', `${input.imageId}.webp`)
  const thumbRel = thumbRelative(input.projectId, input.imageId)
  const output = absoluteInLibrary(input.libraryPath, outputRelative)
  const working = absoluteInLibrary(input.libraryPath, workingRelative)
  const thumb = absoluteInLibrary(input.libraryPath, thumbRel)
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.mkdir(path.dirname(working), { recursive: true })
  await fs.mkdir(path.dirname(thumb), { recursive: true })
  await sharp(input.sourcePath)
    .composite([{ input: svg, blend: 'over' }])
    .webp({ quality: 92 })
    .toFile(output)
  await sharp(output).webp({ quality: 88 }).toFile(working)
  await sharp(output)
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumb)
  const stat = await fs.stat(output)
  return { relative: outputRelative, thumb: thumbRel, width, height, bytes: stat.size }
}
