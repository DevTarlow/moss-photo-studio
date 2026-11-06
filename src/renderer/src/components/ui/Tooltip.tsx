import type { ReactNode } from 'react'
import { Tooltip as RadixTooltip } from 'radix-ui'

export function Tooltip({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <RadixTooltip.Root delayDuration={400}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="tooltip-content" sideOffset={8}>
          {label}
          <RadixTooltip.Arrow className="tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
