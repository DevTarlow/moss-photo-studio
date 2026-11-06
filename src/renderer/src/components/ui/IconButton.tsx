import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  showTooltip?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active = false, showTooltip = true, className, type = 'button', children, ...props },
  ref
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-active={active}
      className={cn('icon-btn', className)}
      {...props}
    >
      {children}
    </button>
  )
  if (!showTooltip) return button
  return <Tooltip label={label}>{button}</Tooltip>
})
