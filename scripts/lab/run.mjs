#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import { createLabLoader } from './loader.mjs'
import { PEOPLE_PACK } from './people-pack.mjs'
import { PERSON_LOOKS_PACK } from './person-looks.mjs'
import { PRODUCT_PACK } from './product-pack.mjs'
import { SOURCE_PACK, sourcePromptFor } from './source-pack.mjs'
import {
  addSpend,
  ensureDir,
  readSpend,
  saveImage,
  sha256,
  slug,
  stamp,
  writeManifest,
  writeReport
} from './report.mjs'

const ROOT = process.cwd()
const LAB = path.join(ROOT, 'lab')
const SOURCES = path.join(LAB, 'sources')
const PEOPLE_DIR = path.join(LAB, 'people')
const LOOKS_DIR = path.join(LAB, 'looks')
const PRODUCTS_DIR = path.join(LAB, 'products')
const COMMANDS = new Set(['edit', 'create', 'sources', 'people', 'looks', 'products', 'help'])

class LabError extends Error {}

const fail = (message) => {
  throw new LabError(message)
}

const usd = (cents) => `$${(Number(cents) / 100).toFixed(2)}`

function loadDotEnv() {
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return
  try {
    process.loadEnvFile(file)
  } catch {
    // A malformed .env is still a fair warning; the key can come from the
    // environment. Do not print file contents.
    console.warn('lab: could not read .env; using the current environment.')
  }
}

function parseArgs(argv) {
  const command = argv[0] ?? 'help'
  const opts = { _: [] }
  const rest = argv.slice(1)
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) {
      opts._.push(token)
      continue
    }
    const [rawKey, inline] = token.slice(2).split('=')
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    if (inline !== undefined) {
      opts[key] = inline
      continue
    }
    const next = rest[index + 1]
    if (next !== undefined && !next.startsWith('--')) {
      opts[key] = next
      index += 1
    } else {
      opts[key] = true
    }
  }
  return { command, opts }
}

function usage() {
  console.log(`Moss prompt lab — a real-Muse calibration tool, never run by the test suite.

Usage:
  npm run lab -- edit   --template kitchen-table --source shirt.jpg [--person maya] --yes
  npm run lab -- create --text "..." [--source shirt.jpg] [--person maya] [--count 1] --yes
  npm run lab -- sources [--force] --yes
  npm run lab -- people  [--ids maya,omar] [--force] --yes
  npm run lab -- looks   [--ids maya,omar] [--looks front,seated] [--force] --yes
  npm run lab -- products [--ids dropper-bottle,speckled-mug] [--force] --yes

Common options:
  --shape square|portrait|landscape   default: from the source photo
  --format webp|jpeg|png               default: webp
  --palette "#112233,#445566"          optional brand colors
  --person maya                        bundled person for an on-person run
  --look front|angle|full|seated       alternate studio look for that person
  --max-cents 300                      hard stop for this and earlier lab runs
  --concurrency 2                      in-flight requests per run (1-4)
  --base-url <url>                     default: MOSS_LAB_BASE_URL or the Muse API
  --yes                                required before any paid request

Key:
  Put MOSS_LAB_MUSE_KEY in .env. The app never reads that file; it keeps its
  key in the system keyring. The lab prints only the last four characters.

Output:
  lab/sources/          owner photos, or generated stand-ins
  lab/people/           reviewed full-body and portrait people assets
  lab/looks/            reviewed alternate studio looks, <id>-<look>.webp
  lab/products/         reviewed unbranded starter products and thumbs
  lab/runs/<stamp>-...  images, thumbs, manifest.json, index.html, sheet.webp, review.md
  lab/spend.json        cumulative actual returned-image cost
`)
}

