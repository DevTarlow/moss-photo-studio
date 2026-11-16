import { useEffect } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { cn } from '../../lib/cn'

let openModalCount = 0

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  width?: number
  className?: string
  hideClose?: boolean
  closeLabel?: string
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 420,
  className,
  hideClose = false,
  closeLabel = 'Close',
  initialFocusRef
}: DialogProps): React.JSX.Element {
  // Radix hides individual background nodes in this app shell, which can leave
  // unnamed buttons exposed to assistive tech. Hide the app root as one modal
  // surface instead, and count nested dialogs so closing one does not reveal the
  // background while another is still open.
  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root')
    if (!root) return
    openModalCount += 1
    if (openModalCount === 1) {
      root.setAttribute('aria-hidden', 'true')
      root.setAttribute('inert', '')
    }
    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        root.removeAttribute('aria-hidden')
        root.removeAttribute('inert')
      }
    }
  }, [open])

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content
          className={cn('dialog-content', className)}
          style={{ width }}
          onOpenAutoFocus={(event) => {
            if (!initialFocusRef?.current) return
            event.preventDefault()
            initialFocusRef.current.focus()
          }}
        >
          <RadixDialog.Title className="dialog-title pr-8">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="dialog-body">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="dialog-actions">{footer}</div>}
          {!hideClose && (
            <RadixDialog.Close asChild>
              <button type="button" className="icon-btn dialog-close" aria-label={closeLabel}>
                <Icon icon={X} size="sm" />
              </button>
            </RadixDialog.Close>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
