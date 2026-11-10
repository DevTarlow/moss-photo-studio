import fs from 'node:fs'
import path from 'node:path'
import type { Db } from './db/connection'
import type { Logger } from './logger'
import type { TextCipher } from './secretCipher'

export interface SecretsStatus {
  hasKey: boolean
  last4: string | null
  validatedAt: number | null
  backend: string
}

export class SecretStore {
  private readonly file: string
  private readonly db: Db
  private readonly logger: Logger
  private readonly cipher: TextCipher

  constructor(options: { userDataDir: string; db: Db; logger: Logger; cipher: TextCipher }) {
    this.file = path.join(options.userDataDir, 'secrets.bin')
    this.db = options.db
    this.logger = options.logger
    this.cipher = options.cipher
  }

  private meta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  private setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  private removeMeta(key: string): void {
    this.db.prepare('DELETE FROM meta WHERE key = ?').run(key)
  }

  private write(payload: string): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 })
    fs.writeFileSync(this.file, Buffer.from(payload, 'utf8'), { mode: 0o600 })
    fs.chmodSync(this.file, 0o600)
  }

  backend(): Promise<string> {
    return this.cipher.backend()
  }

  hasKey(): boolean {
    return fs.existsSync(this.file) && fs.statSync(this.file).size > 0
  }

  async status(): Promise<SecretsStatus> {
    return {
      hasKey: this.hasKey(),
      last4: this.meta('muse.last4'),
      validatedAt: this.meta('muse.validatedAt') ? Number(this.meta('muse.validatedAt')) : null,
      backend: await this.backend()
    }
  }

  async read(): Promise<string | null> {
    if (!this.hasKey()) return null
    try {
      const payload = fs.readFileSync(this.file, 'utf8')
      const decrypted = await this.cipher.decryptString(payload)
      if (decrypted.reencrypted) {
        try {
          this.write(decrypted.reencrypted)
        } catch {
          this.logger.warn('secrets', 'reencrypt_write_failed')
        }
      }
      return decrypted.value
    } catch {
      this.logger.warn('secrets', 'key_unreadable', { errorCode: 'decrypt' })
      return null
    }
  }

  async set(key: string): Promise<{ last4: string }> {
    const trimmed = key.trim()
    if (!trimmed) throw new Error('empty_key')
    this.write(await this.cipher.encryptString(trimmed))
    const last4 = trimmed.slice(-4)
    this.setMeta('muse.last4', last4)
    this.removeMeta('muse.validatedAt')
    this.logger.info('secrets', 'muse_key_saved', { count: 1 })
    return { last4 }
  }

  markValidated(): void {
    this.setMeta('muse.validatedAt', String(Date.now()))
  }

  clear(): void {
    if (fs.existsSync(this.file)) {
      try {
        const size = fs.statSync(this.file).size
        fs.writeFileSync(this.file, Buffer.alloc(size, 0), { mode: 0o600 })
      } catch {
        // Fall through to deletion.
      }
      fs.rmSync(this.file, { force: true })
    }
    this.removeMeta('muse.last4')
    this.removeMeta('muse.validatedAt')
    this.logger.info('secrets', 'muse_key_cleared')
  }
}
