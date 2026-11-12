import type { Db } from '../connection'
import type { Project, ProjectFilter, ProjectSort } from '@shared/types'
import { libraryUrl } from '@shared/files'
import { BUNDLED_PEOPLE } from '@shared/people'

interface ProjectRow {
  id: string
  type: 'set' | 'photo' | 'image'
  name: string
  created_at: number
  updated_at: number
  last_opened_at: number | null
  cover_image_id: string | null
  source_image_id: string | null
  category: string | null
  product_id: string | null
  shape: 'square' | 'portrait' | 'landscape'
  format: 'webp' | 'jpeg' | 'png'
  person_look: string | null
  image_count: number
  running: number
  cover_file: string | null
}

export interface CreateProjectInput {
  type: 'set' | 'photo' | 'image'
  name: string
  category?: string | null
  productId?: string | null
  shape?: 'square' | 'portrait' | 'landscape'
  format?: 'webp' | 'jpeg' | 'png'
  personLook?: string | null
  draft?: boolean
  now?: number
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export class ProjectRepository {
  constructor(private readonly db: Db) {}

  private baseSelect(): string {
    return `
      SELECT p.*,
        (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id AND i.deleted_at IS NULL AND i.status = 'ready' AND (p.type = 'photo' OR i.kind <> 'upload')) AS image_count,
        (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.status = 'running') AS running,
        (SELECT i.file FROM images i WHERE i.id = p.cover_image_id AND i.deleted_at IS NULL) AS cover_file
      FROM projects p
    `
  }

  private map(row: ProjectRow): Project {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastOpenedAt: row.last_opened_at,
      coverImageId: row.cover_image_id,
      coverUrl: row.cover_file ? libraryUrl(row.cover_file) : null,
      sourceImageId: row.source_image_id,
      category: row.category,
      productId: row.product_id,
      shape: row.shape,
      format: row.format,
      personLook: row.person_look,
      imageCount: Number(row.image_count),
      running: Number(row.running) > 0
    }
  }

  create(input: CreateProjectInput): Project {
    const timestamp = input.now ?? Date.now()
    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO projects (id, type, name, created_at, updated_at, category, product_id, shape, format, person_look, draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.type,
        input.name,
        timestamp,
        timestamp,
        input.category ?? null,
        input.productId ?? null,
        input.shape ?? 'square',
        input.format ?? 'webp',
        input.personLook ?? null,
        input.draft ? 1 : 0
      )
    return this.get(id)!
  }

  get(id: string): Project | null {
    const row = this.db.prepare(`${this.baseSelect()} WHERE p.id = ?`).get(id) as ProjectRow | undefined
    return row ? this.map(row) : null
  }

