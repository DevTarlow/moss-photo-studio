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
const icon = await sharp(source)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()

await writeFile(path.join(brand, 'icon.png'), icon)
await sharp(icon).resize(512, 512).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(brand, '512x512.png'))
await sharp(icon).resize(256, 256).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(brand, 'icon-256.png'))
await writeFile(path.join(brand, 'icon.icns'), png2icons.createICNS(icon, png2icons.BICUBIC, 0))
await writeFile(path.join(brand, 'icon.ico'), png2icons.createICO(icon, png2icons.BICUBIC, 0, true))
console.log(
  `icons written from ${sourceMeta.width}x${sourceMeta.height} icon: icon.png, 512x512.png, icon.icns, icon.ico`
)
