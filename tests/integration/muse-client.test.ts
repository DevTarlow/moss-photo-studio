import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { startFakeMuse } from '../fake-muse/server'
import { MuseClient } from '@main/muse/client'
import { Logger } from '@main/logger'

let server: Awaited<ReturnType<typeof startFakeMuse>>
let dir = ''
let logger: Logger

beforeAll(async () => {
  server = await startFakeMuse({ delayMs: 5 })
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-muse-'))
  logger = new Logger(dir)
})
afterAll(async () => {
  await server.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
beforeEach(() => server.reset())

function client(): MuseClient {
  return new MuseClient({
    apiKey: () => 'LLM|integration-key-never-log',
    userId: () => '11111111-1111-4111-8111-111111111111',
    baseUrl: server.baseUrl,
    logger
  })
}

const shape = 'square' as const
const format = 'webp' as const

describe('Muse client requests', () => {
  it('generates exactly the documented body and returns b64 images', async () => {
    const result = await client().generate({ prompt: 'a test product', count: 4, shape, format })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.images).toHaveLength(4)
    expect(result.returnedCount).toBe(4)
    expect(result.outputFormat).toBe('webp')
    const request = server.requests()[0]!
    expect(request.path).toBe('/v1/images/generations')
    expect(request.body).toMatchObject({
      model: 'muse-image-1.0',
      prompt: 'a test product',
      n: 4,
      size: '1024x1024',
      response_format: 'b64_json',
      output_format: 'webp',
      reasoning_strength: 'high',
      tool_enablement: { enable_shell: false },
      user: '11111111-1111-4111-8111-111111111111'
    })
    expect(request.body).not.toHaveProperty('moderation')
    expect(request.body).not.toHaveProperty('images')
  })

  it('edits with one or two data URLs and never sends n', async () => {
    const images = await Promise.all([
      sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } } }).webp().toBuffer(),
      sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 4, g: 5, b: 6 } } }).webp().toBuffer()
    ])
    const result = await client().edit({ prompt: 'hold it', images, shape: 'portrait', format: 'jpeg' })
    expect(result.ok).toBe(true)
    const request = server.requests()[0]!
    expect(request.body).not.toBeNull()
    const body = request.body!
    const bodyImages = body.images as Array<{ image_url: string }>
    expect(bodyImages).toHaveLength(2)
    expect(bodyImages[0]!.image_url.startsWith('data:image/webp;base64,')).toBe(true)
    expect(body).not.toHaveProperty('n')
    expect(body).toMatchObject({ size: '1024x1536', output_format: 'jpeg' })
  })

  it('maps 401 without retrying', async () => {
    server.control('401')
    const result = await client().generate({ prompt: 'x', count: 1, shape, format })
    expect(result).toMatchObject({ ok: false, code: 'invalid_key', status: 401 })
    expect(server.requests()).toHaveLength(1)
  })

  it('maps a policy refusal to content_policy', async () => {
    server.control('policy')
    const result = await client().generate({ prompt: 'x', count: 1, shape, format })
    expect(result).toMatchObject({ ok: false, code: 'content_policy' })
    expect(server.requests()).toHaveLength(1)
  })

  it('does not retry 503', async () => {
    server.control('503')
    const result = await client().generate({ prompt: 'x', count: 1, shape, format })
    expect(result).toMatchObject({ ok: false, code: 'provider_error', status: 503 })
    expect(server.requests()).toHaveLength(1)
  })

  it('retries a 429 and can succeed on the third attempt', async () => {
    server.control('429')
    const result = await client().generate({ prompt: 'retry me', count: 1, shape, format })
    expect(result.ok).toBe(true)
    expect(server.requests()).toHaveLength(3)
  })

  it('treats a network drop as uncertain and not retried', async () => {
    server.control('offline')
    const result = await client().generate({ prompt: 'x', count: 1, shape, format })
    expect(result).toMatchObject({ ok: false, code: 'network' })
    expect(server.requests()).toHaveLength(1)
  })

  it('reports fewer images as a partial success', async () => {
    server.control('short-count')
    const result = await client().generate({ prompt: 'x', count: 4, shape, format })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.images).toHaveLength(2)
    expect(result.returnedCount).toBe(2)
  })

  it('validates keys without spending an image', async () => {
    expect(await client().validateKey()).toEqual({ ok: true })
    server.control('401')
    expect(await client().validateKey()).toMatchObject({ ok: false, code: 'invalid_key' })
    expect(server.requests()).toHaveLength(0)
  })

  it('never writes the key or the prompt into its logs', async () => {
    await client().generate({ prompt: 'A secret prompt phrase', count: 1, shape, format })
    const contents = fs.readFileSync(path.join(dir, 'main.log'), 'utf8')
    expect(contents).not.toContain('LLM|integration-key-never-log')
    expect(contents).not.toContain('A secret prompt phrase')
    expect(contents).toContain('request_finished')
  })
})