function paletteFrom(opts) {
  return String(opts.palette ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

/**
 * Lab-only prompt overrides, used to try candidate directions before they are
 * committed to the recipe data. The app never sees these files.
 */
function readOverrides(opts) {
  const directions = {}
  if (opts.directionsFile) {
    const file = path.resolve(ROOT, String(opts.directionsFile))
    if (!fs.existsSync(file)) fail(`Directions file not found: ${opts.directionsFile}`)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      fail(`Directions file is not valid JSON: ${opts.directionsFile}`)
    }
    for (const [type, value] of Object.entries(parsed ?? {})) {
      if (typeof value === 'string' && value.trim()) directions[type] = value.trim()
    }
  }
  let giftClause
  if (opts.giftClauseFile) {
    const file = path.resolve(ROOT, String(opts.giftClauseFile))
    if (!fs.existsSync(file)) fail(`Gift clause file not found: ${opts.giftClauseFile}`)
    giftClause = fs.readFileSync(file, 'utf8').trim()
    if (giftClause) giftClause = ' ' + giftClause.replace(/^\s+/, '')
  }
  if (opts.giftClause) giftClause = ' ' + String(opts.giftClause).trim()
  return { directions, giftClause }
}

function applyDirections(plan, directions) {
  if (!Object.keys(directions).length) return plan
  return {
    ...plan,
    shots: plan.shots.map((shot) => (directions[shot.type] ? { ...shot, direction: directions[shot.type] } : shot))
  }
}

function findSourceIn(dir, category) {
  for (const extension of ['jpg', 'jpeg', 'png', 'webp']) {
    const file = path.join(dir, `${category}.${extension}`)
    if (fs.existsSync(file)) return file
  }
  return null
}

function findSource(category) {
  return findSourceIn(SOURCES, category)
}

function resolveShape(S, opts, fallback) {
  const shape = opts.shape ? String(opts.shape) : fallback
  if (shape && !S.shapes.SHAPE_PRESETS.some((preset) => preset.id === shape)) {
    fail(`Unknown shape "${shape}". Use square, portrait or landscape.`)
  }
  return shape
}

function resolveFormat(S, opts) {
  const format = String(opts.format ?? 'webp')
  if (!S.constants.FORMATS.includes(format)) fail(`Unknown format "${format}". Use webp, jpeg or png.`)
  return format
}

async function loadModules() {
  const loader = await createLabLoader(ROOT)
  const load = (id) => loader.load(id)
  const modules = {
    loader,
    guards: await load('/src/shared/prompts/guards.ts'),
    templates: await load('/src/shared/prompts/templates.ts'),
    shapes: await load('/src/shared/shapes.ts'),
    cost: await load('/src/shared/cost.ts'),
    constants: await load('/src/shared/constants.ts'),
    media: await load('/src/main/media/import.ts'),
    muse: await load('/src/main/muse/client.ts')
  }
  return modules
}

function createClient(S, baseUrl) {
  const key = String(process.env.MOSS_LAB_MUSE_KEY ?? '').trim()
  const logger = { info() {}, warn() {}, error() {}, debug() {} }
  const client = new S.muse.MuseClient({
    apiKey: () => key || null,
    userId: () => 'moss-lab',
    baseUrl,
    logger
  })
  return { client, key }
}

async function validateKey(client, key) {
  if (!key) {
    fail('MOSS_LAB_MUSE_KEY is empty. Paste the key into .env (or set it in the environment) and try again.')
  }
  const result = await client.validateKey()
  if (!result.ok) fail(`Meta did not accept the key (${result.code}, status ${result.status}). Nothing was charged.`)
  console.log(`Key accepted (…${key.slice(-4)}).`)
}

async function readBudget(opts) {
  const raw = Number(opts.maxCents ?? process.env.MOSS_LAB_MAX_CENTS ?? 300)
  if (!Number.isFinite(raw) || raw <= 0) fail('MOSS_LAB_MAX_CENTS must be a positive number of cents.')
  const spend = await readSpend(LAB)
  return { max: Math.floor(raw), spent: spend.totalCents }
}

function requireYes(opts, plannedCents, budget) {
  if (opts.yes || process.env.MOSS_LAB_YES === '1') return true
  console.log(
    `Planned: ${usd(plannedCents)}. Ledger: ${usd(budget.spent)} of the ${usd(budget.max)} cap. ` +
      'Add --yes to make the paid run.'
  )
  return false
}

async function normaliseSource(S, sourcePath, runDir) {
  const absolute = path.resolve(ROOT, String(sourcePath))
  if (!fs.existsSync(absolute)) fail(`Source photo not found: ${sourcePath}`)
  const bytes = await fsp.readFile(absolute)
  S.media.assertImportable(bytes)
  const normalised = await S.media.normaliseToWorking({
    libraryPath: path.join(runDir, '.work'),
    projectId: 'source',
    imageId: 'product',
    bytes
  })
  const working = await fsp.readFile(normalised.workingPath)
  await ensureDir(path.join(runDir, 'source'))
  await fsp.writeFile(path.join(runDir, 'source', 'working.webp'), working)
  return {
    bytes: working,
    width: normalised.width,
    height: normalised.height,
    file: path.posix.join('source', 'working.webp'),
    label: path.basename(absolute),
    sourcePath: path.relative(ROOT, absolute).split(path.sep).join('/'),
    sha256: sha256(bytes)
  }
}

const personCache = new Map()

async function personBytes(personId, look = null) {
  const key = `${personId}:${look ?? 'original'}`
  if (!personCache.has(key)) {
    const suffix = look && look !== 'original' ? `-${look}` : ''
    const file = path.join(ROOT, 'resources', 'people', `${personId}${suffix}.webp`)
    if (!fs.existsSync(file)) {
      const hint = look && look !== 'original'
        ? `Person "${personId}" has no look "${look}". Run npm run lab -- looks --ids ${personId} --yes.`
        : `Person "${personId}" has no bundled reference. Use one of the bundled people, e.g. maya.`
      fail(hint)
    }
    personCache.set(key, await fsp.readFile(file))
  }
  return personCache.get(key)
}

function filterShots(S, plan, csv) {
  const wanted = new Set(
    String(csv)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const shots = plan.shots.filter((shot) => wanted.has(shot.type))
  if (!shots.length) {
    fail(`No matching shots. Available: ${plan.shots.map((shot) => shot.type).join(', ')}.`)
  }
  return { ...plan, shots }
}

async function buildSetRun({ S, opts, category, sourcePath, runDir, command }) {
  const source = await normaliseSource(S, sourcePath, runDir)
  const shape = resolveShape(S, opts, S.shapes.shapeForImage(source.width, source.height))
  const format = resolveFormat(S, opts)
  const overrides = readOverrides(opts)
  let plan = S.plans.createDefaultPlan({
    category,
    productName: path.basename(sourcePath, path.extname(sourcePath)),
    shape,
    format
  })
  plan = applyDirections(plan, overrides.directions)
  if (opts.shots) plan = filterShots(S, plan, opts.shots)
  if (opts.limit) plan = S.plans.enableFirstShots(plan, Number(opts.limit))
  const palette = paletteFrom(opts)
  const specs = S.setPlan.planSetPrompts({
    plan,
    shots: plan.shots.filter((shot) => shot.enabled),
    palette,
    giftClause: overrides.giftClause
  })
  if (!specs.length) fail('That plan has no enabled shots.')
  const requests = []
  for (const [order, spec] of specs.entries()) {
    const images = [source.bytes]
    if (spec.personId) images.push(await personBytes(spec.personId, spec.personLook))
    requests.push({
      order,
      group: category,
      key: spec.shotId,
      label: spec.label,
      prompt: spec.prompt,
      endpoint: 'edit',
      images,
      count: 1,
      shape,
      format,
      personId: spec.personId,
      hasSource: true
    })
  }
  const recipe = S.recipes.recipeById(category)
  const sourceMeta = {
    file: source.file,
    label: source.label,
    sourcePath: source.sourcePath,
    width: source.width,
    height: source.height,
    sha256: source.sha256
  }
  const meta = {
    command,
    label: recipe.label,
    category,
    palette,
    shape,
    format,
    source: sourceMeta,
    sources: { [category]: sourceMeta }
  }
  return { requests, meta, source }
}

async function executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts }) {
  const planned = requests.reduce((sum, request) => sum + (request.count || 1), 0)
  if (!planned) fail('Nothing to make.')
  if (budget.spent + planned * S.cost.CENTS_PER_IMAGE > budget.max) {
    fail(
      `This run needs ${usd(planned * S.cost.CENTS_PER_IMAGE)}, and the lab ledger is at ` +
        `${usd(budget.spent)} of the ${usd(budget.max)} cap. Raise MOSS_LAB_MAX_CENTS or pass --max-cents.`
    )
  }
  await ensureDir(runDir)
  const manifest = {
    version: 1,
    command: meta.command,
    label: meta.label,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    model: S.constants.MUSE_MODEL,
    baseUrlHost: new URL(baseUrl).host,
    category: meta.category ?? null,
    palette: meta.palette ?? [],
    shape: meta.shape ?? null,
    format: meta.format ?? null,
    maxCents: budget.max,
    source: meta.source ?? null,
    sources: meta.sources ?? {},
    totals: { requested: planned, returned: 0, failed: 0, costCents: 0, skipped: 0 },
    items: []
  }
  console.log(`\n${meta.label} · ${planned} image${planned === 1 ? '' : 's'} · ${usd(planned * S.cost.CENTS_PER_IMAGE)} planned`)
  console.log(`  ${path.relative(ROOT, runDir)}`)
  if (!requireYes(opts, planned * S.cost.CENTS_PER_IMAGE, budget)) {
    return { skipped: true, runDir, manifest }
  }

  const concurrency = Math.max(1, Math.min(Number(opts.concurrency ?? 2), 4))
  let cursor = 0
  let committed = 0
  let reserved = 0
  const writeState = () => writeManifest(runDir, manifest)
  await writeState()

  const workers = Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= requests.length) return
      const request = requests[index]
      const estimate = (request.count || 1) * S.cost.CENTS_PER_IMAGE
      if (budget.spent + committed + reserved + estimate > budget.max) {
        manifest.items.push({
          order: request.order,
          group: request.group,
          key: request.key,
          label: request.label,
          prompt: request.prompt,
          endpoint: request.endpoint,
          shape: request.shape,
          format: request.format,
          status: 'skipped',
          errorCode: 'budget',
          returnedCount: 0,
          costCents: 0,
          durationMs: 0,
          requestId: null,
          revisedPrompt: null,
          usage: null,
          files: [],
          request: {
            endpoint: request.endpoint,
            count: request.count || 1,
            shape: request.shape,
            format: request.format,
            personId: request.personId ?? null,
            personLook: request.personLook ?? null,
            hasSource: request.hasSource === true
          }
        })
        manifest.totals.skipped += 1
        await writeState()
        continue
      }
      reserved += estimate
      const started = Date.now()
      let result
      try {
        result =
          request.endpoint === 'generate'
            ? await client.generate({
                prompt: request.prompt,
                count: request.count || 1,
                shape: request.shape,
                format: request.format
              })
            : await client.edit({
                prompt: request.prompt,
                images: request.images,
                shape: request.shape,
                format: request.format
              })
      } catch {
        result = { ok: false, code: 'unknown', status: 0, requestId: null }
      }
      reserved -= estimate
      const durationMs = Date.now() - started
      const base = `${String(request.order + 1).padStart(2, '0')}-${slug(request.label)}`
      const item = {
        order: request.order,
        group: request.group,
        key: request.key,
        label: request.label,
        prompt: request.prompt,
        endpoint: request.endpoint,
        shape: request.shape,
        format: request.format,
        status: 'failed',
        errorCode: null,
        returnedCount: 0,
        costCents: 0,
        durationMs,
        requestId: result.requestId ?? null,
        revisedPrompt: null,
        usage: null,
        files: [],
        request: {
          endpoint: request.endpoint,
          count: request.count || 1,
          shape: request.shape,
          format: request.format,
          personId: request.personId ?? null,
          personLook: request.personLook ?? null,
          hasSource: request.hasSource === true
        }
      }
      if (result.ok) {
        const expected = request.count || 1
        item.status = result.images.length >= expected ? 'ok' : 'partial'
        item.returnedCount = result.returnedCount
        item.costCents = result.returnedCount * S.cost.CENTS_PER_IMAGE
        item.revisedPrompt = result.revisedPrompts.find(Boolean) ?? null
        item.usage = result.usage
        for (const [imageIndex, bytes] of result.images.entries()) {
          const name = result.images.length > 1 ? `${base}-${imageIndex + 1}` : base
          item.files.push(await saveImage(runDir, request.group, name, bytes))
        }
        console.log(
          `  ✓ ${String(request.order + 1).padStart(2, '0')} ${request.label} · ${(durationMs / 1000).toFixed(1)}s · ${usd(item.costCents)}`
        )
      } else {
        item.errorCode = result.code
        console.log(
          `  ✗ ${String(request.order + 1).padStart(2, '0')} ${request.label} · ${(durationMs / 1000).toFixed(1)}s · ${result.code}`
        )
      }
      committed += item.costCents
      manifest.totals.returned += item.returnedCount
      manifest.totals.failed += item.status === 'failed' ? 1 : 0
      manifest.totals.costCents += item.costCents
      manifest.items.push(item)
      await writeState()
    }
  })
  await Promise.all(workers)

  manifest.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  manifest.finishedAt = new Date().toISOString()
  await writeReport(runDir, manifest)
  await addSpend(LAB, {
    run: path.relative(ROOT, runDir).split(path.sep).join('/'),
    command: meta.command,
    label: meta.label,
    category: meta.category ?? null,
    at: manifest.startedAt,
    planned,
    returned: manifest.totals.returned,
    failed: manifest.totals.failed,
    skipped: manifest.totals.skipped,
    costCents: manifest.totals.costCents
  })
  budget.spent += committed
  console.log(
    `  ${manifest.totals.returned} returned · ${usd(manifest.totals.costCents)} · ledger ${usd(budget.spent)} of ${usd(budget.max)}`
  )
  return { skipped: false, runDir, manifest }
}

