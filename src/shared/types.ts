import type { Format, Shape } from './shapes'
export type { Format, Shape } from './shapes'

export type ProjectType = 'set' | 'photo' | 'image'
export type ImageKind = 'upload' | 'render' | 'edit' | 'adjust'
export type ImageStatus = 'pending' | 'ready' | 'failed'
export type ShotType =
  | 'hero'
  | 'lifestyle'
  | 'detail'
  | 'scale'
  | 'flatlay'
  | 'gift'
  | 'feature'
  | 'onmodel'
export type JobKind = 'set' | 'create' | 'edit'
export type JobStatus = 'running' | 'done' | 'failed' | 'interrupted' | 'cancelled'
export type JobItemStatus = 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled'
export type UsageAction = 'create' | 'set' | 'edit' | 'adjust' | 'listing' | 'analyze' | 'cutout'
export type UsageResult = 'ok' | 'failed'
export type BadgeCorner = 'br' | 'bl' | 'tr' | 'tl'
export type BadgeScale = 's' | 'm' | 'l'
export type ProjectFilter = 'all' | 'sets' | 'photos' | 'images'
export type ProjectSort = 'recent' | 'oldest' | 'name'
export type ThemeSetting = 'system' | 'light' | 'dark'
export type DensitySetting = 'comfortable' | 'compact'

export interface Project {
  id: string
  type: ProjectType
  name: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
  coverImageId: string | null
  coverUrl: string | null
  sourceImageId: string | null
  category: string | null
  /** The product this work belongs to, or null for unfiled work. */
  productId: string | null
  shape: Shape
  format: Format
  /** The person look an image project was started from, if any. */
  personLook: string | null
  imageCount: number
  running: boolean
}

export interface AdjustTransform {
  crop?: { x: number; y: number; width: number; height: number }
  rotate?: 0 | 90 | 180 | 270
  flipH?: boolean
  flipV?: boolean
  brightness?: number
  contrast?: number
  saturation?: number
  warmth?: number
  sharpen?: number
  vignette?: number
}

export interface Image {
  id: string
  projectId: string
  kind: ImageKind
  status: ImageStatus
  url: string | null
  thumbUrl: string | null
  width: number | null
  height: number | null
  format: Format
  prompt: string | null
  revisedPrompt: string | null
  templateId: string | null
  shotId: string | null
  personId: string | null
  label: string
  seq: number
  parentId: string | null
  rootId: string | null
  isOriginal: boolean
  origin: 'upload' | 'ai' | 'local'
  costCents: number
  createdAt: number
  errorCode: string | null
  userText: string | null
  adjust: AdjustTransform | null
  badge: boolean
  durationMs: number | null
  jobId: string | null
}

export interface PlanShot {
  id: string
  type: ShotType
  enabled: boolean
  direction: string
  personId: string | null
  /** A bundled person's alternate studio look, or null for their default. */
  personLook: string | null
  label: string
  featureText?: string
  /** The version the seller pinned as this shot's main image for export. */
  selectedImageId?: string | null
}

export interface PlanJson {
  version: number
  category: string
  productName: string
  shape: Shape
  format: Format
  createdAt: number
  shots: PlanShot[]
}

export interface PlanRecord {
  id: string
  projectId: string
  version: number
  json: PlanJson
  createdAt: number
}

export interface JobItemState {
  key: string
  label: string
  status: JobItemStatus
  requested: number
  returned: number
  imageId?: string
  errorCode?: string
  startedAt?: number
  finishedAt?: number
  uncertainBilling?: boolean
  waiting?: boolean
}

export interface JobState {
  id: string
  projectId: string
  kind: JobKind
  status: JobStatus
  total: number
  done: number
  failed: number
  costCents: number
  startedAt: number
  finishedAt?: number
  currentLabel?: string
  items: JobItemState[]
}

