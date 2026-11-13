import type { Db } from '../connection'
import type { Product, ProductAnalysis } from '@shared/types'
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
  audience: string | null
  notes: string | null
  status: string
  archived_at: number | null
  analysis: string | null
  cutout_file: string | null
  cutout_source_id: string | null
  cutout_confidence: number | null
  cutout_at: number | null
  project_count?: number
  image_count?: number
}

function parseAnalysis(raw: string | null): ProductAnalysis | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ProductAnalysis>
    if (!value || typeof value !== 'object' || !Array.isArray(value.points)) return null
    return {
      product: String(value.product ?? '').slice(0, 100),
      category: String(value.category ?? '').slice(0, 60),
      audience: String(value.audience ?? '').slice(0, 200),
      points: value.points.map((point) => String(point).slice(0, 120)).filter(Boolean).slice(0, 6),
      createdAt: Number(value.createdAt) || 0,
      costMicros: Number(value.costMicros) || 0
    }
  } catch {
    return null
  }
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
    audience: row.audience,
    notes: row.notes,
    status: row.status === 'archived' ? 'archived' : 'active',
    archivedAt: row.archived_at,
    projectCount: Number(row.project_count ?? 0),
    imageCount: Number(row.image_count ?? 0),
    analysis: parseAnalysis(row.analysis),
    cutoutUrl: row.cutout_file ? libraryUrl(row.cutout_file) : null,
    cutoutConfidence: row.cutout_confidence === null ? null : Number(row.cutout_confidence)
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
    audience?: string | null
    notes?: string | null
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
    if (patch.audience !== undefined) {
      fields.push('audience = ?')
      values.push(patch.audience)
    }
    if (patch.notes !== undefined) {
      fields.push('notes = ?')
      values.push(patch.notes)
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

  setCutout(id: string, input: { file: string; sourceId: string; confidence: number }): Product | null {
    if (!this.getRow(id)) return null
    this.db
      .prepare('UPDATE products SET cutout_file = ?, cutout_source_id = ?, cutout_confidence = ?, cutout_at = ?, updated_at = ? WHERE id = ?')
      .run(input.file, input.sourceId, input.confidence, Date.now(), Date.now(), id)
    return this.get(id)
  }

  setAnalysis(id: string, analysis: ProductAnalysis | null): Product | null {
    if (!this.getRow(id)) return null
    this.db
      .prepare('UPDATE products SET analysis = ?, updated_at = ? WHERE id = ?')
      .run(analysis ? JSON.stringify(analysis) : null, Date.now(), id)
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
