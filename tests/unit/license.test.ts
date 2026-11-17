import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import { LicenseRepository } from '@main/db/repositories/license'
import { LicenseController } from '@main/license/controller'
import { machineIdentity, type MachineIdentity } from '@main/license/machine'
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

const machineA: MachineIdentity = { machineId: 'machine-a', fingerprint: 'aaaaaaaaaaaa', label: 'linux-aaaaaaaaaaaa' }
const machineB: MachineIdentity = { machineId: 'machine-b', fingerprint: 'bbbbbbbbbbbb', label: 'linux-bbbbbbbbbbbb' }

class StubProvider implements LicenseProvider {
  mode: 'active' | 'offline' | 'invalid' = 'active'
  product: string | null = 'moss-photo-studio'
  instance = 'instance-1'
  deactivated = false
  activations = 0
  validations = 0
  async activate(): Promise<ActivateOutcome> {
    this.activations += 1
    if (this.mode === 'offline') return { ok: false, code: 'license_offline' }
    if (this.mode === 'invalid') return { ok: false, code: 'license_invalid' }
    return { ok: true, instanceId: this.instance, status: 'active', product: this.product }
  }
  async validate(): Promise<ValidateOutcome> {
    this.validations += 1
    if (this.mode === 'offline') return { ok: false, code: 'license_offline' }
    if (this.mode === 'invalid') return { ok: false, code: 'license_invalid' }
    return { ok: true, status: 'active', product: this.product }
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

function makeController(machine: MachineIdentity = machineA, cipherOverride: TextCipher = cipher): LicenseController {
  return new LicenseController({
    repo: new LicenseRepository(db),
    provider,
    userDataDir: dir,
    clock: () => now,
    logger: new Logger(path.join(dir, 'logs')),
    cipher: cipherOverride,
    machine
  })
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-license-'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: new Logger(path.join(dir, 'logs')) })
  provider = new StubProvider()
  now = Date.UTC(2026, 10, 1)
  controller = makeController()
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
    expect(await controller.canUseStudio()).toBe(false)
  })

  it('activates and validates online', async () => {
    const state = await controller.activate('MOSS-TEST-KEY')
    expect(state.status).toBe('licensed')
    expect(state.keyLast4).toBe('-KEY')
    expect(await controller.canGenerate()).toBe(true)
    expect(await controller.canUseStudio()).toBe(true)
    expect(fs.existsSync(path.join(dir, 'license.json'))).toBe(true)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'license.json'), 'utf8'))
    expect(saved.version).toBe(2)
    expect(saved.machineFingerprint).toBe(machineA.fingerprint)
  })

  it('rejects a valid key issued for another app', async () => {
    provider.product = 'moss-video'
    await expect(controller.activate('MOSS-OTHER-APP')).rejects.toMatchObject({ code: 'license_invalid' })
    expect((await controller.state()).status).toBe('unlicensed')
    expect(await controller.canUseStudio()).toBe(false)
  })

  it('accepts a missing product from an older portal', async () => {
    provider.product = null
    expect((await controller.activate('MOSS-TEST-KEY')).status).toBe('licensed')
  })

  it('turns a validation for another app into an expired license', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.product = 'moss-video'
    now += day
    expect((await controller.validate()).status).toBe('expired')
    expect(await controller.canUseStudio()).toBe(false)
  })

  it('moves to grace when offline within fourteen days', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.mode = 'offline'
    now += 13 * day
    const state = await controller.validate()
    expect(state.status).toBe('grace')
    expect(await controller.canGenerate()).toBe(true)
    expect(await controller.canUseStudio()).toBe(true)
  })

  it('expires after fourteen days offline', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.mode = 'offline'
    now += 15 * day
    const state = await controller.validate()
    expect(state.status).toBe('expired')
    expect(await controller.canGenerate()).toBe(false)
    expect(await controller.canUseStudio()).toBe(false)
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

  it('does not report a license when the stored key cannot be decrypted', async () => {
    await controller.activate('MOSS-TEST-KEY')
    const failingCipher: TextCipher = {
      ...cipher,
      decryptString: async () => {
        throw new Error('no keyring')
      }
    }
    const unreadable = makeController(machineA, failingCipher)
    const state = await unreadable.state()
    expect(state.status).toBe('unlicensed')
    expect(state.message).toMatch(/could not be read/i)
    expect(await unreadable.canGenerate()).toBe(false)
  })

  it('builds a machine label without the hostname', () => {
    const identity = machineIdentity(dir)
    expect(identity.label).toMatch(/^[a-z0-9]+-[0-9a-f]{12}$/)
    expect('hostname' in identity).toBe(false)
  })

  it('refuses a license copied to another computer', async () => {
    await controller.activate('MOSS-TEST-KEY')
    provider.validations = 0
    const copied = makeController(machineB)
    const state = await copied.state()
    expect(state.status).toBe('unlicensed')
    expect(state.message).toMatch(/another computer/i)
    expect(await copied.canUseStudio()).toBe(false)
    expect((await copied.validate()).status).toBe('unlicensed')
    expect(provider.validations).toBe(0)
  })

  it('lets the key claim a seat on the second computer', async () => {
    await controller.activate('MOSS-TEST-KEY')
    const second = makeController(machineB)
    const state = await second.activate('MOSS-TEST-KEY')
    expect(state.status).toBe('licensed')
    expect((await second.state()).machineLabel).toBe(machineB.label)
  })

  it('recovers a version 1 file by adopting this machine', async () => {
    fs.writeFileSync(
      path.join(dir, 'license.json'),
      JSON.stringify({
        version: 1,
        keyEnc: await cipher.encryptString('MOSS-OLD-FILE'),
        instanceId: 'instance-old',
        machineLabel: 'linux-old',
        status: 'licensed',
        activatedAt: now,
        lastValidatedAt: now,
        source: 'moss'
      })
    )
    const recovered = makeController(machineA)
    expect((await recovered.state()).status).toBe('licensed')
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'license.json'), 'utf8'))
    expect(saved.machineFingerprint).toBe(machineA.fingerprint)
  })

  it('does not recover a version 2 file from another computer', async () => {
    fs.writeFileSync(
      path.join(dir, 'license.json'),
      JSON.stringify({
        version: 2,
        keyEnc: await cipher.encryptString('MOSS-COPIED-FILE'),
        instanceId: 'instance-copied',
        machineLabel: machineB.label,
        machineFingerprint: machineB.fingerprint,
        status: 'licensed',
        activatedAt: now,
        lastValidatedAt: now,
        source: 'moss'
      })
    )
    const recovered = makeController(machineA)
    expect((await recovered.state()).status).toBe('unlicensed')
    expect(fs.existsSync(path.join(dir, 'license.json'))).toBe(false)
  })

  it('recovers from license.json if the table is empty', async () => {
    await controller.activate('MOSS-TEST-KEY')
    db.prepare('DELETE FROM license').run()
    const recovered = makeController(machineA)
    expect((await recovered.state()).status).toBe('licensed')
  })
})
