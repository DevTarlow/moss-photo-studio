import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase, SCHEMA_VERSION } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { JobRepository } from '@main/db/repositories/jobs'
import { reconcileOnStartup } from '@main/jobs/queue'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-recovery-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function logger(): Logger {
  return new Logger(path.join(dir, 'logs'))
}

describe('migrations', () => {
  it('backs up a pre-migration database and keeps its data', () => {
    const file = path.join(dir, 'library.sqlite')
    const seed = new Database(file)
    seed.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seed.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('custom', 'kept')
    seed.pragma('user_version = 0')
    seed.close()
    const db = openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger() })
    expect(fs.existsSync(`${file}.bak-${SCHEMA_VERSION}`)).toBe(true)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    const custom = db.prepare('SELECT value FROM meta WHERE key = ?').get('custom') as { value: string }
    expect(custom.value).toBe('kept')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(['projects', 'images', 'plans', 'usage_events', 'license']))
    db.close()
  })
})

describe('crash recovery', () => {
  it('interrupts running jobs, deletes pending images, and keeps ready ones', () => {
    const db: Db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: logger() })
    const projects = new ProjectRepository(db)
    const images = new ImageRepository(db)
    const jobs = new JobRepository(db)
    const project = projects.create({ type: 'set', name: 'Recovery set' })
    const ready = images.create({ projectId: project.id, kind: 'render', status: 'ready', label: 'Main shot', costCents: 1 })
    const pending = images.create({ projectId: project.id, kind: 'render', status: 'pending', label: 'In use' })
    jobs.create({ id: 'job-1', projectId: project.id, kind: 'set', total: 2, snapshot: { items: [] } })
    jobs.updateCounters('job-1', 1, 0, 'running')
    const result = reconcileOnStartup({ jobs, images, logger: logger() })
    expect(result).toEqual({ interruptedJobs: 1, pendingImages: 1 })
    expect(jobs.getRow('job-1')?.status).toBe('interrupted')
    expect(images.get(ready.id)?.status).toBe('ready')
    expect(images.get(pending.id)).toBeNull()
    db.close()
  })
})

describe('version and project repository behaviour', () => {
  it('searches names, directions, prompts and person names', () => {
    const db: Db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: logger() })
    const projects = new ProjectRepository(db)
    const images = new ImageRepository(db)
    projects.create({ type: 'photo', name: 'Mug on a shelf' })
    const bowl = projects.create({ type: 'photo', name: 'Blue bowl' })
    images.create({ projectId: bowl.id, kind: 'render', status: 'ready', label: 'Edit 01', userText: 'a warm kitchen table', personId: 'maya' })
    expect(projects.list({ search: 'mug' }).total).toBe(1)
    expect(projects.list({ search: 'kitchen' }).total).toBe(1)
    expect(projects.list({ search: 'Maya' }).total).toBe(1)
    db.close()
  })

  it('never renumbers labels when an image is deleted', () => {
    const db: Db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: logger() })
    const projects = new ProjectRepository(db)
    const images = new ImageRepository(db)
    const project = projects.create({ type: 'photo', name: 'Labels' })
    const one = images.create({ projectId: project.id, kind: 'upload', label: 'Original photo', isOriginal: true })
    const two = images.create({ projectId: project.id, kind: 'render', label: 'Edit 01', parentId: one.id })
    const three = images.create({ projectId: project.id, kind: 'render', label: 'Edit 02', parentId: one.id })
    images.softDelete(two.id)
    const remaining = images.list(project.id)
    expect(remaining.map((image) => image.label)).toEqual(['Original photo', 'Edit 02'])
    expect(remaining.find((image) => image.id === three.id)?.label).toBe('Edit 02')
    const failed = images.create({ projectId: project.id, kind: 'render', status: 'failed', label: 'Edit 03', parentId: one.id })
    expect(images.list(project.id).some((image) => image.id === failed.id)).toBe(false)
    expect(images.list(project.id, true).some((image) => image.id === failed.id)).toBe(true)
    db.close()
  })
})
