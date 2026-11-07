import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export function Pagination({
  page,
  total,
  pageSize = COLLECTION_PAGE_SIZE,
  onPage,
  busy = false,
  label = 'Pages',
  className
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
  busy?: boolean
  label?: string
  className?: string
}): React.JSX.Element | null {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const current = Math.min(Math.max(1, page), pages)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)
  return (
    <nav className={cn('mt-6 flex flex-wrap items-center justify-center gap-3', className)} aria-label={label}>
      <Button variant="secondary" size="sm" disabled={busy || current <= 1} onClick={() => onPage(current - 1)}>
        Previous
      </Button>
      <p className="meta tabular" aria-live="polite">
        Page {current} of {pages} · {from}–{to} of {total}
      </p>
      <Button variant="secondary" size="sm" disabled={busy || current >= pages} onClick={() => onPage(current + 1)}>
        Next
      </Button>
    </nav>
  )
}
