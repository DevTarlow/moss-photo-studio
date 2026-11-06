import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface BaseProps {
  label?: string
  hint?: string
  error?: string | null
  optional?: boolean
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement>, BaseProps {}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, optional, className, id, ...props },
  ref
) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {optional && <span className="ml-1 font-normal text-[var(--text-faint)]">Optional</span>}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        className={cn('field', error && 'border-[var(--danger)]', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <p className="error-text mt-1" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint mt-1" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseProps {}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, hint, error, optional, className, id, ...props },
  ref
) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {optional && <span className="ml-1 font-normal text-[var(--text-faint)]">Optional</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        className={cn('field', error && 'border-[var(--danger)]', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <p className="error-text mt-1" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint mt-1" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
})
