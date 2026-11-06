import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Format } from '@shared/types'
import { DEFAULT_IMPORT_LONG_EDGE, MAX_IMPORT_BYTES, THUMB_LONG_EDGE, WORKING_QUALITY } from '@shared/constants'
import { extensionForFormat } from '@shared/shapes'
import { absoluteInLibrary, thumbRelative, workingRelative } from './paths'

export class ImageImportError extends Error {
  constructor(
    readonly code:
      | 'unsupported_type'
      | 'too_large'
      | 'too_small'
      | 'unreadable'
      | 'disk_full',
    message: string
  ) {
    super(message)
    this.name = 'ImageImportError'
  }
}

export function detectFormat(bytes: Uint8Array): Format | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png'
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const webp = String.fromCharCode(...bytes.slice(8, 12))
  if (riff === 'RIFF' && webp === 'WEBP') return 'webp'
  return null
}

export function assertImportable(bytes: Uint8Array): Format {
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new ImageImportError('too_large', "That photo is larger than 40 MB. Try a smaller one.")
  }
  const format = detectFormat(bytes)
  if (!format) {
    throw new ImageImportError('unsupported_type', "That file isn't a JPEG, PNG, or WebP photo.")
  }
  return format
}

const isDiskFull = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOSPC' || code === 'EDQUOT'
}

export interface NormalisedImage {
  workingPath: string
  workingRelative: string
  thumbPath: string
  thumbRelative: string
  width: number
  height: number
  bytes: number
  format: Format
}

export async function writeOriginal(input: {
  libraryPath: string
  relative: string
  bytes: Uint8Array
}): Promise<void> {
  const target = absoluteInLibrary(input.libraryPath, input.relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  try {
    // `wx` would refuse a legitimate replacement; source files are written once
    // under a fresh image id, while the first source keeps its stable name.
    await fs.writeFile(target, input.bytes)
  } catch (error) {
    if (isDiskFull(error)) {
      throw new ImageImportError('disk_full', 'There is no space on this computer. Free some space and try again.')
    }
    throw error
  }
}

export async function normaliseToWorking(input: {
  libraryPath: string
  projectId: string
  imageId: string
  bytes: Uint8Array
  longEdge?: number
  quality?: number
  flatten?: boolean
}): Promise<NormalisedImage> {
  const longEdge = input.longEdge ?? DEFAULT_IMPORT_LONG_EDGE
  const quality = input.quality ?? WORKING_QUALITY
  const workingRel = workingRelative(input.projectId, input.imageId)
  const thumbRel = thumbRelative(input.projectId, input.imageId)
  const workingPath = absoluteInLibrary(input.libraryPath, workingRel)
  const thumbPath = absoluteInLibrary(input.libraryPath, thumbRel)
  await fs.mkdir(path.dirname(workingPath), { recursive: true })
  await fs.mkdir(path.dirname(thumbPath), { recursive: true })
  try {
    let pipeline = sharp(input.bytes, { failOn: 'none' }).rotate().toColorspace('srgb')
    const meta = await pipeline.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (Math.min(width, height) < 256) {
      throw new ImageImportError(
        'too_small',
        'That photo is too small to work with. Try one at least 256 pixels wide.'
      )
    }
    if (input.flatten ?? true) {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } })
    }
    // Sharp strips EXIF, ICC profiles outside sRGB and GPS by default. Do not
    // call withMetadata here: the working copy must carry no location data.
    const normalisedBuffer = await pipeline
      .resize({
        width: longEdge,
        height: longEdge,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality, effort: 4 })
      .toBuffer()
    await fs.writeFile(workingPath, normalisedBuffer)
    const stat = await fs.stat(workingPath)
    const finalMeta = await sharp(normalisedBuffer).metadata()
    await sharp(workingPath)
      .resize({
        width: THUMB_LONG_EDGE,
        height: THUMB_LONG_EDGE,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(thumbPath)
    return {
      workingPath,
      workingRelative: workingRel,
      thumbPath,
      thumbRelative: thumbRel,
      width: finalMeta.width ?? width,
      height: finalMeta.height ?? height,
      bytes: stat.size,
      format: 'webp'
    }
  } catch (error) {
    if (error instanceof ImageImportError) throw error
    if (isDiskFull(error)) {
      throw new ImageImportError('disk_full', 'There is no space on this computer. Free some space and try again.')
    }
    throw new ImageImportError('unreadable', "That photo could not be read. Try another one.")
  }
}

