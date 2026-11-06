import type { Db } from '../connection'
import type { JobItemState, JobKind, JobState, JobStatus } from '@shared/types'

export interface JobRow {
  id: string
  project_id: string
  kind: JobKind
  total: number
  done: number
  failed: number
  status: JobStatus
  started_at: number
  finished_at: number | null
  snapshot: string | null
}

export interface JobSnapshot {
  items: JobItemState[]
  prompt?: string
  [key: string]: unknown
}

export class JobRepository {
  constructor(private readonly db: Db) {}

  create(input: {
    id: string
    projectId: string
    kind: JobKind
    total: number
    snapshot: unknown
    startedAt?: number
  }): void {
    this.db
      .prepare(
        `INSERT INTO jobs (id, project_id, kind, total, done, failed, status, started_at, snapshot)
         VALUES (?, ?, ?, ?, 0, 0, 'running', ?, ?)`
      )
      .run(
        input.id,
        input.projectId,
        input.kind,
        input.total,
        input.startedAt ?? Date.now(),
        JSON.stringify(input.snapshot)
      )
  }

  updateCounters(id: string, done: number, failed: number, status: JobStatus, finishedAt?: number): void {
    this.db
      .prepare('UPDATE jobs SET done = ?, failed = ?, status = ?, finished_at = ? WHERE id = ?')
      .run(done, failed, status, finishedAt ?? null, id)
  }

  updateStatus(id: string, status: JobStatus, finishedAt?: number): void {
    this.db.prepare('UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?').run(status, finishedAt ?? null, id)
  }

  updateSnapshot(id: string, snapshot: unknown): void {
    this.db.prepare('UPDATE jobs SET snapshot = ? WHERE id = ?').run(JSON.stringify(snapshot), id)
  }

  getRow(id: string): JobRow | null {
    return (this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined) ?? null
  }

  activeForProject(projectId: string): JobState | null {
    const row = this.db
      .prepare(
        `SELECT * FROM jobs WHERE project_id = ? AND status IN ('running','cancelled','interrupted')
         ORDER BY started_at DESC LIMIT 1`
      )
      .get(projectId) as JobRow | undefined
    if (!row) return null
    if (row.status !== 'running') {
      // A finished or recovered job is only surfaced while its project screen
      // is open. Interrupted jobs are returned so the recovery banner can use
      // their counts.
      if (row.status === 'cancelled') return null
    }
    return this.toState(row)
  }

  runningForProject(projectId: string): JobState | null {
    const row = this.db
      .prepare("SELECT * FROM jobs WHERE project_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1")
      .get(projectId) as JobRow | undefined
    return row ? this.toState(row) : null
  }

  runningJobs(): JobState[] {
    const rows = this.db
      .prepare("SELECT * FROM jobs WHERE status = 'running' ORDER BY started_at ASC")
      .all() as JobRow[]
    return rows.map((row) => this.toState(row))
  }

  recentForProject(projectId: string): JobState[] {
    const rows = this.db
      .prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY started_at DESC LIMIT 20')
      .all(projectId) as JobRow[]
    return rows.map((row) => this.toState(row))
  }

  markInterruptedRunning(): number {
    return this.db
      .prepare("UPDATE jobs SET status = 'interrupted', finished_at = ? WHERE status = 'running'")
      .run(Date.now()).changes
  }

  latestInterrupted(projectId: string): JobState | null {
    const row = this.db
      .prepare("SELECT * FROM jobs WHERE project_id = ? AND status = 'interrupted' ORDER BY started_at DESC LIMIT 1")
      .get(projectId) as JobRow | undefined
    return row ? this.toState(row) : null
  }

  snapshot(id: string): JobSnapshot | null {
    const row = this.getRow(id)
    if (!row?.snapshot) return null
    try {
      return JSON.parse(row.snapshot) as JobSnapshot
    } catch {
      return null
    }
  }

  toState(row: JobRow): JobState {
    let items: JobItemState[]
    try {
      const snapshot = row.snapshot ? (JSON.parse(row.snapshot) as JobSnapshot) : null
      items = Array.isArray(snapshot?.items)
        ? snapshot.items.map((item) => ({
            key: String(item.key),
            label: String(item.label),
            status: item.status,
            requested: Number(item.requested) || 0,
            returned: Number(item.returned) || 0,
            ...(item.imageId ? { imageId: String(item.imageId) } : {}),
            ...(item.errorCode ? { errorCode: String(item.errorCode) } : {}),
            ...(item.startedAt ? { startedAt: Number(item.startedAt) } : {}),
            ...(item.finishedAt ? { finishedAt: Number(item.finishedAt) } : {}),
            ...(item.uncertainBilling ? { uncertainBilling: true } : {}),
            ...(item.waiting ? { waiting: true } : {})
          }))
        : []
    } catch {
      items = []
    }
    return {
      id: row.id,
      projectId: row.project_id,
      kind: row.kind,
      status: row.status,
      total: Number(row.total),
      done: Number(row.done),
      failed: Number(row.failed),
      costCents: items.reduce((sum, item) => sum + (item.returned || 0), 0),
      startedAt: Number(row.started_at),
      ...(row.finished_at ? { finishedAt: Number(row.finished_at) } : {}),
      items
    }
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
  }
}
