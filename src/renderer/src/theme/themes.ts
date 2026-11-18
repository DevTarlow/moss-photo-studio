import type { DefinedTheme } from '@astryxdesign/core/theme'
import type { ThemeId } from '@shared/themes'
import { barkTheme } from './built/bark'
import { basaltTheme } from './built/basalt'
import { clayTheme } from './built/clay'
import { emberTheme } from './built/ember'
import { lichenTheme } from './built/lichen'
import { mossTheme } from './built/moss'
import { mossNightTheme } from './built/moss-night'
import { pineTheme } from './built/pine'
import { sandTheme } from './built/sand'
import { stoneTheme } from './built/stone'

/**
 * The compiled themes, keyed by the id the setting stores. Each generated
 * module imports its own stylesheet from `styles/index.css`; switching theme
 * only changes which one `<Theme>` scopes the app to.
 *
 * Do not edit `built/` — edit `themes/<id>.ts` or `palettes.ts` and run
 * `npm run theme:build`.
 */
export const THEMES: Record<ThemeId, DefinedTheme> = {
  moss: mossTheme,
  sand: sandTheme,
  clay: clayTheme,
  lichen: lichenTheme,
  stone: stoneTheme,
  'moss-night': mossNightTheme,
  bark: barkTheme,
  pine: pineTheme,
  ember: emberTheme,
  basalt: basaltTheme
}