export async function normalisePersonReference(input: {
  libraryPath: string
  personId: string
  bytes: Uint8Array
}): Promise<{ ref: string; thumb: string; width: number; height: number }> {
  const refRel = path.posix.join('people', `${input.personId}.webp`)
  const thumbRel = path.posix.join('people', `${input.personId}-thumb.webp`)
  const refPath = absoluteInLibrary(input.libraryPath, refRel)
  const thumbPath = absoluteInLibrary(input.libraryPath, thumbRel)
  await fs.mkdir(path.dirname(refPath), { recursive: true })
  try {
    const meta = await sharp(input.bytes).rotate().metadata()
    if (Math.min(meta.width ?? 0, meta.height ?? 0) < 256) {
      throw new ImageImportError('too_small', 'That photo is too small. Try one at least 256 pixels wide.')
    }
    await sharp(input.bytes)
      .rotate()
      .toColorspace('srgb')
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92 })
      .toFile(refPath)
    const finalMeta = await sharp(refPath).metadata()
    await sharp(refPath)
      .resize({ width: 480, height: 480, fit: 'cover', position: 'top' })
      .webp({ quality: 82 })
      .toFile(thumbPath)
    return {
      ref: refRel,
      thumb: thumbRel,
      width: finalMeta.width ?? 0,
      height: finalMeta.height ?? 0
    }
  } catch (error) {
    if (error instanceof ImageImportError) throw error
    throw new ImageImportError('unreadable', "That photo could not be read. Try another one.")
  }
}

export async function normaliseLogo(input: {
  libraryPath: string
  bytes: Uint8Array
  mime: string
}): Promise<{ file: string; format: 'png' | 'webp' }> {
  const format = input.mime === 'image/webp' ? 'webp' : 'png'
  const relative = path.posix.join('brand', `logo.${format === 'webp' ? 'webp' : 'png'}`)
  const target = absoluteInLibrary(input.libraryPath, relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const pipeline = sharp(input.bytes)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
  if (format === 'webp') await pipeline.webp({ quality: 90, lossless: true }).toFile(target)
  else await pipeline.png({ compressionLevel: 9 }).toFile(target)
  // Remove the other extension if it exists so the stored logo cannot go stale.
  const other = absoluteInLibrary(input.libraryPath, path.posix.join('brand', format === 'png' ? 'logo.webp' : 'logo.png'))
  await fs.rm(other, { force: true })
  return { file: relative, format }
}

export async function saveResultImage(input: {
  libraryPath: string
  projectId: string
  imageId: string
  bytes: Buffer
  format: Format
  relative: string
}): Promise<{ path: string; workingPath: string; thumbPath: string; width: number; height: number; bytes: number }> {
  const target = absoluteInLibrary(input.libraryPath, input.relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  try {
    await fs.writeFile(target, input.bytes)
  } catch (error) {
    if (isDiskFull(error)) {
      throw new ImageImportError('disk_full', 'The image was made but could not be saved. Meta may bill for it. Free some space and try again.')
    }
    throw error
  }
  const normalised = await normaliseToWorking({
    libraryPath: input.libraryPath,
    projectId: input.projectId,
    imageId: input.imageId,
    bytes: input.bytes,
    flatten: true
  })
  const meta = await sharp(target).metadata()
  const stat = await fs.stat(target)
  return {
    path: target,
    workingPath: normalised.workingPath,
    thumbPath: normalised.thumbPath,
    width: meta.width ?? normalised.width,
    height: meta.height ?? normalised.height,
    bytes: stat.size
  }
}

export function extensionFor(format: Format): string {
  return extensionForFormat(format)
}

export async function generateThumbnail(input: {
  libraryPath: string
  projectId: string
  imageId: string
  sourcePath: string
}): Promise<{ thumbRelative: string; width: number; height: number }> {
  const relative = thumbRelative(input.projectId, input.imageId)
  const target = absoluteInLibrary(input.libraryPath, relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await sharp(input.sourcePath)
    .resize({ width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(target)
  const meta = await sharp(input.sourcePath).metadata()
  return { thumbRelative: relative, width: meta.width ?? 0, height: meta.height ?? 0 }
}
