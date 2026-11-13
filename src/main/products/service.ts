import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Format, ImportResult, Product, ProductAnalysis, ProductDetail, ProjectType, Shape } from '@shared/types'
import type { ProductRepository } from '../db/repositories/products'
import type { ImageRepository } from '../db/repositories/images'
import type { ProjectRepository } from '../db/repositories/projects'
import type { PlanRepository } from '../db/repositories/plans'
import type { MediaService } from '../media/service'
import type { TextProvider } from '../muse/text'
import type { UsageRepository } from '../db/repositories/usage'
import type { SamProvider } from '../muse/sam'
import { errorMessage } from '@shared/errors'
import { extractJsonObject } from '@shared/aiJson'
import { ImageImportError, normaliseProduct } from '../media/import'
import { absoluteInLibrary, workingFor } from '../media/paths'
import { shapeForImage } from '@shared/shapes'
import { bundledProductById, bundledProductCard, isBundledProduct } from '@shared/products'

function cleanName(name: string, fallback: string): string {
  return name.trim().slice(0, 80) || fallback.slice(0, 80) || 'Product'
}

export class ProductService {
  constructor(
    private readonly deps: {
      products: ProductRepository
      images: ImageRepository
      projects: ProjectRepository
      plans: PlanRepository
      media: MediaService
      libraryPath: () => string
      resourceRoot: () => string
      provider?: TextProvider
      usage?: UsageRepository
      sam?: SamProvider
    }
  ) {}

  private async sourceBytes(imageId: string): Promise<{ bytes: Buffer; name: string }> {
    const image = this.deps.images.get(imageId)
    if (!image || image.status !== 'ready') {
      throw new ImageImportError('unreadable', 'That photo is not here anymore.')
    }
    const project = this.deps.projects.get(image.projectId)
    let bytes: Buffer | null = null
    try {
      bytes = await fs.readFile(workingFor(this.deps.libraryPath(), image.projectId, image.id))
    } catch {
      // Older rows may only have their original file.
    }
    if (!bytes && image.url) {
      try {
        bytes = await fs.readFile(
          absoluteInLibrary(this.deps.libraryPath(), decodeURI(image.url.replace('moss-media://library/', '')))
        )
      } catch {
        // Report not_found below.
      }
    }
    if (!bytes) throw new ImageImportError('unreadable', 'That photo is not here anymore.')
    return { bytes, name: image.label || project?.name || 'Product' }
  }

  async addFromBytes(input: { bytes: Uint8Array; name: string; category?: string | null }): Promise<Product> {
    const id = crypto.randomUUID()
    const normalised = await normaliseProduct({
      libraryPath: this.deps.libraryPath(),
      productId: id,
      bytes: input.bytes
    })
    try {
      return this.deps.products.create({
        id,
        name: cleanName(input.name, 'Product'),
        file: normalised.file,
        thumb: normalised.thumb,
        width: normalised.width,
        height: normalised.height,
        category: input.category ?? null
      })
    } catch (error) {
      await this.removeFiles([normalised.file, normalised.thumb])
      throw error
    }
  }

  async saveFromImage(input: { imageId: string; name: string }): Promise<Product> {
    const source = await this.sourceBytes(input.imageId)
    const product = await this.addFromBytes({ bytes: source.bytes, name: cleanName(input.name, source.name) })
    const image = this.deps.images.get(input.imageId)
    if (image) {
      const project = this.deps.projects.get(image.projectId)
      if (project && !project.productId) {
        this.deps.projects.update(project.id, { productId: product.id })
      }
    }
    return product
  }

  async createFromProject(input: { projectId: string; name?: string }): Promise<Product> {
    const project = this.deps.projects.get(input.projectId)
    if (!project) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    if (!project.sourceImageId) throw new ImageImportError('unreadable', 'Add a product photo first.')
    const source = await this.sourceBytes(project.sourceImageId)
    const product = await this.addFromBytes({
      bytes: source.bytes,
      name: cleanName(input.name ?? project.name, source.name),
      category: project.category
    })
    this.deps.projects.update(project.id, { productId: product.id })
    return product
  }

