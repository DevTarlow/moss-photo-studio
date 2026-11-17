import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExportOptions, Image, Product } from '@shared/types'
import { safeBaseName } from '@shared/files'
import { extensionForFormat } from '@shared/shapes'
import { absoluteInLibrary } from './paths'
import { encodeImageFile, ensureUniquePath, exportOneImage } from './export'

function safeFolderName(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  return clean || 'Set'
}

async function createSetFolder(parent: string, name: string): Promise<string> {
  await fs.mkdir(parent, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')
  const base = `Moss Set - ${safeFolderName(name)} - ${stamp}`
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const folder = path.join(parent, attempt === 0 ? base : `${base} ${attempt + 1}`)
    try {
      await fs.mkdir(folder)
      return folder
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('export_collision')
}

export async function exportSetImages(input: {
  libraryPath: string
  name: string
  images: Image[]
  products?: Product[]
  options: ExportOptions
  parentFolder: string
  workingPathFor: (image: Image) => string
}): Promise<{ count: number; folderName: string; warnings: string[]; folder: string }> {
  if (!input.images.length && !(input.products?.length ?? 0)) {
    return { count: 0, folderName: '', warnings: ['This Set has no images yet.'], folder: '' }
  }
  const folder = await createSetFolder(input.parentFolder, input.name)
  const taken = new Set<string>()
  let count = 0
  for (const image of input.images) {
    count += 1
    await exportOneImage({
      libraryPath: input.libraryPath,
      image,
      workingPath: input.workingPathFor(image),
      options: input.options,
      destinationFolder: folder,
      baseName: `${String(count).padStart(2, '0')}-${safeBaseName(image.label, 'image')}`,
      taken
    })
  }
  for (const product of input.products ?? []) {
    count += 1
    const extension = extensionForFormat(input.options.format)
    const destination = await ensureUniquePath(
      folder,
      `${String(count).padStart(2, '0')}-${safeBaseName(product.name, 'product')}`,
      extension,
      taken
    )
    const relative = decodeURI(product.imageUrl.replace('moss-media://library/', ''))
    await encodeImageFile(absoluteInLibrary(input.libraryPath, relative), destination, {
      format: input.options.format,
      quality: Math.max(60, Math.min(100, input.options.quality || 90)),
      maxDimension: input.options.maxDimension,
      preset: input.options.preset
    })
  }
  return { count, folderName: path.basename(folder), warnings: [], folder }
}
