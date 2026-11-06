import type { Db } from '../connection'
import type { PlanJson, PlanRecord } from '@shared/types'
import { normalisePlan } from '@shared/plans'

interface PlanRow {
  id: string
  project_id: string
  version: number
  json: string
  created_at: number
}

function parsePlan(raw: string): PlanJson | null {
  try {
    const parsed = JSON.parse(raw) as PlanJson
    if (!parsed || !Array.isArray(parsed.shots)) return null
    return normalisePlan(parsed)
  } catch {
    return null
  }
}

export class PlanRepository {
  constructor(private readonly db: Db) {}

  getActive(projectId: string): PlanRecord | null {
    const row = this.db
      .prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY version DESC LIMIT 1')
      .get(projectId) as PlanRow | undefined
    if (!row) return null
    const json = parsePlan(row.json)
    if (!json) return null
    return {
      id: row.id,
      projectId: row.project_id,
      version: Number(row.version),
      json,
      createdAt: Number(row.created_at)
    }
  }

  save(projectId: string, plan: PlanJson): PlanRecord {
    const latest = this.db
      .prepare('SELECT MAX(version) AS version FROM plans WHERE project_id = ?')
      .get(projectId) as { version: number | null }
    const version = Number(latest.version ?? 0) + 1
    const id = crypto.randomUUID()
    const clean = normalisePlan({ ...plan, version })
    this.db
      .prepare('INSERT INTO plans (id, project_id, version, json, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, projectId, version, JSON.stringify(clean), Date.now())
    this.db
      .prepare('UPDATE projects SET active_plan_id = ?, category = ?, shape = ?, format = ?, updated_at = ? WHERE id = ?')
      .run(id, clean.category, clean.shape, clean.format, Date.now(), projectId)
    return { id, projectId, version, json: clean, createdAt: Date.now() }
  }

  getById(id: string): PlanRecord | null {
    const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow | undefined
    if (!row) return null
    const json = parsePlan(row.json)
    if (!json) return null
    return {
      id: row.id,
      projectId: row.project_id,
      version: Number(row.version),
      json,
      createdAt: Number(row.created_at)
    }
  }
}
