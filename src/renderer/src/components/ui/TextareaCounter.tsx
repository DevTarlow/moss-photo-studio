import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface TextareaCounterProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  max: number
  label?: string
  hint?: string
  rows?: number
}

export const TextareaCounter = forwardRef<HTMLTextAreaElement, TextareaCounterProps>(function TextareaCounter(
  { value, max, label, hint, className, rows = 5, id, ...props },
  ref
): React.JSX.Element {
  const generated = useId()
  const inputId = id ?? generated
  const over = value.length > max
  const showCounter = value.length > max * 0.8 || over
  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        value={value}
        className={cn('field', over && 'border-[var(--danger)]', className)}
        aria-invalid={over}
        {...props}
      />
      <div className="hint-row">
        <span className="hint">{hint}</span>
        {showCounter && (
          <span className="counter" data-over={over}>
            {value.length.toLocaleString()} / {max.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
})
