import type { Db } from '../connection'
import type { ListingCopy } from '@shared/listings'

interface ListingRow {
  id: string
  product_id: string
  platform: string
  version: number
  json: string
  created_at: number
}

function map(row: ListingRow): { id: string; productId: string; platform: string; version: number; copy: ListingCopy; createdAt: number } {
  return {
    id: row.id,
    productId: row.product_id,
    platform: row.platform,
    version: Number(row.version),
    copy: JSON.parse(row.json) as ListingCopy,
    createdAt: Number(row.created_at)
  }
}

export class ListingRepository {
  constructor(private readonly db: Db) {}

  latest(productId: string, platform: string): { id: string; productId: string; platform: string; version: number; copy: ListingCopy; createdAt: number } | null {
    const row = this.db
      .prepare(
        'SELECT * FROM listings WHERE product_id = ? AND platform = ? ORDER BY version DESC LIMIT 1'
      )
      .get(productId, platform) as ListingRow | undefined
    return row ? map(row) : null
  }

  save(productId: string, copy: ListingCopy): { id: string; productId: string; platform: string; version: number; copy: ListingCopy; createdAt: number } {
    const last = this.db
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM listings WHERE product_id = ? AND platform = ?')
      .get(productId, copy.platform) as { version: number }
    const version = Number(last.version) + 1
    const id = crypto.randomUUID()
    const createdAt = Date.now()
    this.db
      .prepare(
        'INSERT INTO listings (id, product_id, platform, version, json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, productId, copy.platform, version, JSON.stringify(copy), createdAt)
    return { id, productId, platform: copy.platform, version, copy, createdAt }
  }
}
