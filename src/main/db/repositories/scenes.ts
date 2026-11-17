import type { Db } from '../connection'
import type { ScenePreset } from '@shared/types'
import { BUNDLED_SCENE_PRESETS, bundledSceneCard, isBundledScenePreset } from '@shared/scene-presets'
import { libraryUrl } from '@shared/files'

export interface SceneReferenceFile {
  root: 'bundled' | 'library'
  file: string
}

interface SceneRow {
  id: string
  name: string
  file: string
  thumb: string | null
  width: number | null
  height: number | null
  created_at: number
  updated_at: number
}

function mapScene(row: SceneRow): ScenePreset {
  return {
    id: row.id,
    name: row.name,
    category: null,
    blurb: null,
    source: 'user',
    imageUrl: libraryUrl(row.file),
    thumbUrl: libraryUrl(row.thumb ?? row.file),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    createdAt: Number(row.created_at)
  }
}

export class SceneRepository {
  constructor(private readonly db: Db) {}

  bundled(): ScenePreset[] {
    return BUNDLED_SCENE_PRESETS.map(bundledSceneCard)
  }

  listUsers(): ScenePreset[] {
    const rows = this.db.prepare('SELECT * FROM scenes ORDER BY created_at ASC').all() as SceneRow[]
    return rows.map(mapScene)
  }

  list(): ScenePreset[] {
    return [...this.bundled(), ...this.listUsers()]
  }

  getUser(id: string): ScenePreset | null {
    const row = this.getRow(id)
    return row ? mapScene(row) : null
  }

  getRow(id: string): SceneRow | null {
    return (this.db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as SceneRow | undefined) ?? null
  }

  /** Resolve the scene photo to send as a reference: bundled assets or a saved library file. */
  refFor(id: string): SceneReferenceFile | null {
    if (isBundledScenePreset(id)) return { root: 'bundled', file: `scenes/${id}.webp` }
    const row = this.getRow(id)
    if (!row) return null
    return { root: 'library', file: row.file }
  }

  create(input: {
    id: string
    name: string
    file: string
    thumb: string
    width: number
    height: number
    now?: number
  }): ScenePreset {
    const now = input.now ?? Date.now()
    this.db
      .prepare(
        'INSERT INTO scenes (id, name, file, thumb, width, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(input.id, input.name, input.file, input.thumb, input.width, input.height, now, now)
    return this.getUser(input.id)!
  }

  rename(id: string, name: string): ScenePreset | null {
    this.db.prepare('UPDATE scenes SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
    return this.getUser(id)
  }

  delete(id: string): { files: string[] } | null {
    const row = this.getRow(id)
    if (!row) return null
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id)
    return { files: [row.file, row.thumb ?? ''].filter(Boolean) }
  }

  exists(id: string): boolean {
    if (isBundledScenePreset(id)) return true
    return Boolean(this.getRow(id))
  }
}