  async analyze(id: string): Promise<ProductDetail> {
    const product = this.deps.products.get(id)
    const row = this.deps.products.getRow(id)
    if (!product || !row || isBundledProduct(id)) {
      throw new ImageImportError('unreadable', 'That product is not here anymore.')
    }
    if (!this.deps.provider) throw new ImageImportError('unreadable', 'The photo reader is not available.')
    let bytes: Buffer
    try {
      bytes = await fs.readFile(absoluteInLibrary(this.deps.libraryPath(), row.file))
    } catch {
      throw new ImageImportError('unreadable', 'The product photo is missing.')
    }
    const system = [
      'You look at one photo of a product for a small shop.',
      'Describe only what you can actually see. Never invent a material, a dimension, a certification, a brand, or a claim that the photo does not show.',
      'Answer with JSON only, no prose and no code fence, in exactly this shape:',
      '{"product": string, "category": string, "audience": string, "points": [string]}',
      'Write a short product name, a plain category, one sentence about who would buy it, and at most 5 short things a buyer would notice.',
      'Do not use markdown. Use regular hyphens and no em dashes.'
    ].join(' ')
    const user = [
      `The seller calls it: ${product.name}`,
      product.category ? `Their category: ${product.category}` : '',
      'Read the attached photo and return the JSON object only.'
    ]
      .filter(Boolean)
      .join('\n')
    const result = await this.deps.provider.generate({
      system,
      user,
      image: { mime: 'image/webp', bytes }
    })
    if (!result.ok) {
      this.deps.usage?.record({
        projectId: null,
        projectName: product.name,
        action: 'analyze',
        requestedN: 0,
        returnedN: 0,
        costCents: 0,
        costMicros: 0,
        result: 'failed',
        errorCode: result.code,
        requestId: result.requestId
      })
      throw new ImageImportError('unreadable', 'The photo could not be read. Check your key and connection.')
    }
    const parsed = extractJsonObject(result.content)
    if (!parsed || typeof parsed !== 'object') {
      this.deps.usage?.record({
        projectId: null,
        projectName: product.name,
        action: 'analyze',
        requestedN: 0,
        returnedN: 0,
        costCents: 0,
        costMicros: result.costMicros,
        result: 'failed',
        errorCode: 'invalid_request',
        requestId: result.requestId
      })
      throw new ImageImportError('unreadable', 'The photo reader did not return a usable answer.')
    }
    const raw = parsed as { product?: unknown; category?: unknown; audience?: unknown; points?: unknown }
    const analysis: ProductAnalysis = {
      product: String(raw.product ?? product.name).trim().slice(0, 100),
      category: String(raw.category ?? '').trim().slice(0, 60),
      audience: String(raw.audience ?? '').trim().slice(0, 200),
      points: (Array.isArray(raw.points) ? raw.points : [])
        .map((point) => String(point ?? '').trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 5),
      createdAt: Date.now(),
      costMicros: result.costMicros
    }
    this.deps.products.setAnalysis(id, analysis)
    if (!product.category && analysis.category) {
      this.deps.products.update(id, { category: analysis.category })
    }
    if (!product.audience && analysis.audience) {
      this.deps.products.update(id, { audience: analysis.audience })
    }
    this.deps.usage?.record({
      projectId: null,
      projectName: product.name,
      action: 'analyze',
      requestedN: 0,
      returnedN: 0,
      costCents: 0,
      costMicros: result.costMicros,
      result: 'ok',
      requestId: result.requestId
    })
    return this.detail(id)
  }

