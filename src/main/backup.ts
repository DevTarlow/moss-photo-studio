import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Db } from './db/connection'
import { SCHEMA_VERSION } from './db/connection'
import type { Logger } from './logger'
import type { BackupSummary } from '@shared/types'

const BACKUP_MANIFEST = 'moss-backup.json'
const PENDING_RESTORE = 'pending-restore.json'
const DB_NAME = 'library.sqlite'
const BACKUP_VERSION = 1

interface BackupManifest {
  version: number
  createdAt: number
  appVersion: string
  schemaVersion: number
  libraryPath: string
  projects: number
  images: number
  libraryBytes: number
  dbBytes: number
  dbSha256: string
}

interface PendingRestore {
  version: number
  backupDir: string
  targetLibrary: string
  createdAt: number
}

function sqlPath(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function safeStamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

async function uniqueFolder(parent: string, base: string): Promise<string> {
  await fsp.mkdir(parent, { recursive: true })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const name = attempt === 0 ? base : `${base} (${attempt + 1})`
    const candidate = path.join(parent, name)
    try {
      await fsp.access(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error('backup_folder_collision')
}

async function folderSize(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0
  const walk = async (current: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(full)
          files += 1
          bytes += stat.size
        } catch {
          // A file that disappears while counting is not worth failing a backup.
        }
      }
    }
  }
  await walk(dir)
  return { files, bytes }
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  const stream = fs.createReadStream(file)
  for await (const chunk of stream) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function count(db: Db, sql: string): number {
  const row = db.prepare(sql).get() as { count?: number } | undefined
  return Number(row?.count ?? 0)
}

function manifestFor(db: Db, input: {
  appVersion: string
  schemaVersion: number
  libraryPath: string
  libraryBytes: number
  dbBytes: number
  dbSha256: string
}): BackupManifest {
  return {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    libraryPath: input.libraryPath,
    projects: count(db, 'SELECT COUNT(*) AS count FROM projects'),
    images: count(db, 'SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL'),
    libraryBytes: input.libraryBytes,
    dbBytes: input.dbBytes,
    dbSha256: input.dbSha256
  }
}

export async function createBackup(input: {
  db: Db
  userDataDir: string
  libraryPath: string
  appVersion: string
  schemaVersion: number
  parentDir: string
  logger: Logger
}): Promise<{ folderName: string; summary: BackupSummary }> {
  const parent = path.resolve(input.parentDir)
  const library = path.resolve(input.libraryPath)
  if (parent === library || parent.startsWith(`${library}${path.sep}`)) {
    throw new Error('backup_inside_library')
  }
  const folder = await uniqueFolder(parent, `Moss Photo Studio Backup ${safeStamp()}`)
  await fsp.mkdir(folder, { recursive: true })
  const dbTarget = path.join(folder, DB_NAME)
  try {
    // A consistent snapshot, including committed WAL frames.
    input.db.exec(`VACUUM INTO ${sqlPath(dbTarget)}`)
    const libraryTarget = path.join(folder, 'library')
    await fsp.mkdir(libraryTarget, { recursive: true })
    try {
      await fsp.cp(input.libraryPath, libraryTarget, {
        recursive: true,
        force: false,
        errorOnExist: false
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const library = await folderSize(libraryTarget)
    const stat = await fsp.stat(dbTarget)
    const manifest = manifestFor(input.db, {
      appVersion: input.appVersion,
      schemaVersion: input.schemaVersion,
      libraryPath: input.libraryPath,
      libraryBytes: library.bytes,
      dbBytes: stat.size,
      dbSha256: await sha256(dbTarget)
    })
    await fsp.writeFile(path.join(folder, BACKUP_MANIFEST), JSON.stringify(manifest, null, 2), 'utf8')
    await fsp.writeFile(
      path.join(folder, 'README.txt'),
      [
        'Moss Photo Studio backup',
        `Created ${new Date(manifest.createdAt).toISOString()}`,
        '',
        'This folder contains the library database, the image library, and a manifest.',
        'It does not contain your Meta key or the encrypted secret files.',
        'The database keeps an encrypted license row; after a restore, re-activate if asked.',
        'Keep the whole folder together. Restoring needs both library.sqlite and library/.',
        ''
      ].join('\n'),
      'utf8'
    )
    input.logger.info('backup', 'created', { count: manifest.images })
    return {
      folderName: path.basename(folder),
      summary: {
        createdAt: manifest.createdAt,
        appVersion: manifest.appVersion,
        schemaVersion: manifest.schemaVersion,
        projects: manifest.projects,
        images: manifest.images,
        bytes: manifest.libraryBytes + manifest.dbBytes
      }
    }
  } catch (error) {
    await fsp.rm(folder, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function inspectBackup(folder: string): Promise<{
  manifest: BackupManifest
  folderName: string
  summary: BackupSummary
}> {
  const manifestPath = path.join(folder, BACKUP_MANIFEST)
  let raw: unknown
  try {
    raw = JSON.parse(await fsp.readFile(manifestPath, 'utf8'))
  } catch {
    throw new Error('backup_manifest_unreadable')
  }
  const manifest = raw as Partial<BackupManifest>
  if (
    !manifest ||
    manifest.version !== BACKUP_VERSION ||
    typeof manifest.createdAt !== 'number' ||
    typeof manifest.dbSha256 !== 'string' ||
    typeof manifest.dbBytes !== 'number'
  ) {
    throw new Error('backup_manifest_unreadable')
  }
  const dbPath = path.join(folder, DB_NAME)
  const stat = await fsp.stat(dbPath).catch(() => null)
  if (!stat || stat.size !== manifest.dbBytes) throw new Error('backup_database_missing')
  if ((await sha256(dbPath)) !== manifest.dbSha256) throw new Error('backup_database_changed')
  const libraryDir = path.join(folder, 'library')
  const libraryStat = await fsp.stat(libraryDir).catch(() => null)
  if (!libraryStat?.isDirectory()) throw new Error('backup_library_missing')
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const check = db.pragma('quick_check', { simple: true })
    if (check !== 'ok') throw new Error('backup_database_corrupt')
    const schemaVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    const projects = (db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count?: number } | undefined)?.count ?? 0
    const images = (db.prepare('SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL').get() as { count?: number } | undefined)?.count ?? 0
    return {
      manifest: manifest as BackupManifest,
      folderName: path.basename(folder),
      summary: {
        createdAt: manifest.createdAt,
        appVersion: String(manifest.appVersion ?? ''),
        schemaVersion,
        projects: Number(projects),
        images: Number(images),
        bytes: Number(manifest.dbBytes) + Number(manifest.libraryBytes ?? 0)
      }
    }
  } finally {
    db.close()
  }
}

export async function stageRestore(input: {
  backupDir: string
  targetLibrary: string
  userDataDir: string
  logger: Logger
}): Promise<{ summary: BackupSummary }> {
  const inspected = await inspectBackup(input.backupDir)
  if (inspected.summary.schemaVersion > SCHEMA_VERSION) {
    throw new Error('backup_newer_than_app')
  }
  const target = path.resolve(input.targetLibrary)
  await fsp.mkdir(target, { recursive: true })
  const entries = await fsp.readdir(target)
  if (entries.length) throw new Error('restore_target_not_empty')
  await fsp.cp(path.join(input.backupDir, 'library'), target, {
    recursive: true,
    force: true,
    errorOnExist: false
  })
  const pending: PendingRestore = {
    version: 1,
    backupDir: path.resolve(input.backupDir),
    targetLibrary: target,
    createdAt: Date.now()
  }
  await fsp.writeFile(path.join(input.userDataDir, PENDING_RESTORE), JSON.stringify(pending), {
    mode: 0o600
  })
  input.logger.info('backup', 'restore_staged', { count: inspected.summary.images })
  return { summary: inspected.summary }
}

export async function applyPendingRestore(input: {
  userDataDir: string
  logger: Logger
}): Promise<{ restored: boolean; error?: string }> {
  const pendingPath = path.join(input.userDataDir, PENDING_RESTORE)
  let pending: PendingRestore
  try {
    pending = JSON.parse(await fsp.readFile(pendingPath, 'utf8')) as PendingRestore
    if (pending?.version !== 1 || !pending.backupDir || !pending.targetLibrary) {
      throw new Error('pending_restore_unreadable')
    }
  } catch {
    return { restored: false }
  }
  const dbFile = path.join(input.userDataDir, DB_NAME)
  const staging = path.join(input.userDataDir, `${DB_NAME}.restoring`)
  const preRestore = `${dbFile}.pre-restore-${Date.now()}`
  let movedCurrent = false
  try {
    await inspectBackup(pending.backupDir)
    await fsp.mkdir(path.dirname(pending.targetLibrary), { recursive: true })
    await fsp.cp(path.join(pending.backupDir, 'library'), pending.targetLibrary, {
      recursive: true,
      force: true,
      errorOnExist: false
    })
    await fsp.copyFile(path.join(pending.backupDir, DB_NAME), staging)
    const restored = new Database(staging)
    try {
      restored
        .prepare(
          "INSERT INTO settings (key, value) VALUES ('libraryPath', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .run(JSON.stringify(pending.targetLibrary))
      restored.pragma('wal_checkpoint(TRUNCATE)')
    } finally {
      restored.close()
    }
    for (const suffix of ['', '-wal', '-shm']) {
      const source = `${dbFile}${suffix}`
      if (fs.existsSync(source)) {
        await fsp.rename(source, `${preRestore}${suffix}`)
        movedCurrent = true
      }
    }
    await fsp.rename(staging, dbFile)
    await fsp.rm(pendingPath, { force: true })
    input.logger.info('backup', 'restored', { count: 1 })
    return { restored: true }
  } catch {
    await fsp.rm(staging, { force: true }).catch(() => undefined)
    if (movedCurrent) {
      for (const suffix of ['', '-wal', '-shm']) {
        const source = `${preRestore}${suffix}`
        if (fs.existsSync(source)) {
          await fsp.rename(source, `${dbFile}${suffix}`).catch(() => undefined)
        }
      }
    }
    await fsp.rm(pendingPath, { force: true }).catch(() => undefined)
    input.logger.warn('backup', 'restore_failed', { errorCode: 'restore' })
    return { restored: false, error: 'The restore did not finish. Your current library was left in place.' }
  }
}

export async function createDiagnostics(input: {
  userDataDir: string
  libraryPath: string
  documentsDir: string
  appVersion: string
  buildDate: string
  schemaVersion: number
  db: Db
  logger: Logger
}): Promise<{ folderName: string; folder: string }> {
  const folder = await uniqueFolder(
    input.documentsDir,
    `Moss Photo Studio Diagnostics ${safeStamp()}`
  )
  await fsp.mkdir(folder, { recursive: true })
  const library = await folderSize(input.libraryPath)
  await fsp.writeFile(
    path.join(folder, 'app-info.json'),
    JSON.stringify(
      {
        appVersion: input.appVersion,
        buildDate: input.buildDate,
        schemaVersion: input.schemaVersion,
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        node: process.versions.node,
        libraryPath: input.libraryPath,
        libraryFiles: library.files,
        libraryBytes: library.bytes,
        projects: count(input.db, 'SELECT COUNT(*) AS count FROM projects'),
        images: count(input.db, 'SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL')
      },
      null,
      2
    ),
    'utf8'
  )
  const logs = path.join(input.userDataDir, 'logs')
  try {
    await fsp.cp(logs, path.join(folder, 'logs'), { recursive: true, force: false })
  } catch {
    // No logs yet is a valid state.
  }
  await fsp.writeFile(
    path.join(folder, 'README.txt'),
    [
      'Moss Photo Studio diagnostics',
      '',
      'This folder has app information, library counts, and local logs.',
      'It does not contain your Meta key, license key, prompts, or images.',
      'Attach the folder to a support message if you need help.',
      ''
    ].join('\n'),
    'utf8'
  )
  input.logger.info('backup', 'diagnostics_created', { count: 1 })
  return { folderName: path.basename(folder), folder }
}
