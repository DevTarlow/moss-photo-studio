import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AppShell } from '@astryxdesign/core'
import { useViewportTier } from '../../lib/viewport'
import { useUiStore } from '../../store/ui'
import { Rail } from './Rail'
import { TopBar } from './TopBar'

export function AppFrame({
  children,
  title,
  titleContent,
  backTo,
  backLabel,
  topbarRight
}: {
  children: ReactNode
  title?: string
  titleContent?: ReactNode
  backTo?: string
  backLabel?: string
  topbarRight?: ReactNode
}): React.JSX.Element {
  const tier = useViewportTier()
  const override = useUiStore((state) => state.railOverride)
  const toggleRail = useUiStore((state) => state.toggleRail)
  const location = useLocation()
  const collapsed = tier === 'wide' ? (override ?? false) : true
  return (
    <AppShell
      className="app-shell"
      height="fill"
      variant="section"
      contentPadding={0}
      mobileNav={{ breakpoint: 'sm' }}
      topNav={<TopBar title={title} titleContent={titleContent} backTo={backTo} backLabel={backLabel} right={topbarRight} />}
      sideNav={<Rail collapsed={collapsed} onToggle={toggleRail} />}
    >
      <div key={location.pathname} className="flex h-full min-h-0 flex-col">
        {children}
      </div>
    </AppShell>
  )
}
