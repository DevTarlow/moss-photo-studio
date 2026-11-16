import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/app'
import { unwrap } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'

/** Change the monthly limit without leaving the work in progress. */
export function BudgetLimitDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setValue(settings?.budgetCents == null ? '' : (settings.budgetCents / 100).toFixed(2))
    setBusy(false)
    setError(null)
  }, [open, settings?.budgetCents])

  const save = async (): Promise<void> => {
    const trimmed = value.trim().replace(/^\$/, '')
    if (!trimmed) {
      setBusy(true)
      try {
        await unwrap(window.moss.settings.set({ key: 'budgetCents', value: null }))
        await refreshSettings()
        toast.status('Monthly limit removed.')
        onOpenChange(false)
      } catch {
        setError('The monthly limit could not be saved.')
      } finally {
        setBusy(false)
      }
      return
    }
    const dollars = Number(trimmed)
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError('Enter a monthly limit in dollars, or leave it empty.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await unwrap(window.moss.settings.set({ key: 'budgetCents', value: Math.round(dollars * 100) }))
      await refreshSettings()
      toast.status('Monthly limit saved.')
      onOpenChange(false)
    } catch {
      setError('The monthly limit could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
      title="Monthly Limit"
      description="We'll warn you before a make goes over this. Leave it empty for no limit."
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving...' : 'Save Limit'}
          </Button>
        </>
      }
    >
      <Field
        label="Monthly limit in dollars"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="No limit"
        inputMode="decimal"
        autoFocus
        error={error}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
      />
    </Dialog>
  )
}
