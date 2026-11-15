import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase, SCHEMA_VERSION } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { SettingsStore } from '@main/settings'
import {
  applyPendingRestore,
  createBackup,
  createDiagnostics,
  inspectBackup,
  stageRestore
} from '@main/backup'

let dir = ''
let db: Db

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-backup-'))
  db = openDatabase({
    file: path.join(dir, 'library.sqlite'),
    libraryPath: path.join(dir, 'library'),
    logger: new Logger(path.join(dir, 'logs'))
  })
})
afterEach(() => {
  try {
    db.close()
  } catch {
    // A restore test closes it first.
  }
  fs.rmSync(dir, { recursive: true, force: true })
})

function seedLibrary(): { projectId: string; file: string } {
  const projects = new ProjectRepository(db)
  const images = new ImageRepository(db)
  const project = projects.create({ type: 'photo', name: 'Candle photo' })
  const relative = path.posix.join('projects', project.id, 'source.jpg')
  const file = path.join(dir, 'library', relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.from('photo bytes'))
  images.create({
    projectId: project.id,
    kind: 'upload',
    status: 'ready',
    file: relative,
    label: 'Original photo',
    isOriginal: true
  })
  return { projectId: project.id, file }
}

describe('backup and restore', () => {
  it('creates a consistent backup and restores it into a new library', async () => {
    seedLibrary()
    const logger = new Logger(path.join(dir, 'logs'))
    const created = await createBackup({
      db,
      userDataDir: dir,
      libraryPath: path.join(dir, 'library'),
      appVersion: '1.0.0',
      schemaVersion: SCHEMA_VERSION,
      parentDir: path.join(dir, 'backups'),
      logger
    })
    expect(created.summary.projects).toBe(1)
    expect(created.summary.images).toBe(1)
    const backupDir = path.join(dir, 'backups', created.folderName)
    const inspected = await inspectBackup(backupDir)
    expect(inspected.folderName).toBe(created.folderName)
    expect(inspected.summary.images).toBe(1)
    expect(fs.existsSync(path.join(backupDir, 'library.sqlite'))).toBe(true)
    expect(fs.existsSync(path.join(backupDir, 'library'))).toBe(true)
    expect(fs.existsSync(path.join(backupDir, 'moss-backup.json'))).toBe(true)

    db.close()
    const target = path.join(dir, 'restored-library')
    await stageRestore({
      backupDir,
      targetLibrary: target,
      userDataDir: dir,
      logger
    })
    expect(fs.existsSync(path.join(target, 'projects'))).toBe(true)
    const applied = await applyPendingRestore({ userDataDir: dir, logger })
    expect(applied.restored).toBe(true)
    expect(fs.existsSync(path.join(dir, 'pending-restore.json'))).toBe(false)

    const restored = openDatabase({
      file: path.join(dir, 'library.sqlite'),
      libraryPath: path.join(dir, 'library'),
      logger
    })
    try {
      const settings = new SettingsStore(restored)
      expect(settings.libraryPath('unused')).toBe(target)
      const projects = new ProjectRepository(restored)
      expect(projects.list({ limit: 10 }).total).toBe(1)
    } finally {
      restored.close()
    }
  })
})

describe('diagnostics', () => {
  it('writes app information and logs, and never the secret store', async () => {
    seedLibrary()
    fs.writeFileSync(path.join(dir, 'secrets.bin'), 'not for diagnostics')
    const result = await createDiagnostics({
      userDataDir: dir,
      libraryPath: path.join(dir, 'library'),
      documentsDir: path.join(dir, 'documents'),
      appVersion: '1.0.0',
      buildDate: '2026-11-12T00:00:00.000Z',
      schemaVersion: SCHEMA_VERSION,
      db,
      logger: new Logger(path.join(dir, 'logs'))
    })
    expect(fs.existsSync(path.join(result.folder, 'app-info.json'))).toBe(true)
    expect(fs.existsSync(path.join(result.folder, 'README.txt'))).toBe(true)
    const info = fs.readFileSync(path.join(result.folder, 'app-info.json'), 'utf8')
    expect(info).toContain('schemaVersion')
    expect(info).not.toContain('not for diagnostics')
    expect(fs.existsSync(path.join(result.folder, 'secrets.bin'))).toBe(false)
  })
})
