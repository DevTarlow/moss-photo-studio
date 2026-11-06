import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Keyboard, Search } from 'lucide-react'
import { markUrl } from '../../lib/assets'
import { useUiStore } from '../../store/ui'
import { IconButton } from './IconButton'

export function TopBar({
  title,
  titleContent,
  backTo,
  right
}: {
  title?: string
  titleContent?: ReactNode
  backTo?: string
  right?: ReactNode
}): React.JSX.Element {
  const setPalette = useUiStore((state) => state.setPalette)
  const setShortcuts = useUiStore((state) => state.setShortcuts)
  const paletteKey = window.moss.platform === 'darwin' ? '⌘ K' : 'Ctrl K'
  return (
    <header className="app-topbar drag-region">
      <div className="flex min-w-0 items-center gap-3 no-drag">
        <Link to="/library" className="flex items-center gap-2" aria-label="Moss Photo Studio home">
          <img src={markUrl()} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
          <span className="wordmark whitespace-nowrap">Moss Photo Studio</span>
        </Link>
        {backTo && (
          <>
            <span className="h-4 w-px" style={{ background: 'var(--border)' }} aria-hidden />
            <Link to={backTo} className="icon-btn" aria-label="Back to Library">
              <ArrowLeft size={16} />
            </Link>
          </>
        )}
        {titleContent ? (
          <div className="flex min-w-0 items-center gap-2">{titleContent}</div>
        ) : title ? (
          <span className="truncate font-semibold">{title}</span>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-1 no-drag">
        {right}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPalette(true)}
        >
          <Search size={14} />
          <span className="hidden md:inline">Search</span>
          <kbd className="ml-2 rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
            {paletteKey}
          </kbd>
        </button>
        <IconButton label="Keyboard shortcuts" onClick={() => setShortcuts(true)}>
          <Keyboard size={17} />
        </IconButton>
      </div>
    </header>
  )
}
