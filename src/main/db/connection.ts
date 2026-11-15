import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Logger } from '../logger'

export type Db = Database.Database

interface Migration {
  version: number
  up: (db: Db) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('set','photo','image')),
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER,
          archived_at INTEGER,
          cover_image_id TEXT,
          source_image_id TEXT,
          active_plan_id TEXT,
          category TEXT,
          shape TEXT NOT NULL DEFAULT 'square',
          format TEXT NOT NULL DEFAULT 'webp',
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS plans (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE (project_id, version)
        );

        CREATE TABLE IF NOT EXISTS images (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('upload','render','edit','adjust')),
          status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','failed')),
          file TEXT,
          thumb TEXT,
          width INTEGER,
          height INTEGER,
          bytes INTEGER,
          format TEXT NOT NULL DEFAULT 'webp',
          mime TEXT NOT NULL DEFAULT 'image/webp',
          prompt TEXT,
          user_text TEXT,
          revised_prompt TEXT,
          template_id TEXT,
          shot_id TEXT,
          person_id TEXT,
          label TEXT,
          seq INTEGER NOT NULL DEFAULT 1,
          parent_id TEXT,
          root_id TEXT,
          size TEXT,
          adjust TEXT,
          badge INTEGER NOT NULL DEFAULT 0,
          is_original INTEGER NOT NULL DEFAULT 0,
          cost_cents INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER,
          job_id TEXT,
          error_code TEXT,
          created_at INTEGER NOT NULL,
          deleted_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id, deleted_at, created_at);
        CREATE INDEX IF NOT EXISTS idx_images_parent ON images(parent_id);
        CREATE INDEX IF NOT EXISTS idx_images_root ON images(root_id);
        CREATE INDEX IF NOT EXISTS idx_images_job ON images(job_id);

        CREATE TABLE IF NOT EXISTS people (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          notes TEXT,
          source TEXT NOT NULL DEFAULT 'user',
          ref_file TEXT NOT NULL,
          thumb TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('set','create','edit')),
          total INTEGER NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('running','done','failed','interrupted','cancelled')),
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          snapshot TEXT
        );

        CREATE TABLE IF NOT EXISTS usage_events (
          id TEXT PRIMARY KEY,
          at INTEGER NOT NULL,
          project_id TEXT,
          project_name TEXT,
          image_id TEXT,
          action TEXT NOT NULL CHECK (action IN ('create','set','edit','adjust')),
          requested_n INTEGER NOT NULL DEFAULT 0,
          returned_n INTEGER NOT NULL DEFAULT 0,
          cost_cents INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER,
          result TEXT NOT NULL CHECK (result IN ('ok','failed')),
          error_code TEXT,
          request_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_usage_at ON usage_events(at);

        CREATE TABLE IF NOT EXISTS brand (
          id TEXT PRIMARY KEY,
          name TEXT,
          sells TEXT,
          marketplaces TEXT,
          colors TEXT,
          logo_file TEXT,
          badge_enabled INTEGER NOT NULL DEFAULT 0,
          badge_corner TEXT NOT NULL DEFAULT 'br',
          badge_scale TEXT NOT NULL DEFAULT 'm',
          badge_opacity INTEGER NOT NULL DEFAULT 100,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS license (
          id TEXT PRIMARY KEY,
          key_enc TEXT,
          instance_id TEXT,
          machine_label TEXT,
          status TEXT NOT NULL,
          activated_at INTEGER,
          last_validated_at INTEGER,
          source TEXT NOT NULL DEFAULT 'moss'
        );
      `)
    }
  },
  {
    version: 2,
    up(db) {
      db.exec('ALTER TABLE brand ADD COLUMN colors_enabled INTEGER NOT NULL DEFAULT 1')
    }
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          file TEXT NOT NULL,
          thumb TEXT,
          width INTEGER,
          height INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_images_library ON images(deleted_at, status, created_at);
      `)
    }
  },
  {
    version: 4,
    up(db) {
      db.exec('ALTER TABLE projects ADD COLUMN draft INTEGER NOT NULL DEFAULT 0')
    }
  },
  {
    version: 5,
    up(db) {
      db.exec('ALTER TABLE projects ADD COLUMN person_look TEXT')
    }
  },
  {
    version: 6,
    up(db) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_projects_product ON projects(product_id);

        ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        ALTER TABLE products ADD COLUMN archived_at INTEGER;
        ALTER TABLE products ADD COLUMN category TEXT;
        ALTER TABLE products ADD COLUMN audience TEXT;
        ALTER TABLE products ADD COLUMN notes TEXT;

        ALTER TABLE brand ADD COLUMN audience TEXT;
        ALTER TABLE brand ADD COLUMN voice TEXT;
        ALTER TABLE brand ADD COLUMN policies TEXT;
        ALTER TABLE brand ADD COLUMN default_platform TEXT;
        ALTER TABLE brand ADD COLUMN style_preset TEXT;

        ALTER TABLE images ADD COLUMN origin TEXT NOT NULL DEFAULT 'upload';
        UPDATE images
        SET origin = CASE
          WHEN kind = 'upload' THEN 'upload'
          WHEN kind = 'adjust' THEN 'local'
          ELSE 'ai'
        END;

        CREATE TABLE IF NOT EXISTS listings (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          platform TEXT NOT NULL,
          version INTEGER NOT NULL,
          json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE (product_id, platform, version)
        );
        CREATE INDEX IF NOT EXISTS idx_listings_product ON listings(product_id, platform, created_at);
      `)
    }
  },
  {
    version: 7,
    up(db) {
      db.exec(`
        CREATE TABLE usage_events_v7 (
          id TEXT PRIMARY KEY,
          at INTEGER NOT NULL,
          project_id TEXT,
          project_name TEXT,
          image_id TEXT,
          action TEXT NOT NULL CHECK (action IN ('create','set','edit','adjust','listing','analyze','cutout')),
          requested_n INTEGER NOT NULL DEFAULT 0,
          returned_n INTEGER NOT NULL DEFAULT 0,
          cost_cents INTEGER NOT NULL DEFAULT 0,
          cost_micros INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER,
          result TEXT NOT NULL CHECK (result IN ('ok','failed')),
          error_code TEXT,
          request_id TEXT
        );
        INSERT INTO usage_events_v7
          (id, at, project_id, project_name, image_id, action, requested_n, returned_n, cost_cents, cost_micros, duration_ms, result, error_code, request_id)
        SELECT id, at, project_id, project_name, image_id, action, requested_n, returned_n, cost_cents, 0, duration_ms, result, error_code, request_id
        FROM usage_events;
        DROP TABLE usage_events;
        ALTER TABLE usage_events_v7 RENAME TO usage_events;
        CREATE INDEX IF NOT EXISTS idx_usage_at ON usage_events(at);
      `)
    }
  },
  {
    version: 8,
    up(db) {
      db.exec('ALTER TABLE products ADD COLUMN analysis TEXT')
    }
  },
  {
    version: 9,
    up(db) {
      db.exec(`
        ALTER TABLE products ADD COLUMN cutout_file TEXT;
        ALTER TABLE products ADD COLUMN cutout_source_id TEXT;
        ALTER TABLE products ADD COLUMN cutout_confidence REAL;
        ALTER TABLE products ADD COLUMN cutout_at INTEGER;
      `)
    }
  },
  {
    version: 10,
    up(db) {
      const setRows = db.prepare("SELECT id FROM projects WHERE type = 'set'").all() as Array<{ id: string }>
      const cutoutRows = db.prepare('SELECT cutout_file FROM products WHERE cutout_file IS NOT NULL').all() as Array<{ cutout_file: string }>
      const cleanup = {
        projects: setRows.map((row) => row.id),
        files: cutoutRows.map((row) => row.cutout_file)
      }
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('removedFeatureCleanup', ?)").run(JSON.stringify(cleanup))

      db.exec(`
        DELETE FROM jobs WHERE kind = 'set' OR project_id IN (SELECT id FROM projects WHERE type = 'set');
        DELETE FROM images WHERE project_id IN (SELECT id FROM projects WHERE type = 'set');
        DELETE FROM plans;
        DELETE FROM projects WHERE type = 'set';
        DROP TABLE plans;
        DROP TABLE listings;

        CREATE TABLE projects_v10 (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('photo','image')),
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER,
          archived_at INTEGER,
          cover_image_id TEXT,
          source_image_id TEXT,
          product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
          draft INTEGER NOT NULL DEFAULT 0,
          shape TEXT NOT NULL DEFAULT 'square',
          format TEXT NOT NULL DEFAULT 'webp',
          person_look TEXT
        );
        INSERT INTO projects_v10
          (id, type, name, created_at, updated_at, last_opened_at, archived_at, cover_image_id, source_image_id, product_id, draft, shape, format, person_look)
        SELECT id, type, name, created_at, updated_at, last_opened_at, archived_at, cover_image_id, source_image_id, product_id, draft, shape, format, person_look
        FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_v10 RENAME TO projects;
        CREATE INDEX IF NOT EXISTS idx_projects_product ON projects(product_id);

        CREATE TABLE jobs_v10 (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('create','edit')),
          total INTEGER NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('running','done','failed','interrupted','cancelled')),
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          snapshot TEXT
        );
        INSERT INTO jobs_v10
          (id, project_id, kind, total, done, failed, status, started_at, finished_at, snapshot)
        SELECT id, project_id, kind, total, done, failed, status, started_at, finished_at, snapshot
        FROM jobs;
        DROP TABLE jobs;
        ALTER TABLE jobs_v10 RENAME TO jobs;

        CREATE TABLE images_v10 (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('upload','render','edit','adjust')),
          status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','failed')),
          file TEXT,
          thumb TEXT,
          width INTEGER,
          height INTEGER,
          bytes INTEGER,
          format TEXT NOT NULL DEFAULT 'webp',
          mime TEXT NOT NULL DEFAULT 'image/webp',
          prompt TEXT,
          user_text TEXT,
          revised_prompt TEXT,
          template_id TEXT,
          person_id TEXT,
          label TEXT,
          seq INTEGER NOT NULL DEFAULT 1,
          parent_id TEXT,
          root_id TEXT,
          size TEXT,
          adjust TEXT,
          badge INTEGER NOT NULL DEFAULT 0,
          is_original INTEGER NOT NULL DEFAULT 0,
          cost_cents INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER,
          job_id TEXT,
          error_code TEXT,
          created_at INTEGER NOT NULL,
          deleted_at INTEGER,
          origin TEXT NOT NULL DEFAULT 'upload'
        );
        INSERT INTO images_v10
          (id, project_id, kind, status, file, thumb, width, height, bytes, format, mime, prompt, user_text,
           revised_prompt, template_id, person_id, label, seq, parent_id, root_id, size, adjust, badge,
           is_original, cost_cents, duration_ms, job_id, error_code, created_at, deleted_at, origin)
        SELECT id, project_id, kind, status, file, thumb, width, height, bytes, format, mime, prompt, user_text,
               revised_prompt, template_id, person_id, label, seq, parent_id, root_id, size, adjust, badge,
               is_original, cost_cents, duration_ms, job_id, error_code, created_at, deleted_at, origin
        FROM images;
        DROP TABLE images;
        ALTER TABLE images_v10 RENAME TO images;
        CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id, deleted_at, created_at);
        CREATE INDEX IF NOT EXISTS idx_images_parent ON images(parent_id);
        CREATE INDEX IF NOT EXISTS idx_images_root ON images(root_id);
        CREATE INDEX IF NOT EXISTS idx_images_job ON images(job_id);
        CREATE INDEX IF NOT EXISTS idx_images_library ON images(deleted_at, status, created_at);

        CREATE TABLE products_v10 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          file TEXT NOT NULL,
          thumb TEXT,
          width INTEGER,
          height INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          category TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          archived_at INTEGER
        );
        INSERT INTO products_v10
          (id, name, file, thumb, width, height, created_at, updated_at, category, status, archived_at)
        SELECT id, name, file, thumb, width, height, created_at, updated_at, category, status, archived_at
        FROM products;
        DROP TABLE products;
        ALTER TABLE products_v10 RENAME TO products;

        CREATE TABLE brand_v10 (
          id TEXT PRIMARY KEY,
          colors TEXT,
          colors_enabled INTEGER NOT NULL DEFAULT 1,
          logo_file TEXT,
          badge_enabled INTEGER NOT NULL DEFAULT 0,
          badge_corner TEXT NOT NULL DEFAULT 'br',
          badge_scale TEXT NOT NULL DEFAULT 'm',
          badge_opacity INTEGER NOT NULL DEFAULT 100,
          style_preset TEXT,
          updated_at INTEGER NOT NULL
        );
        INSERT INTO brand_v10
          (id, colors, colors_enabled, logo_file, badge_enabled, badge_corner, badge_scale, badge_opacity, style_preset, updated_at)
        SELECT id, colors, colors_enabled, logo_file, badge_enabled, badge_corner, badge_scale, badge_opacity, style_preset, updated_at
        FROM brand;
        DROP TABLE brand;
        ALTER TABLE brand_v10 RENAME TO brand;

        DELETE FROM settings WHERE key = 'onboardingCategory';
        INSERT OR REPLACE INTO meta (key, value) VALUES ('schemaVersion', '10');
      `)
    }
  },
  {
    version: 11,
    up(db) {
      db.exec(`
        ALTER TABLE images ADD COLUMN shot_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_images_shot ON images(shot_id);

        CREATE TABLE IF NOT EXISTS packs (
          project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
          json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE projects_v11 (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('photo','image','pack')),
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER,
          archived_at INTEGER,
          cover_image_id TEXT,
          source_image_id TEXT,
          product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
          draft INTEGER NOT NULL DEFAULT 0,
          shape TEXT NOT NULL DEFAULT 'square',
          format TEXT NOT NULL DEFAULT 'webp',
          person_look TEXT
        );
        INSERT INTO projects_v11
          (id, type, name, created_at, updated_at, last_opened_at, archived_at, cover_image_id, source_image_id, product_id, draft, shape, format, person_look)
        SELECT id, type, name, created_at, updated_at, last_opened_at, archived_at, cover_image_id, source_image_id, product_id, draft, shape, format, person_look
        FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_v11 RENAME TO projects;
        CREATE INDEX IF NOT EXISTS idx_projects_product ON projects(product_id);

        CREATE TABLE jobs_v11 (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('create','edit','pack')),
          total INTEGER NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('running','done','failed','interrupted','cancelled')),
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          snapshot TEXT
        );
        INSERT INTO jobs_v11
          (id, project_id, kind, total, done, failed, status, started_at, finished_at, snapshot)
        SELECT id, project_id, kind, total, done, failed, status, started_at, finished_at, snapshot
        FROM jobs;
        DROP TABLE jobs;
        ALTER TABLE jobs_v11 RENAME TO jobs;

        CREATE TABLE usage_events_v11 (
          id TEXT PRIMARY KEY,
          at INTEGER NOT NULL,
          project_id TEXT,
          project_name TEXT,
          image_id TEXT,
          action TEXT NOT NULL CHECK (action IN ('create','edit','adjust','pack','set','listing','analyze','cutout')),
          requested_n INTEGER NOT NULL DEFAULT 0,
          returned_n INTEGER NOT NULL DEFAULT 0,
          cost_cents INTEGER NOT NULL DEFAULT 0,
          cost_micros INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER,
          result TEXT NOT NULL CHECK (result IN ('ok','failed')),
          error_code TEXT,
          request_id TEXT
        );
        INSERT INTO usage_events_v11
          (id, at, project_id, project_name, image_id, action, requested_n, returned_n, cost_cents, cost_micros, duration_ms, result, error_code, request_id)
        SELECT id, at, project_id, project_name, image_id, action, requested_n, returned_n, cost_cents, cost_micros, duration_ms, result, error_code, request_id
        FROM usage_events;
        DROP TABLE usage_events;
        ALTER TABLE usage_events_v11 RENAME TO usage_events;
        CREATE INDEX IF NOT EXISTS idx_usage_at ON usage_events(at);

        INSERT OR REPLACE INTO meta (key, value) VALUES ('schemaVersion', '11');
      `)
    }
  },
]

export const SCHEMA_VERSION = migrations[migrations.length - 1]!.version

function backupList(file: string): Array<{ path: string; mtime: number }> {
  const dir = path.dirname(file)
  const prefix = `${path.basename(file)}.bak-`
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => ({ path: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

function backupDatabase(db: Db, file: string, version: number): string | null {
  if (!fs.existsSync(file)) return null
  const stat = fs.statSync(file)
  if (stat.size === 0) return null
  const backup = `${file}.bak-${version}`
  fs.rmSync(backup, { force: true })
  // VACUUM INTO takes a consistent snapshot including committed WAL frames;
  // a plain file copy can miss them and leave an unusable backup.
  db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`)
  for (const old of backupList(file).slice(2)) fs.rmSync(old.path, { force: true })
  return backup
}

