import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Image, KitExportResult, PlanJson, Project } from '@shared/types'
import { shotDefinition } from '@shared/prompts/shots'
import { marketplaceById, MARKETPLACES_AS_OF, type MarketplacePreset } from '@shared/marketplaces'
import type { ListingCopy } from '@shared/listings'
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

interface KitEntry {
  image: Image
  label: string
  direction: string
  fileLabel: string
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

function altText(productName: string, label: string, direction: string, max: number): string {
  const text = `${productName}: ${label}. ${direction}`
  return text.slice(0, max).trim()
}

/** A short, filename-safe word from a shot or image label. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'listing-image'
  )
}

function imageDirection(image: Image): string {
  if (image.isOriginal || image.kind === 'upload') return 'The original photo, as uploaded'
  if (image.kind === 'adjust') return 'A locally adjusted listing image'
  const text = image.userText?.trim() || image.prompt?.trim() || ''
  return text.replace(/\s+/g, ' ').slice(0, 500) || 'The image as made'
}

function imageEntries(images: Image[], imageIds: string[]): KitEntry[] {
  const wanted = new Set(imageIds)
  return images
    .filter((image) => wanted.has(image.id) && image.status === 'ready')
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    .map((image) => ({
      image,
      label: image.label || 'Listing image',
      direction: imageDirection(image),
      fileLabel: slug(image.label || 'Listing image')
    }))
}

function planEntries(images: Image[], plan: PlanJson): KitEntry[] {
  const entries: KitEntry[] = []
  for (const shot of plan.shots) {
    if (!shot.enabled) continue
    const definition = shotDefinition(shot.type)
    const ready = images
      .filter((image) => image.shotId === shot.id && image.status === 'ready')
      .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    const chosen =
      (shot.selectedImageId ? ready.find((image) => image.id === shot.selectedImageId) : undefined) ??
      ready.at(-1)
    if (!chosen) continue
    entries.push({
      image: chosen,
      label: definition.label,
      direction: shot.direction.trim() || definition.defaultDirection,
      fileLabel: definition.fileLabel
    })
  }
  return entries
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
  plan?: PlanJson | null
  images: Image[]
  /** When present, pack exactly these ready images instead of the plan shots. */
  imageIds?: string[]
  /** The product name for alt text and the manifest. Falls back to the plan or project name. */
  productName?: string
  platform: string
  includeOriginal?: boolean
  listing?: ListingCopy | null
}): Promise<KitExportResult> {
  const preset = marketplaceById(input.platform)
  const folder = input.folder
  const taken = new Set<string>()
  const written: KitImage[] = []
  const warnings: string[] = []
  const productName =
    input.productName?.trim() || input.plan?.productName.trim() || input.project.name
  let entries: KitEntry[]
  if (input.imageIds?.length) {
    entries = imageEntries(input.images, input.imageIds)
  } else {
    if (!input.plan) throw new Error('kit_plan_missing')
    entries = planEntries(input.images, input.plan)
  }
  let number = 0
  for (const entry of entries) {
    number += 1
    const file = await ensureUniquePath(
      folder,
      `${String(number).padStart(2, '0')}-${entry.fileLabel}-${preset.id}`,
      preset.format === 'jpeg' ? 'jpg' : preset.format,
      taken
    )
    const encoded = await encode(imageFile(input.libraryPath, entry.image), preset)
    await fs.writeFile(file, encoded.bytes)
    if (encoded.warning) warnings.push(encoded.warning)
    written.push({
      file: path.basename(file),
      shot: entry.label,
      direction: entry.direction,
      altText: altText(productName, entry.label, entry.direction, preset.altTextMax),
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

  const listing = input.listing ?? null
  const manifest = {
    product: productName,
    project: input.project.name,
    platform: preset.label,
    platformId: preset.id,
    asOf: MARKETPLACES_AS_OF,
    createdAt: new Date().toISOString(),
    disclosure: AI_DISCLOSURE,
    original: originalName,
    listing: listing
      ? {
          platform: listing.platform,
          titles: listing.titles,
          description: listing.description,
          features: listing.features,
          tags: listing.tags
        }
      : null,
    images: written
  }
  await fs.writeFile(path.join(folder, 'kit.json'), JSON.stringify(manifest, null, 2), 'utf8')
  if (listing) {
    await fs.writeFile(
      path.join(folder, 'listing.md'),
      [
        `# ${manifest.product} - ${listing.platform} listing copy`,
        '',
        '## Titles',
        ...listing.titles.map((title, index) => `${index + 1}. ${title}`),
        '',
        '## Description',
        listing.description,
        '',
        '## Features',
        ...listing.features.map((feature) => `- ${feature}`),
        '',
        '## Tags',
        listing.tags.join(', ') || '(no tags for this platform)',
        ''
      ].join('\n'),
      'utf8'
    )
  }
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
      listing ? 'Included listing copy: listing.md (titles, description, features, tags).' : '',
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
