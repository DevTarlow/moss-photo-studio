import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLicense } from '../fake-license/server'
import { LemonSqueezyProvider } from '@main/license/lemonsqueezy'

let server: Awaited<ReturnType<typeof startFakeLicense>>
let provider: LemonSqueezyProvider

beforeAll(async () => {
  server = await startFakeLicense()
  provider = new LemonSqueezyProvider({ baseUrl: server.baseUrl })
})
afterAll(async () => server.close())
beforeEach(() => server.reset())

describe('Lemon Squeezy license provider', () => {
  it('activates, validates, and deactivates a real store-shaped key', async () => {
    const activated = await provider.activate({ key: 'MOSS-KEY-1', instanceName: 'linux-test-12345678' })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.instanceId).toMatch(/^instance-/)
    const validated = await provider.validate({ key: 'MOSS-KEY-1', instanceId: activated.instanceId })
    expect(validated).toEqual({ ok: true, status: 'active' })
    expect(await provider.deactivate({ key: 'MOSS-KEY-1', instanceId: activated.instanceId })).toEqual({ ok: true })
    expect(server.instances()).toHaveLength(0)
  })

  it('maps an unknown key to invalid', async () => {
    expect(await provider.activate({ key: 'bad', instanceName: 'test' })).toMatchObject({ ok: false, code: 'license_invalid' })
  })

  it('surfaces the two-machine activation limit from the store', async () => {
    expect((await provider.activate({ key: 'MOSS-KEY-2', instanceName: 'one' })).ok).toBe(true)
    expect((await provider.activate({ key: 'MOSS-KEY-2', instanceName: 'two' })).ok).toBe(true)
    expect(await provider.activate({ key: 'MOSS-KEY-2', instanceName: 'three' })).toMatchObject({ ok: false, code: 'license_limit' })
  })

  it('maps a down server or timeout to offline, never invalid', async () => {
    server.control('down')
    expect(await provider.activate({ key: 'MOSS-KEY-3', instanceName: 'one' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.validate({ key: 'MOSS-KEY-3', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.deactivate({ key: 'MOSS-KEY-3', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
  })

  it('maps a store server error to offline, never invalid', async () => {
    server.control('server-error')
    expect(await provider.activate({ key: 'MOSS-KEY-5', instanceName: 'one' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.validate({ key: 'MOSS-KEY-5', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.deactivate({ key: 'MOSS-KEY-5', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
  })

  it('maps expired and disabled statuses to invalid', async () => {
    server.control('expired')
    const result = await provider.activate({ key: 'MOSS-KEY-4', instanceName: 'one' })
    expect(result).toMatchObject({ ok: false, code: 'license_invalid' })
    const activated = await provider.activate({ key: 'MOSS-KEY-4', instanceName: 'one' })
    expect(activated).toMatchObject({ ok: false, code: 'license_invalid' })
    server.control('active')
    const active = await provider.activate({ key: 'MOSS-KEY-4', instanceName: 'one' })
    expect(active.ok).toBe(true)
    if (!active.ok) return
    server.control('expired')
    expect(await provider.validate({ key: 'MOSS-KEY-4', instanceId: active.instanceId })).toMatchObject({ ok: false, code: 'license_invalid' })
  })
})
