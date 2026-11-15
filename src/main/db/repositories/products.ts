import type { Db } from '../connection'
import type { Product } from '@shared/types'
import { libraryUrl } from '@shared/files'

interface ProductRow {
  id: string
  name: string
  file: string
  thumb: string | null
  width: number | null
  height: number | null
  created_at: number
  updated_at: number
  category: string | null
  status: string
  archived_at: number | null
  project_count?: number
  image_count?: number
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    imageUrl: libraryUrl(row.file),
    thumbUrl: libraryUrl(row.thumb ?? row.file),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    source: 'user',
    blurb: null,
    category: row.category,
    status: row.status === 'archived' ? 'archived' : 'active',
    archivedAt: row.archived_at,
    projectCount: Number(row.project_count ?? 0),
    imageCount: Number(row.image_count ?? 0),
  }
}

export class ProductRepository {
  constructor(private readonly db: Db) {}

  private baseSelect(): string {
    return `
      SELECT p.*,
        (SELECT COUNT(*) FROM projects pr WHERE pr.product_id = p.id AND pr.archived_at IS NULL AND pr.draft = 0) AS project_count,
        (SELECT COUNT(*) FROM images i JOIN projects pr ON pr.id = i.project_id
          WHERE pr.product_id = p.id AND i.deleted_at IS NULL AND i.status = 'ready') AS image_count
      FROM products p
    `
  }

  list(options: { includeArchived?: boolean } = {}): Product[] {
    const where = options.includeArchived ? '' : "WHERE p.status <> 'archived'"
    const rows = this.db
      .prepare(`${this.baseSelect()} ${where} ORDER BY p.updated_at DESC, p.name ASC`)
      .all() as ProductRow[]
    return rows.map(mapProduct)
  }

  listArchived(): Product[] {
    const rows = this.db
      .prepare(`${this.baseSelect()} WHERE p.status = 'archived' ORDER BY p.archived_at DESC, p.name ASC`)
      .all() as ProductRow[]
    return rows.map(mapProduct)
  }

  get(id: string): Product | null {
    const row = this.db.prepare(`${this.baseSelect()} WHERE p.id = ?`).get(id) as ProductRow | undefined
    return row ? mapProduct(row) : null
  }

  getRow(id: string): ProductRow | null {
    return (this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined) ?? null
  }

  create(input: {
    id: string
    name: string
    file: string
    thumb: string
    width: number
    height: number
    category?: string | null
    now?: number
  }): Product {
    const timestamp = input.now ?? Date.now()
    this.db
      .prepare(
        `INSERT INTO products (id, name, file, thumb, width, height, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.id, input.name, input.file, input.thumb, input.width, input.height, input.category ?? null, timestamp, timestamp)
    return this.get(input.id)!
  }

  rename(id: string, name: string): Product | null {
    this.db.prepare('UPDATE products SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
    return this.get(id)
  }

  update(id: string, patch: {
    name?: string
    category?: string | null
    status?: 'active' | 'archived'
  }): Product | null {
    if (!this.getRow(id)) return null
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.category !== undefined) {
      fields.push('category = ?')
      values.push(patch.category)
    }
    if (patch.status !== undefined) {
      fields.push('status = ?', 'archived_at = ?')
      values.push(patch.status, patch.status === 'archived' ? Date.now() : null)
    }
    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(Date.now(), id)
      this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
    return this.get(id)
  }

  archive(id: string): Product | null {
    return this.update(id, { status: 'archived' })
  }

  unarchive(id: string): Product | null {
    return this.update(id, { status: 'active' })
  }

  delete(id: string): { files: string[] } | null {
    const row = this.getRow(id)
    if (!row) return null
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id)
    return { files: [row.file, row.thumb ?? ''].filter(Boolean) }
  }

  exists(id: string): boolean {
    return Boolean(this.getRow(id))
  }
}
