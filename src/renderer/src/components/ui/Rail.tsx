import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Image as ImageIcon,
  Images,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  Sparkles,
  Users
} from 'lucide-react'
import { useAppStore } from '../../store/app'
import { toast } from '../../lib/toast'
import { useConfirm } from './ConfirmProvider'
import { IconButton } from './IconButton'
import { cn } from '../../lib/cn'

const items = [
  { to: '/library', label: 'Library', icon: Images },
  { to: '/people', label: 'People', icon: Users },
  { to: '/usage', label: 'Usage', icon: BarChart3 }
]

const tools = [
  { to: '/library?new=set', label: 'Set Creator', icon: Layers },
  { to: '/library?new=photo', label: 'Image Editor', icon: ImageIcon },
  { to: '/library?new=image', label: 'Image Generator', icon: Sparkles }
]

export function Rail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }): React.JSX.Element {
  const location = useLocation()
  const workspace = location.pathname.startsWith('/project/')
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
    <nav className={cn('app-rail', collapsed && 'rail-collapsed')} data-collapsed={collapsed} aria-label="Studio">
      <div className={cn('flex flex-col gap-1 pt-3', collapsed ? 'items-center px-2' : 'px-2')}>
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
      <div className={cn('mt-5 flex flex-col gap-1', collapsed ? 'items-center px-2' : 'px-2')}>
        {!collapsed ? (
          <p className="section-label px-2 pb-1">Tools</p>
        ) : (
          <div className="my-1 h-px w-6" style={{ background: 'var(--border)' }} aria-hidden />
        )}
        {tools.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.to} to={item.to} className="rail-item" aria-label={collapsed ? item.label : undefined}>
              <Icon size={18} strokeWidth={1.75} />
              {!collapsed && <span className="rail-label">{item.label}</span>}
            </Link>
          )
        })}
      </div>
      <div className={cn('mt-auto flex flex-col gap-1 pb-3', collapsed ? 'items-center px-2' : 'px-2')}>
        {appInfo && !appInfo.isPackaged && !appInfo.e2e && (
          <button
            type="button"
            className="rail-item"
            aria-label={collapsed ? 'Reset app' : undefined}
            aria-busy={resetting}
            disabled={resetting}
            onClick={() => void resetApp()}
          >
            <RotateCcw size={18} strokeWidth={1.75} />
            {!collapsed && <span className="rail-label">Reset App</span>}
          </button>
        )}
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
