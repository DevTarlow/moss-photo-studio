import { forwardRef, useEffect, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { useAppStore } from '../store/app'
// The built theme (npm run theme:build) carries __built, so Astryx skips runtime
// style injection; its CSS arrives through styles/index.css. Edit mossTheme.ts,
// then rebuild — the release gate fails if the two drift.
import { mossTheme } from './moss'

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

/** Resolve the saved preference, including the OS preference for `system`. */
function useResolvedMode(): 'light' | 'dark' {
  const preference = useAppStore((state) => state.settings?.theme ?? 'light')
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (preference === 'light' || preference === 'dark') return preference
  return systemDark ? 'dark' : 'light'
}

function useResolvedMotion(): 'reduce' | 'full' {
  const preference = useAppStore((state) => state.settings?.reduceMotion ?? 'system')
  const [systemReduce, setSystemReduce] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setSystemReduce(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  if (preference === 'reduce') return 'reduce'
  if (preference === 'full') return 'full'
  return systemReduce ? 'reduce' : 'full'
}

export function MossThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const mode = useResolvedMode()
  const motion = useResolvedMotion()

  useEffect(() => {
    document.documentElement.dataset.motion = motion
  }, [motion])

  return (
    <Theme theme={mossTheme} mode={mode}>
      <LinkProvider component={RouterLink}>{children}</LinkProvider>
    </Theme>
  )
}
