import { APP_VERSION } from '@shared/constants'
import type { UpdateCheckResult } from '@shared/types'

export class UpdateError extends Error {
  constructor(readonly code: 'offline' | 'unknown') {
    super(
      code === 'offline'
        ? 'Could not reach the license center. Check your connection and try again.'
        : 'Could not check for updates. Try again later.'
    )
    this.name = 'UpdateError'
  }
}

interface UpdateOptions {
  baseUrl: string
  appSlug: string
  currentVersion?: string
  channel?: string
  fetcher?: typeof fetch
  timeoutMs?: number
}

/**
 * Manual update check. Sends the product, platform, architecture, channel, and
 * current version only; no install id, license key, email, or library data.
 * The app never downloads or installs anything automatically.
 */
export class UpdateService {
  private readonly baseUrl: string
  private readonly appSlug: string
  private readonly currentVersion: string
  private readonly channel: string
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  constructor(options: UpdateOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.appSlug = options.appSlug
    this.currentVersion = options.currentVersion ?? APP_VERSION
    this.channel = options.channel ?? 'stable'
    this.fetcher = options.fetcher ?? fetch
    this.timeoutMs = options.timeoutMs ?? 8_000
  }

  async check(): Promise<UpdateCheckResult> {
    const query = new URLSearchParams({
      app: this.appSlug,
      platform: process.platform,
      arch: process.arch,
      channel: this.channel,
      version: this.currentVersion
    })
    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}/api/v1/releases/latest?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs)
      })
    } catch {
      throw new UpdateError('offline')
    }

    const downloadPageUrl = new URL(
      `/downloads?app=${encodeURIComponent(this.appSlug)}`,
      `${this.baseUrl}/`
    ).toString()

    if (response.status === 204) {
      return {
        available: false,
        version: null,
        notes: null,
        publishedAt: null,
        mandatory: false,
        downloadPageUrl
      }
    }
    if (!response.ok) throw new UpdateError(response.status >= 500 || response.status === 429 ? 'offline' : 'unknown')

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new UpdateError('unknown')
    }
    if (!payload || typeof payload !== 'object') throw new UpdateError('unknown')
    const record = payload as Record<string, unknown>
    if (typeof record.version !== 'string' || !record.version.trim()) throw new UpdateError('unknown')
    return {
      available: true,
      version: record.version,
      notes: typeof record.notes === 'string' ? record.notes : null,
      publishedAt: typeof record.publishedAt === 'number' ? record.publishedAt : null,
      mandatory: record.mandatory === true,
      downloadPageUrl
    }
  }
}