export interface ActiveJobSummary {
  jobId: string
  projectId: string
  kind: JobKind
  status: JobStatus
  total: number
  done: number
  failed: number
  costCents: number
  startedAt: number
  currentLabel?: string
  items: JobItemState[]
}

export interface ProjectDetail {
  project: Project
  images: Image[]
  plan: PlanRecord | null
  activeJob: JobState | null
  usageCents: number
}

export interface PersonLook {
  /** 'front', 'angle', 'full' or 'seated' for bundled people. */
  key: string
  label: string
  url: string
}

export interface Person {
  id: string
  name: string
  ageBand: string | null
  blurb: string | null
  source: 'bundled' | 'user'
  refUrl: string
  /** The square card thumbnail. */
  portraitUrl: string
  /** The larger photo shown when the person opens, before a look is chosen. */
  defaultImageUrl: string
  /** Alternate studio looks. Empty for user-added people. */
  looks: PersonLook[]
  usedIn: number
}

export interface PhotoWarning {
  code: 'small' | 'dark' | 'low_contrast' | 'soft'
  message: string
}

export interface PhotoCheck {
  width: number
  height: number
  brightness: number
  contrast: number
  sharpness: number
  warnings: PhotoWarning[]
}

export interface ProductAnalysis {
  product: string
  category: string
  audience: string
  points: string[]
  createdAt: number
  costMicros: number
}

export interface Product {
  id: string
  name: string
  imageUrl: string
  thumbUrl: string
  width: number
  height: number
  createdAt: number
  updatedAt: number
  source: 'bundled' | 'user'
  blurb: string | null
  category: string | null
  audience?: string | null
  notes?: string | null
  status?: 'active' | 'archived'
  archivedAt?: number | null
  projectCount?: number
  imageCount?: number
  analysis?: ProductAnalysis | null
  cutoutUrl?: string | null
  cutoutConfidence?: number | null
}

export interface ProductDetail {
  product: Product
  projects: Project[]
  counts: { projects: number; sets: number; images: number }
  latestSet: Project | null
}

export interface LibraryImage {
  id: string
  projectId: string
  projectName: string
  projectType: ProjectType
  label: string
  url: string | null
  thumbUrl: string | null
  width: number | null
  height: number | null
  personId: string | null
  kind: ImageKind
  createdAt: number
}

export interface Brand {
  colors: string[]
  colorsEnabled: boolean
  logoUrl: string | null
  badgeEnabled: boolean
  badgeCorner: BadgeCorner
  badgeScale: BadgeScale
  badgeOpacity: number
  /** The seller profile that the Listing Writer will read. All optional. */
  businessName?: string
  sells?: string
  audience?: string
  voice?: string
  policies?: string
  marketplaces?: string[]
  defaultPlatform?: string
}

export interface UsageEvent {
  id: string
  at: number
  projectId: string | null
  projectName: string
  action: UsageAction
  requested: number
  returned: number
  costCents: number
  costMicros: number
  uncertainBilling: boolean
  durationMs: number | null
  result: UsageResult
  errorCode: string | null
}

export interface UsageSummary {
  month: string
  images: number
  spendCents: number
  textMicros: number
  budgetCents: number | null
  projects: Array<{ projectId: string; name: string; images: number; spendCents: number }>
}

export interface UsageByProject {
  items: Array<{ projectId: string | null; name: string; images: number; spendCents: number }>
}

export type LicenseStatus = 'unlicensed' | 'licensed' | 'grace' | 'expired' | 'offline_unlicensed'

export interface LicenseState {
  status: LicenseStatus
  source: 'lemon' | 'dev' | null
  machineLabel: string | null
  keyLast4: string | null
  lastValidatedAt: number | null
  offlineUntil: number | null
  message: string | null
}

export interface ImportResult {
  projectId?: string
  imageId?: string
  personId?: string
  width: number
  height: number
}

export interface ExportOptions {
  format: Format
  quality: number
  maxDimension: number | null
  includeVersions?: boolean
  filename?: string
}

