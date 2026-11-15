import type { Db } from '../connection'
import type { PackJson } from '@shared/types'
import { normalisePack } from '@shared/prompts/packPrompt'

interface PackRow {
  project_id: string
  json: string
  updated_at: number
}

export class PackRepository {
  constructor(private readonly db: Db) {}

  get(projectId: string): PackJson | null {
    const row = this.db.prepare('SELECT * FROM packs WHERE project_id = ?').get(projectId) as PackRow | undefined
    if (!row) return null
    try {
      return normalisePack(JSON.parse(row.json) as Partial<PackJson>)
    } catch {
      return null
    }
  }

  save(projectId: string, pack: PackJson): PackJson {
    const clean = normalisePack(pack)
    this.db
      .prepare(
        `INSERT INTO packs (project_id, json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
      )
      .run(projectId, JSON.stringify(clean), Date.now())
    return clean
  }

  delete(projectId: string): void {
    this.db.prepare('DELETE FROM packs WHERE project_id = ?').run(projectId)
  }
}
