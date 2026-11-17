import type { ReactNode } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { useModalInert } from './useModalInert'

export function Sheet({
  open,
  onOpenChange,
  side,
  title,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: 'left' | 'right'
  title: string
  children: ReactNode
}): React.JSX.Element {
  useModalInert(open)
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="sheet-overlay" />
        <RadixDialog.Content className="sheet-panel" data-side={side} aria-describedby={undefined}>
          <div className="flex h-[52px] items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)' }}>
            <RadixDialog.Title className="flex-1 text-[13px] font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Close panel"><Icon icon={X} size="sm" /></button>
            </RadixDialog.Close>
          </div>
          <div className="scroll-area flex-1">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
