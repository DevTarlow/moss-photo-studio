import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import { LicenseRepository } from '@main/db/repositories/license'
import { LicenseController } from '@main/license/controller'
import type { LicenseProvider, ActivateOutcome, DeactivateOutcome, ValidateOutcome } from '@main/license/provider'
import { Logger } from '@main/logger'
import type { TextCipher } from '@main/secretCipher'

const cipher: TextCipher = {
  encryptString: async (value) => `test:${Buffer.from(value).toString('base64')}`,
  decryptString: async (value) => ({
    value: Buffer.from(value.replace(/^test:/, ''), 'base64').toString('utf8'),
    reencrypted: null
  }),
  backend: async () => 'test',
  isBasicProtection: async () => false
}

class StubProvider implements LicenseProvider {
  mode: 'active' | 'offline' | 'invalid' = 'active'
  instance = 'instance-1'
  deactivated = false
  async activate(): Promise<ActivateOutcome> {
    if (this.mode === 'offline') return { ok: false, code: 'license_offline' }
    if (this.mode === 'invalid') return { ok: false, code: 'license_invalid' }
    return { ok: true, instanceId: this.instance, status: 'active' }
  }
  async validate(): Promise<ValidateOutcome> {
    if (this.mode === 'offline') return { ok: false, code: 'license_offline' }
    if (this.mode === 'invalid') return { ok: false, code: 'license_invalid' }
    return { ok: true, status: 'active' }
  }
  async deactivate(): Promise<DeactivateOutcome> {
    if (this.mode === 'offline') return { ok: false, code: 'license_offline' }
    this.deactivated = true
    return { ok: true }
  }
}

let dir = ''
let db: ReturnType<typeof openDatabase>
let now = Date.UTC(2026, 10, 1)
let provider: StubProvider
let controller: LicenseController

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-license-'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: new Logger(path.join(dir, 'logs')) })
  provider = new StubProvider()
  now = Date.UTC(2026, 10, 1)
  controller = new LicenseController({
    repo: new LicenseRepository(db),
    provider,
    userDataDir: dir,
    clock: () => now,
    logger: new Logger(path.join(dir, 'logs')),
    cipher
  })
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

const day = 24 * 60 * 60 * 1000

describe('license state machine', () => {
  it('starts unlicensed', async () => {
    expect((await controller.state()).status).toBe('unlicensed')
    expect(await controller.canGenerate()).toBe(false)
  })

  it('activates and validates online', async () => {
    const state = await controller.activate('MOSS-TEST-KEY')
    expect(state.status).toBe('licensed')
    expect(state.keyLast4).toBe('-KEY')
    expect(await controller.canGenerate()).toBe(true)
    expect(fs.existsSync(path.join(dir, 'license.json'))).toBe(true)
  })

  it('moves to grace when offline within fourteen days', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.mode = 'offline'
    now += 13 * day
    const state = await controller.validate()
    expect(state.status).toBe('grace')
    expect(await controller.canGenerate()).toBe(true)
  })

  it('expires after fourteen days offline', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.mode = 'offline'
    now += 15 * day
    const state = await controller.validate()
    expect(state.status).toBe('expired')
    expect(await controller.canGenerate()).toBe(false)
    expect(state.message).toContain('14 days')
  })

  it('rejects an invalid validation as expired', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.mode = 'invalid'
    now += day
    const state = await controller.validate()
    expect(state.status).toBe('expired')
  })

  it('rejects a clock that moves back more than a day', async () => {
    await controller.activate('MOSS-TEST-KEY')
    now -= 2 * day
    const state = await controller.state()
    expect(state.status).toBe('expired')
    expect(state.message).toMatch(/clock/i)
  })

  it('validates at most once per twenty four hours on launch', async () => {
    await controller.activate('MOSS-TEST-KEY')
    let calls = 0
    const original = provider.validate.bind(provider)
    provider.validate = async () => { calls += 1; return original() }
    now += 2 * 60 * 60 * 1000
    await controller.validateOnLaunch()
    expect(calls).toBe(0)
    now += 25 * 60 * 60 * 1000
    await controller.validateOnLaunch()
    expect(calls).toBe(1)
  })

  it('deactivates and returns to unlicensed', async () => {
    await controller.activate('MOSS-TEST-KEY')
    const state = await controller.deactivate()
    expect(state.status).toBe('unlicensed')
    expect(provider.deactivated).toBe(true)
    expect(fs.existsSync(path.join(dir, 'license.json'))).toBe(false)
  })

  it('recovers from license.json if the table is empty', async () => {
    await controller.activate('MOSS-TEST-KEY')
    db.prepare('DELETE FROM license').run()
    const recovered = new LicenseController({
      repo: new LicenseRepository(db),
      provider,
      userDataDir: dir,
      clock: () => now,
      logger: new Logger(path.join(dir, 'logs')),
      cipher
    })
    expect((await recovered.state()).status).toBe('licensed')
  })
})
