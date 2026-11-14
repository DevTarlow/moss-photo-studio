import type { MenuContext } from './types'

export const APP_NAME = 'Moss Photo Studio'
export const APP_ID = 'com.mosstoolbox.photostudio'
export const APP_VERSION = '1.0.4'

export const MUSE_BASE_URL = 'https://api.meta.ai/v1'
export const MUSE_MODEL = 'muse-image-1.0'
export const MUSE_KEY_ORIGIN = 'https://dev.meta.ai'
export const LICENSE_API_BASE = 'https://license.mossaistudio.com'
export const LICENSE_PORTAL_URL = 'https://license.mossaistudio.com/account'
// Replace with the real product-site checkout URL before release.
export const LICENSE_STORE_URL = 'https://mossphotostudio.com'
export const LICENSE_STORE_PLACEHOLDER = 'https://example.com/moss-photo-studio'
export const LICENSE_API_HOST = new URL(LICENSE_API_BASE).host
export const LICENSE_PORTAL_HOST = new URL(LICENSE_PORTAL_URL).host
export const SUPPORT_EMAIL = 'tarlow@mossaistudio.com'

export const MAX_PROMPT = 2000
export const MAX_SET_SHOTS = 8
export const MAX_SET_DIRECTION = 400
export const MAX_CREATE_VARIANTS = 4
export const MAX_FEATURE_TEXT = 60
export const MAX_REFERENCE_IMAGES = 3
export const DEFAULT_IMPORT_LONG_EDGE = 2048
export const MAX_IMPORT_BYTES = 40 * 1024 * 1024
export const MAX_LOGO_BYTES = 5 * 1024 * 1024
export const MAX_PERSON_BYTES = 20 * 1024 * 1024
export const THUMB_LONG_EDGE = 480
export const WORKING_QUALITY = 88
export const REQUEST_TIMEOUT_MS = 300_000
export const VALIDATE_TIMEOUT_MS = 15_000
export const ONBOARDING_IMPORT_TIMEOUT_MS = 8_000
export const DEFAULT_CONCURRENCY = 2
export const COLLECTION_PAGE_SIZE = 20
export const LICENSE_GRACE_DAYS = 14
export const DEFAULT_BUDGET_CENTS = 1000

export const SHAPES = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024'
} as const

export const FORMATS = ['webp', 'jpeg', 'png'] as const

export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const APP_ALLOWED_EXTERNAL_HOSTS = [
  'dev.meta.ai',
  'docs.meta.ai',
  new URL(LICENSE_STORE_URL).host,
  LICENSE_PORTAL_HOST
] as const

/** Hosts the renderer may contact. Used by the E2E no-stray-network assertion. */
export const NETWORK_HOSTS = ['api.meta.ai', LICENSE_API_HOST] as const

export const isStoreUrlPlaceholder = (url: string): boolean => url === LICENSE_STORE_PLACEHOLDER

export const EMPTY_MENU_CONTEXT: MenuContext = {
  editor: false,
  adjust: false,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  canExport: false,
  canZoom: false
}
