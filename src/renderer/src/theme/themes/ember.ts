import { defineTheme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'
import { themeBase } from '../themeBase'
import { palette } from '../palettes'

const { tokens, localTokens } = palette('ember')

// The icon registry must be imported *in this file*: `astryx theme build`
// scrapes the theme source for it when it emits the generated module.
export const emberTheme = defineTheme({
  name: 'ember',
  extends: themeBase,
  icons: neutralTheme.icons,
  tokens,
  localTokens
})
