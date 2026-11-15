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
import { runPendingRemovedDataCleanup } from '@main/removedData'

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
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(['projects', 'images', 'products', 'usage_events', 'license']))
    expect(tables.map((row) => row.name)).not.toEqual(expect.arrayContaining(['plans', 'listings']))
    db.close()
  })
})


describe('retired feature cleanup', () => {
  it('removes sets, plans, listings, cutouts and business columns while keeping other work', async () => {
    const file = path.join(dir, 'library.sqlite')
    const v9 = openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger(), targetVersion: 9 })
    const now = Date.now()
    v9.prepare("INSERT INTO projects (id, type, name, created_at, updated_at, category, active_plan_id, shape, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run('legacy-set', 'set', 'Old set', now, now, 'ceramics', 'plan-1', 'square', 'webp')
    v9.prepare("INSERT INTO projects (id, type, name, created_at, updated_at, shape, format) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run('kept-photo', 'photo', 'Kept photo', now, now, 'square', 'webp')
    v9.prepare("INSERT INTO images (id, project_id, kind, status, file, label, created_at, shot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run('old-image', 'legacy-set', 'render', 'ready', 'projects/legacy-set/images/old.webp', 'Main shot', now, 'shot-1')
    v9.prepare("INSERT INTO jobs (id, project_id, kind, total, status, started_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run('old-job', 'legacy-set', 'set', 1, 'interrupted', now)
    v9.prepare("INSERT INTO products (id, name, file, thumb, width, height, created_at, updated_at, cutout_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run('legacy-product', 'Old product', 'products/legacy-product.webp', 'products/legacy-product-thumb.webp', 10, 10, now, now, 'products/legacy-product-cutout.png')
    v9.prepare("UPDATE brand SET name = ?, sells = ?, colors = ?, updated_at = ? WHERE id = 'default'")
      .run('Old shop', 'Old goods', JSON.stringify(['#14532d']), now)
    v9.prepare("INSERT INTO usage_events (id, at, project_id, project_name, action, requested_n, returned_n, cost_cents, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run('old-usage', now, 'legacy-set', 'Old set', 'set', 1, 1, 1, 'ok')
    fs.mkdirSync(path.join(dir, 'library', 'projects', 'legacy-set', 'images'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'library', 'projects', 'legacy-set', 'images', 'old.webp'), 'old')
    fs.mkdirSync(path.join(dir, 'library', 'products'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'library', 'products', 'legacy-product-cutout.png'), 'cutout')
    v9.close()

    const db = openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger() })
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id = 'legacy-set'").get()).toEqual({ count: 0 })
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id = 'kept-photo'").get()).toEqual({ count: 1 })
    expect(db.prepare("SELECT COUNT(*) AS count FROM usage_events WHERE action = 'set'").get()).toEqual({ count: 1 })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    expect(tables.map((row) => row.name)).not.toEqual(expect.arrayContaining(['plans', 'listings']))
    const brandColumns = db.pragma('table_info(brand)') as Array<{ name: string }>
    expect(brandColumns.map((row) => row.name)).not.toContain('name')
    expect(db.prepare("SELECT colors FROM brand WHERE id = 'default'").get()).toEqual({ colors: JSON.stringify(['#14532d']) })
    await runPendingRemovedDataCleanup({ db, libraryPath: path.join(dir, 'library'), logger: logger() })
    expect(fs.existsSync(path.join(dir, 'library', 'projects', 'legacy-set'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'library', 'products', 'legacy-product-cutout.png'))).toBe(false)
    db.close()
  })
})

describe('database integrity', () => {
  it('refuses a database written by a newer app instead of silently downgrading', () => {
    const file = path.join(dir, 'library.sqlite')
    const seed = new Database(file)
    seed.pragma(`user_version = ${SCHEMA_VERSION + 1}`)
    seed.close()
    expect(() => openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger() })).toThrow(/newer/)
  })

  it('recovers from the latest snapshot when the live database is unreadable', () => {
    const file = path.join(dir, 'library.sqlite')
    const seed = new Database(file)
    seed.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seed.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('custom', 'kept')
    seed.pragma('user_version = 0')
    seed.close()
    const first = openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger() })
    expect(first.prepare('SELECT value FROM meta WHERE key = ?').get('custom')).toEqual({ value: 'kept' })
    first.close()
    // The migration wrote a consistent snapshot beside the live file.
    const backups = fs.readdirSync(dir).filter((name) => name.startsWith('library.sqlite.bak-'))
    expect(backups.length).toBeGreaterThan(0)
    fs.writeFileSync(file, Buffer.from('this is not a sqlite database'))
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true })
    const recovered = openDatabase({ file, libraryPath: path.join(dir, 'library'), logger: logger() })
    expect(recovered.prepare('SELECT value FROM meta WHERE key = ?').get('custom')).toEqual({ value: 'kept' })
    recovered.close()
  })
})

describe('crash recovery', () => {
  it('interrupts running jobs, deletes pending images, and keeps ready ones', () => {
    const db: Db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: logger() })
    const projects = new ProjectRepository(db)
    const images = new ImageRepository(db)
    const jobs = new JobRepository(db)
    const project = projects.create({ type: 'image', name: 'Recovery image' })
    const ready = images.create({ projectId: project.id, kind: 'render', status: 'ready', label: 'Main shot', costCents: 1 })
    const pending = images.create({ projectId: project.id, kind: 'render', status: 'pending', label: 'In use' })
    jobs.create({ id: 'job-1', projectId: project.id, kind: 'create', total: 2, snapshot: { items: [] } })
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
