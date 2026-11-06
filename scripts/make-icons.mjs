#!/usr/bin/env node
/**
 * Build the platform icon set from the Moss ball mark.
 * Source art: resources/brand/mark.png. Padding and background are deliberate:
 * the ball keeps its air on the brand bone field at every dock size.
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

const background = '#FAF7F2'
const mark = await readFile(path.join(brand, 'mark.png'))
const markMeta = await sharp(mark).metadata()
const inner = 760
const scaled = await sharp(mark)
  .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: true })
  .toBuffer()
const scaledMeta = await sharp(scaled).metadata()
const icon = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background }
})
  .composite([
    {
      input: scaled,
      left: Math.round((1024 - (scaledMeta.width ?? inner)) / 2),
      top: Math.round((1024 - (scaledMeta.height ?? inner)) / 2)
    }
  ])
  .png()
  .toBuffer()

await writeFile(path.join(brand, 'icon.png'), icon)
await sharp(icon).resize(512, 512).png().toFile(path.join(brand, '512x512.png'))
await sharp(icon).resize(256, 256).png().toFile(path.join(brand, 'icon-256.png'))
await writeFile(path.join(brand, 'icon.icns'), png2icons.createICNS(icon, png2icons.BICUBIC, 0))
await writeFile(path.join(brand, 'icon.ico'), png2icons.createICO(icon, png2icons.BICUBIC, 0, true))
console.log(
  `icons written from ${markMeta.width}x${markMeta.height} mark: icon.png, 512x512.png, icon.icns, icon.ico`
)
