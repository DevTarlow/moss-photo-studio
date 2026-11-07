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
    updatedAt: Number(row.updated_at)
  }
}

export class ProductRepository {
  constructor(private readonly db: Db) {}

  list(): Product[] {
    const rows = this.db
      .prepare('SELECT * FROM products ORDER BY created_at DESC, name ASC')
      .all() as ProductRow[]
    return rows.map(mapProduct)
  }

  get(id: string): Product | null {
    const row = this.getRow(id)
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
    now?: number
  }): Product {
    const timestamp = input.now ?? Date.now()
    this.db
      .prepare(
        `INSERT INTO products (id, name, file, thumb, width, height, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.id, input.name, input.file, input.thumb, input.width, input.height, timestamp, timestamp)
    return this.get(input.id)!
  }

  rename(id: string, name: string): Product | null {
    this.db.prepare('UPDATE products SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
    return this.get(id)
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
