import type { Db } from '../connection'
import type { AdjustTransform, Format, Image, ImageKind, ImageStatus, LibraryImage, ProjectType } from '@shared/types'
import { libraryUrl } from '@shared/files'
import { mimeForFormat } from '@shared/shapes'

interface ImageRow {
  id: string
  project_id: string
  kind: ImageKind
  status: ImageStatus
  file: string | null
  thumb: string | null
  width: number | null
  height: number | null
  format: Format
  prompt: string | null
  revised_prompt: string | null
  template_id: string | null
  person_id: string | null
  label: string | null
  seq: number
  parent_id: string | null
  root_id: string | null
  is_original: number
  origin: 'upload' | 'ai' | 'local'
  cost_cents: number
  created_at: number
  error_code: string | null
  user_text: string | null
  adjust: string | null
  badge: number
  duration_ms: number | null
  job_id: string | null
}

export interface NewImageInput {
  id?: string
  projectId: string
  kind: ImageKind
  status?: ImageStatus
  file?: string | null
  thumb?: string | null
  width?: number | null
  height?: number | null
  format?: Format
  prompt?: string | null
  userText?: string | null
  revisedPrompt?: string | null
  templateId?: string | null
  personId?: string | null
  label: string
  parentId?: string | null
  rootId?: string | null
  size?: string | null
  adjust?: AdjustTransform | null
  badge?: boolean
  isOriginal?: boolean
  costCents?: number
  durationMs?: number | null
  jobId?: string | null
  errorCode?: string | null
  now?: number
}

function mapImage(row: ImageRow): Image {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    status: row.status,
    url: row.file ? libraryUrl(row.file) : null,
    thumbUrl: row.thumb ? libraryUrl(row.thumb) : null,
    width: row.width,
    height: row.height,
    format: row.format,
    prompt: row.prompt,
    revisedPrompt: row.revised_prompt,
    templateId: row.template_id,
    personId: row.person_id,
    label: row.label ?? 'Image',
    seq: Number(row.seq),
    parentId: row.parent_id,
    rootId: row.root_id,
    isOriginal: Boolean(row.is_original),
    origin: row.origin ?? 'ai',
    costCents: Number(row.cost_cents),
    createdAt: Number(row.created_at),
    errorCode: row.error_code,
    userText: row.user_text,
    adjust: row.adjust ? (JSON.parse(row.adjust) as AdjustTransform) : null,
    badge: Boolean(row.badge),
    durationMs: row.duration_ms,
    jobId: row.job_id
  }
}

export class ImageRepository {
  constructor(private readonly db: Db) {}

