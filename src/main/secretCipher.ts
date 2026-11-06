import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'

const SAFE_PREFIX = 'MOSS1:safe:'
const LOCAL_PREFIX = 'MOSS1:local:'

/**
 * Text encryption for the Muse key and the license key.
 *
 * safeStorage is used whenever Chromium's keyring is available. On Linux
 * without a keyring, headless test machines and some desktops report
 * basic_text with encryption unavailable; blocking setup there would break
 * the promise that a seller can install and use the studio. The fallback keeps
 * the key encrypted at rest with a local 32-byte secret and a 0600 file, and
 * Settings shows the basic-protection warning. See DECISIONS.md.
 */
export interface TextCipher {
  encryptString(value: string): string
  decryptString(value: string): string
  backend(): string
  isBasicProtection(): boolean
}

export class SafeTextCipher implements TextCipher {
  private readonly fallbackKeyPath: string
  private fallbackKey: Buffer | null = null

  constructor(private readonly userDataDir: string) {
    this.fallbackKeyPath = path.join(userDataDir, '.local-secret-key')
  }

  backend(): string {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.getSelectedStorageBackend()
      } catch {
        return 'unknown'
      }
    }
    return 'basic_text'
  }

  isBasicProtection(): boolean {
    return !safeStorage.isEncryptionAvailable() || this.backend() === 'basic_text'
  }

  private localKey(): Buffer {
    if (this.fallbackKey) return this.fallbackKey
    try {
      const existing = fs.readFileSync(this.fallbackKeyPath)
      if (existing.length === 32) {
        this.fallbackKey = existing
        return existing
      }
    } catch {
      // Generate below.
    }
    const key = crypto.randomBytes(32)
    fs.mkdirSync(this.userDataDir, { recursive: true, mode: 0o700 })
    fs.writeFileSync(this.fallbackKeyPath, key, { mode: 0o600 })
    fs.chmodSync(this.fallbackKeyPath, 0o600)
    this.fallbackKey = key
    return key
  }

  encryptString(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      return `${SAFE_PREFIX}${encrypted.toString('base64')}`
    }
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.localKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${LOCAL_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`
  }

  decryptString(value: string): string {
    if (value.startsWith(SAFE_PREFIX)) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('keyring_unavailable')
      return safeStorage.decryptString(Buffer.from(value.slice(SAFE_PREFIX.length), 'base64'))
    }
    if (value.startsWith(LOCAL_PREFIX)) {
      const payload = Buffer.from(value.slice(LOCAL_PREFIX.length), 'base64')
      const iv = payload.subarray(0, 12)
      const tag = payload.subarray(12, 28)
      const encrypted = payload.subarray(28)
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.localKey(), iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    }
    // Legacy raw safeStorage data from an older install.
    if (!safeStorage.isEncryptionAvailable()) throw new Error('keyring_unavailable')
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }
}