async function runSetCommand({ S, client, baseUrl, opts, budget, category, sourcePath, command = 'set', runDir }) {
  const run = await buildSetRun({ S, opts, category, sourcePath, runDir, command })
  try {
    return await executeRun({ S, client, baseUrl, requests: run.requests, runDir, meta: run.meta, budget, opts })
  } finally {
    await fsp.rm(path.join(runDir, '.work'), { recursive: true, force: true }).catch(() => undefined)
  }
}

async function planCommand({ S, opts }) {
  const categories = opts.category && !opts.all
    ? [String(opts.category)]
    : S.recipes.RECIPES.map((recipe) => recipe.id)
  const shape = resolveShape(S, opts, 'square')
  const format = resolveFormat(S, opts)
  const palette = paletteFrom(opts)
  const overrides = readOverrides(opts)
  const plan = {
    command: 'plan',
    createdAt: new Date().toISOString(),
    model: S.constants.MUSE_MODEL,
    shape,
    format,
    palette,
    overrides,
    categories: [],
    totals: { images: 0, costCents: 0 }
  }
  for (const category of categories) {
    const recipe = S.recipes.recipeById(category)
    const basePlan = S.plans.createDefaultPlan({
      category,
      productName: 'Preview',
      shape,
      format
    })
    const categoryPlan = applyDirections(basePlan, overrides.directions)
    const specs = S.setPlan.planSetPrompts({
      plan: categoryPlan,
      shots: categoryPlan.shots,
      palette,
      giftClause: overrides.giftClause
    })
    plan.categories.push({
      category,
      label: recipe.label,
      shots: specs.map((spec) => ({
        type: spec.type,
        label: spec.label,
        personId: spec.personId,
        prompt: spec.prompt,
        costCents: S.cost.CENTS_PER_IMAGE
      }))
    })
    plan.totals.images += specs.length
    plan.totals.costCents += specs.length * S.cost.CENTS_PER_IMAGE
    console.log(`\n${recipe.label} (${specs.length} images · ${usd(specs.length * S.cost.CENTS_PER_IMAGE)})`)
    for (const spec of specs) {
      const prompt = spec.prompt.length > 220 ? `${spec.prompt.slice(0, 217)}...` : spec.prompt
      console.log(`  ${spec.label}${spec.personId ? ` [person: ${spec.personId}]` : ''}`)
      console.log(`    ${prompt}`)
    }
  }
  const dir = path.join(LAB, 'plans')
  await ensureDir(dir)
  const file = path.join(dir, `${stamp()}-${slug(categories.length === 1 ? categories[0] : 'all')}.json`)
  await fsp.writeFile(file, `${JSON.stringify(plan, null, 2)}\n`)
  console.log(`\nPlan written to ${path.relative(ROOT, file)}. Nothing was charged.`)
}

