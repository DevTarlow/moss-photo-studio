import fs from 'node:fs'
import path from 'node:path'
import type { TextCipher } from '../secretCipher'
import type { ErrorCode, LicenseState } from '@shared/types'
import { LICENSE_GRACE_DAYS, LICENSE_GRACE_DAYS as GRACE } from '@shared/constants'
import type { LicenseRepository, LicenseRow } from '../db/repositories/license'
import type { Logger } from '../logger'
import type { LicenseProvider, LicenseProviderError } from './provider'
import { machineIdentity } from './machine'

const DAY = 24 * 60 * 60 * 1000
const GRACE_MS = LICENSE_GRACE_DAYS * DAY

export class LicenseError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
    this.name = 'LicenseError'
  }
}

interface LicenseFile {
  version: 1
  keyEnc: string | null
  instanceId: string | null
  machineLabel: string | null
  status: string
  activatedAt: number | null
  lastValidatedAt: number | null
  source: string
}

const providerCodeToError = (code: LicenseProviderError): ErrorCode => {
  if (code === 'license_limit') return 'license_limit'
  if (code === 'license_offline') return 'license_offline'
  if (code === 'license_invalid') return 'license_invalid'
  return 'unknown'
}

export class LicenseController {
  private readonly repo: LicenseRepository
  private readonly provider: LicenseProvider
  private readonly clock: () => number
  private readonly file: string
  private readonly logger: Logger
  private readonly devUnlock: boolean
  private readonly machineLabel: string
  private readonly cipher: TextCipher
  private readonly listeners = new Set<(state: LicenseState) => void>()

  constructor(options: {
    repo: LicenseRepository
    provider: LicenseProvider
    userDataDir: string
    clock?: () => number
    logger: Logger
    devUnlock?: boolean
    cipher: TextCipher
  }) {
    this.repo = options.repo
    this.provider = options.provider
    this.clock = options.clock ?? (() => Date.now())
    this.file = path.join(options.userDataDir, 'license.json')
    this.logger = options.logger
    this.devUnlock = Boolean(options.devUnlock)
    this.cipher = options.cipher
    this.machineLabel = machineIdentity(options.userDataDir).label
    this.recoverFromFile()
  }

