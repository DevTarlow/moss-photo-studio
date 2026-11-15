import type { Db } from '../connection'
import type { UsageAction, UsageEvent, UsageResult } from '@shared/types'
import { billingUncertain } from '@shared/errors'

export interface NewUsageEvent {
  at?: number
  projectId: string | null
  projectName: string
  imageId?: string | null
  action: UsageAction
  requestedN: number
  returnedN: number
  costCents: number
  costMicros?: number
  durationMs?: number | null
  result: UsageResult
  errorCode?: string | null
  requestId?: string | null
}

export class UsageRepository {
  constructor(private readonly db: Db) {}

  record(event: NewUsageEvent): string {
    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO usage_events
          (id, at, project_id, project_name, image_id, action, requested_n, returned_n, cost_cents,
           cost_micros, duration_ms, result, error_code, request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        event.at ?? Date.now(),
        event.projectId,
        event.projectName,
        event.imageId ?? null,
        event.action,
        event.requestedN,
        event.returnedN,
        event.costCents,
        event.costMicros ?? 0,
        event.durationMs ?? null,
        event.result,
        event.errorCode ?? null,
        event.requestId ?? null
      )
    return id
  }

  monthTotal(monthStart: number, monthEnd: number): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(cost_cents), 0) AS cents FROM usage_events WHERE at >= ? AND at < ?')
      .get(monthStart, monthEnd) as { cents: number }
    return Number(row.cents)
  }

  projectTotal(projectId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(cost_cents), 0) AS cents FROM usage_events WHERE project_id = ?')
      .get(projectId) as { cents: number }
    return Number(row.cents)
  }

  monthSummary(monthStart: number, monthEnd: number): { images: number; cents: number } {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(returned_n), 0) AS images, COALESCE(SUM(cost_cents), 0) AS cents
         FROM usage_events WHERE at >= ? AND at < ?`
      )
      .get(monthStart, monthEnd) as { images: number; cents: number }
    return { images: Number(row.images), cents: Number(row.cents) }
  }

  byProject(monthStart: number, monthEnd: number): Array<{ projectId: string | null; name: string; images: number; spendCents: number }> {
    // One row per project, named from the live project so a rename shows up
    // immediately. A deleted project reads as Deleted project rather than a
    // stale, possibly id-like snapshot.
    const rows = this.db
      .prepare(
        `SELECT ue.project_id AS project_id,
                CASE
                  WHEN p.id IS NOT NULL THEN p.name
                  WHEN ue.project_id IS NULL THEN 'Project'
                  ELSE 'Deleted project'
                END AS name,
                COALESCE(SUM(ue.returned_n), 0) AS images,
                COALESCE(SUM(ue.cost_cents), 0) AS cents
         FROM usage_events ue
         LEFT JOIN projects p ON p.id = ue.project_id
         WHERE ue.at >= ? AND ue.at < ?
         GROUP BY ue.project_id
         ORDER BY cents DESC, name ASC`
      )
      .all(monthStart, monthEnd) as Array<{ project_id: string | null; name: string | null; images: number; cents: number }>
    return rows.map((row) => ({
      projectId: row.project_id,
      name: row.name ? String(row.name) : 'Project',
      images: Number(row.images),
      spendCents: Number(row.cents)
    }))
  }

  list(options: {
    monthStart: number
    monthEnd: number
    projectId?: string
    limit?: number
    offset?: number
  }): { items: UsageEvent[]; total: number } {
    const clauses = ['at >= ?', 'at < ?']
    const params: unknown[] = [options.monthStart, options.monthEnd]
    if (options.projectId) {
      clauses.push('project_id = ?')
      params.push(options.projectId)
    }
    const where = `WHERE ${clauses.join(' AND ')}`
    const limit = Math.max(1, Math.min(500, options.limit ?? 50))
    const offset = Math.max(0, options.offset ?? 0)
    const rows = this.db
      .prepare(
        `SELECT ue.*,
                CASE
                  WHEN p.id IS NOT NULL THEN p.name
                  WHEN ue.project_id IS NULL THEN 'Project'
                  ELSE 'Deleted project'
                END AS resolved_project_name
         FROM usage_events ue LEFT JOIN projects p ON p.id = ue.project_id
         ${where} ORDER BY ue.at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Array<Record<string, unknown>>
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM usage_events ${where}`)
      .get(...params) as { total: number }
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        at: Number(row.at),
        projectId: row.project_id ? String(row.project_id) : null,
        projectName: row.resolved_project_name ? String(row.resolved_project_name) : 'Deleted project',
        action: row.action as UsageAction,
        requested: Number(row.requested_n),
        returned: Number(row.returned_n),
        costCents: Number(row.cost_cents),
        costMicros: Number(row.cost_micros ?? 0),
        uncertainBilling: billingUncertain((row.error_code ? String(row.error_code) : null) as never),
        durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
        result: row.result as UsageResult,
        errorCode: row.error_code ? String(row.error_code) : null
      })),
      total: Number(totalRow.total)
    }
  }

  allForCsv(monthStart: number, monthEnd: number): UsageEvent[] {
    const rows = this.db
      .prepare(
        `SELECT ue.*,
                CASE
                  WHEN p.id IS NOT NULL THEN p.name
                  WHEN ue.project_id IS NULL THEN 'Project'
                  ELSE 'Deleted project'
                END AS resolved_project_name
         FROM usage_events ue LEFT JOIN projects p ON p.id = ue.project_id
         WHERE ue.at >= ? AND ue.at < ? ORDER BY ue.at ASC`
      )
      .all(monthStart, monthEnd) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      at: Number(row.at),
      projectId: row.project_id ? String(row.project_id) : null,
      projectName: row.resolved_project_name ? String(row.resolved_project_name) : 'Deleted project',
      action: row.action as UsageAction,
      requested: Number(row.requested_n),
      returned: Number(row.returned_n),
      costCents: Number(row.cost_cents),
      costMicros: Number(row.cost_micros ?? 0),
      uncertainBilling: billingUncertain((row.error_code ? String(row.error_code) : null) as never),
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      result: row.result as UsageResult,
      errorCode: row.error_code ? String(row.error_code) : null
    }))
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM usage_events').run()
  }

  allMonths(): string[] {
    // The picker always has the last twelve calendar months, even when a month
    // has no runs. Months come before the current one by date, not by usage.
    const months: string[] = []
    const cursor = new Date()
    cursor.setDate(1)
    cursor.setHours(12, 0, 0, 0)
    for (let index = 0; index < 12; index += 1) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor.setMonth(cursor.getMonth() - 1)
    }
    return months
  }
}