async function setCommand({ S, client, baseUrl, opts, budget }) {
  const category = String(opts.category ?? '')
  if (!category) fail('Pass --category, for example --category clothing.')
  if (!opts.source) fail('Pass --source /path/to/product.jpg.')
  if (!S.recipes.RECIPES.some((entry) => entry.id === category)) {
    fail(`Unknown category "${category}". Use one of: ${S.recipes.RECIPES.map((entry) => entry.id).join(', ')}.`)
  }
  const recipe = S.recipes.recipeById(category)
  const runDir = path.join(LAB, 'runs', `${stamp()}-set-${slug(recipe.id)}`)
  return runSetCommand({
    S,
    client,
    baseUrl,
    opts,
    budget,
    category: recipe.id,
    sourcePath: opts.source,
    command: 'set',
    runDir
  })
}

async function editCommand({ S, client, baseUrl, opts, budget }) {
  if (!opts.source) fail('Pass --source /path/to/product.jpg.')
  if (!opts.template) fail('Pass --template, for example --template kitchen-table.')
  const template = S.templates.templateById(String(opts.template))
  if (!template) fail(`Unknown template "${opts.template}". Use a scene, model, background, lighting, color or finish template.`)
  const runDir = path.join(LAB, 'runs', `${stamp()}-edit-${slug(template.id)}`)
  const source = await normaliseSource(S, opts.source, runDir)
  const shape = resolveShape(S, opts, S.shapes.shapeForImage(source.width, source.height))
  const format = resolveFormat(S, opts)
  const palette = paletteFrom(opts)
  const personId = template.kind === 'model' ? String(opts.person ?? 'maya') : opts.person ? String(opts.person) : null
  const personLook = personId && opts.look && opts.look !== 'original' ? String(opts.look) : null
  const images = [source.bytes]
  if (personId) images.push(await personBytes(personId, personLook))
  const prompt = S.guards.composeChange({
    text: template.prompt,
    kind: template.kind,
    hasReference: true,
    isGiftShot: template.id === 'gift-ready',
    palette
  })
  const sourceMeta = {
    file: source.file,
    label: source.label,
    sourcePath: source.sourcePath,
    width: source.width,
    height: source.height,
    sha256: source.sha256
  }
  const meta = {
    command: 'edit',
    label: `${template.label}${personId ? ` · ${personId}` : ''}`,
    category: template.group,
    palette,
    shape,
    format,
    source: sourceMeta,
    sources: { edit: sourceMeta }
  }
  const requests = [
    {
      order: 0,
      group: 'edit',
      key: template.id,
      label: template.label,
      prompt,
      endpoint: 'edit',
      images,
      count: 1,
      shape,
      format,
      personId,
      personLook,
      hasSource: true
    }
  ]
  try {
    return await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  } finally {
    await fsp.rm(path.join(runDir, '.work'), { recursive: true, force: true }).catch(() => undefined)
  }
}

