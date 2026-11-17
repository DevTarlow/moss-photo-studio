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
  Settings,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react'
import { Icon, SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core'
import { settingsSections } from '../../lib/settingsSections'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'

const settingsIcons = {
  studio: <Icon icon={KeyRound} size="md" strokeWidth={1.75} />,
  brand: <Icon icon={Palette} size="md" strokeWidth={1.75} />,
  library: <Icon icon={FolderOpen} size="md" strokeWidth={1.75} />,
  appearance: <Icon icon={Monitor} size="md" strokeWidth={1.75} />,
  license: <Icon icon={ShieldCheck} size="md" strokeWidth={1.75} />,
  updates: <Icon icon={RefreshCw} size="md" strokeWidth={1.75} />,
  privacy: <Icon icon={Settings} size="md" strokeWidth={1.75} />,
  about: <Icon icon={Info} size="md" strokeWidth={1.75} />
}

const items = [
  { to: '/library', label: 'All work', icon: <Icon icon={Images} size="md" strokeWidth={1.75} /> },
  { to: '/products', label: 'Products', icon: <Icon icon={Package} size="md" strokeWidth={1.75} /> },
  { to: '/sets', label: 'Sets', icon: <Icon icon={Layers} size="md" strokeWidth={1.75} /> },
  { to: '/people', label: 'People', icon: <Icon icon={Users} size="md" strokeWidth={1.75} /> },
  { to: '/usage', label: 'Usage', icon: <Icon icon={BarChart3} size="md" strokeWidth={1.75} /> }
]

const tools = [
  { id: 'editor', to: '/library?new=photo', label: 'Image Editor', icon: <Icon icon={ImageIcon} size="md" strokeWidth={1.75} /> },
  { id: 'generator', to: '/library?new=image', label: 'Image Generator', icon: <Icon icon={Sparkles} size="md" strokeWidth={1.75} /> }
]

export function Rail({
  collapsed,
  onToggle
}: {
  collapsed: boolean
  onToggle: () => void
}): React.JSX.Element {
  const location = useLocation()
  const canUseStudio = useAppStore((state) => state.canUseStudio)
  const inSettings = location.pathname.startsWith('/settings')
  const project = useWorkspaceStore((state) => state.project)
  const inWorkspace = location.pathname.startsWith('/project/')
  const viewingPhoto = new URLSearchParams(location.search).get('view') === 'photo'
  const editorActive = inWorkspace && Boolean(project) && (project?.type === 'photo' || viewingPhoto)
  const generatorActive = inWorkspace && Boolean(project) && !editorActive

  const isSelected = (to: string): boolean => {
    if (to === '/products') {
      return location.pathname === '/products' || location.pathname.startsWith('/product/')
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <SideNav
      className="app-side-nav"
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: onToggle, hasButton: false }}
      resizable={{ defaultWidth: 232, minWidth: 200, maxWidth: 320, autoSaveId: 'moss-side-nav' }}
      footer={
        !inSettings ? (
          <div className="flex flex-col gap-1">
            <SideNavItem
              label="Settings"
              icon={<Icon icon={Settings} size="md" strokeWidth={1.75} />}
              href="/settings/studio"
              isSelected={false}
            />
          </div>
        ) : null
      }
    >
      <SideNavSection title="Studio">
        {items.map((item) => (
          <SideNavItem
            key={item.to}
            label={item.label}
            icon={item.icon}
            href={item.to}
            isSelected={isSelected(item.to)}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="Tools">
        {tools.map((tool) => (
          <SideNavItem
            key={tool.to}
            label={canUseStudio ? tool.label : `${tool.label} (reactivate)`}
            icon={tool.icon}
            href={canUseStudio ? tool.to : '/activation'}
            isSelected={canUseStudio && (tool.id === 'editor' ? editorActive : generatorActive)}
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
