import http from 'node:http'
import crypto from 'node:crypto'
import sharp from 'sharp'

export type MuseScenario = 'normal' | 'policy' | '401' | '429' | '503' | 'short-count' | 'slow' | 'offline' | `fail-indexes:${string}`
export interface MuseRequestLog { method: string; path: string; body: Record<string, unknown> | null; scenario: string; at: number }

const COLORS = ['#3D4A38', '#9A3412', '#14532D', '#5A4A3A', '#2F4858', '#6B4F3A']

async function placeholder(prompt: string, index: number, width: number, height: number, format: string): Promise<Buffer> {
  const stamp = prompt.slice(0, 40).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${COLORS[index % COLORS.length]}"/><text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.18)}" font-family="sans-serif" font-size="22" fill="#FAF7F2" fill-opacity="0.65">FAKE MUSE</text><text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.5)}" font-family="sans-serif" font-size="32" fill="#FAF7F2">${stamp}</text><text x="${Math.round(width * 0.08)}" y="${height - Math.round(height * 0.08)}" font-family="sans-serif" font-size="18" fill="#FAF7F2" fill-opacity="0.55">${width} x ${height}</text></svg>`)
  const base = sharp(svg)
  if (format === 'jpeg') return base.jpeg({ quality: 85 }).toBuffer()
  if (format === 'png') return base.png().toBuffer()
  return base.webp({ quality: 85 }).toBuffer()
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export async function startFakeMuse(options: { delayMs?: number; slowMs?: number } = {}) {
  let scenario: MuseScenario = 'normal'
  let imageRequestNumber = 0
  let rateLimitAttempts = 0
  let requests: MuseRequestLog[] = []
  const delayMs = options.delayMs ?? 25
  const slowMs = options.slowMs ?? 2500
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/__control' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { scenario?: MuseScenario }
      scenario = body.scenario ?? 'normal'
      imageRequestNumber = 0
      rateLimitAttempts = 0
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, scenario })); return
    }
    if (url.pathname === '/__requests') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(requests)); return }
    if (url.pathname === '/__reset') { scenario = 'normal'; imageRequestNumber = 0; rateLimitAttempts = 0; requests = []; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return }
    const headerScenario = req.headers['x-muse-scenario']
    const activeScenario = (Array.isArray(headerScenario) ? headerScenario[0] : headerScenario) ?? scenario
    if (url.pathname === '/v1/models') {
      if (activeScenario === 'offline') { res.destroy(); return }
      if (activeScenario === '401') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"invalid_api_key"}}'); return }
      await new Promise((r) => setTimeout(r, 10))
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ object: 'list', data: [{ id: 'muse-image-1.0', object: 'model' }] })); return
    }
    if (req.method === 'POST' && (url.pathname === '/v1/images/generations' || url.pathname === '/v1/images/edits')) {
      let body: Record<string, unknown>
      try { body = JSON.parse(await readBody(req)) as Record<string, unknown> } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"invalid_request"}}'); return }
      imageRequestNumber += 1
      const currentNumber = imageRequestNumber
      requests.push({ method: req.method, path: url.pathname, body, scenario: activeScenario, at: Date.now() })
      if (activeScenario === 'offline') { res.destroy(); return }
      if (activeScenario === 'policy') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"content_policy_violation","message":"blocked"}}'); return }
      if (activeScenario === '401') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"invalid_api_key"}}'); return }
      if (activeScenario === '429') {
        rateLimitAttempts += 1
        if (rateLimitAttempts <= 2) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' }); res.end('{"error":{"code":"rate_limit_exceeded"}}'); return }
      }
      if (activeScenario === '503') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"service_unavailable"}}'); return }
      if (activeScenario.startsWith('fail-indexes:')) {
        const indexes = activeScenario.slice(13).split(',').map((value) => Number(value.trim()))
        if (indexes.includes(currentNumber)) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"internal_error"}}'); return }
      }
      await new Promise((r) => setTimeout(r, activeScenario === 'slow' ? slowMs : delayMs))
      const prompt = String(body.prompt ?? '')
      const outputFormat = ['jpeg', 'png', 'webp'].includes(String(body.output_format)) ? String(body.output_format) : 'webp'
      const [width, height] = String(body.size ?? '1024x1024').split('x').map(Number) as [number, number]
      let count = url.pathname.endsWith('/edits') ? 1 : Number(body.n ?? 1)
      if (activeScenario === 'short-count') count = Math.max(0, count - 2)
      const data: Array<Record<string, unknown>> = []
      for (let index = 0; index < count; index += 1) {
        data.push({ b64_json: (await placeholder(prompt, index, width, height, outputFormat)).toString('base64'), revised_prompt: `A revised prompt for image ${index + 1}` })
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'x-request-id': crypto.randomUUID() })
      res.end(JSON.stringify({ created: Math.floor(Date.now() / 1000), data, output_format: outputFormat, background: 'opaque', usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"not_found"}}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake Muse did not bind')
  return {
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    control: (next: MuseScenario) => { scenario = next; imageRequestNumber = 0; rateLimitAttempts = 0 },
    requests: () => requests,
    reset: () => { scenario = 'normal'; imageRequestNumber = 0; rateLimitAttempts = 0; requests = [] }
  }
}
