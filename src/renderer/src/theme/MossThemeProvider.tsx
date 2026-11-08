import { forwardRef, useEffect, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { useAppStore } from '../store/app'
import { mossTheme } from './mossTheme'

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

export function MossThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const mode = useResolvedMode()
  return (
    <Theme theme={mossTheme} mode={mode}>
      <LinkProvider component={RouterLink}>{children}</LinkProvider>
    </Theme>
  )
}
