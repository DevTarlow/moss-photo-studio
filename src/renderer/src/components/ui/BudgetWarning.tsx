import { AlertTriangle } from 'lucide-react'
import { usd } from '@shared/cost'
import { Button, Icon } from '@astryxdesign/core'

export function BudgetWarning({
  limitCents,
  onRaise,
  onFewer
}: {
  limitCents: number
  onRaise: () => void
  onFewer?: () => void
}): React.JSX.Element {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
      <Icon icon={AlertTriangle} size="md" style={{ color: 'var(--warning)' }} aria-hidden />
      <p className="min-w-[200px] flex-1 text-[12px]">
        This image would go over your {usd(limitCents)} monthly limit. Change the limit in Usage{onFewer ? ', or make fewer images' : ''}.
      </p>
      <Button label="Change Limit" variant="secondary" size="sm" onClick={onRaise} />
      {onFewer && <Button label="Make Fewer" variant="secondary" size="sm" onClick={onFewer} />}
    </div>
  )
}