async function createCommand({ S, client, baseUrl, opts, budget }) {
  const text = String(opts.text ?? '').trim()
  if (!text) fail('Pass --text "describe the image".')
  const count = Number(opts.count ?? 1)
  if (!Number.isInteger(count) || count < 1 || count > S.constants.MAX_CREATE_VARIANTS) {
    fail(`--count must be between 1 and ${S.constants.MAX_CREATE_VARIANTS}.`)
  }
  const personId = opts.person ? String(opts.person) : null
  const personLook = personId && opts.look && opts.look !== 'original' ? String(opts.look) : null
  if ((opts.source || personId) && count !== 1) fail('A reference makes one image at a time.')
  const runDir = path.join(LAB, 'runs', `${stamp()}-create-${slug(text)}`)
  const source = opts.source ? await normaliseSource(S, opts.source, runDir) : null
  const shape = resolveShape(S, opts, source ? S.shapes.shapeForImage(source.width, source.height) : 'square')
  const format = resolveFormat(S, opts)
  const palette = paletteFrom(opts)
  const images = []
  if (source) images.push(source.bytes)
  if (personId) images.push(await personBytes(personId, personLook))
  const prompt = S.guards.composeCreatePrompt({
    text,
    hasProduct: Boolean(source),
    hasPerson: Boolean(personId)
  })
  const sourceMeta = source
    ? {
        file: source.file,
        label: source.label,
        sourcePath: source.sourcePath,
        width: source.width,
        height: source.height,
        sha256: source.sha256
      }
    : null
  const meta = {
    command: 'create',
    label: text.slice(0, 70),
    category: 'create',
    palette,
    shape,
    format,
    source: sourceMeta,
    sources: sourceMeta ? { create: sourceMeta } : {}
  }
  const requests = [
    {
      order: 0,
      group: 'create',
      key: 'create',
      label: `Create ${count} ${count === 1 ? 'image' : 'images'}`,
      prompt,
      endpoint: images.length ? 'edit' : 'generate',
      images,
      count,
      shape,
      format,
      personId,
      personLook,
      hasSource: Boolean(source)
    }
  ]
  try {
    return await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  } finally {
    await fsp.rm(path.join(runDir, '.work'), { recursive: true, force: true }).catch(() => undefined)
  }
}

async function peopleCommand({ S, client, baseUrl, opts, budget }) {
  const wanted = opts.ids
    ? new Set(
        String(opts.ids)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    : null
  if (wanted) {
    for (const id of wanted) {
      if (!PEOPLE_PACK.some((person) => person.id === id)) {
        fail(`Unknown bundled person "${id}". Use one of: ${PEOPLE_PACK.map((person) => person.id).join(', ')}.`)
      }
    }
  }
  const pack = PEOPLE_PACK.filter((person) => !wanted || wanted.has(person.id))
  const pending = pack.filter(
    (person) => opts.force || !fs.existsSync(path.join(PEOPLE_DIR, `${person.id}.webp`))
  )
  if (!pending.length) {
    console.log('All requested people already have images. Add --force to regenerate them.')
    return { skipped: true }
  }
  const runDir = path.join(LAB, 'runs', `${stamp()}-people`)
  const requests = pending.map((person, order) => ({
    order,
    group: 'people',
    key: person.id,
    label: `${person.name} · ${person.ageBand}`,
    prompt: person.prompt,
    endpoint: 'generate',
    images: [],
    count: 1,
    shape: 'portrait',
    format: 'webp',
    personId: null,
    hasSource: false
  }))
  const meta = {
    command: 'people',
    label: `People pack · ${pending.length}`,
    category: 'people',
    palette: [],
    shape: 'portrait',
    format: 'webp',
    source: null,
    sources: {}
  }
  const result = await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  if (result.skipped) return result
  await ensureDir(PEOPLE_DIR)
  const generated = []
  for (const item of result.manifest.items) {
    if (item.status !== 'ok' || !item.files?.[0]) continue
    const person = pending.find((entry) => entry.id === item.key)
    if (!person) continue
    const raw = path.join(runDir, item.files[0].file)
    const rawMeta = await sharp(raw).metadata()
    const width = rawMeta.width ?? 1024
    const fullPath = path.join(PEOPLE_DIR, `${person.id}.webp`)
    const portraitPath = path.join(PEOPLE_DIR, `${person.id}-portrait.webp`)
    await sharp(raw)
      .resize({ width: 640, height: 960, fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toFile(fullPath)
    // A square crop from the top keeps the head and chest. It is deliberately
    // deterministic: prompts put the head near the top of a centered full body.
    const cropSize = Math.round(width * 0.62)
    await sharp(raw)
      .extract({ left: Math.round((width - cropSize) / 2), top: 0, width: cropSize, height: cropSize })
      .resize({ width: 512, height: 512 })
      .webp({ quality: 88 })
      .toFile(portraitPath)
    generated.push({
      id: person.id,
      name: person.name,
      ageBand: person.ageBand,
      blurb: person.blurb,
      prompt: person.prompt,
      run: path.relative(ROOT, runDir).split(path.sep).join('/'),
      files: [fullPath, portraitPath].map((file) => path.relative(ROOT, file).split(path.sep).join('/')),
      costCents: item.costCents
    })
    console.log(`  ${path.relative(ROOT, fullPath)}`)
    console.log(`  ${path.relative(ROOT, portraitPath)}`)
  }
  let manifest = { people: [] }
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(PEOPLE_DIR, 'manifest.json'), 'utf8'))
  } catch {
    // First people run.
  }
  const byId = new Map((manifest.people ?? []).map((person) => [person.id, person]))
  for (const person of generated) byId.set(person.id, person)
  await fsp.writeFile(
    path.join(PEOPLE_DIR, 'manifest.json'),
    `${JSON.stringify({ createdAt: new Date().toISOString(), people: [...byId.values()] }, null, 2)}\n`
  )
  return result
}

