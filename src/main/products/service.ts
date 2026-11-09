import fs from 'node:fs/promises'
import type { Format, ImportResult, Product, ProjectType, Shape } from '@shared/types'
import type { ProductRepository } from '../db/repositories/products'
import type { ImageRepository } from '../db/repositories/images'
import type { ProjectRepository } from '../db/repositories/projects'
import type { PlanRepository } from '../db/repositories/plans'
import type { MediaService } from '../media/service'
import { ImageImportError, normaliseProduct } from '../media/import'
import { absoluteInLibrary, workingFor } from '../media/paths'
import { shapeForImage } from '@shared/shapes'

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

  async addFromBytes(input: { bytes: Uint8Array; name: string }): Promise<Product> {
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
        height: normalised.height
      })
    } catch (error) {
      await this.removeFiles([normalised.file, normalised.thumb])
      throw error
    }
  }

  async saveFromImage(input: { imageId: string; name: string }): Promise<Product> {
    const source = await this.sourceBytes(input.imageId)
    return this.addFromBytes({ bytes: source.bytes, name: cleanName(input.name, source.name) })
  }

  private async removeFiles(files: string[]): Promise<void> {
    for (const file of files) {
      if (!file) continue
      await fs.rm(absoluteInLibrary(this.deps.libraryPath(), file), { force: true }).catch(() => undefined)
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = this.deps.products.delete(id)
    if (!deleted) throw new ImageImportError('unreadable', 'That product is not here anymore.')
    await this.removeFiles(deleted.files)
  }

  private async productBytes(productId: string): Promise<{ bytes: Buffer; product: Product }> {
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
