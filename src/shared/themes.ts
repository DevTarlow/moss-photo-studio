/**
 * The appearance themes Moss offers, and their light/dark mode.
 *
 * This file is the contract between the main process (window chrome, menu),
 * the renderer (theme provider, picker), and the theme build/audit scripts. It
 * holds no colours: `src/renderer/src/theme/palettes.ts` is the palette source
 * and `src/renderer/src/theme/built/` is the generated Astryx output.
 *
 * Keep it dependency-free so a plain Node script can import it directly.
 */

export const THEME_IDS = [
  'moss',
  'sand',
  'clay',
  'lichen',
  'stone',
  'moss-night',
  'bark',
  'pine',
  'ember',
  'basalt'
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ThemeMode = 'light' | 'dark'

/** New installs, and any unreadable stored value, start on the paper-and-forest look. */
export const DEFAULT_THEME_ID: ThemeId = 'moss'

export const THEME_LABELS: Record<ThemeId, string> = {
  moss: 'Moss',
  sand: 'Sand',
  clay: 'Clay',
  lichen: 'Lichen',
  stone: 'Stone',
  'moss-night': 'Moss Night',
  bark: 'Bark',
  pine: 'Pine',
  ember: 'Ember',
  basalt: 'Basalt'
}

export const THEME_MODES: Record<ThemeId, ThemeMode> = {
  moss: 'light',
  sand: 'light',
  clay: 'light',
  lichen: 'light',
  stone: 'light',
  'moss-night': 'dark',
  bark: 'dark',
  pine: 'dark',
  ember: 'dark',
  basalt: 'dark'
}

/**
 * Values an older install may still have stored. Light and dark keep the look
 * the user already had; `system` resolves to the light default, matching how a
 * new install starts.
 */
export const LEGACY_THEME_IDS = {
  system: 'moss',
  light: 'moss',
  dark: 'moss-night'
} as const satisfies Record<string, ThemeId>

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

/** Normalizes a stored value, including the pre-theme-picker values. */
export function normalizeTheme(value: unknown): ThemeId {
  if (isThemeId(value)) return value
  if (typeof value === 'string' && value in LEGACY_THEME_IDS) {
    return LEGACY_THEME_IDS[value as keyof typeof LEGACY_THEME_IDS]
  }
  return DEFAULT_THEME_ID
}