async function looksCommand({ S, client, baseUrl, opts, budget }) {
  const wantedPeople = opts.ids
    ? new Set(
        String(opts.ids)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    : null
  if (wantedPeople) {
    for (const id of wantedPeople) {
      if (!PEOPLE_PACK.some((person) => person.id === id)) {
        fail(`Unknown bundled person "${id}". Use one of: ${PEOPLE_PACK.map((person) => person.id).join(', ')}.`)
      }
    }
  }
  const wantedLooks = opts.looks
    ? new Set(
        String(opts.looks)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    : null
  if (wantedLooks) {
    for (const key of wantedLooks) {
      if (!PERSON_LOOKS_PACK.some((look) => look.key === key)) {
        fail(`Unknown look "${key}". Use one of: ${PERSON_LOOKS_PACK.map((look) => look.key).join(', ')}.`)
      }
    }
  }
  const pending = []
  for (const person of PEOPLE_PACK) {
    if (wantedPeople && !wantedPeople.has(person.id)) continue
    for (const look of PERSON_LOOKS_PACK) {
      if (wantedLooks && !wantedLooks.has(look.key)) continue
      const target = path.join(LOOKS_DIR, `${person.id}-${look.key}.webp`)
      if (!opts.force && fs.existsSync(target)) continue
      pending.push({ person, look, target })
    }
  }
  if (!pending.length) {
    console.log('All requested person looks already have images. Add --force to regenerate them.')
    return { skipped: true }
  }
  const runDir = path.join(LAB, 'runs', `${stamp()}-looks`)
  const requests = []
  for (const [order, entry] of pending.entries()) {
    const reference = await personBytes(entry.person.id)
    requests.push({
      order,
      group: 'looks',
      key: `${entry.person.id}-${entry.look.key}`,
      label: `${entry.person.name} · ${entry.look.label}`,
      prompt: S.guards.composeCreatePrompt({
        text: entry.look.prompt,
        hasProduct: false,
        hasPerson: true
      }),
      endpoint: 'edit',
      images: [reference],
      count: 1,
      shape: 'portrait',
      format: 'webp',
      personId: entry.person.id,
      personLook: entry.look.key,
      hasSource: false
    })
  }
  const meta = {
    command: 'looks',
    label: `Person looks · ${pending.length}`,
    category: 'looks',
    palette: [],
    shape: 'portrait',
    format: 'webp',
    source: null,
    sources: {}
  }
  const result = await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  if (result.skipped) return result
  await ensureDir(LOOKS_DIR)
  const byKey = new Map(pending.map((entry) => [`${entry.person.id}-${entry.look.key}`, entry]))
  const generated = []
  for (const item of result.manifest.items) {
    if (item.status !== 'ok' || !item.files?.[0]) continue
    const entry = byKey.get(item.key)
    if (!entry) continue
    const raw = path.join(runDir, item.files[0].file)
    await sharp(raw)
      .resize({ width: 640, height: 960, fit: 'cover', position: 'centre' })
      .webp({ quality: 88, effort: 4 })
      .toFile(entry.target)
    generated.push({
      personId: entry.person.id,
      key: entry.look.key,
      label: entry.look.label,
      prompt: item.prompt,
      run: path.relative(ROOT, runDir).split(path.sep).join('/'),
      file: path.relative(ROOT, entry.target).split(path.sep).join('/'),
      costCents: item.costCents
    })
    console.log(`  ${path.relative(ROOT, entry.target)}`)
  }
  let manifest = { looks: [] }
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(LOOKS_DIR, 'manifest.json'), 'utf8'))
  } catch {
    // First looks run.
  }
  const byId = new Map((manifest.looks ?? []).map((look) => [`${look.personId}-${look.key}`, look]))
  for (const look of generated) byId.set(`${look.personId}-${look.key}`, look)
  await fsp.writeFile(
    path.join(LOOKS_DIR, 'manifest.json'),
    `${JSON.stringify({ createdAt: new Date().toISOString(), looks: [...byId.values()] }, null, 2)}\n`
  )
  return result
}