export interface AppInfo {
  version: string
  isPackaged: boolean
  platform: string
  paths: { library: string; logs: string; userData: string }
  fakeMode: boolean
  devUnlock: boolean
  e2e: boolean
  buildDate: string
  releases: { electron: string; chromium: string; node: string }
}

export type ErrorCode =
  | 'content_policy'
  | 'invalid_key'
  | 'billing'
  | 'forbidden'
  | 'misconfigured'
  | 'rate_limited'
  | 'provider_error'
  | 'network'
  | 'app_bug'
  | 'invalid_request'
  | 'aborted'
  | 'unlicensed'
  | 'unlicensed_library'
  | 'no_key'
  | 'budget'
  | 'disk_full'
  | 'not_saved'
  | 'unknown_channel'
  | 'invalid_payload'
  | 'not_found'
  | 'conflict'
  | 'unknown'
  | 'license_limit'
  | 'license_invalid'
  | 'license_offline'
  | 'already_running'
  | 'unsupported_type'
  | 'too_large'
  | 'too_small'
  | 'unreadable'
  | 'cancelled'
  | 'export_failed'
  | 'no_match'

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string }

export interface ProjectListResult {
  items: Project[]
  total: number
}

export interface UsageListResult {
  items: UsageEvent[]
  total: number
}

export interface SettingsAll {
  theme: ThemeSetting
  density: DensitySetting
  onboardingStep: number
  onboardingDone: boolean
  onboardingDismissed: boolean
  onboardingCategory: string
  setupDismissed: boolean
  firstRunConfirmShown: boolean
  concurrency: number
  budgetCents: number | null
  defaultFormat: Format
  defaultShape: Shape
  lastProjectId: string | null
  libraryPath: string
  exportDefaults: ExportOptions
  windowState: WindowState | null
  licenseGraceNotified: boolean
  reduceMotion: 'system' | 'reduce' | 'full'
  lastBackupAt: number | null
}

export interface LibraryStats {
  path: string
  images: number
  bytes: number
}

export interface BackupSummary {
  createdAt: number
  appVersion: string
  schemaVersion: number
  projects: number
  images: number
  bytes: number
}

export interface BackupStatus {
  lastBackupAt: number | null
}

export interface KitExportResult {
  count: number
  folderName: string
  warnings: string[]
  includesOriginal: boolean
}

export type MenuAction =
  | 'new-set'
  | 'new-photo'
  | 'new-image'
  | 'export'
  | 'find'
  | 'toggle-rail'
  | 'toggle-panel'
  | 'open-settings'
  | 'open-usage'
  | 'open-privacy'
  | 'open-about'
  | 'open-guide'
  | 'open-shortcuts'
  | 'theme-system'
  | 'theme-light'
  | 'theme-dark'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'actual-size'
  | 'close-window'
  | 'open-project'
  | 'undo'
  | 'redo'
  | 'copy-image'
  | 'paste-image'
  | 'zoom-scale-in'
  | 'zoom-scale-out'
  | 'toggle-theme'

export interface MenuContext {
  editor: boolean
  adjust: boolean
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canExport: boolean
  canZoom: boolean
}

export interface MenuEvent {
  action: MenuAction
  projectId?: string
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export interface Placement {
  size: Shape
  format: Format
}

export type JobUpdateListener = (state: JobState) => void
export type LicenseChangeListener = (state: LicenseState) => void

export interface CreateJobInput {
  projectId: string
  prompt: string
  count: number
  shape: Shape
  format: Format
  sourceImageId?: string
  productId?: string
  personId?: string
  personLook?: string
}

export interface EditJobInput {
  projectId: string
  imageId: string
  change: string
  kind: '' | 'scene' | 'edit' | 'model'
  templateId?: string
  personId?: string
  palette?: string[]
  isGiftShot?: boolean
}

export interface SetJobInput {
  projectId: string
  mode: 'make' | 'remake'
  shotIds?: string[]
}
