import type {
  ActivateOutcome,
  DeactivateOutcome,
  LicenseProvider,
  LicenseProviderError,
  ValidateOutcome
} from './provider'

interface LemonOptions {
  baseUrl: string
  fetcher?: typeof fetch
  activateTimeoutMs?: number
  validateTimeoutMs?: number
  deactivateTimeoutMs?: number
}

interface JsonRecord {
  [key: string]: unknown
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {}
}

function storeError(message: string): LicenseProviderError {
  const text = message.toLowerCase()
  if (text.includes('no available activations') || text.includes('activation limit') || text.includes('limit reached')) {
    return 'license_limit'
  }
  if (text.includes('not found') || text.includes('invalid') || text.includes('expired') || text.includes('disabled') || text.includes('inactive')) {
    return 'license_invalid'
  }
  return 'unknown'
}

async function postForm(
  url: string,
  fields: Record<string, string>,
  timeoutMs: number,
  fetcher: typeof fetch
): Promise<{ status: number; body: JsonRecord }> {
  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(timeoutMs)
    })
    const text = await response.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    return { status: response.status, body: asRecord(parsed) }
  } catch {
    return { status: 0, body: {} }
  }
}

export class LemonSqueezyProvider implements LicenseProvider {
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch
  private readonly activateTimeoutMs: number
  private readonly validateTimeoutMs: number
  private readonly deactivateTimeoutMs: number

  constructor(options: LemonOptions) {
    this.baseUrl = options.baseUrl
    this.fetcher = options.fetcher ?? fetch
    this.activateTimeoutMs = options.activateTimeoutMs ?? 15_000
    this.validateTimeoutMs = options.validateTimeoutMs ?? 10_000
    this.deactivateTimeoutMs = options.deactivateTimeoutMs ?? 10_000
  }

  async activate(input: { key: string; instanceName: string }): Promise<ActivateOutcome> {
    const result = await postForm(
      `${this.baseUrl}/v1/licenses/activate`,
      { license_key: input.key, instance_name: input.instanceName },
      this.activateTimeoutMs,
      this.fetcher
    )
    if (result.status === 0) return { ok: false, code: 'license_offline' }
    if (!result.status.toString().startsWith('2')) {
      const error = String(result.body.error ?? '')
      return { ok: false, code: storeError(error) }
    }
    if (result.body.activated !== true) {
      return { ok: false, code: storeError(String(result.body.error ?? 'activation failed')) }
    }
    const instance = asRecord(result.body.instance)
    const license = asRecord(result.body.license_key)
    const instanceId = typeof instance.id === 'string' || typeof instance.id === 'number' ? String(instance.id) : ''
    if (!instanceId) return { ok: false, code: 'unknown' }
    return {
      ok: true,
      instanceId,
      status: typeof license.status === 'string' ? license.status : 'active'
    }
  }

  async validate(input: { key: string; instanceId: string }): Promise<ValidateOutcome> {
    const result = await postForm(
      `${this.baseUrl}/v1/licenses/validate`,
      { license_key: input.key, instance_id: input.instanceId },
      this.validateTimeoutMs,
      this.fetcher
    )
    if (result.status === 0) return { ok: false, code: 'license_offline' }
    if (!result.status.toString().startsWith('2')) {
      return { ok: false, code: storeError(String(result.body.error ?? '')) }
    }
    const license = asRecord(result.body.license_key)
    const status = typeof license.status === 'string' ? license.status : ''
    if (result.body.valid !== true) {
      return { ok: false, code: status === 'expired' || status === 'disabled' ? 'license_invalid' : 'license_invalid' }
    }
    if (status && status !== 'active') {
      return { ok: false, code: 'license_invalid' }
    }
    return { ok: true, status: status || 'active' }
  }

  async deactivate(input: { key: string; instanceId: string }): Promise<DeactivateOutcome> {
    const result = await postForm(
      `${this.baseUrl}/v1/licenses/deactivate`,
      { license_key: input.key, instance_id: input.instanceId },
      this.deactivateTimeoutMs,
      this.fetcher
    )
    if (result.status === 0) return { ok: false, code: 'license_offline' }
    if (!result.status.toString().startsWith('2')) {
      return { ok: false, code: storeError(String(result.body.error ?? '')) }
    }
    if (result.body.deactivated === true) return { ok: true }
    return { ok: false, code: 'unknown' }
  }
}
