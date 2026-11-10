import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'

const SAFE_PREFIX = 'MOSS1:safe:'
const LOCAL_PREFIX = 'MOSS1:local:'

export interface DecryptedText {
  value: string
  /**
   * A fresh ciphertext when the OS key provider rotated or upgraded the
   * encryption. Callers persist it so the next read starts on the new key.
   */
  reencrypted: string | null
}

/**
 * Text encryption for the Muse key and the license key.
 *
 * safeStorage is used whenever Chromium's keyring is available. The app uses
 * the asynchronous API because Electron 45 deprecates the blocking methods and
 * removes them in Electron 46; it also reports when stored data should be
 * re-encrypted after a key rotation. On Linux without a keyring, headless test
 * machines and some desktops can report encryption unavailable; blocking setup
 * there would break the promise that a seller can install and use the studio.
 * The fallback keeps the key encrypted at rest with a local 32-byte secret and
 * a 0600 file, and Settings shows the basic-protection warning. See
 * DECISIONS.md.
 */
export interface TextCipher {
  encryptString(value: string): Promise<string>
  decryptString(value: string): Promise<DecryptedText>
  backend(): Promise<string>
  isBasicProtection(): Promise<boolean>
}

export class SafeTextCipher implements TextCipher {
  private readonly fallbackKeyPath: string
  private fallbackKey: Buffer | null = null
  private encryptionAvailable = false

  constructor(private readonly userDataDir: string) {
    this.fallbackKeyPath = path.join(userDataDir, '.local-secret-key')
  }

  private async available(): Promise<boolean> {
    if (this.encryptionAvailable) return true
    try {
      // The async encryptor initializes lazily after app ready. Do not cache a
      // false result: a call before ready should not disable the keyring for
      // the rest of the session.
      this.encryptionAvailable = await safeStorage.isAsyncEncryptionAvailable()
    } catch {
      this.encryptionAvailable = false
    }
    return this.encryptionAvailable
  }

  async backend(): Promise<string> {
    if (await this.available()) {
      try {
        return safeStorage.getSelectedStorageBackend()
      } catch {
        return 'unknown'
      }
    }
    return 'basic_text'
  }

  async isBasicProtection(): Promise<boolean> {
    return !(await this.available()) || (await this.backend()) === 'basic_text'
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

  async encryptString(value: string): Promise<string> {
    if (await this.available()) {
      const encrypted = await safeStorage.encryptStringAsync(value)
      return `${SAFE_PREFIX}${encrypted.toString('base64')}`
    }
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.localKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${LOCAL_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`
  }

  private async decryptSafe(encrypted: Buffer): Promise<DecryptedText> {
    const decrypted = await safeStorage.decryptStringAsync(encrypted)
    if (!decrypted.shouldReEncrypt) return { value: decrypted.result, reencrypted: null }
    const upgraded = await safeStorage.encryptStringAsync(decrypted.result)
    return { value: decrypted.result, reencrypted: `${SAFE_PREFIX}${upgraded.toString('base64')}` }
  }

  async decryptString(value: string): Promise<DecryptedText> {
    if (value.startsWith(SAFE_PREFIX)) {
      if (!(await this.available())) throw new Error('keyring_unavailable')
      return this.decryptSafe(Buffer.from(value.slice(SAFE_PREFIX.length), 'base64'))
    }
    if (value.startsWith(LOCAL_PREFIX)) {
      const payload = Buffer.from(value.slice(LOCAL_PREFIX.length), 'base64')
      const iv = payload.subarray(0, 12)
      const tag = payload.subarray(12, 28)
      const encrypted = payload.subarray(28)
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.localKey(), iv)
      decipher.setAuthTag(tag)
      return {
        value: Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'),
        reencrypted: null
      }
    }
    // Legacy raw safeStorage data from an older install.
    if (!(await this.available())) throw new Error('keyring_unavailable')
    return this.decryptSafe(Buffer.from(value, 'base64'))
  }
}
