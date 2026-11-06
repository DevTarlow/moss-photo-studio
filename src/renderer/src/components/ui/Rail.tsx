import { Link, NavLink, useLocation } from 'react-router-dom'
import { BarChart3, Images, PanelLeftClose, PanelLeftOpen, Settings, Users } from 'lucide-react'
import { markUrl } from '../../lib/assets'
import { useUiStore } from '../../store/ui'
import { IconButton } from './IconButton'
import { cn } from '../../lib/cn'

const items = [
  { to: '/library', label: 'Library', icon: Images },
  { to: '/people', label: 'People', icon: Users },
  { to: '/usage', label: 'Usage', icon: BarChart3 }
]

export function Rail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }): React.JSX.Element {
  const location = useLocation()
  const workspace = location.pathname.startsWith('/project/')
  return (
    <nav className={cn('app-rail', collapsed && 'rail-collapsed')} data-collapsed={collapsed} aria-label="Studio">
      <div className={cn('flex flex-col', collapsed ? 'items-center pt-3' : 'px-3 pt-3')}>
        <Link to="/library" className={cn('flex items-center gap-2 rounded-lg px-2 py-1', !collapsed && 'w-full')} aria-label="Moss Photo Studio Library">
          <img src={markUrl()} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
          {!collapsed && <span className="wordmark">Moss</span>}
        </Link>
      </div>
      <div className={cn('mt-4 flex flex-col gap-1', collapsed ? 'items-center px-2' : 'px-2')}>
        {workspace && (
          <Link to="/library" className="rail-item" aria-label="Back to Library">
            <span className="grid h-[18px] w-[18px] place-items-center" aria-hidden>
              ←
            </span>
            {!collapsed && <span className="rail-label">Back to Library</span>}
          </Link>
        )}
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="rail-item"
              data-active={location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon size={18} strokeWidth={1.75} />
              {!collapsed && <span className="rail-label">{item.label}</span>}
            </NavLink>
          )
        })}
      </div>
      <div className={cn('mt-auto flex flex-col gap-1 pb-3', collapsed ? 'items-center px-2' : 'px-2')}>
        <NavLink
          to="/settings/studio"
          className="rail-item"
          data-active={location.pathname.startsWith('/settings')}
          aria-label={collapsed ? 'Settings' : undefined}
        >
          <Settings size={18} strokeWidth={1.75} />
          {!collapsed && <span className="rail-label">Settings</span>}
        </NavLink>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-end')}>
          <IconButton label={collapsed ? 'Show navigation labels' : 'Hide navigation labels'} onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </IconButton>
        </div>
      </div>
    </nav>
  )
}
