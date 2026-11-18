import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Database from 'better-sqlite3'
import * as yauzl from 'yauzl'
import * as yazl from 'yazl'
import type { Db } from './db/connection'
import { SCHEMA_VERSION } from './db/connection'
import type { Logger } from './logger'
import type { BackupSummary } from '@shared/types'

const BACKUP_MANIFEST = 'moss-backup.json'
const PENDING_RESTORE = 'pending-restore.json'
const DB_NAME = 'library.sqlite'
const LIBRARY_DIR = 'library/'
const BACKUP_VERSION = 1
const PENDING_VERSION = 2
const MAX_MANIFEST_BYTES = 1_000_000

interface BackupManifest {
  version: number
  createdAt: number
  appVersion: string
  schemaVersion: number
  libraryPath: string
  projects: number
  images: number
  libraryFiles?: number
  libraryBytes: number
  dbBytes: number
  dbSha256: string
}

interface PendingRestoreV1 {
  version: 1
  backupDir: string
  targetLibrary: string
  createdAt: number
}

interface PendingRestoreV2 {
  version: 2
  stagingDb: string
  dbBytes: number
  dbSha256: string
  targetLibrary: string
  previousLibrary: string
  sourcePath: string
  backupCreatedAt: number
  createdAt: number
}

type PendingRestore = PendingRestoreV1 | PendingRestoreV2

interface LibraryStats {
  files: number
  bytes: number
}

interface Inspection {
  manifest: BackupManifest
  sourceName: string
  summary: BackupSummary
}

