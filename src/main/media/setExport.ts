import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExportOptions, Image } from '@shared/types'
import { safeBaseName } from '@shared/files'
import { exportOneImage } from './export'

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
  options: ExportOptions
  parentFolder: string
  workingPathFor: (image: Image) => string
}): Promise<{ count: number; folderName: string; warnings: string[]; folder: string }> {
  if (!input.images.length) {
    return { count: 0, folderName: '', warnings: ['This Set has no ready images yet.'], folder: '' }
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
  return { count, folderName: path.basename(folder), warnings: [], folder }
}
