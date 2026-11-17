import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLicense } from '../fake-license/server'
import { MossLicenseProvider } from '@main/license/moss'

let server: Awaited<ReturnType<typeof startFakeLicense>>
let provider: MossLicenseProvider

beforeAll(async () => {
  server = await startFakeLicense()
  provider = new MossLicenseProvider({ baseUrl: server.baseUrl })
})
afterAll(async () => server.close())
beforeEach(() => server.reset())

describe('Moss license portal provider', () => {
  it('activates, validates, and deactivates a real portal-shaped key', async () => {
    const activated = await provider.activate({ key: 'MOSS-E2E-VALID-KEY', instanceName: 'linux-test-12345678' })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.instanceId).toMatch(/^instance-/)
    expect(activated.product).toBe('moss-photo-studio')
    const validated = await provider.validate({ key: 'MOSS-E2E-VALID-KEY', instanceId: activated.instanceId })
    expect(validated).toEqual({ ok: true, status: 'active', product: 'moss-photo-studio' })
    expect(await provider.deactivate({ key: 'MOSS-E2E-VALID-KEY', instanceId: activated.instanceId })).toEqual({ ok: true })
    expect(server.instances()).toHaveLength(0)
  })

  it('maps an unknown key to invalid', async () => {
    expect(await provider.activate({ key: 'bad', instanceName: 'test' })).toMatchObject({ ok: false, code: 'license_invalid' })
  })

  it('surfaces the two-machine activation limit from the portal', async () => {
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

  it('maps a portal server error to offline, never invalid', async () => {
    server.control('server-error')
    expect(await provider.activate({ key: 'MOSS-KEY-5', instanceName: 'one' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.validate({ key: 'MOSS-KEY-5', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
    expect(await provider.deactivate({ key: 'MOSS-KEY-5', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_offline' })
  })

  it('maps expired and revoked statuses to invalid', async () => {
    server.control('expired')
    expect(await provider.activate({ key: 'MOSS-KEY-4', instanceName: 'one' })).toMatchObject({ ok: false, code: 'license_invalid' })
    expect(await provider.validate({ key: 'MOSS-KEY-4', instanceId: 'x' })).toMatchObject({ ok: false, code: 'license_invalid' })
  })

  it('sends the key only in the JSON body, never the URL', async () => {
    await provider.activate({ key: 'MOSS-KEY-6', instanceName: 'one' })
    const request = server.requests().at(-1)
    expect(request?.path).toBe('/api/v1/licenses/activate')
    expect(request?.path).not.toContain('MOSS-KEY-6')
    expect(request?.json.key).toBe('MOSS-KEY-6')
    expect(request?.json.app_slug).toBe('moss-photo-studio')
  })

  it('returns the product so the app can reject a key for another app', async () => {
    server.control('foreign-product')
    const activated = await provider.activate({ key: 'MOSS-KEY-7', instanceName: 'one' })
    expect(activated).toMatchObject({ ok: false, code: 'license_invalid' })
  })
})
