import { Switch as RadixSwitch } from 'radix-ui'

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <RadixSwitch.Root
      className="switch-root"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
    >
      <RadixSwitch.Thumb className="switch-thumb" />
    </RadixSwitch.Root>
  )
}
