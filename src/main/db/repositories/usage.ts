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
           duration_ms, result, error_code, request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    const rows = this.db
      .prepare(
        `SELECT project_id, project_name, COALESCE(SUM(returned_n), 0) AS images, COALESCE(SUM(cost_cents), 0) AS cents
         FROM usage_events WHERE at >= ? AND at < ?
         GROUP BY project_id, project_name ORDER BY cents DESC, project_name ASC`
      )
      .all(monthStart, monthEnd) as Array<{ project_id: string | null; project_name: string; images: number; cents: number }>
    return rows.map((row) => ({
      projectId: row.project_id,
      name: row.project_name,
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
      .prepare(`SELECT * FROM usage_events ${where} ORDER BY at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Array<Record<string, unknown>>
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM usage_events ${where}`)
      .get(...params) as { total: number }
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        at: Number(row.at),
        projectId: row.project_id ? String(row.project_id) : null,
        projectName: String(row.project_name),
        action: row.action as UsageAction,
        requested: Number(row.requested_n),
        returned: Number(row.returned_n),
        costCents: Number(row.cost_cents),
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
      .prepare('SELECT * FROM usage_events WHERE at >= ? AND at < ? ORDER BY at ASC')
      .all(monthStart, monthEnd) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      at: Number(row.at),
      projectId: row.project_id ? String(row.project_id) : null,
      projectName: String(row.project_name),
      action: row.action as UsageAction,
      requested: Number(row.requested_n),
      returned: Number(row.returned_n),
      costCents: Number(row.cost_cents),
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
    const rows = this.db
      .prepare(
        `SELECT DISTINCT strftime('%Y-%m', at / 1000, 'unixepoch', 'localtime') AS month
         FROM usage_events ORDER BY month DESC LIMIT 12`
      )
      .all() as Array<{ month: string | null }>
    return rows.map((row) => row.month ?? '').filter(Boolean)
  }
}
