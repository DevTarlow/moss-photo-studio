import type { Db } from './db/connection'
import type {
  DensitySetting,
  ExportOptions,
  SettingsAll,
  ThemeSetting,
  WindowState,
  Format,
  Shape
} from '@shared/types'

export const SETTING_KEYS = [
  'deviceId',
  'theme',
  'density',
  'onboardingStep',
  'onboardingDone',
  'onboardingDismissed',
  'setupDismissed',
  'firstRunConfirmShown',
  'concurrency',
  'budgetCents',
  'defaultFormat',
  'defaultShape',
  'lastProjectId',
  'libraryPath',
  'exportDefaults',
  'exportFolders',
  'windowState',
  'licenseGraceNotified',
  'reduceMotion',
  'lastBackupAt',
  'lastBackupDir',
  'lastDiagnosticsDir'
] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export class SettingsStore {
  constructor(private readonly db: Db) {}

  private raw(key: SettingKey): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  get<T>(key: SettingKey, fallback: T): T {
    const rawValue = this.raw(key)
    if (rawValue === null) return fallback
    try {
      return JSON.parse(rawValue) as T
    } catch {
      return fallback
    }
  }

  set(key: SettingKey, value: unknown): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  libraryPath(fallback: string): string {
    return this.get<string>('libraryPath', fallback)
  }

  deviceId(): string {
    return this.get<string>('deviceId', '')
  }

  budgetCents(): number | null {
    const value = this.get<number | null>('budgetCents', 1000)
    if (value === null) return null
    if (!Number.isFinite(value) || value < 0) return 1000
    return Math.round(value)
  }

  exportDefaults(): ExportOptions {
    return this.get<ExportOptions>('exportDefaults', {
      // JPEG is the broadly compatible default for shop uploads.
      format: 'jpeg',
      quality: 90,
      maxDimension: null
    })
  }

  exportFolders(): Record<string, string> {
    return this.get<Record<string, string>>('exportFolders', {})
  }

  exportFolderFor(projectId: string): string | null {
    const folders = this.exportFolders()
    const value = folders[projectId]
    return typeof value === 'string' ? value : null
  }

  rememberExportFolder(projectId: string, folder: string): void {
    const folders = this.exportFolders()
    this.set('exportFolders', { ...folders, [projectId]: folder })
  }

  windowState(): WindowState | null {
    return this.get<WindowState | null>('windowState', null)
  }

  all(): SettingsAll {
    const exportDefaults = this.exportDefaults()
    const theme = this.get<ThemeSetting>('theme', 'light')
    const density = this.get<DensitySetting>('density', 'comfortable')
    const defaultFormat = this.get<Format>('defaultFormat', 'webp')
    const defaultShape = this.get<Shape>('defaultShape', 'square')
    const reduceMotion = this.get<'system' | 'reduce' | 'full'>('reduceMotion', 'system')
    return {
      theme: ['system', 'light', 'dark'].includes(theme) ? theme : 'light',
      density: density === 'compact' ? 'compact' : 'comfortable',
      onboardingStep: this.get<number>('onboardingStep', 0),
      onboardingDone: this.get<boolean>('onboardingDone', false),
      onboardingDismissed: this.get<boolean>('onboardingDismissed', false),
      setupDismissed: this.get<boolean>('setupDismissed', false),
      firstRunConfirmShown: this.get<boolean>('firstRunConfirmShown', false),
      concurrency: Math.max(1, Math.min(4, this.get<number>('concurrency', 2))),
      budgetCents: this.budgetCents(),
      defaultFormat: ['webp', 'jpeg', 'png'].includes(defaultFormat) ? defaultFormat : 'webp',
      defaultShape: ['square', 'portrait', 'landscape'].includes(defaultShape) ? defaultShape : 'square',
      lastProjectId: this.get<string | null>('lastProjectId', null),
      libraryPath: this.get<string>('libraryPath', ''),
      exportDefaults: {
        ...exportDefaults,
        format: ['webp', 'jpeg', 'png'].includes(exportDefaults?.format) ? exportDefaults.format : defaultFormat,
        quality: Math.max(60, Math.min(100, exportDefaults?.quality ?? 90)),
        maxDimension: exportDefaults?.maxDimension ?? null
      },
      windowState: this.windowState(),
      licenseGraceNotified: this.get<boolean>('licenseGraceNotified', false),
      reduceMotion: ['system', 'reduce', 'full'].includes(reduceMotion) ? reduceMotion : 'system',
      lastBackupAt: this.get<number | null>('lastBackupAt', null)
    }
  }
}
