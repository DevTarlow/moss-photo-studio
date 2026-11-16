import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { MuseKeyGuideDialog } from './MuseKeyGuideDialog'

/**
 * Connect Meta without leaving the project. Used when a paid action is blocked
 * because no key is saved yet; the description, examples, and free adjustments
 * stay on screen behind it.
 */
export function MetaKeyDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const refreshSecrets = useAppStore((state) => state.refreshSecrets)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setKey('')
    setError(null)
    setShow(false)
    setBusy(false)
  }, [open])

  const save = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Paste your Meta key first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(window.moss.secrets.testMuseKey({ key: key.trim() }))
      if (!result.ok) {
        setError(
          result.code === 'invalid_key'
            ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
            : 'Could not reach Meta. Check your connection, or add the key later.'
        )
        return
      }
      await unwrap(window.moss.secrets.setMuseKey({ key: key.trim() }))
      await refreshSecrets()
      toast.status('Meta key saved. You can make images now.')
      onOpenChange(false)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next)
        }}
        title="Connect Meta"
        description="Moss uses your own Meta account to make images. The key stays on this computer."
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Not Now</Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving...' : 'Save Meta Key'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label="Meta key"
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Paste the key from Meta"
            autoFocus
            error={error}
            hint="The key is stored on this computer. It never reaches the interface again."
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-[11px]"
              style={{ color: 'var(--text-faint)' }}
              onClick={() => setShow((value) => !value)}
            >
              {show ? 'Hide key' : 'Show key'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: 'var(--accent)' }}
              onClick={() => setGuideOpen(true)}
            >
              Where do I get a key?
            </button>
          </div>
          <p className="hint">
            You can keep working while you find it. Local edits, Sets, and your library never need a key.
          </p>
        </div>
      </Dialog>
      <MuseKeyGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  )
}
