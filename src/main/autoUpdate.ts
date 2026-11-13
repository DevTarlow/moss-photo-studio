import type { AutoUpdateState } from '@shared/types'

type UpdaterListener = (...args: unknown[]) => void

export interface AutoUpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  on(event: string, listener: UpdaterListener): unknown
}

interface AutoUpdateOptions {
  supported: boolean
  currentVersion: string
  downloadPageUrl: string
  updater?: AutoUpdaterLike
}

function notesOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!Array.isArray(value)) return null
  const parts = value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object' && 'note' in item) {
        const note = (item as { note?: unknown }).note
        if (typeof note === 'string') return note.trim()
      }
      return ''
    })
    .filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}

function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim().slice(0, 240) || 'Could not check for updates.'
}

/**
 * Wraps electron-updater so the main process can expose a small named IPC
 * surface. Updates download in the background and install only when the user
 * chooses Restart. The updater never runs in development or in a test build.
 */
export class AutoUpdateService {
  private readonly supported: boolean
  private readonly currentVersion: string
  private readonly downloadPageUrl: string
  private readonly updater: AutoUpdaterLike | null
  private readonly listeners = new Set<(state: AutoUpdateState) => void>()
  private stateValue: AutoUpdateState

  constructor(options: AutoUpdateOptions) {
    this.supported = options.supported
    this.currentVersion = options.currentVersion
    this.downloadPageUrl = options.downloadPageUrl
    this.updater = options.supported ? options.updater ?? null : null
    this.stateValue = {
      supported: options.supported,
      status: options.supported ? 'idle' : 'unsupported',
      currentVersion: options.currentVersion,
      version: null,
      notes: null,
      progress: null,
      error: null,
      canInstall: false,
      downloadPageUrl: options.downloadPageUrl
    }

    if (!this.updater) return
    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = true
    this.updater.on('checking-for-update', () => {
      this.set({ status: 'checking', error: null, progress: null })
    })
    this.updater.on('update-available', (info) => {
      const record = (info ?? {}) as { version?: unknown; releaseNotes?: unknown }
      this.set({
        status: 'available',
        version: typeof record.version === 'string' ? record.version : null,
        notes: notesOf(record.releaseNotes),
        progress: 0,
        error: null
      })
    })
    this.updater.on('update-not-available', () => {
      this.set({
        status: 'idle',
        version: null,
        notes: null,
        progress: null,
        error: null
      })
    })
    this.updater.on('download-progress', (info) => {
      const record = (info ?? {}) as { percent?: unknown }
      const percent = typeof record.percent === 'number' && Number.isFinite(record.percent)
        ? Math.max(0, Math.min(100, record.percent))
        : null
      this.set({ status: 'downloading', progress: percent, error: null })
    })
    this.updater.on('update-downloaded', (info) => {
      const record = (info ?? {}) as { version?: unknown; releaseNotes?: unknown }
      this.set({
        status: 'ready',
        version: typeof record.version === 'string' ? record.version : this.stateValue.version,
        notes: notesOf(record.releaseNotes) ?? this.stateValue.notes,
        progress: 100,
        error: null,
        canInstall: true
      })
    })
    this.updater.on('error', (error) => {
      this.fail(error)
    })
  }

  state(): AutoUpdateState {
    return { ...this.stateValue }
  }

  subscribe(listener: (state: AutoUpdateState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async check(): Promise<AutoUpdateState> {
    if (!this.supported || !this.updater) return this.state()
    if (this.stateValue.status === 'checking' || this.stateValue.status === 'downloading' || this.stateValue.status === 'ready') return this.state()
    this.set({ status: 'checking', error: null, progress: null, canInstall: false })
    try {
      await this.updater.checkForUpdates()
    } catch (error) {
      this.fail(error)
    }
    return this.state()
  }

  install(): { ok: boolean } {
    if (!this.updater || this.stateValue.status !== 'ready') return { ok: false }
    this.updater.quitAndInstall(false, true)
    return { ok: true }
  }

  private fail(error: unknown): void {
    const message = messageOf(error)
    this.set({
      status: 'error',
      error: message,
      progress: null,
      canInstall: false
    })
  }

  private set(patch: Partial<AutoUpdateState>): void {
    this.stateValue = { ...this.stateValue, ...patch }
    const snapshot = this.state()
    for (const listener of this.listeners) listener(snapshot)
  }
}
