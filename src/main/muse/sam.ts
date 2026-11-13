import type { ErrorCode } from '@shared/types'
import type { Logger } from '../logger'
import { decodeMaskToRaster, parseImageStream, recordsOfKind } from '@meta-sam/parser'

export interface SamBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface SamMask {
  raster: Uint8Array
  width: number
  height: number
  bounds: SamBounds
  confidence: number | null
}

export interface SamSuccess {
  ok: true
  mask: SamMask
  costMicros: number
  requestId: string
}

export interface SamFailure {
  ok: false
  code: ErrorCode
  requestId: string
}

export type SamResult = SamSuccess | SamFailure

export interface SamProvider {
  segment(input: { bytes: Buffer; mime: string; concept: string }): Promise<SamResult>
}

function errorCodeFor(status: number): ErrorCode {
  if (status === 401) return 'invalid_key'
  if (status === 402) return 'billing'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_error'
  if (status === 400) return 'invalid_request'
  return 'network'
}

export class MuseSamClient implements SamProvider {
  private readonly apiKey: () => string | null | Promise<string | null>
  private readonly baseUrl: string
  private readonly logger: Logger
  private readonly timeoutMs: number
  private readonly fetcher: typeof fetch

  constructor(options: {
    apiKey: () => string | null | Promise<string | null>
    baseUrl: string
    logger: Logger
    timeoutMs?: number
    fetcher?: typeof fetch
  }) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl
    this.logger = options.logger
    this.timeoutMs = options.timeoutMs ?? 120_000
    this.fetcher = options.fetcher ?? fetch
  }

  async segment(input: { bytes: Buffer; mime: string; concept: string }): Promise<SamResult> {
    const apiKey = await this.apiKey()
    const requestId = crypto.randomUUID()
    if (!apiKey) return { ok: false, code: 'invalid_key', requestId }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs)
    try {
      const response = await this.fetcher(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'x-request-id': requestId
        },
        body: JSON.stringify({
          model: 'sam-3.1',
          stream: true,
          metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
          input: [
            {
              type: 'message',
              role: 'user',
              content: [
                { type: 'input_text', text: input.concept.slice(0, 80) || 'product' },
                { type: 'input_image', image_url: `data:${input.mime};base64,${input.bytes.toString('base64')}` }
              ]
            }
          ]
        }),
        signal: controller.signal
      })
      if (!response.ok || !response.body) {
        this.logger.warn('muse', 'sam_failed', { requestId, status: response.status })
        return { ok: false, code: errorCodeFor(response.status), requestId }
      }
      const events: unknown[] = []
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index = buffer.indexOf('\n')
        while (index >= 0) {
          const line = buffer.slice(0, index).replace(/\r$/, '')
          buffer = buffer.slice(index + 1)
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data !== '[DONE]') {
              try {
                events.push(JSON.parse(data))
              } catch {
                // The parser reports malformed event payloads.
              }
            }
          }
          index = buffer.indexOf('\n')
        }
      }
      async function* source(): AsyncGenerator<{ type: string }> {
        for (const event of events) yield event as { type: string }
      }
      const parsed = parseImageStream(source())
      for await (const _snapshot of parsed) {
        // Consuming the iterable drives the parser; the result is read below.
      }
      const result = await parsed.finalResult
      const masks = recordsOfKind(result.records, 'mask')
      if (!masks.length) {
        this.logger.info('muse', 'sam_no_match', { requestId })
        return { ok: false, code: 'no_match', requestId }
      }
      const chosen = [...masks].sort((a, b) => {
        const areaA = (a.bounds.right - a.bounds.left) * (a.bounds.bottom - a.bounds.top)
        const areaB = (b.bounds.right - b.bounds.left) * (b.bounds.bottom - b.bounds.top)
        if (areaA !== areaB) return areaB - areaA
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      })[0]!
      const confidence = chosen.confidence ?? null
      if (confidence !== null && confidence < 0.35) {
        this.logger.info('muse', 'sam_low_confidence', { requestId })
        return { ok: false, code: 'no_match', requestId }
      }
      this.logger.info('muse', 'sam_finished', { requestId, count: masks.length })
      return {
        ok: true,
        mask: {
          raster: decodeMaskToRaster(chosen.mask),
          width: chosen.mask.width,
          height: chosen.mask.height,
          bounds: chosen.bounds,
          confidence
        },
        // SAM 3.1 is $2.50 per 1,000 images ($0.0025 each).
        costMicros: 2500,
        requestId
      }
    } catch {
      this.logger.warn('muse', 'sam_failed', { requestId, errorCode: 'network' })
      return { ok: false, code: 'network', requestId }
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Deterministic oval cutout for the fake host and E2E. */
export class FakeSamProvider implements SamProvider {
  async segment(input: { bytes: Buffer; mime: string; concept: string }): Promise<SamResult> {
    const sharp = (await import('sharp')).default
    const meta = await sharp(input.bytes).metadata()
    const width = Math.max(32, meta.width ?? 512)
    const height = Math.max(32, meta.height ?? 512)
    const left = Math.round(width * 0.08)
    const top = Math.round(height * 0.08)
    const right = Math.round(width * 0.92)
    const bottom = Math.round(height * 0.92)
    const maskWidth = right - left
    const maskHeight = bottom - top
    const raster = new Uint8Array(maskWidth * maskHeight)
    const cx = maskWidth / 2
    const cy = maskHeight / 2
    const rx = maskWidth * 0.48
    const ry = maskHeight * 0.48
    for (let y = 0; y < maskHeight; y += 1) {
      for (let x = 0; x < maskWidth; x += 1) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) raster[y * maskWidth + x] = 1
      }
    }
    return {
      ok: true,
      requestId: crypto.randomUUID(),
      costMicros: 2500,
      mask: {
        raster,
        width: maskWidth,
        height: maskHeight,
        bounds: { left, top, right, bottom },
        confidence: 0.99
      }
    }
  }
}
