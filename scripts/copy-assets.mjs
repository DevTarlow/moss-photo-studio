#!/usr/bin/env node
/**
 * Copy and optimise the bundled photo assets.
 *
 * The reference project is optional. When it is absent this script draws
 * honest stand-in cards rather than leaving any image path broken.
 */
import { access, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const reference = path.resolve(root, '..', 'moss-toolbox', 'public', 'images')
const peopleIds = [
  'maya', 'omar', 'jordan', 'mei', 'alex', 'priya',
  'ravi', 'tom', 'sofia', 'grace', 'kwame', 'nina'
]
const sceneIds = [
  'studio-white', 'soft-gradient', 'marble-counter', 'kitchen-table',
  'linen-sheets', 'concrete-plinth', 'dark-spotlight', 'gift-ready'
]
const modelTemplateIds = [
  'worn-waist', 'worn-full', 'held', 'close-up', 'in-use', 'from-behind', 'in-motion', 'sitting'
]

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function tile(source, destination, size = 512) {
  await ensureDir(path.dirname(destination))
  if (await exists(source)) {
    await sharp(source)
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(destination)
    return
  }
  const name = path.basename(destination, '.webp').replaceAll('-', ' ')
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#3d4a38"/>
      <text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#f4efe6">${name}</text>
      <text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#c9c3b5">Moss Photo Studio</text>
    </svg>`
  )
  await sharp(svg).webp({ quality: 80 }).toFile(destination)
}

async function portrait(source, destination, size = 512) {
  await ensureDir(path.dirname(destination))
  if (await exists(source)) {
    await sharp(source)
      .rotate()
      .resize({ width: size, height: size, fit: 'cover', position: 'top' })
      .webp({ quality: 80 })
      .toFile(destination)
  } else {
    await tile(source, destination, size)
  }
}

async function fullPerson(source, destination) {
  await ensureDir(path.dirname(destination))
  if (await exists(source)) {
    await sharp(source)
      .rotate()
      .resize({ width: 640, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destination)
  } else {
    await tile(source, destination, 640)
  }
}

const t0 = Date.now()
for (const id of sceneIds) {
  await tile(path.join(reference, 'studio-scenes', `${id}.webp`), path.join(root, 'resources/tiles/scenes', `${id}.webp`))
}
await tile(path.join(reference, 'studio-scenes', 'source.webp'), path.join(root, 'resources/tiles/scenes', 'source.webp'))

const editorSource = path.join(reference, 'editor-templates')
const editorDest = path.join(root, 'resources/tiles')
if (await exists(editorSource)) {
  for (const entry of await readdir(editorSource, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.webp')) continue
    const id = entry.name.replace(/\.webp$/, '')
    await tile(path.join(editorSource, entry.name), path.join(editorDest, `${id}.webp`))
  }
}
// Ensure all non-model tiles exist even when the reference tree is partial.
for (const id of [
  'blurred', 'bright-even', 'clean-up', 'cooler', 'film-look', 'golden-hour', 'moody',
  'more-vibrant', 'product-close-up', 'pure-white', 'room-for-text', 'soft-colour',
  'soft-shadow', 'square-crop', 'warmer', 'window-light'
]) {
  await tile(path.join(editorSource, `${id}.webp`), path.join(editorDest, `${id}.webp`))
}

for (const id of peopleIds) {
  await fullPerson(path.join(reference, 'models', id, 'reference.webp'), path.join(root, 'resources/people', `${id}.webp`))
  await portrait(path.join(reference, 'models', id, 'portrait.webp'), path.join(root, 'resources/people', `${id}-portrait.webp`))
  for (const template of modelTemplateIds) {
    await tile(
      path.join(editorSource, 'models', id, `${template}.webp`),
      path.join(editorDest, 'models', id, `${template}.webp`),
      384
    )
  }
}

const extraSources = path.join(reference, 'home')
for (const [source, dest] of [
  ['mug/source.webp', 'resources/tiles/examples/product.webp'],
  ['candle/lifestyle.webp', 'resources/tiles/examples/lifestyle.webp'],
  ['mug/flat-lay.webp', 'resources/tiles/examples/flatlay.webp'],
  ['candle/gift.webp', 'resources/tiles/examples/gift.webp']
]) {
  await tile(path.join(extraSources, source), path.join(root, dest), 640)
}

async function folderSize(dir) {
  let total = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) total += await folderSize(p)
    else total += (await stat(p)).size
  }
  return total
}
const bytes = await folderSize(path.join(root, 'resources'))
console.log(`assets ready in ${Date.now() - t0} ms, ${(bytes / 1024 / 1024).toFixed(2)} MB`)
if (bytes > 8 * 1024 * 1024) {
  console.error('resources/ is over the 8 MB budget')
  process.exitCode = 1
}
