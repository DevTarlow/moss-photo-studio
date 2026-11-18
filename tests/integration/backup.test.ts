import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as yazl from 'yazl'
import { openDatabase, SCHEMA_VERSION } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { SettingsStore } from '@main/settings'
import {
  applyPendingRestore,
  chooseRestoreTarget,
  createBackup,
  createDiagnostics,
  inspectBackup,
  stageRestore
} from '@main/backup'

let dir = ''
let db: Db
let logger: Logger

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-backup-'))
  logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({
    file: path.join(dir, 'library.sqlite'),
    libraryPath: path.join(dir, 'library'),
    logger
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

async function createZipBackup(): Promise<{ fileName: string; filePath: string; summary: { createdAt: number } }> {
  return createBackup({
    db,
    libraryPath: path.join(dir, 'library'),
    appVersion: '1.0.0',
    schemaVersion: SCHEMA_VERSION,
    destination: path.join(dir, 'backups', 'Moss Backup.zip'),
    logger
  })
}

async function writeZip(file: string, entries: Array<{ name: string; data?: Buffer; directory?: boolean }>): Promise<void> {
  const zip = new yazl.ZipFile()
  const output = fs.createWriteStream(file)
  const done = new Promise<void>((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    zip.on('error', reject)
  })
  zip.outputStream.pipe(output)
  for (const entry of entries) {
    if (entry.directory) zip.addEmptyDirectory(entry.name)
    else zip.addBuffer(entry.data ?? Buffer.alloc(0), entry.name)
  }
  zip.end()
  await done
}

describe('backup and restore', () => {
  it('creates one .zip and restores it into a new library', async () => {
    seedLibrary()
    const created = await createZipBackup()
    expect(created.fileName).toBe('Moss Backup.zip')
    expect(fs.existsSync(created.filePath)).toBe(true)
    expect(fs.readFileSync(created.filePath).subarray(0, 4).toString('binary')).toBe('PK\x03\x04')

    const inspected = await inspectBackup(created.filePath)
    expect(inspected.sourceName).toBe('Moss Backup.zip')
    expect(inspected.summary.projects).toBe(1)
    expect(inspected.summary.images).toBe(1)
    expect(inspected.summary.bytes).toBeGreaterThan(0)

    const target = await chooseRestoreTarget({
      currentLibrary: path.join(dir, 'library'),
      documentsDir: path.join(dir, 'documents'),
      userDataDir: dir
    })
    expect(path.dirname(target)).toBe(dir)
    expect(fs.existsSync(target)).toBe(false)

    db.close()
    await stageRestore({
      source: created.filePath,
      targetLibrary: target,
      previousLibrary: path.join(dir, 'library'),
      userDataDir: dir,
      logger
    })
    expect(fs.existsSync(path.join(target, 'projects'))).toBe(true)
    const applied = await applyPendingRestore({ userDataDir: dir, logger })
    expect(applied.restored).toBe(true)
    expect(fs.existsSync(path.join(dir, 'pending-restore.json'))).toBe(false)
    expect(fs.readdirSync(dir).some((name) => name.startsWith('library.sqlite.pre-restore-'))).toBe(true)

    const restored = openDatabase({
      file: path.join(dir, 'library.sqlite'),
      libraryPath: path.join(dir, 'library'),
      logger
    })
    try {
      const settings = new SettingsStore(restored)
      expect(settings.libraryPath('unused')).toBe(target)
      expect(settings.get<number | null>('lastBackupAt', null)).toBe(created.summary.createdAt)
      expect(settings.get<string | null>('lastBackupPath', null)).toBe(created.filePath)
      expect(new ProjectRepository(restored).list({ limit: 10 }).total).toBe(1)
    } finally {
      restored.close()
    }
  })

  it('round-trips an empty library', async () => {
    const created = await createZipBackup()
    const inspected = await inspectBackup(created.filePath)
    expect(inspected.summary.projects).toBe(0)
    expect(inspected.summary.images).toBe(0)
    expect(inspected.summary.bytes).toBeGreaterThan(0)

    db.close()
    const target = path.join(dir, 'restored-empty')
    await stageRestore({
      source: created.filePath,
      targetLibrary: target,
      previousLibrary: path.join(dir, 'library'),
      userDataDir: dir,
      logger
    })
    expect(fs.existsSync(target)).toBe(true)
    const applied = await applyPendingRestore({ userDataDir: dir, logger })
    expect(applied.restored).toBe(true)
    expect(fs.existsSync(target)).toBe(true)
  })

  it('still restores a legacy folder backup', async () => {
    seedLibrary()
    const legacy = path.join(dir, 'legacy-backup')
    const legacyDb = path.join(legacy, 'library.sqlite')
    fs.cpSync(path.join(dir, 'library'), path.join(legacy, 'library'), { recursive: true })
    db.exec(`VACUUM INTO '${legacyDb.replace(/'/g, "''")}'`)
    const dbBytes = fs.statSync(legacyDb).size
    const dbSha256 = crypto.createHash('sha256').update(fs.readFileSync(legacyDb)).digest('hex')
    fs.writeFileSync(
      path.join(legacy, 'moss-backup.json'),
      JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        schemaVersion: SCHEMA_VERSION,
        libraryPath: path.join(dir, 'library'),
        projects: 1,
        images: 1,
        libraryBytes: 0,
        dbBytes,
        dbSha256
      }),
      'utf8'
    )
    fs.writeFileSync(path.join(legacy, 'README.txt'), 'legacy', 'utf8')

    const inspected = await inspectBackup(legacy)
    expect(inspected.summary.images).toBe(1)

    db.close()
    const target = path.join(dir, 'restored-legacy')
    await stageRestore({
      source: legacy,
      targetLibrary: target,
      previousLibrary: path.join(dir, 'library'),
      userDataDir: dir,
      logger
    })
    expect(fs.existsSync(path.join(target, 'projects'))).toBe(true)
    const applied = await applyPendingRestore({ userDataDir: dir, logger })
    expect(applied.restored).toBe(true)
  })

  it('rejects a zip whose database hash does not match the manifest', async () => {
    const bad = Buffer.from('not the real database')
    const file = path.join(dir, 'tampered.zip')
    await writeZip(file, [
      { name: 'library.sqlite', data: bad },
      { name: 'library/', directory: true },
      {
        name: 'moss-backup.json',
        data: Buffer.from(
          JSON.stringify({
            version: 1,
            createdAt: Date.now(),
            appVersion: '1.0.0',
            schemaVersion: SCHEMA_VERSION,
            libraryPath: '/tmp/library',
            projects: 0,
            images: 0,
            libraryBytes: 0,
            dbBytes: bad.length,
            dbSha256: '0'.repeat(64)
          })
        )
      }
    ])
    await expect(inspectBackup(file)).rejects.toThrow()
  })

  it('rejects a zip with no manifest', async () => {
    const file = path.join(dir, 'no-manifest.zip')
    await writeZip(file, [
      { name: 'library.sqlite', data: Buffer.from('database') },
      { name: 'library/', directory: true }
    ])
    await expect(inspectBackup(file)).rejects.toThrow()
  })

  it('leaves the live database in place when the staged copy disappears', async () => {
    seedLibrary()
    const created = await createZipBackup()
    const target = path.join(dir, 'restored-pending')
    await stageRestore({
      source: created.filePath,
      targetLibrary: target,
      previousLibrary: path.join(dir, 'library'),
      userDataDir: dir,
      logger
    })
    const pending = JSON.parse(fs.readFileSync(path.join(dir, 'pending-restore.json'), 'utf8')) as {
      stagingDb: string
    }
    fs.rmSync(pending.stagingDb, { force: true })

    const applied = await applyPendingRestore({ userDataDir: dir, logger })
    expect(applied.restored).toBe(false)
    expect(fs.existsSync(path.join(dir, 'pending-restore.json'))).toBe(false)
    expect(new ProjectRepository(db).list({ limit: 10 }).total).toBe(1)
  })

  it('refuses to stage a backup written by a newer schema', async () => {
    const data = Buffer.from('database')
    const file = path.join(dir, 'newer.zip')
    await writeZip(file, [
      { name: 'library.sqlite', data },
      { name: 'library/', directory: true },
      {
        name: 'moss-backup.json',
        data: Buffer.from(
          JSON.stringify({
            version: 1,
            createdAt: Date.now(),
            appVersion: '9.0.0',
            schemaVersion: SCHEMA_VERSION + 1,
            libraryPath: '/tmp/library',
            projects: 0,
            images: 0,
            libraryBytes: 0,
            dbBytes: data.length,
            dbSha256: crypto.createHash('sha256').update(data).digest('hex')
          })
        )
      }
    ])
    await expect(
      stageRestore({
        source: file,
        targetLibrary: path.join(dir, 'restored-newer'),
        previousLibrary: path.join(dir, 'library'),
        userDataDir: dir,
        logger
      })
    ).rejects.toThrow(/newer/)
    expect(fs.existsSync(path.join(dir, 'restored-newer'))).toBe(false)
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
