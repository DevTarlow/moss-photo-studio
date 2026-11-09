import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'run'
}

export function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function readSpend(labRoot) {
  try {
    const raw = await fs.readFile(path.join(labRoot, 'spend.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      updatedAt: parsed.updatedAt ?? null,
      totalCents: Number(parsed.totalCents) || 0,
      runs: Array.isArray(parsed.runs) ? parsed.runs : []
    }
  } catch {
    return { updatedAt: null, totalCents: 0, runs: [] }
  }
}

export async function addSpend(labRoot, entry) {
  const spend = await readSpend(labRoot)
  spend.totalCents += Number(entry.costCents) || 0
  spend.updatedAt = new Date().toISOString()
  spend.runs.push(entry)
  await ensureDir(labRoot)
  await fs.writeFile(path.join(labRoot, 'spend.json'), `${JSON.stringify(spend, null, 2)}\n`)
  return spend
}

/** Writes the raw returned image and returns its durable metadata. */
export async function saveImage(runDir, group, baseName, buffer) {
  const meta = await sharp(buffer).metadata()
  const format = meta.format === 'jpeg' ? 'jpg' : meta.format === 'png' ? 'png' : 'webp'
  const imageRel = path.posix.join('images', group, `${baseName}.${format}`)
  const thumbRel = path.posix.join('thumbs', group, `${baseName}.webp`)
  const imagePath = path.join(runDir, imageRel)
  const thumbPath = path.join(runDir, thumbRel)
  await ensureDir(path.dirname(imagePath))
  await ensureDir(path.dirname(thumbPath))
  await fs.writeFile(imagePath, buffer)
  await sharp(buffer)
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbPath)
  return {
    file: imageRel,
    thumb: thumbRel,
    format,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: buffer.byteLength,
    sha256: sha256(buffer)
  }
}

