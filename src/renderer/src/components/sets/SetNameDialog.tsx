import { useEffect, useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { messageOf } from '../../lib/ipc'

export function SetNameDialog({
  open,
  title,
  initialName = '',
  submitLabel,
  onOpenChange,
  onSubmit
}: {
  open: boolean
  title: string
  initialName?: string
  submitLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setError(null)
    setBusy(false)
  }, [open, initialName])

  const submit = async (): Promise<void> => {
    const clean = name.trim()
    if (!clean) {
      setError('Give the Set a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(clean)
      onOpenChange(false)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Sets keep related images together. You can rename or delete a Set later."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving...' : submitLabel}</Button>
        </>
      }
    >
      <label className="field-label" htmlFor="set-name">Set name</label>
      <input
        id="set-name"
        className="field mt-1"
        value={name}
        maxLength={80}
        autoFocus
        placeholder="For example: Spring collection"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}
      />
      {error && <p className="error-text mt-2" role="alert">{error}</p>}
    </Dialog>
  )
}
