import { DropdownMenu } from 'radix-ui'
import type { ScenePreset } from '@shared/types'

export function SceneCard({
  scene,
  onOpen,
  onRename,
  onDelete
}: {
  scene: ScenePreset
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <div className="card card-hover group relative overflow-hidden">
      <button type="button" className="block w-full cursor-pointer" onClick={onOpen} aria-label={`Open ${scene.name}`}>
        <img
          src={scene.thumbUrl}
          alt=""
          className="aspect-square w-full object-cover"
          style={{ background: 'var(--surface-2)' }}
        />
      </button>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{scene.name}</p>
        <p className="meta mt-0.5">{scene.category ?? 'Your scene'}</p>
        {scene.blurb && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>{scene.blurb}</p>}
      </div>
      {scene.source === 'user' && onRename && onDelete && (
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn" style={{ background: 'var(--surface)' }} aria-label={`Actions for ${scene.name}`}>
                ⋯
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                <DropdownMenu.Item className="menu-item" onSelect={onRename}>Rename</DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>Delete</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}
