import { AlertTriangle } from 'lucide-react'
import { usd } from '@shared/cost'
import { Button } from './Button'

export function BudgetWarning({
  limitCents,
  onRaise,
  onFewer
}: {
  limitCents: number
  onRaise: () => void
  onFewer: () => void
}): React.JSX.Element {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
      <AlertTriangle size={18} style={{ color: 'var(--warning)' }} aria-hidden />
      <p className="min-w-[200px] flex-1 text-[12px]">
        This run would pass your {usd(limitCents)} monthly limit. Raise it in Usage, or make fewer images.
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onRaise}>
        Raise the Limit
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onFewer}>
        Make Fewer Images
      </Button>
    </div>
  )
}
