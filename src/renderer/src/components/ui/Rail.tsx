import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BarChart3,
  FolderOpen,
  Image as ImageIcon,
  Images,
  Info,
  KeyRound,
  Layers,
  Monitor,
  Package,
  Palette,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users
} from 'lucide-react'
import { Icon, SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core'
import { useAppStore } from '../../store/app'
import { settingsSections } from '../../lib/settingsSections'
import { toast } from '../../lib/toast'
import { useConfirm } from './ConfirmProvider'

const settingsIcons = {
  studio: <Icon icon={KeyRound} size="md" strokeWidth={1.75} />,
  brand: <Icon icon={Palette} size="md" strokeWidth={1.75} />,
  business: <Icon icon={Store} size="md" strokeWidth={1.75} />,
  library: <Icon icon={FolderOpen} size="md" strokeWidth={1.75} />,
  appearance: <Icon icon={Monitor} size="md" strokeWidth={1.75} />,
  license: <Icon icon={ShieldCheck} size="md" strokeWidth={1.75} />,
  updates: <Icon icon={RefreshCw} size="md" strokeWidth={1.75} />,
  privacy: <Icon icon={Settings} size="md" strokeWidth={1.75} />,
  about: <Icon icon={Info} size="md" strokeWidth={1.75} />
}

const items = [
  { to: '/products', label: 'Products', icon: <Icon icon={Package} size="md" strokeWidth={1.75} /> },
  { to: '/library', label: 'All work', icon: <Icon icon={Images} size="md" strokeWidth={1.75} /> },
  { to: '/people', label: 'People', icon: <Icon icon={Users} size="md" strokeWidth={1.75} /> },
  { to: '/usage', label: 'Usage', icon: <Icon icon={BarChart3} size="md" strokeWidth={1.75} /> }
]

const tools = [
  { to: '/library?new=set', label: 'New Set', icon: <Icon icon={Layers} size="md" strokeWidth={1.75} /> },
  { to: '/library?new=photo', label: 'Image Editor', icon: <Icon icon={ImageIcon} size="md" strokeWidth={1.75} /> },
  { to: '/library?new=image', label: 'Image Generator', icon: <Icon icon={Sparkles} size="md" strokeWidth={1.75} /> }
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
              icon={<Icon icon={RotateCcw} size="md" strokeWidth={1.75} />}
              onClick={() => void resetApp()}
              isDisabled={resetting}
            />
          )}
          {!inSettings && (
            <SideNavItem
              label="Settings"
              icon={<Icon icon={Settings} size="md" strokeWidth={1.75} />}
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
      <SideNavSection title="Tools">
        {tools.map((tool) => (
          <SideNavItem
            key={tool.to}
            label={tool.label}
            icon={tool.icon}
            href={tool.to}
            isSelected={false}
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
