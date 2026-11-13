import type {
  ActivateOutcome,
  DeactivateOutcome,
  LicenseProvider,
  LicenseProviderError,
  ValidateOutcome
} from './provider'

interface MossOptions {
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

function isTransient(status: number): boolean {
  return status === 0 || status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500
}

function bodyError(body: JsonRecord): LicenseProviderError {
  const code = String(body.error ?? '').toLowerCase()
  if (code === 'activation_limit') return 'license_limit'
  if (code === 'license_expired' || code === 'license_revoked' || code === 'invalid_key') {
    return 'license_invalid'
  }
  return 'unknown'
}

/**
 * The portal's errors are deliberate: only an explicit rejection may reach the
 * controller as an invalid license. A portal outage, edge auth failure, or
 * throttle is offline so the 14 day grace window still applies.
 */
function httpFailure(status: number, body: JsonRecord): LicenseProviderError {
  if (status === 409) return 'license_limit'
  if (isTransient(status)) return 'license_offline'
  if (status === 400 || status === 404 || status === 410 || status === 422) {
    const mapped = bodyError(body)
    return mapped === 'unknown' ? 'license_invalid' : mapped
  }
  return 'license_offline'
}

async function postJson(
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields),
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

export class MossLicenseProvider implements LicenseProvider {
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch
  private readonly activateTimeoutMs: number
  private readonly validateTimeoutMs: number
  private readonly deactivateTimeoutMs: number

  constructor(options: MossOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.fetcher = options.fetcher ?? fetch
    this.activateTimeoutMs = options.activateTimeoutMs ?? 15_000
    this.validateTimeoutMs = options.validateTimeoutMs ?? 10_000
    this.deactivateTimeoutMs = options.deactivateTimeoutMs ?? 10_000
  }

  async activate(input: { key: string; instanceName: string }): Promise<ActivateOutcome> {
    const result = await postJson(
      `${this.baseUrl}/api/v1/licenses/activate`,
      { key: input.key, instance_name: input.instanceName },
      this.activateTimeoutMs,
      this.fetcher
    )
    if (!result.status.toString().startsWith('2')) {
      return { ok: false, code: httpFailure(result.status, result.body) }
    }
    if (result.body.activated !== true) {
      const code = bodyError(result.body)
      return { ok: false, code: code === 'unknown' ? 'license_invalid' : code }
    }
    const instance = asRecord(result.body.instance)
    const license = asRecord(result.body.license)
    const instanceId = typeof instance.id === 'string' ? instance.id : ''
    if (!instanceId) return { ok: false, code: 'unknown' }
    const status = typeof license.status === 'string' ? license.status : 'active'
    if (status !== 'active') return { ok: false, code: 'license_invalid' }
    return { ok: true, instanceId, status }
  }

  async validate(input: { key: string; instanceId: string }): Promise<ValidateOutcome> {
    const result = await postJson(
      `${this.baseUrl}/api/v1/licenses/validate`,
      { key: input.key, instance_id: input.instanceId },
      this.validateTimeoutMs,
      this.fetcher
    )
    if (!result.status.toString().startsWith('2')) {
      return { ok: false, code: httpFailure(result.status, result.body) }
    }
    if (result.body.valid === true) {
      const license = asRecord(result.body.license)
      const status = typeof license.status === 'string' ? license.status : 'active'
      return { ok: true, status }
    }
    if (result.body.valid === false) return { ok: false, code: 'license_invalid' }
    return { ok: false, code: 'unknown' }
  }

  async deactivate(input: { key: string; instanceId: string }): Promise<DeactivateOutcome> {
    const result = await postJson(
      `${this.baseUrl}/api/v1/licenses/deactivate`,
      { key: input.key, instance_id: input.instanceId },
      this.deactivateTimeoutMs,
      this.fetcher
    )
    if (!result.status.toString().startsWith('2')) {
      return { ok: false, code: httpFailure(result.status, result.body) }
    }
    if (result.body.deactivated === true) return { ok: true }
    return { ok: false, code: 'unknown' }
  }
}
