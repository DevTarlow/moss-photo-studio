import { forwardRef } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { DEFAULT_THEME_ID, THEME_MODES } from '@shared/themes'
import { useAppStore } from '../store/app'
// The built themes (npm run theme:build) carry __built, so Astryx skips runtime
// style injection; their CSS arrives through styles/index.css. Edit
// palettes.ts or themes/<id>.ts, then rebuild — the release gate fails if the
// themes and the committed output drift.
import { THEMES } from './themes'

type RouterLinkProps = Omit<ComponentProps<typeof Link>, 'to'> & { href: string }

/**
 * Astryx links speak `href`; React Router links speak `to`. This adapter keeps
 * every Astryx link inside the hash router instead of doing a full navigation.
 */
const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(function RouterLink(
  { href, ...props },
  ref
) {
  return <Link ref={ref} to={href} {...props} />
})

/**
 * Each appearance theme has a fixed mode, so the saved id alone decides both
 * the theme identity (`data-astryx-theme`) and the mode (`data-theme`, which
 * drives `light-dark()` and the dark elevation token). Before settings load
 * the app paints the default light look, exactly as it did before.
 */
export function MossThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const themeId = useAppStore((state) => state.settings?.theme ?? DEFAULT_THEME_ID)

  return (
    <Theme theme={THEMES[themeId]} mode={THEME_MODES[themeId]}>
      <LinkProvider component={RouterLink}>{children}</LinkProvider>
    </Theme>
  )
}
