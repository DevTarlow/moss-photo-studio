import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExportOptions, Image, PackExportResult, PackJson } from '@shared/types'
import { safeBaseName } from '@shared/files'
import { exportOneImage, ensureUniquePath } from './export'

function chosenImage(pack: PackJson, images: Image[], shotId: string, selectedImageId: string | null): Image | null {
  const ready = images
    .filter((image) => image.shotId === shotId && image.status === 'ready')
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
  const selected = selectedImageId ? ready.find((image) => image.id === selectedImageId) : undefined
  return selected ?? ready.at(-1) ?? null
}

function safeFolderName(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  return clean || 'Image Pack'
}

async function createPackFolder(parent: string, projectName: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')
  const base = `Moss Pack - ${safeFolderName(projectName)} - ${stamp}`
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

export async function exportPackProject(input: {
  libraryPath: string
  projectName: string
  pack: PackJson
  images: Image[]
  options: ExportOptions
  parentFolder: string
  workingPathFor: (image: Image) => string
}): Promise<PackExportResult & { folder: string }> {
  const enabled = input.pack.shots.filter((shot) => shot.enabled)
  const ready = enabled
    .map((shot) => ({ shot, image: chosenImage(input.pack, input.images, shot.id, shot.selectedImageId) }))
    .filter((entry): entry is { shot: PackJson['shots'][number]; image: Image } => Boolean(entry.image))
  if (!ready.length) {
    return { count: 0, folderName: '', warnings: ['No ready images to export yet.'], folder: '' }
  }
  await fs.mkdir(input.parentFolder, { recursive: true })
  const folder = await createPackFolder(input.parentFolder, input.projectName)
  const extension = input.options.format === 'jpeg' ? 'jpg' : input.options.format
  const taken = new Set<string>()
  const warnings: string[] = []
  const manifestShots: Array<{ label: string; direction: string; file: string; imageId: string }> = []
  let index = 0
  for (const { shot, image } of ready) {
    index += 1
    const base = `${String(index).padStart(2, '0')}-${safeBaseName(shot.label, 'shot')}`
    const destination = await ensureUniquePath(folder, base, extension, taken)
    await exportOneImage({
      libraryPath: input.libraryPath,
      image,
      workingPath: input.workingPathFor(image),
      options: input.options,
      destinationFolder: folder,
      baseName: path.basename(destination, `.${extension}`),
      taken
    })
    manifestShots.push({
      label: shot.label,
      direction: shot.direction,
      file: path.basename(destination),
      imageId: image.id
    })
  }
  for (const shot of enabled) {
    if (!ready.some((entry) => entry.shot.id === shot.id)) warnings.push(`${shot.label} has no ready image and was skipped.`)
  }
  const manifest = {
    app: 'Moss Photo Studio',
    name: input.projectName,
    presetId: input.pack.presetId,
    stylePreset: input.pack.stylePreset,
    direction: input.pack.direction,
    exportedAt: new Date().toISOString(),
    format: input.options.format,
    quality: input.options.quality,
    shots: manifestShots,
    skipped: warnings
  }
  await fs.writeFile(path.join(folder, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await fs.writeFile(
    path.join(folder, 'README.txt'),
    [
      input.projectName,
      '',
      'This folder is a self-contained image pack made with Moss Photo Studio.',
      'The images were made with Meta Muse from the prompts and references chosen in the app.',
      'Review the rules of the place where you publish them.',
      '',
      'pack.json lists each shot, its direction, and the image file.'
    ].join('\n') + '\n',
    'utf8'
  )
  return { count: manifestShots.length, folderName: path.basename(folder), warnings, folder }
}
