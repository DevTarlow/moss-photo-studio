import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { ExportOptions, Format, Image } from '@shared/types'
import { extensionForFormat, mimeForFormat } from '@shared/shapes'
import { exportPresetById } from '@shared/exportPresets'
import { safeBaseName, uniqueFileName } from '@shared/files'
import { pathToFileURL } from 'node:url'
import { absoluteInLibrary } from './paths'

export interface ExportedFile {
  path: string
}

async function sourceForImage(libraryPath: string, image: Image, workingPath: string): Promise<string> {
  if (image.kind === 'upload') return workingPath
  if (!image.url) throw new Error('no_image_file')
  const withoutScheme = image.url.replace('moss-media://library/', '')
  const relative = decodeURI(withoutScheme)
  return absoluteInLibrary(libraryPath, relative)
}

export async function encodeImageFile(
  input: string,
  output: string,
  options: { format: Format; quality: number; maxDimension: number | null; preset?: 'original' | 'square' | 'portrait' }
): Promise<void> {
  const image = sharp(input).rotate().toColorspace('srgb')
  const meta = await image.metadata()
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)
  let pipeline = image
  const preset = exportPresetById(options.preset)
  if (preset?.width && preset.height) {
    pipeline = pipeline.resize({
      width: preset.width,
      height: preset.height,
      fit: 'cover',
      position: 'centre'
    })
  } else if (options.maxDimension && longEdge > options.maxDimension) {
    pipeline = pipeline.resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true
    })
  }
  if (options.format === 'png') {
    await pipeline.png({ compressionLevel: 9 }).toFile(output)
  } else if (options.format === 'jpeg') {
    await pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: options.quality }).toFile(output)
  } else {
    await pipeline.webp({ quality: options.quality }).toFile(output)
  }
}

export async function ensureUniquePath(folder: string, base: string, extension: string, taken: Set<string>): Promise<string> {
  let name = uniqueFileName(base, extension, taken)
  // The batch set catches collisions within one export. The disk check makes
  // sure a second export into the same folder never silently overwrites it.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    try {
      await fs.access(path.join(folder, name))
    } catch {
      return path.join(folder, name)
    }
    name = uniqueFileName(base, extension, taken)
  }
  throw new Error('export_collision')
}

export async function exportOneImage(input: {
  libraryPath: string
  image: Image
  workingPath: string
  options: ExportOptions
  destinationFolder: string
  baseName: string
  taken?: Set<string>
}): Promise<string> {
  await fs.mkdir(input.destinationFolder, { recursive: true })
  const extension = extensionForFormat(input.options.format)
  const taken = input.taken ?? new Set<string>()
  const safe = safeBaseName(input.baseName, input.image.label || 'image')
  const output = await ensureUniquePath(input.destinationFolder, safe, extension, taken)
  const source = await sourceForImage(input.libraryPath, input.image, input.workingPath)
  await encodeImageFile(source, output, {
    format: input.options.format,
    quality: Math.max(60, Math.min(100, input.options.quality || 90)),
    maxDimension: input.options.maxDimension,
    preset: input.options.preset
  })
  return output
}

export function outputPathPreview(folder: string, base: string, format: Format): string {
  return pathToFileURL(path.join(folder, `${safeBaseName(base)}.${extensionForFormat(format)}`)).toString()
}

export function contentType(format: Format): string {
  return mimeForFormat(format)
}

export async function exportImageToPath(input: {
  libraryPath: string
  image: Image
  workingPath: string
  options: ExportOptions
  destinationPath: string
}): Promise<string> {
  const source = await sourceForImage(input.libraryPath, input.image, input.workingPath)
  await encodeImageFile(source, input.destinationPath, {
    format: input.options.format,
    quality: Math.max(60, Math.min(100, input.options.quality || 90)),
    maxDimension: input.options.maxDimension,
    preset: input.options.preset
  })
  return input.destinationPath
}
