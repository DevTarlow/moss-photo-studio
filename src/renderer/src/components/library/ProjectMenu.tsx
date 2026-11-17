import type { ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Copy, Download, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { Icon } from '@astryxdesign/core'

export function ProjectMenuContent({
  onRename,
  onDuplicate,
  onAddToSet,
  onExport,
  onDelete
}: {
  onRename: () => void
  onDuplicate: () => void
  onAddToSet?: () => void
  onExport: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.Content className="menu-content" align="end" sideOffset={6} collisionPadding={12}>
      <DropdownMenu.Item className="menu-item" onSelect={onRename}>
        <Icon icon={Pencil} size="sm" /> Rename
      </DropdownMenu.Item>
      <DropdownMenu.Item className="menu-item" onSelect={onDuplicate}>
        <Icon icon={Copy} size="sm" /> Duplicate
      </DropdownMenu.Item>
      {onAddToSet && (
        <DropdownMenu.Item className="menu-item" onSelect={onAddToSet}>
          <Icon icon={FolderPlus} size="sm" /> Add to Set
        </DropdownMenu.Item>
      )}
      <DropdownMenu.Item className="menu-item" onSelect={onExport}>
        <Icon icon={Download} size="sm" /> Export
      </DropdownMenu.Item>
      <DropdownMenu.Separator className="menu-separator" />
      <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>
        <Icon icon={Trash2} size="sm" /> Delete
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  )
}

export function ProjectMenu({
  children,
  ...handlers
}: {
  children: ReactNode
  onRename: () => void
  onDuplicate: () => void
  onAddToSet?: () => void
  onExport: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <ProjectMenuContent {...handlers} />
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
