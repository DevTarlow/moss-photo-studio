import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { usd } from '../../lib/format'
import { Progress } from '../ui/Progress'

/**
 * The priced action belongs under the inputs that drive it, not at the bottom
 * of the whole window. Both studio tools share this compact footer so the
 * monthly budget and the commit button stay in the same place.
 */
export function CommitFooter({
  monthCents,
  budgetCents,
  children
}: {
  monthCents: number
  budgetCents: number | null
  children: ReactNode
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="ws-commit" data-commit-action>
      <button
        type="button"
        className="ws-commit-budget"
        aria-label="Open Usage"
        onClick={() => navigate('/usage')}
      >
        <span className="tabular">
          Month {usd(monthCents)}
          {budgetCents !== null ? ` of ${usd(budgetCents)}` : ''}
        </span>
        {budgetCents !== null && budgetCents > 0 && (
          <Progress
            value={Math.min(monthCents, budgetCents)}
            max={budgetCents}
            label={`${usd(monthCents)} of ${usd(budgetCents)} this month`}
          />
        )}
      </button>
      <div className="ws-commit-action">{children}</div>
    </div>
  )
}
