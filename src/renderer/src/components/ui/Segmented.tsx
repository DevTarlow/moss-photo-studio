interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-selected={option.value === value}
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
