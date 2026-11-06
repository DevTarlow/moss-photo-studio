import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useViewportTier } from '../../lib/viewport'
import { useUiStore } from '../../store/ui'
import { Rail } from './Rail'
import { TopBar } from './TopBar'

export function AppFrame({
  children,
  title,
  titleContent,
  backTo,
  topbarRight
}: {
  children: ReactNode
  title?: string
  titleContent?: ReactNode
  backTo?: string
  topbarRight?: ReactNode
}): React.JSX.Element {
  const tier = useViewportTier()
  const override = useUiStore((state) => state.railOverride)
  const toggleRail = useUiStore((state) => state.toggleRail)
  const location = useLocation()
  const collapsed = tier === 'wide' ? (override ?? false) : true
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopBar
        title={title}
        titleContent={titleContent}
        backTo={backTo}
        right={topbarRight}
      />
      <div className="app-shell-row">
        <Rail collapsed={collapsed} onToggle={toggleRail} />
        <main className="app-main" key={location.pathname}>
          {children}
        </main>
      </div>
    </div>
  )
}
