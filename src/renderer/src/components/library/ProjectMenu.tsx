import type { ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Copy, Download, Pencil, Trash2 } from 'lucide-react'

export function ProjectMenuContent({
  onRename,
  onDuplicate,
  onExport,
  onDelete
}: {
  onRename: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.Content className="menu-content" align="end" sideOffset={6} collisionPadding={12}>
      <DropdownMenu.Item className="menu-item" onSelect={onRename}>
        <Pencil size={14} /> Rename
      </DropdownMenu.Item>
      <DropdownMenu.Item className="menu-item" onSelect={onDuplicate}>
        <Copy size={14} /> Duplicate
      </DropdownMenu.Item>
      <DropdownMenu.Item className="menu-item" onSelect={onExport}>
        <Download size={14} /> Export
      </DropdownMenu.Item>
      <DropdownMenu.Separator className="menu-separator" />
      <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>
        <Trash2 size={14} /> Delete
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
