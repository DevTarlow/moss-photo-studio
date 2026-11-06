export function Progress({
  value,
  max,
  label
}: {
  value: number
  max: number
  label?: string
}): React.JSX.Element {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={label ?? `${value} of ${max}`}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
