import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export function Chip({ selected = false, className, type = 'button', ...props }: ChipProps): React.JSX.Element {
  return <button type={type} className={cn('chip', className)} data-selected={selected} aria-pressed={selected} {...props} />
}
