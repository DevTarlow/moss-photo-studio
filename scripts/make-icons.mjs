#!/usr/bin/env node
/**
 * Build the platform icon set from the Moss app icon.
 * Source art: resources/brand/moss-photo-studio-icon.png. The source already
 * carries its own rounded plate and transparent margin, so it only needs to be
 * scaled into the 1024px master before the platform sizes are derived.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import png2icons from 'png2icons'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const brand = path.join(root, 'resources/brand')
await mkdir(brand, { recursive: true })

const source = await readFile(path.join(brand, 'moss-photo-studio-icon.png'))
const sourceMeta = await sharp(source).metadata()
const trimmed = await sharp(source).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
const pad = 20
const side = Math.min(
  Math.max(trimmed.info.width, trimmed.info.height) + pad * 2,
  Math.min(sourceMeta.width ?? 0, sourceMeta.height ?? 0)
)
const left = Math.min(
  Math.max(0, Math.round(-(trimmed.info.trimOffsetLeft ?? 0) - (side - trimmed.info.width) / 2)),
  (sourceMeta.width ?? side) - side
)
const top = Math.min(
  Math.max(0, Math.round(-(trimmed.info.trimOffsetTop ?? 0) - (side - trimmed.info.height) / 2)),
  (sourceMeta.height ?? side) - side
)
const art = await sharp(source)
  .extract({ left, top, width: side, height: side })
  .toBuffer()
const inner = 960
const scaled = await sharp(art)
  .resize({ width: inner, height: inner, fit: 'contain' })
  .toBuffer()
const icon = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([
    {
      input: scaled,
      left: Math.round((1024 - inner) / 2),
      top: Math.round((1024 - inner) / 2)
    }
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()

await writeFile(path.join(brand, 'icon.png'), icon)
await sharp(icon).resize(512, 512).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(brand, '512x512.png'))
await sharp(icon).resize(256, 256).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(brand, 'icon-256.png'))
await writeFile(path.join(brand, 'icon.icns'), png2icons.createICNS(icon, png2icons.BICUBIC, 0))
await writeFile(path.join(brand, 'icon.ico'), png2icons.createICO(icon, png2icons.BICUBIC, 0, true))

// The in-app header mark uses the same plate, trimmed to its edges so it stays
// legible at 24-40px.
const mark = await sharp(art)
  .resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()
await writeFile(path.join(brand, 'mark.png'), mark)

console.log(
  `icons written from ${sourceMeta.width}x${sourceMeta.height} icon: icon.png, 512x512.png, icon.icns, icon.ico, mark.png`
)
