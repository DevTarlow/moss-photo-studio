import { describe, expect, it } from 'vitest'
import { MuseTextClient } from '@main/muse/text'
import { Logger } from '@main/logger'

function logger(): Logger {
  return new Logger('/tmp/moss-muse-text-logs')
}

function fetcher(status: number, body: unknown, ok = status >= 200 && status < 300): typeof fetch {
  return (async () => ({
    ok,
    status,
    text: async () => JSON.stringify(body)
  })) as unknown as typeof fetch
}

describe('Muse text client', () => {
  it('reads a chat completion and estimates the token cost in micros', async () => {
    const client = new MuseTextClient({
      apiKey: () => 'LLM|test',
      baseUrl: 'https://api.meta.ai/v1',
      logger: logger(),
      fetcher: fetcher(200, {
        choices: [{ message: { content: '{"titles":["A mug"]}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 }
      })
    })
    const result = await client.generate({ system: 'json', user: 'write' })
    expect(result).toMatchObject({ ok: true, content: '{"titles":["A mug"]}', costMicros: 110 })
  })

  it('maps a key failure and an empty answer without pretending they worked', async () => {
    const keyed = new MuseTextClient({
      apiKey: () => 'LLM|test',
      baseUrl: 'https://api.meta.ai/v1',
      logger: logger(),
      fetcher: fetcher(401, { error: { type: 'invalid_request_error' } }, false)
    })
    expect(await keyed.generate({ system: 'json', user: 'write' })).toMatchObject({ ok: false, code: 'invalid_key' })
    const empty = new MuseTextClient({
      apiKey: () => 'LLM|test',
      baseUrl: 'https://api.meta.ai/v1',
      logger: logger(),
      fetcher: fetcher(200, { choices: [{ message: { content: null } }] })
    })
    expect(await empty.generate({ system: 'json', user: 'write' })).toMatchObject({ ok: false, code: 'provider_error' })
  })

  it('sends a product image as a data URL when one is attached', async () => {
    let body: { messages: Array<{ content: unknown }> } | null = null
    const capture = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body)) as { messages: Array<{ content: unknown }> }
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }
    }) as unknown as typeof fetch
    const client = new MuseTextClient({
      apiKey: () => 'LLM|test',
      baseUrl: 'https://api.meta.ai/v1',
      logger: logger(),
      fetcher: capture
    })
    await client.generate({
      system: 'json',
      user: 'write',
      image: { mime: 'image/webp', bytes: Buffer.from('bytes') }
    })
    expect(JSON.stringify(body!.messages)).toContain('data:image/webp;base64,')
  })
})
