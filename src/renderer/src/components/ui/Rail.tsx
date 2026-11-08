import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BarChart3,
  FolderOpen,
  Images,
  Info,
  KeyRound,
  Monitor,
  Package,
  Palette,
  RotateCcw,
  Settings,
  ShieldCheck,
  Users
} from 'lucide-react'
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core'
import { useAppStore } from '../../store/app'
import { settingsSections } from '../../lib/settingsSections'
import { toast } from '../../lib/toast'
import { useConfirm } from './ConfirmProvider'

const settingsIcons = {
  studio: <KeyRound size={18} strokeWidth={1.75} />,
  brand: <Palette size={18} strokeWidth={1.75} />,
  library: <FolderOpen size={18} strokeWidth={1.75} />,
  appearance: <Monitor size={18} strokeWidth={1.75} />,
  license: <ShieldCheck size={18} strokeWidth={1.75} />,
  privacy: <Settings size={18} strokeWidth={1.75} />,
  about: <Info size={18} strokeWidth={1.75} />
}

const items = [
  { to: '/library', label: 'Library', icon: <Images size={18} strokeWidth={1.75} /> },
  { to: '/products', label: 'Products', icon: <Package size={18} strokeWidth={1.75} /> },
  { to: '/people', label: 'People', icon: <Users size={18} strokeWidth={1.75} /> },
  { to: '/usage', label: 'Usage', icon: <BarChart3 size={18} strokeWidth={1.75} /> }
]

export function Rail({
  collapsed,
  onToggle
}: {
  collapsed: boolean
  onToggle: () => void
}): React.JSX.Element {
  const location = useLocation()
  const inSettings = location.pathname.startsWith('/settings')
  const appInfo = useAppStore((state) => state.appInfo)
  const confirm = useConfirm()
  const [resetting, setResetting] = useState(false)

  const resetApp = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Reset Moss Photo Studio?',
      body: 'This deletes all local app data, settings, license, and saved keys, then closes the app. It cannot be undone.',
      confirmLabel: 'Reset and Close',
      danger: true
    })
    if (!confirmed) return
    setResetting(true)
    const result = await window.moss.app.reset().catch(() => null)
    if (!result?.ok) {
      setResetting(false)
      toast.error('The app could not be reset.')
    }
  }

  return (
    <SideNav
      className="app-side-nav"
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: onToggle }}
      resizable={{ defaultWidth: 232, minWidth: 200, maxWidth: 320, autoSaveId: 'moss-side-nav' }}
      footer={
        <div className="flex flex-col gap-1">
          {appInfo && !appInfo.isPackaged && !appInfo.e2e && (
            <SideNavItem
              label="Reset App"
              icon={<RotateCcw size={18} strokeWidth={1.75} />}
              onClick={() => void resetApp()}
              isDisabled={resetting}
            />
          )}
          {!inSettings && (
            <SideNavItem
              label="Settings"
              icon={<Settings size={18} strokeWidth={1.75} />}
              href="/settings/studio"
              isSelected={false}
            />
          )}
        </div>
      }
    >
      <SideNavSection title="Studio">
        {items.map((item) => (
          <SideNavItem
            key={item.to}
            label={item.label}
            icon={item.icon}
            href={item.to}
            isSelected={location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)}
          />
        ))}
      </SideNavSection>
      {inSettings && (
        <SideNavSection title="Settings">
          {settingsSections.map((item) => (
            <SideNavItem
              key={item.id}
              label={item.label}
              icon={settingsIcons[item.id]}
              href={`/settings/${item.id}`}
              isSelected={location.pathname === `/settings/${item.id}`}
            />
          ))}
        </SideNavSection>
      )}
    </SideNav>
  )
}