  onChange(listener: (state: LicenseState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): LicenseState {
    const state = this.state()
    for (const listener of this.listeners) listener(state)
    return state
  }

  private recoverFromFile(): void {
    if (this.repo.getRow()) return
    try {
      if (!fs.existsSync(this.file)) return
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<LicenseFile>
      if (!parsed || typeof parsed !== 'object' || !parsed.keyEnc || !parsed.instanceId) return
      this.repo.save({
        keyEnc: parsed.keyEnc,
        instanceId: parsed.instanceId,
        machineLabel: parsed.machineLabel ?? this.machineLabel,
        status: parsed.status ?? 'licensed',
        activatedAt: parsed.activatedAt ?? null,
        lastValidatedAt: parsed.lastValidatedAt ?? null,
        source: parsed.source ?? 'lemon'
      })
      this.logger.info('license', 'recovered_from_file')
    } catch {
      this.logger.warn('license', 'recovery_file_unreadable')
    }
  }

  private writeFile(row: LicenseRow | null): void {
    if (!row) {
      fs.rmSync(this.file, { force: true })
      return
    }
    const payload: LicenseFile = {
      version: 1,
      keyEnc: row.key_enc,
      instanceId: row.instance_id,
      machineLabel: row.machine_label,
      status: row.status,
      activatedAt: row.activated_at,
      lastValidatedAt: row.last_validated_at,
      source: row.source
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 })
      const temp = `${this.file}.tmp`
      fs.writeFileSync(temp, JSON.stringify(payload), { mode: 0o600 })
      fs.renameSync(temp, this.file)
    } catch {
      this.logger.warn('license', 'recovery_file_write_failed')
    }
  }

  private decryptKey(row: LicenseRow | null): string | null {
    if (!row?.key_enc) return null
    try {
      return this.cipher.decryptString(row.key_enc)
    } catch {
      return null
    }
  }

  private last4(key: string | null): string | null {
    return key ? key.slice(-4) : null
  }

  private devState(): LicenseState {
    return {
      status: 'licensed',
      source: 'dev',
      machineLabel: this.machineLabel,
      keyLast4: null,
      lastValidatedAt: this.clock(),
      offlineUntil: null,
      message: null
    }
  }

  state(): LicenseState {
    if (this.devUnlock) return this.devState()
    const row = this.repo.getRow()
    if (!row || !row.key_enc || !row.instance_id) {
      return {
        status: 'unlicensed',
        source: null,
        machineLabel: this.machineLabel,
        keyLast4: null,
        lastValidatedAt: null,
        offlineUntil: null,
        message: null
      }
    }
    const now = this.clock()
    const key = this.decryptKey(row)
    const last = row.last_validated_at
    const offlineUntil = last ? last + GRACE_MS : null
    const rolledBack = last !== null && now < last - DAY
    const graceEnded = last !== null && now - last > GRACE_MS
    const source = row.source === 'dev' ? 'dev' : 'lemon'
    if (rolledBack) {
      return {
        status: 'expired',
        source,
        machineLabel: row.machine_label ?? this.machineLabel,
        keyLast4: this.last4(key),
        lastValidatedAt: last,
        offlineUntil,
        message: 'The clock on this computer moved backwards. Connect to the internet and check the license.'
      }
    }
    if (graceEnded || row.status === 'expired') {
      return {
        status: 'expired',
        source,
        machineLabel: row.machine_label ?? this.machineLabel,
        keyLast4: this.last4(key),
        lastValidatedAt: last,
        offlineUntil,
        message:
          row.status === 'expired' && !graceEnded
            ? "Meta says this license is no longer active. Buy a license or contact support."
            : "It's been 14 days since the last check. Connect to the internet and press Activate to keep using the studio."
      }
    }
    if (row.status === 'grace') {
      return {
        status: 'grace',
        source,
        machineLabel: row.machine_label ?? this.machineLabel,
        keyLast4: this.last4(key),
        lastValidatedAt: last,
        offlineUntil,
        message: "Working offline. License checks resume when you're connected."
      }
    }
    if (row.status === 'licensed') {
      return {
        status: 'licensed',
        source,
        machineLabel: row.machine_label ?? this.machineLabel,
        keyLast4: this.last4(key),
        lastValidatedAt: last,
        offlineUntil,
        message: null
      }
    }
    return {
      status: 'unlicensed',
      source: null,
      machineLabel: this.machineLabel,
      keyLast4: this.last4(key),
      lastValidatedAt: last,
      offlineUntil,
      message: null
    }
  }

  canGenerate(): boolean {
    const status = this.state().status
    return status === 'licensed' || status === 'grace'
  }

  private save(input: {
    keyEnc: string | null
    instanceId: string | null
    machineLabel: string | null
    status: string
    activatedAt: number | null
    lastValidatedAt: number | null
    source: string
  }): void {
    this.repo.save(input)
    this.writeFile(this.repo.getRow())
  }

  async validateOnLaunch(): Promise<LicenseState> {
    if (this.devUnlock) return this.state()
    const row = this.repo.getRow()
    if (!row || !row.last_validated_at) return this.state()
    if (this.clock() - row.last_validated_at < DAY) return this.state()
    return this.validate()
  }

  async validate(): Promise<LicenseState> {
    if (this.devUnlock) return this.state()
    const row = this.repo.getRow()
    const key = this.decryptKey(row)
    if (!row || !row.instance_id || !key) {
      return this.state()
    }
    const outcome = await this.provider.validate({ key, instanceId: row.instance_id })
    const now = this.clock()
    if (outcome.ok) {
      this.save({
        ...rowToSave(row),
        status: 'licensed',
        lastValidatedAt: now
      })
      this.logger.info('license', 'validated')
      return this.emit()
    }
    if (outcome.code === 'license_offline') {
      const last = row.last_validated_at
      const withinGrace =
        last !== null && now >= last - DAY && now - last <= GRACE_MS
      this.save({
        ...rowToSave(row),
        status: withinGrace ? 'grace' : 'expired'
      })
      this.logger.info('license', 'validation_offline', { errorCode: 'license_offline' })
      return this.emit()
    }
    this.save({
      ...rowToSave(row),
      status: 'expired'
    })
    this.logger.warn('license', 'validation_rejected', { errorCode: providerCodeToError(outcome.code) })
    return this.emit()
  }

  async activate(key: string): Promise<LicenseState> {
    const trimmed = key.trim()
    if (!trimmed) throw new LicenseError('license_invalid')
    const outcome = await this.provider.activate({ key: trimmed, instanceName: this.machineLabel })
    if (!outcome.ok) throw new LicenseError(providerCodeToError(outcome.code))
    if (outcome.status !== 'active') throw new LicenseError('license_invalid')
    const encrypted = this.cipher.encryptString(trimmed)
    const now = this.clock()
    this.save({
      keyEnc: encrypted,
      instanceId: outcome.instanceId,
      machineLabel: this.machineLabel,
      status: 'licensed',
      activatedAt: now,
      lastValidatedAt: now,
      source: 'lemon'
    })
    this.logger.info('license', 'activated')
    return this.emit()
  }

  async deactivate(): Promise<LicenseState> {
    if (this.devUnlock) return this.state()
    const row = this.repo.getRow()
    const key = this.decryptKey(row)
    if (!row || !row.instance_id || !key) {
      this.repo.clear()
      this.writeFile(null)
      return this.emit()
    }
    const outcome = await this.provider.deactivate({ key, instanceId: row.instance_id })
    if (!outcome.ok) throw new LicenseError(providerCodeToError(outcome.code))
    this.repo.clear()
    this.writeFile(null)
    this.logger.info('license', 'deactivated')
    return this.emit()
  }
}

function rowToSave(row: LicenseRow): {
  keyEnc: string | null
  instanceId: string | null
  machineLabel: string | null
  activatedAt: number | null
  lastValidatedAt: number | null
  source: string
} {
  return {
    keyEnc: row.key_enc,
    instanceId: row.instance_id,
    machineLabel: row.machine_label,
    activatedAt: row.activated_at,
    lastValidatedAt: row.last_validated_at,
    source: row.source
  }
}

export const GRACE_DAYS = GRACE
