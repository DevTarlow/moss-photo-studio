import { Check, Minus } from 'lucide-react'
import { Icon, Text } from '@astryxdesign/core'

export type SetupStepState = 'complete' | 'skipped' | 'current' | 'pending'

export interface SetupStep {
  label: string
  optional?: boolean
  state: SetupStepState
}

const STATE_WORD: Record<SetupStepState, string> = {
  complete: 'Completed',
  skipped: 'Skipped',
  current: 'Current step',
  pending: 'Not started'
}

/**
 * The onboarding progress list. Astryx Step treats every position behind the
 * active step as completed, which would put a green check on an optional step
 * the seller skipped. This ordered list carries the honest state instead:
 * complete, skipped, current, or not started. It stays a real <ol> for screen
 * readers and adds the state words as visually hidden text.
 */
export function SetupStepper({
  steps,
  activeStep,
  orientation = 'vertical',
  label = 'Setup steps'
}: {
  steps: readonly SetupStep[]
  activeStep: number
  orientation?: 'vertical' | 'horizontal'
  label?: string
}): React.JSX.Element {
  return (
    <ol className="setup-steps" data-orientation={orientation} aria-label={label}>
      {steps.map((step, index) => {
        const state: SetupStepState =
          index === activeStep ? 'current' : step.state
        return (
          <li
            key={step.label}
            className="setup-step"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="setup-step-indicator" aria-hidden>
              {state === 'complete' ? (
                <Icon icon={Check} size="sm" strokeWidth={2.4} />
              ) : state === 'skipped' ? (
                <Icon icon={Minus} size="sm" strokeWidth={2.4} />
              ) : (
                <span className="setup-step-number">{index + 1}</span>
              )}
            </span>
            <span className="setup-step-copy">
              <Text type="body" weight={state === 'current' ? 'bold' : undefined} className="setup-step-label">
                {step.label}
              </Text>
              {step.optional && (
                <Text type="supporting" color="secondary" className="setup-step-optional">
                  Optional
                </Text>
              )}
            </span>
            <span className="sr-only">{STATE_WORD[state]}</span>
          </li>
        )
      })}
    </ol>
  )
}