  async cleanShot(id: string): Promise<{ projectId: string; detail: ProductDetail }> {
    const product = this.deps.products.get(id)
    const row = this.deps.products.getRow(id)
    if (!product || !row || isBundledProduct(id)) {
      throw new ImageImportError('unreadable', 'That product is not here anymore.')
    }
    if (!this.deps.sam) throw new ImageImportError('unreadable', 'The cutout tool is not available.')
    let bytes: Buffer
    try {
      bytes = await fs.readFile(absoluteInLibrary(this.deps.libraryPath(), row.file))
    } catch {
      throw new ImageImportError('unreadable', 'The product photo is missing.')
    }
    const segmented = await this.deps.sam.segment({ bytes, mime: 'image/webp', concept: product.name })
    if (!segmented.ok) {
      this.deps.usage?.record({
        projectId: null,
        projectName: product.name,
        action: 'cutout',
        requestedN: 0,
        returnedN: 0,
        costCents: 0,
        costMicros: 0,
        result: 'failed',
        errorCode: segmented.code,
        requestId: segmented.requestId
      })
      throw new ImageImportError('unreadable', errorMessage(segmented.code))
    }
    const meta = await sharp(bytes).metadata()
    const width = Math.max(1, meta.width ?? 0)
    const height = Math.max(1, meta.height ?? 0)
    const { bounds, raster, width: maskWidth } = segmented.mask
    const alpha = Buffer.alloc(width * height * 4)
    for (let y = 0; y < bounds.bottom - bounds.top; y += 1) {
      for (let x = 0; x < bounds.right - bounds.left; x += 1) {
        if (raster[y * maskWidth + x]) {
          const at = ((bounds.top + y) * width + bounds.left + x) * 4
          alpha[at + 3] = 255
        }
      }
    }
    const maskPng = await sharp(alpha, { raw: { width, height, channels: 4 } }).png().toBuffer()
    const cutout = await sharp(bytes).ensureAlpha().composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer()
    const cutoutRelative = path.posix.join('products', `${id}-cutout.png`)
    await fs.mkdir(path.dirname(absoluteInLibrary(this.deps.libraryPath(), cutoutRelative)), { recursive: true })
    await fs.writeFile(absoluteInLibrary(this.deps.libraryPath(), cutoutRelative), cutout)
    let trimmed = cutout
    try {
      trimmed = await sharp(cutout).trim().png().toBuffer()
    } catch {
      // A cutout touching every edge has nothing to trim.
    }
    const cleanSize = 2048
    const object = await sharp(trimmed)
      .resize({ width: Math.round(cleanSize * 0.84), height: Math.round(cleanSize * 0.84), fit: 'inside' })
      .png()
      .toBuffer()
    const objectMeta = await sharp(object).metadata()
    const clean = await sharp({
      create: { width: cleanSize, height: cleanSize, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
      .composite([{
        input: object,
        left: Math.max(0, Math.round((cleanSize - (objectMeta.width ?? cleanSize)) / 2)),
        top: Math.max(0, Math.round((cleanSize - (objectMeta.height ?? cleanSize)) / 2))
      }])
      .jpeg({ quality: 92 })
      .toBuffer()
    const project = this.deps.projects.create({
      type: 'photo',
      name: `${product.name} clean shot`,
      productId: id,
      shape: 'square',
      format: 'jpeg'
    })
    try {
      await this.deps.media.importSource({ projectId: project.id, bytes: clean, name: 'clean-shot.jpg' })
    } catch (error) {
      await this.deps.media.deleteProjectFiles(project.id).catch(() => undefined)
      this.deps.projects.delete(project.id)
      throw error
    }
    this.deps.products.setCutout(id, {
      file: cutoutRelative,
      sourceId: id,
      confidence: segmented.mask.confidence ?? 0
    })
    this.deps.usage?.record({
      projectId: project.id,
      projectName: project.name,
      action: 'cutout',
      requestedN: 0,
      returnedN: 0,
      costCents: 0,
      costMicros: segmented.costMicros,
      result: 'ok',
      requestId: segmented.requestId
    })
    return { projectId: project.id, detail: this.detail(id) }
  }

  detail(id: string): ProductDetail {
    const product = this.deps.products.get(id)
    if (!product) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    const projects = this.deps.projects.list({ productId: id, limit: 200 }).items
    const sets = projects.filter((project) => project.type === 'set')
    const images = projects.reduce((sum, project) => sum + project.imageCount, 0)
    return {
      product,
      projects,
      counts: { projects: projects.length, sets: sets.length, images },
      latestSet: sets[0] ?? null
    }
  }

  linkProject(productId: string, projectId: string): { ok: true } {
    if (isBundledProduct(productId)) throw new ImageImportError('unreadable', 'Included products cannot own work.')
    if (!this.deps.products.getRow(productId)) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    if (!this.deps.projects.get(projectId)) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    this.deps.projects.update(projectId, { productId })
    return { ok: true }
  }

  unlinkProject(projectId: string): { ok: true } {
    if (!this.deps.projects.get(projectId)) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    this.deps.projects.update(projectId, { productId: null })
    return { ok: true }
  }

  private async removeFiles(files: string[]): Promise<void> {
    for (const file of files) {
      if (!file) continue
      await fs.rm(absoluteInLibrary(this.deps.libraryPath(), file), { force: true }).catch(() => undefined)
    }
  }

  async delete(id: string): Promise<void> {
    if (isBundledProduct(id)) {
      throw new ImageImportError('unreadable', 'Included products cannot be deleted.')
    }
    const deleted = this.deps.products.delete(id)
    if (!deleted) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    await this.removeFiles(deleted.files)
  }

  private async productBytes(productId: string): Promise<{ bytes: Buffer; product: Product }> {
    const bundled = bundledProductById(productId)
    if (bundled) {
      try {
        const bytes = await fs.readFile(path.join(this.deps.resourceRoot(), 'products', `${bundled.id}.webp`))
        return { bytes, product: bundledProductCard(bundled) }
      } catch {
        throw new ImageImportError('unreadable', 'That product is not here anymore.')
      }
    }
    const row = this.deps.products.getRow(productId)
    if (!row) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    try {
      const bytes = await fs.readFile(absoluteInLibrary(this.deps.libraryPath(), row.file))
      return { bytes, product: this.deps.products.get(productId)! }
    } catch {
      throw new ImageImportError('unreadable', 'That product is not here anymore.')
    }
  }

  async createProject(input: {
    productId: string
    type: ProjectType
    name?: string
    shape: Shape
    format: Format
  }): Promise<{ projectId: string; imageId: string }> {
    const { bytes, product } = await this.productBytes(input.productId)
    const name = input.name?.trim() || product.name
    const project = this.deps.projects.create({
      type: input.type,
      name,
      // Included products are resources, not product rows; a bundled source
      // starts as unfiled work until the seller saves it as a Product.
      productId: isBundledProduct(input.productId) ? null : input.productId,
      // A set has no plan until the seller picks what they sell. The set
      // workspace shows the category chooser first.
      category: null,
      shape: input.type === 'set' ? shapeForImage(product.width, product.height) : input.shape,
      format: input.format
    })
    try {
      const imported = await this.deps.media.importSource({
        projectId: project.id,
        bytes,
        label: product.name
      })
      if (!imported.imageId) throw new ImageImportError('unreadable', 'That product could not be used.')
      return { projectId: project.id, imageId: imported.imageId }
    } catch (error) {
      await this.deps.media.deleteProjectFiles(project.id).catch(() => undefined)
      this.deps.projects.delete(project.id)
      throw error
    }
  }

  async importIntoProject(input: { productId: string; projectId: string; label?: string }): Promise<ImportResult> {
    if (!this.deps.projects.get(input.projectId)) throw new ImageImportError('unreadable', 'That project is not here anymore.')
    const { bytes, product } = await this.productBytes(input.productId)
    return this.deps.media.importSource({
      projectId: input.projectId,
      bytes,
      label: input.label ?? product.name
    })
  }
}
