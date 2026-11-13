import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Image, KitExportResult, PlanJson, Project } from '@shared/types'
import { shotDefinition } from '@shared/prompts/shots'
import { marketplaceById, MARKETPLACES_AS_OF, type MarketplacePreset } from '@shared/marketplaces'
import { absoluteInLibrary, workingFor } from './paths'
import { ensureUniquePath } from './export'

const AI_DISCLOSURE =
  'Some listing images were created or edited with AI. The original, unedited photo is included in this kit; check the current marketplace rules before uploading.'

interface KitImage {
  file: string
  shot: string
  direction: string
  altText: string
  width: number
  height: number
  bytes: number
}

function imageFile(libraryPath: string, image: Image): string {
  if (image.kind !== 'upload' && image.url) {
    return absoluteInLibrary(libraryPath, decodeURI(image.url.replace('moss-media://library/', '')))
  }
  return workingFor(libraryPath, image.projectId, image.id)
}

function originalFile(libraryPath: string, image: Image): string | null {
  if (!image.url) return null
  try {
    return absoluteInLibrary(libraryPath, decodeURI(image.url.replace('moss-media://library/', '')))
  } catch {
    return null
  }
}

function altText(productName: string, shot: PlanJson['shots'][number], max: number): string {
  const definition = shotDefinition(shot.type)
  const direction = shot.direction.trim() || definition.defaultDirection
  const text = `${productName}: ${definition.label}. ${direction}`
  return text.slice(0, max).trim()
}

async function encode(
  input: string,
  preset: MarketplacePreset
): Promise<{ bytes: Buffer; width: number; height: number; warning: string | null }> {
  let quality = preset.quality
  let warning: string | null = null
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let pipeline = sharp(input)
      .rotate()
      .resize({
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
    if (preset.format === 'jpeg') {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality })
    } else if (preset.format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 })
    } else {
      pipeline = pipeline.webp({ quality })
    }
    const bytes = await pipeline.toBuffer()
    if (!preset.maxBytes || bytes.length <= preset.maxBytes || quality <= 60) {
      if (preset.maxBytes && bytes.length > preset.maxBytes) {
        warning = `One image is still over the ${preset.maxBytes} byte guide at the lowest quality. Check it before uploading.`
      }
      return { bytes, width: preset.width, height: preset.height, warning }
    }
    quality -= 4
  }
  throw new Error('kit_encode_failed')
}

function stamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

/** A dedicated folder so a kit never mixes with an existing export. */
export async function createKitFolder(parent: string): Promise<string> {
  await fs.mkdir(parent, { recursive: true })
  const base = `Moss Photo Studio Kit ${stamp()}`
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const folder = path.join(parent, attempt === 0 ? base : `${base} (${attempt + 1})`)
    try {
      await fs.access(folder)
    } catch {
      await fs.mkdir(folder, { recursive: true })
      return folder
    }
  }
  throw new Error('kit_folder_collision')
}

export async function exportKit(input: {
  libraryPath: string
  folder: string
  project: Project
  plan: PlanJson
  images: Image[]
  platform: string
  includeOriginal?: boolean
}): Promise<KitExportResult> {
  const preset = marketplaceById(input.platform)
  const folder = input.folder
  const taken = new Set<string>()
  const written: KitImage[] = []
  const warnings: string[] = []
  const enabled = input.plan.shots.filter((shot) => shot.enabled)
  let number = 0
  for (const shot of enabled) {
    const definition = shotDefinition(shot.type)
    const ready = input.images
      .filter((image) => image.shotId === shot.id && image.status === 'ready')
      .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    const chosen = (shot.selectedImageId ? ready.find((image) => image.id === shot.selectedImageId) : undefined) ?? ready.at(-1)
    if (!chosen) continue
    number += 1
    const file = await ensureUniquePath(
      folder,
      `${String(number).padStart(2, '0')}-${definition.fileLabel}-${preset.id}`,
      preset.format === 'jpeg' ? 'jpg' : preset.format,
      taken
    )
    const encoded = await encode(imageFile(input.libraryPath, chosen), preset)
    await fs.writeFile(file, encoded.bytes)
    if (encoded.warning) warnings.push(encoded.warning)
    written.push({
      file: path.basename(file),
      shot: definition.label,
      direction: shot.direction.trim() || definition.defaultDirection,
      altText: altText(input.plan.productName || input.project.name, shot, preset.altTextMax),
      width: encoded.width,
      height: encoded.height,
      bytes: encoded.bytes.length
    })
  }

  let originalName: string | null = null
  const sourceId = input.project.sourceImageId
  if ((input.includeOriginal ?? preset.includeOriginal) && sourceId) {
    const source = input.images.find((image) => image.id === sourceId) ?? null
    if (source) {
      const file = originalFile(input.libraryPath, source)
      if (file) {
        try {
          const ext = path.extname(file) || '.jpg'
          originalName = path.basename(
            await ensureUniquePath(folder, 'original', ext.replace('.', ''), taken)
          )
          await fs.copyFile(file, path.join(folder, originalName))
        } catch {
          warnings.push('The original photo could not be included.')
        }
      }
    }
  }

  const manifest = {
    product: input.plan.productName || input.project.name,
    project: input.project.name,
    platform: preset.label,
    platformId: preset.id,
    asOf: MARKETPLACES_AS_OF,
    createdAt: new Date().toISOString(),
    disclosure: AI_DISCLOSURE,
    original: originalName,
    images: written
  }
  await fs.writeFile(path.join(folder, 'kit.json'), JSON.stringify(manifest, null, 2), 'utf8')
  const csvEscape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
  await fs.writeFile(
    path.join(folder, 'listing.csv'),
    [
      'File,Shot,Direction,Alt text',
      ...written.map((image) =>
        [image.file, image.shot, image.direction, image.altText].map(csvEscape).join(',')
      )
    ].join('\n') + '\n',
    'utf8'
  )
  await fs.writeFile(
    path.join(folder, 'README.txt'),
    [
      `Moss Photo Studio Listing Kit - ${preset.label}`,
      `Created ${manifest.createdAt}`,
      '',
      `${written.length} listing ${written.length === 1 ? 'image' : 'images'} at ${preset.width} x ${preset.height}.`,
      preset.note,
      originalName ? `Included untouched original: ${originalName}. Keep it in the listing when the shop requires a real, unedited photo.` : '',
      '',
      'AI disclosure:',
      AI_DISCLOSURE,
      '',
      'Check the current marketplace rules before uploading. Etsy, for example, requires at least one unedited photo of the actual item and asks sellers to note AI-edited images.',
      warnings.length ? `\nWarnings:\n${warnings.map((warning) => `- ${warning}`).join('\n')}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    'utf8'
  )

  return {
    count: written.length,
    folderName: path.basename(folder),
    warnings,
    includesOriginal: Boolean(originalName)
  }
}
