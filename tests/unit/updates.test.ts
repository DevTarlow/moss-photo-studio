import { describe, expect, it } from 'vitest'
import { UpdateError, UpdateService } from '@main/updates'

function fetchReturning(response: Response, calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    calls.push(String(input))
    return response
  }) as typeof fetch
}

describe('update check', () => {
  it('returns the latest version and a portal download page', async () => {
    const calls: string[] = []
    const service = new UpdateService({
      baseUrl: 'https://license.test/',
      appSlug: 'moss-photo-studio',
      currentVersion: '1.0.0',
      fetcher: fetchReturning(
        new Response(
          JSON.stringify({
            version: '1.2.0',
            notes: 'Faster sets',
            publishedAt: Date.UTC(2026, 10, 1),
            mandatory: false
          }),
          { status: 200 }
        ),
        calls
      )
    })
    const result = await service.check()
    expect(result.available).toBe(true)
    expect(result.version).toBe('1.2.0')
    expect(result.notes).toBe('Faster sets')
    expect(result.downloadPageUrl).toBe('https://license.test/downloads?app=moss-photo-studio')
    expect(calls[0]).toContain('app=moss-photo-studio')
    expect(calls[0]).toContain('version=1.0.0')
    expect(calls[0]).toContain('channel=stable')
    expect(calls[0]).not.toContain('key=')
    expect(calls[0]).not.toContain('email')
  })

  it('treats 204 as up to date', async () => {
    const service = new UpdateService({
      baseUrl: 'https://license.test',
      appSlug: 'moss-photo-studio',
      fetcher: fetchReturning(new Response(null, { status: 204 }))
    })
    await expect(service.check()).resolves.toMatchObject({ available: false, version: null })
  })

  it('maps a server failure to offline', async () => {
    const service = new UpdateService({
      baseUrl: 'https://license.test',
      appSlug: 'moss-photo-studio',
      fetcher: fetchReturning(new Response('{}', { status: 500 }))
    })
    await expect(service.check()).rejects.toMatchObject({ code: 'offline' })
  })

  it('maps a network failure to offline', async () => {
    const service = new UpdateService({
      baseUrl: 'https://license.test',
      appSlug: 'moss-photo-studio',
      fetcher: (async () => {
        throw new Error('network')
      }) as typeof fetch
    })
    await expect(service.check()).rejects.toBeInstanceOf(UpdateError)
  })

  it('rejects a malformed response', async () => {
    const service = new UpdateService({
      baseUrl: 'https://license.test',
      appSlug: 'moss-photo-studio',
      fetcher: fetchReturning(new Response(JSON.stringify({ version: 42 }), { status: 200 }))
    })
    await expect(service.check()).rejects.toMatchObject({ code: 'unknown' })
  })
})