  private rowCount(projectId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM images WHERE project_id = ?').get(projectId) as {
      count: number
    }
    return Number(row.count)
  }

  nextSeq(projectId: string): number {
    const row = this.db
      .prepare('SELECT MAX(seq) AS seq FROM images WHERE project_id = ?')
      .get(projectId) as { seq: number | null }
    return Number(row.seq ?? 0) + 1
  }

  create(input: NewImageInput): Image {
    const id = input.id ?? crypto.randomUUID()
    const created = input.now ?? Date.now()
    const insert = this.db.transaction(() => {
      const seq = this.nextSeq(input.projectId)
      this.db
        .prepare(
          `INSERT INTO images
            (id, project_id, kind, status, file, thumb, width, height, format, mime, prompt, user_text,
             revised_prompt, template_id, person_id, label, seq, parent_id, root_id, size, adjust,
             badge, is_original, cost_cents, duration_ms, job_id, error_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.projectId,
          input.kind,
          input.status ?? 'ready',
          input.file ?? null,
          input.thumb ?? null,
          input.width ?? null,
          input.height ?? null,
          input.format ?? 'webp',
          mimeForFormat(input.format ?? 'webp'),
          input.prompt ?? null,
          input.userText ?? null,
          input.revisedPrompt ?? null,
          input.templateId ?? null,
          input.personId ?? null,
          input.label,
          seq,
          input.parentId ?? null,
          input.rootId ?? id,
          input.size ?? null,
          input.adjust ? JSON.stringify(input.adjust) : null,
          input.badge ? 1 : 0,
          input.isOriginal ? 1 : 0,
          input.costCents ?? 0,
          input.durationMs ?? null,
          input.jobId ?? null,
          input.errorCode ?? null,
          created
        )
      this.db
        .prepare('UPDATE images SET origin = ? WHERE id = ?')
        .run(input.kind === 'upload' ? 'upload' : input.kind === 'adjust' ? 'local' : 'ai', id)
      if (input.isOriginal || input.kind === 'upload') {
        this.db
          .prepare(
            `UPDATE projects SET
              source_image_id = ?,
              cover_image_id = CASE WHEN cover_image_id IS NULL AND type = 'photo' THEN ? ELSE cover_image_id END,
              draft = 0,
              updated_at = ?
             WHERE id = ?`
          )
          .run(id, id, created, input.projectId)
      } else {
        // The first image makes a hidden Image Generator draft a real project.
        this.db.prepare('UPDATE projects SET draft = 0, updated_at = ? WHERE id = ?').run(created, input.projectId)
      }
    })
    insert()
    return this.get(id)!
  }

  get(id: string): Image | null {
    const row = this.db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined
    return row ? mapImage(row) : null
  }

  getRow(id: string): (ImageRow & { deleted_at: number | null }) | null {
    return (this.db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow & { deleted_at: number | null }) ?? null
  }

  list(projectId: string, includeFailed = false): Image[] {
    const statusClause = includeFailed ? "status IN ('ready','failed')" : "status = 'ready'"
    const rows = this.db
      .prepare(
        `SELECT * FROM images WHERE project_id = ? AND deleted_at IS NULL AND ${statusClause}
         ORDER BY seq ASC, created_at ASC`
      )
      .all(projectId) as ImageRow[]
    const known = new Set(rows.map((row) => row.id))
    return rows.map((row) => {
      const image = mapImage(row)
      if (image.parentId && !known.has(image.parentId)) {
        return { ...image, parentId: null, rootId: image.id }
      }
      return image
    })
  }

  listForJob(jobId: string): Image[] {
    const rows = this.db
      .prepare('SELECT * FROM images WHERE job_id = ? AND deleted_at IS NULL ORDER BY seq ASC')
      .all(jobId) as ImageRow[]
    return rows.map(mapImage)
  }

  listLibrary(options: { search?: string; limit?: number; offset?: number } = {}): {
    items: LibraryImage[]
    total: number
  } {
    const limit = Math.min(200, Math.max(1, options.limit ?? 60))
    const offset = Math.max(0, options.offset ?? 0)
    const clauses = ['i.deleted_at IS NULL', "i.status = 'ready'", 'p.archived_at IS NULL']
    const params: unknown[] = []
    const search = options.search?.trim()
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
      clauses.push("(p.name LIKE ? ESCAPE '\\' OR i.label LIKE ? ESCAPE '\\')")
      params.push(like, like)
    }
    const where = `WHERE ${clauses.join(' AND ')}`
    const total = this.db
      .prepare(`SELECT COUNT(*) AS count FROM images i JOIN projects p ON p.id = i.project_id ${where}`)
      .get(...params) as { count: number }
    const rows = this.db
      .prepare(
        `SELECT i.id, i.project_id, p.name AS project_name, p.type AS project_type, i.label,
                i.file, i.thumb, i.width, i.height, i.kind, i.person_id, i.created_at
         FROM images i JOIN projects p ON p.id = i.project_id
         ${where}
         ORDER BY i.created_at DESC, i.seq DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Array<{
      id: string
      project_id: string
      project_name: string
      project_type: ProjectType
      label: string | null
      file: string | null
      thumb: string | null
      width: number | null
      height: number | null
      kind: ImageKind
      person_id: string | null
      created_at: number
    }>
    return {
      total: Number(total.count),
      items: rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        projectType: row.project_type,
        label: row.label ?? 'Image',
        url: row.file ? libraryUrl(row.file) : null,
        thumbUrl: row.thumb ? libraryUrl(row.thumb) : row.file ? libraryUrl(row.file) : null,
        width: row.width,
        height: row.height,
        personId: row.person_id,
        kind: row.kind,
        createdAt: Number(row.created_at)
      }))
    }
  }

  markReady(
    id: string,
    fields: {
      file: string
      thumb: string
      width: number
      height: number
      bytes?: number
      format: Format
      costCents: number
      durationMs: number
      badge?: boolean
      revisedPrompt?: string | null
    }
  ): Image | null {
    const row = this.getRow(id)
    if (!row) return null
    this.db
      .prepare(
        `UPDATE images SET status = 'ready', file = ?, thumb = ?, width = ?, height = ?, bytes = ?,
          format = ?, mime = ?, cost_cents = ?, duration_ms = ?, badge = ?, revised_prompt = ?, error_code = NULL
         WHERE id = ?`
      )
      .run(
        fields.file,
        fields.thumb,
        fields.width,
        fields.height,
        fields.bytes ?? null,
        fields.format,
        mimeForFormat(fields.format),
        fields.costCents,
        fields.durationMs,
        fields.badge ? 1 : 0,
        fields.revisedPrompt ?? null,
        id
      )
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), row.project_id)
    return this.get(id)
  }

  markFailed(id: string, errorCode: string): Image | null {
    this.db
      .prepare("UPDATE images SET status = 'failed', error_code = ? WHERE id = ?")
      .run(errorCode, id)
    return this.get(id)
  }

  markFailedAndSetDuration(id: string, errorCode: string, durationMs: number): void {
    this.db
      .prepare("UPDATE images SET status = 'failed', error_code = ?, duration_ms = ? WHERE id = ?")
      .run(errorCode, durationMs, id)
  }

  removePending(id: string): void {
    this.db.prepare("DELETE FROM images WHERE id = ? AND status = 'pending'").run(id)
  }

  deleteAllPending(): number {
    return this.db.prepare("DELETE FROM images WHERE status = 'pending'").run().changes
  }

  pendingForProject(projectId: string): Image[] {
    const rows = this.db
      .prepare("SELECT * FROM images WHERE project_id = ? AND status = 'pending'")
      .all(projectId) as ImageRow[]
    return rows.map(mapImage)
  }

  labels(projectId: string): string[] {
    const rows = this.db
      .prepare('SELECT label FROM images WHERE project_id = ?')
      .all(projectId) as Array<{ label: string | null }>
    return rows.map((row) => row.label ?? '')
  }

  countReady(projectId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM images WHERE project_id = ? AND status = 'ready' AND deleted_at IS NULL")
      .get(projectId) as { count: number }
    return Number(row.count)
  }

  setCover(projectId: string, imageId: string): void {
    this.db.prepare('UPDATE projects SET cover_image_id = ? WHERE id = ?').run(imageId, projectId)
  }

  setSource(projectId: string, imageId: string): void {
    this.db.prepare('UPDATE projects SET source_image_id = ? WHERE id = ?').run(imageId, projectId)
  }

  softDelete(id: string): { file: string | null; thumb: string | null; projectId: string } | null {
    const row = this.getRow(id)
    if (!row) return null
    this.db.transaction(() => {
      this.db
        .prepare('UPDATE images SET parent_id = NULL, root_id = id WHERE parent_id = ?')
        .run(id)
      this.db.prepare('UPDATE images SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
      this.db
        .prepare(
          `UPDATE projects SET cover_image_id = (
             SELECT id FROM images WHERE project_id = ? AND status = 'ready' AND deleted_at IS NULL
             ORDER BY created_at ASC LIMIT 1
           ) WHERE id = ? AND cover_image_id = ?`
        )
        .run(row.project_id, row.project_id, id)
    })()
    return { file: row.file, thumb: row.thumb, projectId: row.project_id }
  }

  deleteForProject(projectId: string): void {
    this.db.prepare('DELETE FROM images WHERE project_id = ?').run(projectId)
  }

  updateAdjust(id: string, adjust: AdjustTransform): void {
    this.db.prepare('UPDATE images SET adjust = ? WHERE id = ?').run(JSON.stringify(adjust), id)
  }

  countAll(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL').get() as {
      count: number
    }
    return Number(row.count)
  }

  totalBytes(): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(bytes), 0) AS bytes FROM images WHERE deleted_at IS NULL')
      .get() as { bytes: number }
    return Number(row.bytes)
  }

  imagesWithFiles(): Array<{ id: string; project_id: string; file: string | null; thumb: string | null }> {
    return this.db
      .prepare('SELECT id, project_id, file, thumb FROM images WHERE deleted_at IS NULL')
      .all() as Array<{ id: string; project_id: string; file: string | null; thumb: string | null }>
  }

  latestRootLabel(projectId: string, parentId: string): string | null {
    const row = this.db
      .prepare('SELECT label FROM images WHERE id = ? AND project_id = ?')
      .get(parentId, projectId) as { label: string | null } | undefined
    return row?.label ?? null
  }
}