async function productsCommand({ S, client, baseUrl, opts, budget }) {
  const wanted = opts.ids
    ? new Set(
        String(opts.ids)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    : null
  if (wanted) {
    for (const id of wanted) {
      if (!PRODUCT_PACK.some((product) => product.id === id)) {
        fail(`Unknown bundled product "${id}". Use one of: ${PRODUCT_PACK.map((product) => product.id).join(', ')}.`)
      }
    }
  }
  const pending = PRODUCT_PACK.filter((product) => {
    if (wanted && !wanted.has(product.id)) return false
    if (opts.force) return true
    return (
      !fs.existsSync(path.join(PRODUCTS_DIR, `${product.id}.webp`)) ||
      !fs.existsSync(path.join(PRODUCTS_DIR, `${product.id}-thumb.webp`))
    )
  })
  if (!pending.length) {
    console.log('All requested bundled products already have images. Add --force to regenerate them.')
    return { skipped: true }
  }
  const runDir = path.join(LAB, 'runs', `${stamp()}-products`)
  const requests = pending.map((product, order) => ({
    order,
    group: 'products',
    key: product.id,
    label: `${product.name} · ${product.category}`,
    prompt: product.prompt,
    endpoint: 'generate',
    images: [],
    count: 1,
    shape: 'square',
    format: 'webp',
    personId: null,
    hasSource: false
  }))
  const meta = {
    command: 'products',
    label: `Product pack · ${pending.length}`,
    category: 'products',
    palette: [],
    shape: 'square',
    format: 'webp',
    source: null,
    sources: {}
  }
  const result = await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  if (result.skipped) return result
  await ensureDir(PRODUCTS_DIR)
  const generated = []
  for (const item of result.manifest.items) {
    if (item.status !== 'ok' || !item.files?.[0]) continue
    const product = pending.find((entry) => entry.id === item.key)
    if (!product) continue
    const raw = path.join(runDir, item.files[0].file)
    const fullPath = path.join(PRODUCTS_DIR, `${product.id}.webp`)
    const thumbPath = path.join(PRODUCTS_DIR, `${product.id}-thumb.webp`)
    await sharp(raw)
      .resize({ width: 1024, height: 1024, fit: 'cover', position: 'centre' })
      .webp({ quality: 90, effort: 4 })
      .toFile(fullPath)
    await sharp(raw)
      .resize({ width: 480, height: 480, fit: 'cover' })
      .webp({ quality: 82 })
      .toFile(thumbPath)
    generated.push({
      id: product.id,
      name: product.name,
      category: product.category,
      prompt: item.prompt,
      run: path.relative(ROOT, runDir).split(path.sep).join('/'),
      files: [fullPath, thumbPath].map((file) => path.relative(ROOT, file).split(path.sep).join('/')),
      costCents: item.costCents
    })
    console.log(`  ${path.relative(ROOT, fullPath)}`)
    console.log(`  ${path.relative(ROOT, thumbPath)}`)
  }
  let manifest = { products: [] }
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(PRODUCTS_DIR, 'manifest.json'), 'utf8'))
  } catch {
    // First product run.
  }
  const byId = new Map((manifest.products ?? []).map((product) => [product.id, product]))
  for (const product of generated) byId.set(product.id, product)
  await fsp.writeFile(
    path.join(PRODUCTS_DIR, 'manifest.json'),
    `${JSON.stringify({ createdAt: new Date().toISOString(), products: [...byId.values()] }, null, 2)}\n`
  )
  return result
}

async function sourcesCommand({ S, client, baseUrl, opts, budget }) {
  const missing = SOURCE_PACK.filter((entry) => opts.force || !findSource(entry.category))
  if (!missing.length) {
    console.log(`All ${SOURCE_PACK.length} category sources are present in ${path.relative(ROOT, SOURCES)}.`)
    return
  }
  const runDir = path.join(LAB, 'runs', `${stamp()}-sources`)
  const requests = missing.map((entry, order) => ({
    order,
    group: 'sources',
    key: entry.category,
    label: entry.category,
    prompt: entry.prompt,
    endpoint: 'generate',
    images: [],
    count: 1,
    shape: 'square',
    format: 'webp',
    personId: null,
    hasSource: false
  }))
  const meta = {
    command: 'sources',
    label: `Source pack · ${missing.length} stand-in product${missing.length === 1 ? '' : 's'}`,
    category: 'sources',
    palette: [],
    shape: 'square',
    format: 'webp',
    source: null,
    sources: {}
  }
  const result = await executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
  if (result.skipped) return result
  await ensureDir(SOURCES)
  const manifest = []
  for (const item of result.manifest.items) {
    if (item.status !== 'ok' || !item.files?.[0]) continue
    const from = path.join(runDir, item.files[0].file)
    const extension = path.extname(from) || '.webp'
    const target = path.join(SOURCES, `${item.key}${extension}`)
    await fsp.copyFile(from, target)
    manifest.push({
      category: item.key,
      file: path.relative(ROOT, target).split(path.sep).join('/'),
      prompt: item.prompt,
      source: 'synthetic',
      run: path.relative(ROOT, runDir).split(path.sep).join('/')
    })
    console.log(`  ${path.relative(ROOT, target)}`)
  }
  await fsp.writeFile(path.join(SOURCES, 'manifest.json'), `${JSON.stringify({ createdAt: new Date().toISOString(), sources: manifest }, null, 2)}\n`)
  return result
}

