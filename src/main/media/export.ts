import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { ExportOptions, Format, Image, PlanJson } from '@shared/types'
import { extensionForFormat, mimeForFormat } from '@shared/shapes'
import { safeBaseName, uniqueFileName, versionSuffix } from '@shared/files'
import { shotDefinition } from '@shared/prompts/shots'
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

async function encode(
  input: string,
  output: string,
  options: { format: Format; quality: number; maxDimension: number | null }
): Promise<void> {
  const image = sharp(input).rotate().toColorspace('srgb')
  const meta = await image.metadata()
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)
  let pipeline = image
  if (options.maxDimension && longEdge > options.maxDimension) {
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
  await encode(source, output, {
    format: input.options.format,
    quality: Math.max(60, Math.min(100, input.options.quality || 90)),
    maxDimension: input.options.maxDimension
  })
  return output
}

export interface SetExportFile {
  path: string
  shotType: string
  direction: string
  imageLabel: string
}

export async function exportSetProject(input: {
  libraryPath: string
  projectName: string
  plan: PlanJson
  images: Image[]
  options: ExportOptions
  folder: string
  workingPathFor: (image: Image) => string
  shouldCancel?: () => boolean
}): Promise<{ paths: string[]; files: SetExportFile[]; cancelled: boolean }> {
  await fs.mkdir(input.folder, { recursive: true })
  const includedShots = input.plan.shots.filter((shot) => shot.enabled)
  const taken = new Set<string>()
  const files: SetExportFile[] = []
  const extension = extensionForFormat(input.options.format)
  let number = 0
  let cancelled = false
  for (const shot of includedShots) {
    if (input.shouldCancel?.()) {
      cancelled = true
      break
    }
    number += 1
    const definition = shotDefinition(shot.type)
    const ready = input.images
      .filter((image) => image.shotId === shot.id && image.status === 'ready')
      .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    if (!ready.length) continue
    const latest = ready[ready.length - 1]!
    const prefix = String(number).padStart(2, '0')
    const baseLabel = definition.fileLabel
    const latestPath = await ensureUniquePath(
      input.folder,
      `${prefix}-${baseLabel}`,
      extension,
      taken
    )
    await encode(input.workingPathFor(latest), latestPath, input.options)
    files.push({
      path: latestPath,
      shotType: definition.label,
      direction: shot.direction.trim() || definition.defaultDirection,
      imageLabel: latest.label
    })
    if (input.options.includeVersions) {
      for (const older of ready.slice(0, -1)) {
        const suffix = versionSuffix(older.label, definition.label) || '-v1'
        const olderPath = await ensureUniquePath(
          input.folder,
          `${prefix}-${baseLabel}${suffix}`,
          extension,
          taken
        )
        await encode(input.workingPathFor(older), olderPath, input.options)
        files.push({
          path: olderPath,
          shotType: definition.label,
          direction: shot.direction.trim() || definition.defaultDirection,
          imageLabel: older.label
        })
      }
    }
  }
  const manifestLines = [
    input.projectName,
    new Date().toISOString(),
    '',
    ...files.map(
      (file) =>
        `${path.basename(file.path)}\nShot: ${file.shotType}\nDirection: ${file.direction}\nVersion: ${file.imageLabel}`
    )
  ]
  const manifestName = path.basename(await ensureUniquePath(input.folder, 'set', 'txt', taken))
  await fs.writeFile(path.join(input.folder, manifestName), `${manifestLines.join('\n\n')}\n`, 'utf8')
  return { paths: files.map((file) => file.path), files, cancelled }
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
  await encode(source, input.destinationPath, {
    format: input.options.format,
    quality: Math.max(60, Math.min(100, input.options.quality || 90)),
    maxDimension: input.options.maxDimension
  })
  return input.destinationPath
}
