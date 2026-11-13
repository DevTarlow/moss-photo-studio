import type { ErrorCode } from '@shared/types'
import type { Logger } from '../logger'

export interface TextRequest {
  system: string
  user: string
  image?: { mime: string; bytes: Buffer }
}

export interface TextSuccess {
  ok: true
  content: string
  costMicros: number
  requestId: string
}

export interface TextFailure {
  ok: false
  code: ErrorCode
  status: number
  requestId: string
}

export type TextResult = TextSuccess | TextFailure

export interface TextProvider {
  generate(input: TextRequest): Promise<TextResult>
}

function errorCodeFor(status: number, body: unknown): ErrorCode {
  if (status === 401) return 'invalid_key'
  if (status === 402) return 'billing'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_error'
  if (status === 400) {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const error = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : record
    const code = String(error.code ?? error.type ?? '')
    if (code === 'content_policy_violation' || code === 'content_policy') return 'content_policy'
    return 'invalid_request'
  }
  return 'network'
}

export class MuseTextClient implements TextProvider {
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

  async generate(input: TextRequest): Promise<TextResult> {
    const apiKey = await this.apiKey()
    const requestId = crypto.randomUUID()
    if (!apiKey) return { ok: false, code: 'invalid_key', status: 0, requestId }
    const content = input.image
      ? [
          { type: 'text', text: input.user },
          {
            type: 'image_url',
            image_url: { url: `data:${input.image.mime};base64,${input.image.bytes.toString('base64')}` }
          }
        ]
      : input.user
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs)
    const started = Date.now()
    try {
      const response = await this.fetcher(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-request-id': requestId
        },
        body: JSON.stringify({
          model: 'muse-ember-1.0',
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content }
          ],
          max_tokens: 3000
        }),
        signal: controller.signal
      })
      const text = await response.text()
      let parsed: unknown = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = null
      }
      const durationMs = Date.now() - started
      if (!response.ok) {
        const code = errorCodeFor(response.status, parsed)
        this.logger.warn('muse', 'text_failed', { requestId, status: response.status, errorCode: code, durationMs })
        return { ok: false, code, status: response.status, requestId }
      }
      const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
      const choices = Array.isArray(record.choices) ? record.choices : []
      const first = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : null
      const message = first && first.message && typeof first.message === 'object' ? (first.message as Record<string, unknown>) : null
      const answer = typeof message?.content === 'string' ? message.content : ''
      if (!answer.trim()) {
        this.logger.warn('muse', 'text_empty', { requestId, status: response.status, durationMs })
        return { ok: false, code: 'provider_error', status: response.status, requestId }
      }
      const usage = record.usage && typeof record.usage === 'object' ? (record.usage as Record<string, unknown>) : {}
      const promptTokens = Number(usage.prompt_tokens) || 0
      const completionTokens = Number(usage.completion_tokens) || 0
      // Muse Ember: $0.10 / 1M input tokens, $0.50 / 1M output tokens.
      const costMicros = Math.max(0, Math.ceil(promptTokens * 0.1 + completionTokens * 0.5))
      this.logger.info('muse', 'text_finished', {
        requestId,
        status: response.status,
        durationMs,
        count: completionTokens
      })
      return { ok: true, content: answer, costMicros, requestId }
    } catch {
      this.logger.warn('muse', 'text_failed', { requestId, errorCode: 'network', durationMs: Date.now() - started })
      return { ok: false, code: 'network', status: 0, requestId }
    } finally {
      clearTimeout(timer)
    }
  }
}

function field(text: string, label: string): string {
  const match = new RegExp(`${label}:\\s*([^\\n]+)`, 'i').exec(text)
  return match?.[1]?.trim() ?? 'a handmade product'
}

/** Deterministic stand-in used by the fake host and E2E. */
export class FakeTextProvider implements TextProvider {
  async generate(input: TextRequest): Promise<TextResult> {
    const product = field(input.user, 'Product')
    return {
      ok: true,
      requestId: crypto.randomUUID(),
      costMicros: 0,
      content: JSON.stringify({
        titles: [
          `${product} - hand finished in small batches`,
          `${product} for a calm, considered home`,
          `${product} - a quiet everyday favourite`
        ],
        description: `${product} is made in small batches with the details that matter. The piece in the photo is the piece you receive; every listing is checked by hand before it ships.`,
        features: [
          'Made by hand in small batches',
          'The exact product is shown in the photo',
          'Packed with care for the trip',
          'A considered everyday object',
          'Easy to care for'
        ],
        tags: ['handmade', 'small batch', product.toLowerCase().slice(0, 20), 'gift', 'everyday']
      })
    }
  }
}
