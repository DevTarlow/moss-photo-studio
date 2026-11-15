import type { Db } from '../connection'
import type { SetSummary } from '@shared/types'
import { libraryUrl } from '@shared/files'

interface SetRow {
  id: string
  name: string
  created_at: number
  updated_at: number
  image_count: number
  cover_file: string | null
}

function mapSet(row: SetRow): SetSummary {
  return {
    id: row.id,
    name: row.name,
    imageCount: Number(row.image_count),
    coverUrl: row.cover_file ? libraryUrl(row.cover_file) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  }
}

const summarySelect = `
  SELECT s.id, s.name, s.created_at, s.updated_at,
    (SELECT COUNT(*) FROM images i
      WHERE i.set_id = s.id AND i.deleted_at IS NULL AND i.status = 'ready')
      + (SELECT COUNT(*) FROM products p WHERE p.set_id = s.id) AS image_count,
    (SELECT x.file FROM (
      SELECT COALESCE(i.thumb, i.file) AS file, i.created_at AS at
        FROM images i
        WHERE i.set_id = s.id AND i.deleted_at IS NULL AND i.status = 'ready'
      UNION ALL
      SELECT COALESCE(p.thumb, p.file) AS file, p.created_at AS at
        FROM products p
        WHERE p.set_id = s.id
    ) x ORDER BY x.at DESC LIMIT 1) AS cover_file
  FROM sets s
`

export class SetRepository {
  constructor(private readonly db: Db) {}

  list(): SetSummary[] {
    const rows = this.db
      .prepare(`${summarySelect} ORDER BY s.updated_at DESC, s.name COLLATE NOCASE ASC`)
      .all() as SetRow[]
    return rows.map(mapSet)
  }

  get(id: string): SetSummary | null {
    const row = this.db.prepare(`${summarySelect} WHERE s.id = ?`).get(id) as SetRow | undefined
    return row ? mapSet(row) : null
  }

  create(name: string): SetSummary {
    const id = crypto.randomUUID()
    const now = Date.now()
    this.db
      .prepare('INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, name.trim(), now, now)
    return this.get(id)!
  }

  rename(id: string, name: string): SetSummary | null {
    this.db.prepare('UPDATE sets SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), Date.now(), id)
    return this.get(id)
  }

  delete(id: string): boolean {
    const result = this.db.transaction(() => {
      this.db.prepare('UPDATE images SET set_id = NULL WHERE set_id = ?').run(id)
      this.db.prepare('UPDATE products SET set_id = NULL WHERE set_id = ?').run(id)
      return this.db.prepare('DELETE FROM sets WHERE id = ?').run(id).changes > 0
    })()
    return result
  }

  touch(id: string): void {
    this.db.prepare('UPDATE sets SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  }
}
