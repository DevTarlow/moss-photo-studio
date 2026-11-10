import type { ErrorCode } from '@shared/types'
import { MUSE_BASE_URL, MUSE_MODEL, REQUEST_TIMEOUT_MS, VALIDATE_TIMEOUT_MS } from '@shared/constants'
import type { Format } from '@shared/types'
import { sizeForShape, type Shape } from '@shared/shapes'
import type { Logger } from '../logger'

export interface MuseSuccess {
  ok: true
  images: Buffer[]
  returnedCount: number
  outputFormat: Format
  revisedPrompts: Array<string | null>
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null
  requestId: string
  status: number
}

export interface MuseFailure {
  ok: false
  code: ErrorCode
  status: number
  retryAfter?: number
  requestId: string
}

export type MuseResult = MuseSuccess | MuseFailure

export interface MuseClientOptions {
  apiKey: () => string | null | Promise<string | null>
  userId: () => string
  baseUrl?: string
  fetcher?: typeof fetch
  logger: Logger
  now?: () => number
  timeoutMs?: number
}

interface RawImage {
  b64_json?: unknown
  revised_prompt?: unknown
}

interface RawResponse {
  created?: unknown
  data?: unknown
  output_format?: unknown
  usage?: unknown
}

function parseUsage(value: unknown): MuseSuccess['usage'] {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    inputTokens: Number(record.input_tokens) || 0,
    outputTokens: Number(record.output_tokens) || 0,
    totalTokens: Number(record.total_tokens) || 0
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

function errorCodeFor(status: number, body: unknown): ErrorCode {
  if (status === 401) return 'invalid_key'
  if (status === 402) return 'billing'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'misconfigured'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_error'
  if (status === 400) {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const error = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : record
    const code = String(error.code ?? error.type ?? record.code ?? '')
    if (code === 'content_policy_violation' || code === 'content_policy') return 'content_policy'
    if (code === 'unsupported_parameter') return 'app_bug'
    return 'invalid_request'
  }
  return 'network'
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const abort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

export class MuseClient {
  private readonly apiKey: () => string | null | Promise<string | null>
  private readonly userId: () => string
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch
  private readonly logger: Logger
  private readonly timeoutMs: number

  constructor(options: MuseClientOptions) {
    this.apiKey = options.apiKey
    this.userId = options.userId
    this.baseUrl = options.baseUrl ?? MUSE_BASE_URL
    this.fetcher = options.fetcher ?? fetch
    this.logger = options.logger
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  }

  async validateKey(key?: string): Promise<{ ok: true } | { ok: false; code: ErrorCode; status: number }> {
    const apiKey = key ?? (await this.apiKey())
    if (!apiKey) return { ok: false, code: 'no_key', status: 0 }
    try {
      const response = await this.fetcher(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS)
      })
      if (response.ok) return { ok: true }
      return { ok: false, code: errorCodeFor(response.status, null), status: response.status }
    } catch {
      return { ok: false, code: 'network', status: 0 }
    }
  }

  async generate(input: {
    prompt: string
    count: number
    shape: Shape
    format: Format
    signal?: AbortSignal
    onRateLimitWait?: (waitMs: number) => void
  }): Promise<MuseResult> {
    return this.request(
      'generations',
      {
        model: MUSE_MODEL,
        prompt: input.prompt,
        n: input.count,
        size: sizeForShape(input.shape),
        response_format: 'b64_json',
        output_format: input.format,
        reasoning_strength: 'high',
        tool_enablement: { enable_shell: false },
        user: this.userId()
      },
      input.count,
      input.format,
      input.signal,
      input.onRateLimitWait
    )
  }

  async edit(input: {
    prompt: string
    images: Buffer[]
    shape: Shape
    format: Format
    signal?: AbortSignal
    onRateLimitWait?: (waitMs: number) => void
  }): Promise<MuseResult> {
    return this.request(
      'edits',
      {
        model: MUSE_MODEL,
        prompt: input.prompt,
        images: input.images.map((bytes) => ({
          image_url: `data:image/webp;base64,${bytes.toString('base64')}`
        })),
        size: sizeForShape(input.shape),
        response_format: 'b64_json',
        output_format: input.format,
        reasoning_strength: 'high',
        tool_enablement: { enable_shell: false },
        user: this.userId()
      },
      1,
      input.format,
      input.signal,
      input.onRateLimitWait
    )
  }

  private async request(
    endpoint: 'generations' | 'edits',
    body: Record<string, unknown>,
    expected: number,
    format: Format,
    externalSignal?: AbortSignal,
    onRateLimitWait?: (waitMs: number) => void
  ): Promise<MuseResult> {
    const apiKey = await this.apiKey()
    const requestId = crypto.randomUUID()
    if (!apiKey) return { ok: false, code: 'no_key', status: 0, requestId }
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const start = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs)
      let callerAborted = false
      const onExternalAbort = (): void => {
        callerAborted = true
        controller.abort(new DOMException('Aborted', 'AbortError'))
      }
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
      if (externalSignal?.aborted) onExternalAbort()
      try {
        const response = await this.fetcher(`${this.baseUrl}/images/${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-request-id': requestId
          },
          body: JSON.stringify(body),
          signal: controller.signal
        })
        const text = await response.text()
        let parsed: unknown = null
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = null
        }
        const durationMs = Date.now() - start
        this.logger.info('muse', 'request_finished', {
          requestId,
          status: response.status,
          durationMs,
          count: expected,
          errorCode: response.ok ? undefined : errorCodeFor(response.status, parsed)
        })
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
          if (attempt < maxAttempts) {
            const backoff = Math.min(2000, 500 * 2 ** (attempt - 1))
            const jitter = Math.floor(Math.random() * 200)
            const waitMs = retryAfter ?? backoff + jitter
            onRateLimitWait?.(waitMs)
            await wait(waitMs, externalSignal)
            onRateLimitWait?.(0)
            continue
          }
          return { ok: false, code: 'rate_limited', status: 429, retryAfter, requestId }
        }
        if (!response.ok) {
          return { ok: false, code: errorCodeFor(response.status, parsed), status: response.status, requestId }
        }
        const record = (parsed ?? {}) as RawResponse
        if (!Array.isArray(record.data)) {
          this.logger.warn('muse', 'malformed_response', {
            requestId,
            status: response.status,
            errorCode: 'provider_error'
          })
          return { ok: false, code: 'provider_error', status: response.status, requestId }
        }
        const rawItems = record.data as RawImage[]
        const images: Buffer[] = []
        const revisedPrompts: Array<string | null> = []
        for (const item of rawItems) {
          if (typeof item?.b64_json !== 'string' || !item.b64_json) continue
          const decoded = Buffer.from(item.b64_json, 'base64')
          if (!decoded.length) continue
          images.push(decoded)
          revisedPrompts.push(typeof item.revised_prompt === 'string' ? item.revised_prompt : null)
        }
        const returnedCount = images.length
        if (returnedCount === 0) {
          return { ok: false, code: 'provider_error', status: response.status, requestId }
        }
        const limited = images.slice(0, expected)
        const limitedPrompts = revisedPrompts.slice(0, expected)
        const reportedFormat = record.output_format
        const resolvedFormat: Format =
          reportedFormat === 'jpeg' || reportedFormat === 'png' || reportedFormat === 'webp'
            ? reportedFormat
            : format
        return {
          ok: true,
          images: limited,
          returnedCount,
          outputFormat: resolvedFormat,
          revisedPrompts: limitedPrompts,
          usage: parseUsage(record.usage),
          requestId,
          status: response.status
        }
      } catch (error) {
        const durationMs = Date.now() - start
        const aborted = callerAborted || (error instanceof DOMException && error.name === 'AbortError')
        if (aborted && externalSignal?.aborted) {
          this.logger.info('muse', 'request_aborted', { requestId, durationMs, errorCode: 'aborted' })
          return { ok: false, code: 'aborted', status: 0, requestId }
        }
        this.logger.warn('muse', 'request_network_failed', {
          requestId,
          durationMs,
          errorCode: 'network'
        })
        return { ok: false, code: 'network', status: 0, requestId }
      } finally {
        clearTimeout(timer)
        externalSignal?.removeEventListener('abort', onExternalAbort)
      }
    }
    return { ok: false, code: 'rate_limited', status: 429, requestId }
  }
}