function latestBackup(file: string): string | null {
  return backupList(file)[0]?.path ?? null
}

export function closeDatabase(db: Db): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // A checkpoint failure must not stop the app from closing.
  }
  db.close()
}

export interface OpenDatabaseOptions {
  file: string
  libraryPath: string
  logger: Logger
  /** Test hook: stop after this schema version. Production always uses the latest. */
  targetVersion?: number
}

function recoverDatabase(options: OpenDatabaseOptions): Db | null {
  const { file, logger } = options
  const backup = latestBackup(file)
  if (!backup) return null
  logger.warn('db', 'integrity_failed', { count: 1 })
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true })
  fs.copyFileSync(backup, file)
  return openDatabaseAttempt(options, false)
}

export function openDatabase(options: OpenDatabaseOptions): Db {
  return openDatabaseAttempt(options, true)
}

function openDatabaseAttempt(options: OpenDatabaseOptions, allowRecovery: boolean): Db {
  const { file, libraryPath, logger } = options
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const existed = fs.existsSync(file) && fs.statSync(file).size > 0
  let db: Db | null = null
  try {
    db = new Database(file)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('synchronous = NORMAL')
    db.pragma('busy_timeout = 5000')
    const check = db.pragma('quick_check', { simple: true })
    if (check !== 'ok') throw new Error('db_corrupt')
  } catch (error) {
    try {
      db?.close()
    } catch {
      // Nothing to do if SQLite never opened.
    }
    if (allowRecovery) {
      const recovered = recoverDatabase({ file, libraryPath, logger })
      if (recovered) return recovered
    }
    throw error
  }
  if (!db) throw new Error('db_corrupt')

  const current = Number(db.pragma('user_version', { simple: true }) ?? 0)
  const target = options.targetVersion ?? SCHEMA_VERSION
  if (current > target || target > SCHEMA_VERSION) {
    db.close()
    throw new Error('db_newer_than_app')
  }
  if (current < target) {
    let backup: string | null = null
    try {
      if (existed || current > 0) backup = backupDatabase(db, file, target)
      db.pragma('foreign_keys = OFF')
      try {
        for (const migration of migrations) {
          if (migration.version <= current || migration.version > target) continue
          const run = db.transaction(() => {
            migration.up(db)
            db.pragma(`user_version = ${migration.version}`)
          })
          run()
          logger.info('db', 'migration_applied', { count: migration.version })
        }
        const violations = db.pragma('foreign_key_check') as unknown[]
        if (violations.length) throw new Error('foreign_key_check_failed')
      } finally {
        db.pragma('foreign_keys = ON')
      }
    } catch (error) {
      db.close()
      if (backup && fs.existsSync(backup)) {
        fs.copyFileSync(backup, file)
        for (const suffix of ['-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true })
      }
      logger.error('db', 'migration_failed', { errorCode: 'migration' })
      throw error
    }
  }

  seedDefaults(db, libraryPath)
  return db
}

function seedDefaults(db: Db, libraryPath: string): void {
  const set = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  const seed = db.transaction(() => {
    set.run('deviceId', JSON.stringify(crypto.randomUUID()))
    set.run('theme', JSON.stringify('light'))
    set.run('density', JSON.stringify('comfortable'))
    set.run('onboardingStep', JSON.stringify(0))
    set.run('onboardingDone', JSON.stringify(false))
    set.run('setupDismissed', JSON.stringify(false))
    set.run('firstRunConfirmShown', JSON.stringify(false))
    set.run('concurrency', JSON.stringify(2))
    set.run('budgetCents', JSON.stringify(1000))
    set.run('defaultFormat', JSON.stringify('webp'))
    set.run('defaultShape', JSON.stringify('square'))
    set.run('lastProjectId', JSON.stringify(null))
    set.run('libraryPath', JSON.stringify(libraryPath))
    set.run('exportDefaults', JSON.stringify({ format: 'jpeg', quality: 90, maxDimension: null }))
    set.run('exportFolders', JSON.stringify({}))
    set.run('windowState', JSON.stringify(null))
    set.run('licenseGraceNotified', JSON.stringify(false))
    set.run('reduceMotion', JSON.stringify('system'))
    db.prepare('INSERT OR IGNORE INTO brand (id, updated_at) VALUES (?, ?)').run('default', Date.now())
    db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('schemaVersion', String(SCHEMA_VERSION))
  })
  seed()
}
