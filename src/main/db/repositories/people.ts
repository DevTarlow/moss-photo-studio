import type { Db } from '../connection'
import type { Person, PersonLook } from '@shared/types'
import { BUNDLED_PEOPLE, BUNDLED_PERSON_LOOKS, isBundledLookKey, isBundledPerson } from '@shared/people'
import { bundledUrl, libraryUrl } from '@shared/files'

export interface PersonReferenceFile {
  root: 'bundled' | 'library'
  file: string
}

function bundledLooks(id: string): PersonLook[] {
  return BUNDLED_PERSON_LOOKS.map((look) => ({
    key: look.key,
    label: look.label,
    hint: look.hint,
    url: bundledUrl(`people/${id}-${look.key}.webp`)
  }))
}

interface PersonRow {
  id: string
  name: string
  notes: string | null
  source: string
  ref_file: string
  thumb: string | null
  created_at: number
}

export class PeopleRepository {
  constructor(private readonly db: Db) {}

  private usedCount(id: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM images WHERE person_id = ? AND deleted_at IS NULL AND status = 'ready'")
      .get(id) as { count: number }
    return Number(row.count)
  }

  bundled(): Person[] {
    return BUNDLED_PEOPLE.map((person) => ({
      id: person.id,
      name: person.name,
      ageBand: person.ageBand,
      blurb: person.blurb,
      source: 'bundled',
      refUrl: bundledUrl(`people/${person.id}.webp`),
      portraitUrl: bundledUrl(`people/${person.id}-portrait.webp`),
      defaultImageUrl: bundledUrl(`people/${person.id}.webp`),
      looks: bundledLooks(person.id),
      usedIn: this.usedCount(person.id)
    }))
  }

  listUsers(): Person[] {
    const rows = this.db.prepare('SELECT * FROM people ORDER BY created_at ASC').all() as PersonRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ageBand: null,
      blurb: row.notes,
      source: 'user',
      refUrl: libraryUrl(row.ref_file),
      portraitUrl: libraryUrl(row.thumb ?? row.ref_file),
      defaultImageUrl: libraryUrl(row.thumb ?? row.ref_file),
      looks: [],
      usedIn: this.usedCount(row.id)
    }))
  }

  list(): Person[] {
    return [...this.bundled(), ...this.listUsers()]
  }

  getUser(id: string): Person | null {
    const row = this.db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      ageBand: null,
      blurb: row.notes,
      source: 'user',
      refUrl: libraryUrl(row.ref_file),
      portraitUrl: libraryUrl(row.thumb ?? row.ref_file),
      defaultImageUrl: libraryUrl(row.thumb ?? row.ref_file),
      looks: [],
      usedIn: this.usedCount(row.id)
    }
  }

  /**
   * Resolve the person photo to send as a reference. Bundled people can use
   * one of their alternate studio looks; user people keep their one portrait.
   */
  refFor(id: string, look: string | null): PersonReferenceFile | null {
    if (isBundledPerson(id)) {
      if (!look || look === 'original') return { root: 'bundled', file: `people/${id}.webp` }
      if (!isBundledLookKey(look)) return null
      return { root: 'bundled', file: `people/${id}-${look}.webp` }
    }
    const row = this.getRow(id)
    if (!row) return null
    if (look && look !== 'original') return null
    return { root: 'library', file: row.ref_file }
  }

  getRow(id: string): PersonRow | null {
    return (this.db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined) ?? null
  }

  create(input: { id: string; name: string; refFile: string; thumb: string; now?: number }): Person {
    this.db
      .prepare('INSERT INTO people (id, name, source, ref_file, thumb, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.id, input.name, 'user', input.refFile, input.thumb, input.now ?? Date.now())
    return this.getUser(input.id)!
  }

  rename(id: string, name: string): Person | null {
    this.db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, id)
    return this.getUser(id)
  }

  delete(id: string): { files: string[] } | null {
    const row = this.getRow(id)
    if (!row) return null
    this.db.prepare('DELETE FROM people WHERE id = ?').run(id)
    return { files: [row.ref_file, row.thumb ?? ''].filter(Boolean) }
  }

  exists(id: string): boolean {
    if (BUNDLED_PEOPLE.some((person) => person.id === id)) return true
    return Boolean(this.getRow(id))
  }
}