  list(options: {
    filter?: ProjectFilter
    sort?: ProjectSort
    search?: string
    productId?: string | null
    limit?: number
    offset?: number
  } = {}): { items: Project[]; total: number } {
    const clauses: string[] = ['p.archived_at IS NULL', 'p.draft = 0']
    const params: unknown[] = []
    const filter = options.filter ?? 'all'
    if (options.productId !== undefined) {
      if (options.productId === null) clauses.push('p.product_id IS NULL')
      else {
        clauses.push('p.product_id = ?')
        params.push(options.productId)
      }
    }
    if (filter === 'sets') clauses.push("p.type = 'set'")
    if (filter === 'photos') clauses.push("p.type = 'photo'")
    if (filter === 'images') clauses.push("p.type = 'image'")
    const search = options.search?.trim()
    if (search) {
      const like = `%${escapeLike(search)}%`
      const bundledIds = BUNDLED_PEOPLE.filter((person) =>
        person.name.toLowerCase().includes(search.toLowerCase())
      ).map((person) => person.id)
      const bundledClause = bundledIds.length
        ? `OR EXISTS (SELECT 1 FROM images pi WHERE pi.project_id = p.id AND pi.deleted_at IS NULL AND pi.person_id IN (${bundledIds.map(() => '?').join(',')}))`
        : ''
      clauses.push(`(
        p.name LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM plans pl WHERE pl.project_id = p.id AND pl.json LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM images si WHERE si.project_id = p.id AND si.deleted_at IS NULL AND (si.prompt LIKE ? ESCAPE '\\' OR si.user_text LIKE ? ESCAPE '\\' OR si.label LIKE ? ESCAPE '\\'))
        OR EXISTS (SELECT 1 FROM images pp JOIN people pe ON pe.id = pp.person_id WHERE pp.project_id = p.id AND pp.deleted_at IS NULL AND pe.name LIKE ? ESCAPE '\\')
        ${bundledClause}
      )`)
      params.push(like, like, like, like, like, like, ...bundledIds)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const sort = options.sort ?? 'recent'
    const order =
      sort === 'name'
        ? 'ORDER BY p.name COLLATE NOCASE ASC, p.updated_at DESC'
        : sort === 'oldest'
          ? 'ORDER BY p.created_at ASC'
          : 'ORDER BY p.updated_at DESC'
    const limit = Math.max(1, Math.min(200, options.limit ?? 100))
    const offset = Math.max(0, options.offset ?? 0)
    const rows = this.db
      .prepare(`${this.baseSelect()} ${where} ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ProjectRow[]
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM projects p ${where}`)
      .get(...params) as { total: number }
    return { items: rows.map((row) => this.map(row)), total: Number(totalRow.total) }
  }

  recent(limit: number): Project[] {
    const rows = this.db
      .prepare(`${this.baseSelect()} WHERE p.archived_at IS NULL AND p.draft = 0 ORDER BY p.last_opened_at DESC, p.updated_at DESC LIMIT ?`)
      .all(Math.max(1, Math.min(20, limit))) as ProjectRow[]
    return rows.map((row) => this.map(row))
  }

  rename(id: string, name: string): Project | null {
    this.db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
    return this.get(id)
  }

  update(id: string, patch: {
    name?: string
    shape?: string
    format?: string
    category?: string | null
    productId?: string | null
    sourceImageId?: string | null
    coverImageId?: string | null
  }): Project | null {
    const current = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!current) return null
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.shape !== undefined) {
      fields.push('shape = ?')
      values.push(patch.shape)
    }
    if (patch.format !== undefined) {
      fields.push('format = ?')
      values.push(patch.format)
    }
    if (patch.category !== undefined) {
      fields.push('category = ?')
      values.push(patch.category)
    }
    if (patch.productId !== undefined) {
      fields.push('product_id = ?')
      values.push(patch.productId)
    }
    if (patch.sourceImageId !== undefined) {
      fields.push('source_image_id = ?')
      values.push(patch.sourceImageId)
    }
    if (patch.coverImageId !== undefined) {
      fields.push('cover_image_id = ?')
      values.push(patch.coverImageId)
    }
    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(Date.now(), id)
      this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
    return this.get(id)
  }

  touch(id: string): void {
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  setLastOpened(id: string): void {
    const at = Date.now()
    this.db.prepare('UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?').run(at, at, id)
  }

  setCoverFromProject(id: string): void {
    const first = this.db
      .prepare(
        `SELECT id FROM images WHERE project_id = ? AND status = 'ready' AND deleted_at IS NULL
         ORDER BY is_original DESC, created_at ASC LIMIT 1`
      )
      .get(id) as { id: string } | undefined
    const project = this.db.prepare('SELECT type FROM projects WHERE id = ?').get(id) as
      | { type: string }
      | undefined
    let cover = first?.id
    if (project?.type === 'set') {
      const hero = this.db
        .prepare(
          `SELECT id FROM images WHERE project_id = ? AND status = 'ready' AND deleted_at IS NULL AND shot_id IS NOT NULL
           ORDER BY created_at ASC LIMIT 1`
        )
        .get(id) as { id: string } | undefined
      if (hero?.id) cover = hero.id
    }
    if (cover) {
      this.db.prepare('UPDATE projects SET cover_image_id = ? WHERE id = ?').run(cover, id)
    }
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0
  }

  /**
   * An Image Generator draft is hidden until its first image. A draft that was
   * never touched has no images and no jobs, so it is safe to drop at startup.
   */
  deleteEmptyDrafts(): number {
    return this.db
      .prepare(
        `DELETE FROM projects
         WHERE draft = 1
           AND NOT EXISTS (SELECT 1 FROM images i WHERE i.project_id = projects.id)
           AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.project_id = projects.id)`
      )
      .run().changes
  }

  countImages(id: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM images WHERE project_id = ? AND deleted_at IS NULL')
      .get(id) as { count: number }
    return Number(row.count)
  }

  sourceImage(id: string): { id: string; file: string; format: string; width: number | null; height: number | null } | null {
    const row = this.db
      .prepare(
        'SELECT id, file, format, width, height FROM images WHERE id = ? AND project_id = ? AND deleted_at IS NULL'
      )
      .get(id, id) as { id: string; file: string; format: string; width: number | null; height: number | null } | undefined
    return row ?? null
  }

  coverFirstImage(id: string): void {
    this.setCoverFromProject(id)
  }

  setActivePlanId(projectId: string, planId: string | null): void {
    this.db.prepare('UPDATE projects SET active_plan_id = ? WHERE id = ?').run(planId, projectId)
  }

  row(id: string): Record<string, unknown> | null {
    return (this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown>) ?? null
  }
}