async function writeSweepIndex(parentDir, summaries, skipped) {
  const rows = summaries
    .map(
      (summary) =>
        `<li><a href="${slug(summary.category)}/index.html">${summary.label}</a> — ${summary.returned} images · ${usd(summary.costCents)}</li>`
    )
    .join('\n')
  const skippedRows = skipped.map((entry) => `<li>${entry}</li>`).join('\n')
  const total = summaries.reduce((sum, summary) => sum + summary.costCents, 0)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Category sweep</title>
<style>body{font:14px/1.5 system-ui,sans-serif;background:#141412;color:#f2eee4;margin:0;padding:32px}a{color:#86c79a}li{margin:6px 0}.muted{color:#a8a294}</style></head><body>
<h1>Category sweep</h1><p class="muted">${summaries.length} categories · ${usd(total)}</p>
<ul>${rows}</ul>${skipped.length ? `<h2>No source photo</h2><ul>${skippedRows}</ul>` : ''}
<p class="muted"><a href="../index.html">Runs</a> · <a href="../../spend.json">Spend ledger</a></p>
</body></html>`
  await fsp.writeFile(path.join(parentDir, 'index.html'), html)
  await fsp.writeFile(
    path.join(parentDir, 'summary.json'),
    `${JSON.stringify({ createdAt: new Date().toISOString(), categories: summaries, skipped }, null, 2)}\n`
  )
}

async function sweepCommand({ S, client, baseUrl, opts, budget }) {
  const all = S.recipes.RECIPES.map((recipe) => recipe.id)
  const categories = opts.categories
    ? String(opts.categories)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : all
  for (const category of categories) {
    if (!all.includes(category)) fail(`Unknown category "${category}".`)
  }
  const sourceDir = opts.sourceDir ? path.resolve(ROOT, String(opts.sourceDir)) : SOURCES
  const withSources = categories.filter((category) => Boolean(findSourceIn(sourceDir, category)))
  const skipped = categories.filter((category) => !withSources.includes(category))
  if (!withSources.length) {
    fail(`No category sources found in ${path.relative(ROOT, sourceDir)}. Run "npm run lab -- sources" first, or drop real photos there.`)
  }
  const perCategory = (category) => S.recipes.recipeShotTypes(category).length
  const planned = withSources.reduce((sum, category) => sum + perCategory(category), 0)
  console.log(`Sweep: ${withSources.length} categories × ${perCategory(withSources[0])} shots = ${planned} images · ${usd(planned * S.cost.CENTS_PER_IMAGE)}`)
  if (skipped.length) console.log(`Skipping (no source): ${skipped.join(', ')}`)
  if (!requireYes(opts, planned * S.cost.CENTS_PER_IMAGE, budget)) return { skipped: true }
  const parentDir = path.join(LAB, 'runs', `${stamp()}-sweep`)
  const summaries = []
  for (const category of withSources) {
    const sourcePath = findSourceIn(sourceDir, category)
    const runDir = path.join(parentDir, category)
    const result = await runSetCommand({
      S,
      client,
      baseUrl,
      opts: { ...opts, yes: true },
      budget,
      category,
      sourcePath,
      command: 'sweep',
      runDir
    })
    if (!result?.skipped) {
      summaries.push({
        category,
        label: S.recipes.recipeById(category).label,
        returned: result.manifest.totals.returned,
        failed: result.manifest.totals.failed,
        costCents: result.manifest.totals.costCents,
        run: path.relative(ROOT, runDir).split(path.sep).join('/')
      })
    }
  }
  await writeSweepIndex(parentDir, summaries, skipped)
  const total = summaries.reduce((sum, summary) => sum + summary.costCents, 0)
  console.log(`\nSweep complete: ${summaries.length} categories · ${usd(total)} · ${path.relative(ROOT, parentDir)}`)
  return { skipped: false, parentDir, summaries }
}

async function resumeCommand({ S, client, baseUrl, opts, budget }) {
  const original = opts._[0]
  if (!original) fail('Pass the run folder to resume, for example: npm run lab -- resume lab/runs/2026-11-09-1412-set-clothing --yes')
  const originalDir = path.resolve(ROOT, String(original))
  const manifestFile = path.join(originalDir, 'manifest.json')
  if (!fs.existsSync(manifestFile)) fail(`No manifest.json in ${original}`)
  const previous = JSON.parse(await fsp.readFile(manifestFile, 'utf8'))
  const failed = previous.items.filter((item) => item.status !== 'ok')
  if (!failed.length) {
    console.log('Every image in that run succeeded. Nothing to resume.')
    return { skipped: true }
  }
  const sourceFile = path.join(originalDir, 'source', 'working.webp')
  const sourceBytes = fs.existsSync(sourceFile) ? await fsp.readFile(sourceFile) : null
  const runDir = path.join(LAB, 'runs', `${stamp()}-resume-${slug(path.basename(originalDir))}`)
  const requests = []
  for (const [order, item] of failed.entries()) {
    const meta = item.request ?? {}
    const images = []
    if (meta.hasSource && sourceBytes) images.push(sourceBytes)
    if (meta.personId) images.push(await personBytes(meta.personId, meta.personLook ?? null))
    if (meta.hasSource && !sourceBytes) fail(`The original run has no source/working.webp; cannot rebuild "${item.label}".`)
    requests.push({
      order,
      group: item.group,
      key: item.key,
      label: item.label,
      prompt: item.prompt,
      endpoint: meta.endpoint ?? item.endpoint ?? 'edit',
      images,
      count: meta.count ?? 1,
      shape: meta.shape ?? previous.shape,
      format: meta.format ?? previous.format,
      personId: meta.personId ?? null,
      hasSource: meta.hasSource === true
    })
  }
  const meta = {
    command: 'resume',
    label: `Resume · ${previous.command} · ${previous.label}`,
    category: previous.category,
    palette: previous.palette,
    shape: previous.shape,
    format: previous.format,
    source: previous.source,
    sources: previous.sources
  }
  return executeRun({ S, client, baseUrl, requests, runDir, meta, budget, opts })
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
    fail('Run the lab from the repository root.')
  }
  const { command, opts } = parseArgs(process.argv.slice(2))
  if (!COMMANDS.has(command)) {
    usage()
    fail(`Unknown command "${command}".`)
  }
  if (command === 'help' || opts.help) {
    usage()
    return
  }
  loadDotEnv()
  const baseUrl = String(opts.baseUrl ?? process.env.MOSS_LAB_BASE_URL ?? 'https://api.meta.ai/v1').replace(/\/+$/, '')
  new URL(baseUrl)
  const S = await loadModules()
  try {
    const { client, key } = createClient(S, baseUrl)
    await validateKey(client, key)
    const budget = await readBudget(opts)
    if (command === 'edit') await editCommand({ S, client, baseUrl, opts, budget })
    else if (command === 'create') await createCommand({ S, client, baseUrl, opts, budget })
    else if (command === 'sources') await sourcesCommand({ S, client, baseUrl, opts, budget })
    else if (command === 'people') await peopleCommand({ S, client, baseUrl, opts, budget })
    else if (command === 'looks') await looksCommand({ S, client, baseUrl, opts, budget })
    else if (command === 'products') await productsCommand({ S, client, baseUrl, opts, budget })
  } finally {
    await S.loader.close()
  }
}

main().catch((error) => {
  if (error instanceof LabError) {
    console.error(`lab: ${error.message}`)
  } else {
    console.error(`lab: unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) console.error(error.stack.split('\n').slice(0, 6).join('\n'))
  }
  process.exitCode = 1
})
