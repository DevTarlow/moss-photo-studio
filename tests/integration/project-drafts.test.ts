import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-project-drafts-'))
  db = openDatabase({
    file: path.join(dir, 'library.sqlite'),
    libraryPath: path.join(dir, 'library'),
    logger: new Logger(path.join(dir, 'logs'))
  })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Image Generator drafts', () => {
  it('keeps an untouched draft out of every project list but still openable', () => {
    const draft = projects.create({ type: 'image', name: 'Untitled image', draft: true })

    expect(projects.list().total).toBe(0)
    expect(projects.list({ filter: 'images' }).total).toBe(0)
    expect(projects.recent(10)).toEqual([])
    expect(projects.get(draft.id)?.id).toBe(draft.id)
  })

  it('lists the project once its first image is stored', () => {
    const draft = projects.create({ type: 'image', name: 'Untitled image', draft: true })
    images.create({ projectId: draft.id, kind: 'render', status: 'ready', label: 'Created 1' })

    expect(projects.list().total).toBe(1)
    expect(projects.list().items[0]?.id).toBe(draft.id)
  })

  it('lists the project once a reference upload is stored', () => {
    const draft = projects.create({ type: 'image', name: 'Untitled image', draft: true })
    images.create({ projectId: draft.id, kind: 'upload', status: 'ready', label: 'Reference' })

    expect(projects.list().total).toBe(1)
  })

  it('drops untouched drafts at startup and keeps drafts that have a run', () => {
    const untouched = projects.create({ type: 'image', name: 'Untouched', draft: true })
    const attempted = projects.create({ type: 'image', name: 'Attempted', draft: true })
    db.prepare(
      `INSERT INTO jobs (id, project_id, kind, total, status, started_at)
       VALUES (?, ?, 'create', 1, 'failed', ?)`
    ).run('draft-job', attempted.id, Date.now())

    expect(projects.deleteEmptyDrafts()).toBe(1)
    expect(projects.get(untouched.id)).toBeNull()
    expect(projects.get(attempted.id)?.id).toBe(attempted.id)
  })
})