export async function writeManifest(runDir, manifest) {
  await ensureDir(runDir)
  await fs.writeFile(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const escapeMd = (value) =>
  String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim()

function rel(fromDir, file) {
  return path.relative(fromDir, file).split(path.sep).join('/')
}

/** Every output in a run as contact-sheet tiles, source first per group. */
async function sheetEntries(runDir, manifest, groupId) {
  const source = manifest.sources?.[groupId]
  const entries = []
  if (source) {
    entries.push({
      image: path.join(runDir, source.file),
      label: 'SOURCE',
      note: source.label ?? path.basename(source.file)
    })
  }
  for (const item of manifest.items.filter((entry) => entry.group === groupId)) {
    if (!item.files?.length) {
      entries.push({ image: null, label: item.label, note: item.status === 'ok' ? 'no image' : item.errorCode ?? item.status })
      continue
    }
    item.files.forEach((file, index) => {
      entries.push({
        image: path.join(runDir, file.file),
        label: item.label,
        note: item.files.length > 1 ? `image ${index + 1} · ${item.status}` : item.status
      })
    })
  }
  return entries
}

async function contactTile(entry) {
  const size = 360
  const labelHeight = 78
  const background = '#20201c'
  let image
  if (entry.image) {
    const input = await sharp(entry.image)
      .resize({ width: size, height: size, fit: 'contain', background })
      .toBuffer()
    image = input
  } else {
    image = await sharp({
      create: { width: size, height: size, channels: 3, background: '#2b2b25' }
    }).png().toBuffer()
  }
  const label = escapeHtml(entry.label)
  const note = escapeHtml(entry.note)
  const svg = Buffer.from(
    `<svg width="${size}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${size}" height="${labelHeight}" fill="${background}"/>` +
      `<text x="14" y="28" fill="#f2eee4" font-family="sans-serif" font-size="17" font-weight="600">${label}</text>` +
      `<text x="14" y="52" fill="#a8a294" font-family="sans-serif" font-size="13">${note}</text>` +
      `<text x="14" y="69" fill="#6e685c" font-family="sans-serif" font-size="10">${escapeHtml(path.basename(entry.image ?? ''))}</text>` +
    `</svg>`
  )
  return sharp({ create: { width: size, height: size + labelHeight, channels: 3, background } })
    .composite([
      { input: image, top: 0, left: 0 },
      { input: svg, top: size, left: 0 }
    ])
    .png()
    .toBuffer()
}

async function writeSheet(runDir, manifest, groupId) {
  const entries = await sheetEntries(runDir, manifest, groupId)
  if (!entries.length) return null
  const columns = entries.length <= 4 ? 2 : 3
  const tileWidth = 360
  const tileHeight = 438
  const gap = 12
  const rows = Math.ceil(entries.length / columns)
  const width = columns * tileWidth + (columns + 1) * gap
  const height = rows * tileHeight + (rows + 1) * gap
  const tiles = await Promise.all(entries.map((entry) => contactTile(entry)))
  const composites = tiles.map((tile, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return {
      input: tile,
      left: gap + column * (tileWidth + gap),
      top: gap + row * (tileHeight + gap)
    }
  })
  const file = path.join(runDir, 'sheet.webp')
  await sharp({ create: { width, height, channels: 3, background: '#141412' } })
    .composite(composites)
    .webp({ quality: 84 })
    .toFile(file)
  return file
}

export async function writeReport(runDir, manifest) {
  await ensureDir(runDir)
  const groups = [...new Set(manifest.items.map((item) => item.group))]
  const sheets = {}
  for (const group of groups) sheets[group] = await writeSheet(runDir, manifest, group)
  await writeManifest(runDir, manifest)
  await writeHtml(runDir, manifest, sheets)
  await writeReview(runDir, manifest)
  return sheets
}

async function writeHtml(runDir, manifest, sheets) {
  const groups = [...new Set(manifest.items.map((item) => item.group))]
  const sections = groups
    .map((group) => {
      const source = manifest.sources?.[group]
      const rows = manifest.items
        .filter((item) => item.group === group)
        .map((item) => {
          const images = (item.files ?? [])
            .map(
              (file) =>
                `<a href="${escapeHtml(rel(runDir, path.resolve(runDir, file.file)))}"><img loading="lazy" src="${escapeHtml(rel(runDir, path.resolve(runDir, file.file)))}" alt="${escapeHtml(item.label)}"></a>`
            )
            .join('')
          return `<figure>
  <div class="row">${images || '<span class="failed">No image</span>'}</div>
  <figcaption>
    <strong>${escapeHtml(item.label)}</strong> · ${escapeHtml(item.status)}${item.errorCode ? ` · ${escapeHtml(item.errorCode)}` : ''} · ${item.costCents}¢
    <p class="prompt">${escapeHtml(item.prompt)}</p>
    ${item.revisedPrompt ? `<p class="revised">Revised: ${escapeHtml(item.revisedPrompt)}</p>` : ''}
  </figcaption>
</figure>`
        })
        .join('')
      const sheet = sheets[group]
        ? `<p><a href="${escapeHtml(rel(runDir, sheets[group]))}">Contact sheet</a></p>`
        : ''
      return `<section>
  <h2>${escapeHtml(group)}${source ? ` · <span class="muted">${escapeHtml(source.label ?? '')}</span>` : ''}</h2>
  ${sheet}
  ${rows || '<p class="muted">No images.</p>'}
</section>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moss lab · ${escapeHtml(manifest.command)} · ${escapeHtml(manifest.label ?? '')}</title>
<style>
  :root { color-scheme: dark; --bg:#141412; --card:#20201c; --text:#f2eee4; --muted:#a8a294; --line:#3a372f; --accent:#86c79a; }
  body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 system-ui, sans-serif; }
  header { padding:28px 32px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 6px; font-size:22px; } h2 { margin:0 0 10px; font-size:17px; text-transform:capitalize; }
  main { padding:24px 32px 60px; display:grid; gap:34px; }
  section { display:grid; gap:12px; }
  figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .row { display:flex; flex-wrap:wrap; gap:2px; background:#191915; }
  .row img { display:block; width:min(480px, 100%); height:auto; }
  figcaption { padding:12px 14px; display:grid; gap:5px; }
  .prompt, .revised { margin:0; color:var(--muted); font-size:12px; overflow-wrap:anywhere; }
  .revised { color:#7f9c86; }
  .muted { color:var(--muted); font-weight:400; }
  .failed { padding:24px; color:#e0a458; }
  a { color:var(--accent); } code { color:var(--muted); }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(manifest.command)} · ${escapeHtml(manifest.label ?? '')}</h1>
  <p class="muted">${escapeHtml(manifest.category ?? '')} · ${escapeHtml(manifest.model)} · ${escapeHtml(manifest.startedAt)} · ${manifest.totals.costCents}¢ spent · ${manifest.totals.returned}/${manifest.totals.requested} images returned${manifest.totals.failed ? ` · ${manifest.totals.failed} failed` : ''}</p>
  <p class="muted">Source: <code>${escapeHtml(manifest.source?.label ?? 'generated')}</code>${manifest.source ? ` · ${manifest.source.width}×${manifest.source.height} · ${manifest.source.sha256.slice(0, 12)}` : ''}</p>
</header>
<main>
${sections}
</main>
</body>
</html>
`
  await fs.writeFile(path.join(runDir, 'index.html'), html)
}

async function writeReview(runDir, manifest) {
  const groups = [...new Set(manifest.items.map((item) => item.group))]
  const lines = [
    `# Lab review · ${manifest.command} · ${manifest.label ?? ''}`,
    '',
    `- Started: ${manifest.startedAt}`,
    `- Finished: ${manifest.finishedAt ?? 'in progress'}`,
    `- Category: ${manifest.category ?? 'n/a'}`,
    `- Source: ${manifest.source?.label ?? 'generated'}`,
    `- Cost: ${manifest.totals.costCents}¢ (${manifest.totals.returned} images returned, ${manifest.totals.failed} failed)`,
    '',
    'Rate each image for product fidelity, shot intent, category fit, listing usability and guard compliance.',
    'Verdicts: `keep`, `fix`, `drop`.',
    ''
  ]
  for (const group of groups) {
    lines.push(`## ${group}`, '')
    lines.push('| Shot | Status | Files | Prompt | Revised prompt | Verdict | Notes |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    for (const item of manifest.items.filter((entry) => entry.group === group)) {
      const files = (item.files ?? []).map((file) => file.file).join(', ') || '—'
      lines.push(
        `| ${escapeMd(item.label)} | ${item.status}${item.errorCode ? ` (${item.errorCode})` : ''} | ${escapeMd(files)} | ${escapeMd(item.prompt)} | ${escapeMd(item.revisedPrompt ?? '')} |  |  |`
      )
    }
    lines.push('')
  }
  await fs.writeFile(path.join(runDir, 'review.md'), `${lines.join('\n')}\n`)
}