function sqlPath(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function safeStamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export function backupFileName(date = new Date()): string {
  return `Moss Photo Studio Backup ${safeStamp(date)}.zip`
}

function restoredFolderName(date = new Date()): string {
  return `Moss Photo Studio Restored ${safeStamp(date)}`
}

function isInside(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`)
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

async function canWrite(dir: string): Promise<boolean> {
  const probe = path.join(dir, `.moss-write-${process.pid}-${Date.now()}`)
  try {
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(probe, '')
    await fsp.rm(probe, { force: true })
    return true
  } catch {
    return false
  }
}

export async function chooseRestoreTarget(input: {
  currentLibrary: string
  documentsDir: string
  userDataDir: string
}): Promise<string> {
  const parents = [
    path.dirname(path.resolve(input.currentLibrary)),
    path.resolve(input.documentsDir),
    path.resolve(input.userDataDir)
  ]
  const seen = new Set<string>()
  for (const parent of parents) {
    if (seen.has(parent)) continue
    seen.add(parent)
    if (!(await canWrite(parent))) continue
    return uniqueFolder(parent, restoredFolderName())
  }
  throw new Error('restore_target_unavailable')
}

async function folderSize(dir: string): Promise<LibraryStats> {
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

function manifestFor(
  db: Db,
  input: {
    appVersion: string
    schemaVersion: number
    libraryPath: string
    libraryFiles: number
    libraryBytes: number
    dbBytes: number
    dbSha256: string
  }
): BackupManifest {
  return {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    libraryPath: input.libraryPath,
    projects: count(db, 'SELECT COUNT(*) AS count FROM projects'),
    images: count(db, 'SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL'),
    libraryFiles: input.libraryFiles,
    libraryBytes: input.libraryBytes,
    dbBytes: input.dbBytes,
    dbSha256: input.dbSha256
  }
}

function parseManifest(raw: unknown): BackupManifest {
  const manifest = raw as Partial<BackupManifest>
  if (
    !manifest ||
    manifest.version !== BACKUP_VERSION ||
    typeof manifest.createdAt !== 'number' ||
    typeof manifest.appVersion !== 'string' ||
    typeof manifest.schemaVersion !== 'number' ||
    typeof manifest.libraryPath !== 'string' ||
    typeof manifest.projects !== 'number' ||
    typeof manifest.images !== 'number' ||
    typeof manifest.libraryBytes !== 'number' ||
    typeof manifest.dbBytes !== 'number' ||
    manifest.dbBytes <= 0 ||
    typeof manifest.dbSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(manifest.dbSha256)
  ) {
    throw new Error('backup_manifest_unreadable')
  }
  return manifest as BackupManifest
}

function summaryFor(manifest: BackupManifest): BackupSummary {
  return {
    createdAt: manifest.createdAt,
    appVersion: manifest.appVersion,
    schemaVersion: manifest.schemaVersion,
    projects: manifest.projects,
    images: manifest.images,
    bytes: manifest.libraryBytes + manifest.dbBytes
  }
}

function backupReadme(manifest: BackupManifest): string {
  return [
    'Moss Photo Studio backup',
    `Created ${new Date(manifest.createdAt).toISOString()}`,
    '',
    'This .zip file contains the library database, the image library, and a manifest.',
    'Keep this file to restore the studio later from Settings, Storage, Restore.',
    'It does not contain your Meta key or the encrypted secret files.',
    'The database keeps an encrypted license row; after a restore, re-activate if asked.',
    ''
  ].join('\n')
}

async function addLibraryToZip(zip: yazl.ZipFile, root: string): Promise<LibraryStats> {
  let files = 0
  let bytes = 0
  // Always add the folder so an empty library still restores into its own directory.
  zip.addEmptyDirectory(LIBRARY_DIR)
  let top: fs.Dirent[]
  try {
    top = await fsp.readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { files, bytes }
    throw error
  }
  const walk = async (current: string, relative: string, entries: fs.Dirent[]): Promise<void> => {
    if (relative && entries.length === 0) {
      zip.addEmptyDirectory(`${LIBRARY_DIR}${relative}/`)
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      const next = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        const children = await fsp.readdir(full, { withFileTypes: true })
        await walk(full, next, children)
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const stat = await fsp.stat(full)
        if (!stat.isFile()) continue
        zip.addFile(full, `${LIBRARY_DIR}${next}`, { compress: false })
        files += 1
        bytes += stat.size
      }
    }
  }
  await walk(root, '', top)
  return { files, bytes }
}

async function writeBackupArchive(input: {
  partialPath: string
  dbSnapshot: string
  dbBytes: number
  dbSha256: string
  libraryPath: string
  appVersion: string
  schemaVersion: number
}): Promise<BackupManifest> {
  const zip = new yazl.ZipFile()
  const output = fs.createWriteStream(input.partialPath, { mode: 0o600 })
  const finished = pipeline(zip.outputStream as unknown as Readable, output)
  // The archive source may fail (a library file vanished); surface it through
  // the pipeline instead of leaving a half-written .zip behind.
  finished.catch(() => undefined)
  zip.on('error', (error) => {
    output.destroy(error instanceof Error ? error : new Error(String(error)))
  })
  // Count from the snapshot itself, so the manifest always describes the
  // database that is actually inside the archive.
  const snapshot = new Database(input.dbSnapshot, { readonly: true, fileMustExist: true })
  try {
    zip.addFile(input.dbSnapshot, DB_NAME, { compress: true })
    const library = await addLibraryToZip(zip, input.libraryPath)
    const manifest = manifestFor(snapshot, {
      appVersion: input.appVersion,
      schemaVersion: input.schemaVersion,
      libraryPath: input.libraryPath,
      libraryFiles: library.files,
      libraryBytes: library.bytes,
      dbBytes: input.dbBytes,
      dbSha256: input.dbSha256
    })
    zip.addBuffer(Buffer.from(backupReadme(manifest), 'utf8'), 'README.txt', { compress: true })
    zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), BACKUP_MANIFEST, {
      compress: true
    })
    zip.end()
    await finished
    return manifest
  } catch (error) {
    output.destroy()
    ;(zip.outputStream as unknown as Readable).destroy()
    await finished.catch(() => undefined)
    throw error
  } finally {
    snapshot.close()
  }
}

export async function createBackup(input: {
  db: Db
  libraryPath: string
  appVersion: string
  schemaVersion: number
  destination: string
  logger: Logger
}): Promise<{ fileName: string; filePath: string; summary: BackupSummary }> {
  const library = path.resolve(input.libraryPath)
  const requested = path.resolve(input.destination)
  const filePath = requested.toLowerCase().endsWith('.zip') ? requested : `${requested}.zip`
  if (isInside(library, filePath)) throw new Error('backup_inside_library')
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'moss-backup-'))
  const partialPath = `${filePath}.partial-${process.pid}-${Date.now()}`
  try {
    const dbSnapshot = path.join(workDir, DB_NAME)
    // A consistent snapshot, including committed WAL frames.
    input.db.exec(`VACUUM INTO ${sqlPath(dbSnapshot)}`)
    const stat = await fsp.stat(dbSnapshot)
    const manifest = await writeBackupArchive({
      partialPath,
      dbSnapshot,
      dbBytes: stat.size,
      dbSha256: await sha256(dbSnapshot),
      libraryPath: library,
      appVersion: input.appVersion,
      schemaVersion: input.schemaVersion
    })
    // Replace only after the complete archive exists, so a failed backup never
    // destroys a previous one at the same path.
    await fsp.rm(filePath, { force: true })
    await fsp.rename(partialPath, filePath)
    input.logger.info('backup', 'created', { count: manifest.images })
    return { fileName: path.basename(filePath), filePath, summary: summaryFor(manifest) }
  } catch (error) {
    await fsp.rm(partialPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function openZip(source: string): Promise<yauzl.ZipFile> {
  return yauzl.openPromise(source, {
    autoClose: false,
    strictFileNames: true,
    validateEntrySizes: true
  })
}

function closeZip(zip: yauzl.ZipFile): void {
  try {
    zip.close()
  } catch {
    // A close on an already-closed handle is harmless.
  }
}

function validateZipEntry(entry: yauzl.Entry): void {
  if (entry.isEncrypted()) throw new Error('backup_entry_unsupported')
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000
  if (mode !== 0 && mode !== 0o100000 && mode !== 0o040000) {
    throw new Error('backup_entry_unsupported')
  }
  const name = entry.fileName
  const segments = (name.endsWith('/') ? name.slice(0, -1) : name).split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('backup_unexpected_entry')
  }
  if (
    name !== BACKUP_MANIFEST &&
    name !== DB_NAME &&
    name !== 'README.txt' &&
    name !== LIBRARY_DIR &&
    !name.startsWith(LIBRARY_DIR)
  ) {
    throw new Error('backup_unexpected_entry')
  }
}

async function readEntryText(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
  const stream = await zip.openReadStreamPromise(entry)
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of stream) {
    const buffer = chunk as Buffer
    bytes += buffer.length
    if (bytes > MAX_MANIFEST_BYTES) throw new Error('backup_manifest_unreadable')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function verifyZipDatabase(source: string, manifest: BackupManifest): Promise<void> {
  const zip = await openZip(source)
  try {
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName !== DB_NAME) continue
      if (entry.uncompressedSize !== manifest.dbBytes) {
        throw new Error('backup_database_changed')
      }
      const hash = crypto.createHash('sha256')
      let bytes = 0
      const stream = await zip.openReadStreamPromise(entry)
      for await (const chunk of stream) {
        hash.update(chunk as Buffer)
        bytes += (chunk as Buffer).length
      }
      if (bytes !== manifest.dbBytes || hash.digest('hex') !== manifest.dbSha256.toLowerCase()) {
        throw new Error('backup_database_changed')
      }
      return
    }
  } finally {
    closeZip(zip)
  }
  throw new Error('backup_database_missing')
}

async function inspectZip(source: string): Promise<Inspection> {
  const zip = await openZip(source)
  let manifest: BackupManifest | null = null
  let hasDatabase = false
  let hasLibrary = false
  const seen = new Set<string>()
  try {
    for await (const entry of zip.eachEntry()) {
      validateZipEntry(entry)
      const name = entry.fileName
      if (seen.has(name)) throw new Error('backup_duplicate_entry')
      seen.add(name)
      if (name.endsWith('/')) {
        if (name === LIBRARY_DIR) hasLibrary = true
        continue
      }
      if (name === DB_NAME) {
        if (hasDatabase) throw new Error('backup_duplicate_entry')
        hasDatabase = true
      } else if (name === BACKUP_MANIFEST) {
        if (manifest) throw new Error('backup_duplicate_entry')
        if (entry.uncompressedSize > MAX_MANIFEST_BYTES) {
          throw new Error('backup_manifest_unreadable')
        }
        const raw = JSON.parse(await readEntryText(zip, entry)) as unknown
        manifest = parseManifest(raw)
      } else if (name.startsWith(LIBRARY_DIR)) {
        hasLibrary = true
      }
    }
  } finally {
    closeZip(zip)
  }
  if (!manifest) throw new Error('backup_manifest_unreadable')
  if (!hasDatabase) throw new Error('backup_database_missing')
  if (!hasLibrary) throw new Error('backup_library_missing')
  await verifyZipDatabase(source, manifest)
  return {
    manifest,
    sourceName: path.basename(source),
    summary: summaryFor(manifest)
  }
}

async function inspectFolder(folder: string): Promise<Inspection> {
  const manifestPath = path.join(folder, BACKUP_MANIFEST)
  let raw: unknown
  try {
    raw = JSON.parse(await fsp.readFile(manifestPath, 'utf8'))
  } catch {
    throw new Error('backup_manifest_unreadable')
  }
  const manifest = parseManifest(raw)
  const dbPath = path.join(folder, DB_NAME)
  const stat = await fsp.stat(dbPath).catch(() => null)
  if (!stat || stat.size !== manifest.dbBytes) throw new Error('backup_database_missing')
  if ((await sha256(dbPath)) !== manifest.dbSha256.toLowerCase()) {
    throw new Error('backup_database_changed')
  }
  const libraryDir = path.join(folder, 'library')
  const libraryStat = await fsp.stat(libraryDir).catch(() => null)
  if (!libraryStat?.isDirectory()) throw new Error('backup_library_missing')
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const check = db.pragma('quick_check', { simple: true })
    if (check !== 'ok') throw new Error('backup_database_corrupt')
    const schemaVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    const projects =
      (db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count?: number } | undefined)
        ?.count ?? 0
    const images =
      (
        db.prepare('SELECT COUNT(*) AS count FROM images WHERE deleted_at IS NULL').get() as
          | { count?: number }
          | undefined
      )?.count ?? 0
    return {
      manifest,
      sourceName: path.basename(folder),
      summary: {
        createdAt: manifest.createdAt,
        appVersion: manifest.appVersion,
        schemaVersion,
        projects: Number(projects),
        images: Number(images),
        bytes: manifest.dbBytes + manifest.libraryBytes
      }
    }
  } finally {
    db.close()
  }
}

export async function inspectBackup(source: string): Promise<Inspection> {
  const resolved = path.resolve(source)
  const stat = await fsp.stat(resolved).catch(() => null)
  if (!stat) throw new Error('backup_not_found')
  if (stat.isDirectory()) return inspectFolder(resolved)
  if (!stat.isFile()) throw new Error('backup_manifest_unreadable')
  return inspectZip(resolved)
}

async function verifyFileHash(file: string, bytes: number, sha: string): Promise<void> {
  const stat = await fsp.stat(file).catch(() => null)
  if (!stat || stat.size !== bytes) throw new Error('backup_database_changed')
  if ((await sha256(file)) !== sha.toLowerCase()) throw new Error('backup_database_changed')
}

async function extractDatabaseFromZip(
  source: string,
  destination: string,
  manifest: BackupManifest
): Promise<void> {
  const zip = await openZip(source)
  try {
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName !== DB_NAME) continue
      if (entry.uncompressedSize !== manifest.dbBytes) {
        throw new Error('backup_database_changed')
      }
      const hash = crypto.createHash('sha256')
      let bytes = 0
      const transform = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          hash.update(chunk)
          bytes += chunk.length
          callback(null, chunk)
        }
      })
      const stream = await zip.openReadStreamPromise(entry)
      await pipeline(stream, transform, fs.createWriteStream(destination, { mode: 0o600 }))
      if (bytes !== manifest.dbBytes || hash.digest('hex') !== manifest.dbSha256.toLowerCase()) {
        throw new Error('backup_database_changed')
      }
      return
    }
  } finally {
    closeZip(zip)
  }
  throw new Error('backup_database_missing')
}

async function extractLibraryFromZip(source: string, target: string): Promise<void> {
  const zip = await openZip(source)
  const root = path.resolve(target)
  try {
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName
      if (name === DB_NAME || name === BACKUP_MANIFEST || name === 'README.txt') continue
      if (name !== LIBRARY_DIR && !name.startsWith(LIBRARY_DIR)) continue
      const trimmed = name.endsWith('/') ? name.slice(0, -1) : name
      const relative = trimmed.slice(LIBRARY_DIR.length)
      const destination = path.resolve(root, ...relative.split('/').filter(Boolean))
      if (destination !== root && !isInside(root, destination)) {
        throw new Error('backup_unexpected_entry')
      }
      if (name.endsWith('/')) {
        await fsp.mkdir(destination, { recursive: true })
        continue
      }
      await fsp.mkdir(path.dirname(destination), { recursive: true })
      const stream = await zip.openReadStreamPromise(entry)
      await pipeline(stream, fs.createWriteStream(destination))
    }
  } finally {
    closeZip(zip)
  }
}

async function removeStaging(staging: string): Promise<void> {
  await fsp.rm(staging, { force: true }).catch(() => undefined)
  await fsp.rm(`${staging}-wal`, { force: true }).catch(() => undefined)
  await fsp.rm(`${staging}-shm`, { force: true }).catch(() => undefined)
}

async function quickCheck(file: string): Promise<void> {
  const db = new Database(file, { readonly: true, fileMustExist: true })
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok') {
      throw new Error('backup_database_corrupt')
    }
  } finally {
    db.close()
  }
}

export async function stageRestore(input: {
  source: string
  targetLibrary: string
  previousLibrary: string
  userDataDir: string
  logger: Logger
}): Promise<{ summary: BackupSummary }> {
  const inspected = await inspectBackup(input.source)
  if (inspected.summary.schemaVersion > SCHEMA_VERSION) {
    throw new Error('backup_newer_than_app')
  }
  const source = path.resolve(input.source)
  const target = path.resolve(input.targetLibrary)
  if (isInside(target, source) || isInside(source, target)) {
    throw new Error('restore_target_invalid')
  }
  const staging = path.join(input.userDataDir, `${DB_NAME}.restoring-${Date.now()}`)
  let createdTarget = false
  try {
    const existing = await fsp.stat(target).catch(() => null)
    if (existing) {
      if (!existing.isDirectory()) throw new Error('restore_target_not_empty')
      const entries = await fsp.readdir(target)
      if (entries.length) throw new Error('restore_target_not_empty')
    } else {
      await fsp.mkdir(target, { recursive: true })
      createdTarget = true
    }
    const sourceStat = await fsp.stat(source)
    if (sourceStat.isDirectory()) {
      await fsp.cp(path.join(source, 'library'), target, {
        recursive: true,
        force: true,
        errorOnExist: false
      })
      await fsp.copyFile(path.join(source, DB_NAME), staging)
      await verifyFileHash(staging, inspected.manifest.dbBytes, inspected.manifest.dbSha256)
    } else {
      await extractLibraryFromZip(source, target)
      await extractDatabaseFromZip(source, staging, inspected.manifest)
    }
    await quickCheck(staging)
    const pending: PendingRestoreV2 = {
      version: PENDING_VERSION,
      stagingDb: staging,
      dbBytes: inspected.manifest.dbBytes,
      dbSha256: inspected.manifest.dbSha256,
      targetLibrary: target,
      previousLibrary: path.resolve(input.previousLibrary),
      sourcePath: source,
      backupCreatedAt: inspected.manifest.createdAt,
      createdAt: Date.now()
    }
    await fsp.writeFile(path.join(input.userDataDir, PENDING_RESTORE), JSON.stringify(pending), {
      mode: 0o600
    })
    input.logger.info('backup', 'restore_staged', { count: inspected.summary.images })
    return { summary: inspected.summary }
  } catch (error) {
    await removeStaging(staging)
    if (createdTarget) {
      await fsp.rm(target, { recursive: true, force: true }).catch(() => undefined)
    }
    throw error
  }
}

async function applyLegacyPendingRestore(
  pending: PendingRestoreV1,
  input: { userDataDir: string; logger: Logger }
): Promise<{ restored: boolean; error?: string }> {
  const pendingPath = path.join(input.userDataDir, PENDING_RESTORE)
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
    await fsp.rm(pendingPath, { force: true }).catch(() => undefined)
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

async function applyStagedPendingRestore(
  pending: PendingRestoreV2,
  input: { userDataDir: string; logger: Logger }
): Promise<{ restored: boolean; error?: string }> {
  const pendingPath = path.join(input.userDataDir, PENDING_RESTORE)
  const dbFile = path.join(input.userDataDir, DB_NAME)
  const staging = path.resolve(pending.stagingDb)
  // The pending file is local, but never let a stale or edited record point
  // the swap at a file outside this app's own data folder.
  if (
    path.dirname(staging) !== path.resolve(input.userDataDir) ||
    !path.basename(staging).startsWith(`${DB_NAME}.restoring-`)
  ) {
    await fsp.rm(pendingPath, { force: true }).catch(() => undefined)
    input.logger.warn('backup', 'restore_failed', { errorCode: 'restore' })
    return { restored: false, error: 'The restore did not finish. Your current library was left in place.' }
  }
  const preRestore = `${dbFile}.pre-restore-${Date.now()}`
  let movedCurrent = false
  try {
    await verifyFileHash(staging, pending.dbBytes, pending.dbSha256)
    const restored = new Database(staging)
    try {
      const setSetting = restored.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      setSetting.run('libraryPath', JSON.stringify(pending.targetLibrary))
      setSetting.run('lastBackupAt', JSON.stringify(pending.backupCreatedAt))
      setSetting.run('lastBackupPath', JSON.stringify(pending.sourcePath))
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
    await removeStaging(staging)
    await fsp.rm(pendingPath, { force: true }).catch(() => undefined)
    if (
      pending.previousLibrary &&
      path.resolve(pending.previousLibrary) !== path.resolve(pending.targetLibrary)
    ) {
      await fsp
        .writeFile(
          path.join(pending.previousLibrary, 'README.txt'),
          'The studio restored a backup into a new folder. This copy is no longer used and is safe to delete after you check the restored library.\n',
          'utf8'
        )
        .catch(() => undefined)
    }
    input.logger.info('backup', 'restored', { count: 1 })
    return { restored: true }
  } catch {
    // If the live database was already moved aside, put it back before
    // reporting failure. The current library was never touched.
    await removeStaging(staging)
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

export async function applyPendingRestore(input: {
  userDataDir: string
  logger: Logger
}): Promise<{ restored: boolean; error?: string }> {
  const pendingPath = path.join(input.userDataDir, PENDING_RESTORE)
  let pending: PendingRestore
  try {
    pending = JSON.parse(await fsp.readFile(pendingPath, 'utf8')) as PendingRestore
  } catch {
    return { restored: false }
  }
  if (!pending || typeof pending !== 'object') return { restored: false }
  if (pending.version === 1) {
    if (!pending.backupDir || !pending.targetLibrary) return { restored: false }
    return applyLegacyPendingRestore(pending, input)
  }
  if (
    pending.version !== PENDING_VERSION ||
    typeof pending.stagingDb !== 'string' ||
    typeof pending.targetLibrary !== 'string' ||
    typeof pending.dbBytes !== 'number' ||
    typeof pending.dbSha256 !== 'string' ||
    typeof pending.previousLibrary !== 'string' ||
    typeof pending.sourcePath !== 'string' ||
    typeof pending.backupCreatedAt !== 'number'
  ) {
    await fsp.rm(pendingPath, { force: true }).catch(() => undefined)
    return { restored: false }
  }
  return applyStagedPendingRestore(pending, input)
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
