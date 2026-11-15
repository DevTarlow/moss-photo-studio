import fs from 'node:fs/promises'
import path from 'node:path'
import type { Format, ImportResult, Product, ProductDetail, ProjectType, Shape } from '@shared/types'
import type { ProductRepository } from '../db/repositories/products'
import type { ImageRepository } from '../db/repositories/images'
import type { ProjectRepository } from '../db/repositories/projects'
import type { MediaService } from '../media/service'
import { ImageImportError, normaliseProduct } from '../media/import'
import { absoluteInLibrary, workingFor } from '../media/paths'
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
      media: MediaService
      libraryPath: () => string
      resourceRoot: () => string
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
      name: cleanName(input.name ?? project.name, source.name)
    })
    this.deps.projects.update(project.id, { productId: product.id })
    return product
  }

  detail(id: string): ProductDetail {
    const product = this.deps.products.get(id)
    if (!product) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    const projects = this.deps.projects.list({ productId: id, limit: 200 }).items
    const images = projects.reduce((sum, project) => sum + project.imageCount, 0)
    return {
      product,
      projects,
      counts: { projects: projects.length, images }
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
      shape: input.shape,
      format: input.format
    })
    try {
      const imported = await this.deps.media.importSource({
        projectId: project.id,
        bytes,
        label: product.name,
        setId: product.setId
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
      label: input.label ?? product.name,
      setId: product.setId
    })
  }
}
