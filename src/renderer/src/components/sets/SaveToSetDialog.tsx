import { useEffect, useState } from 'react'
import { Check, Layers, Loader2 } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { SetSummary } from '@shared/types'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { useSetPickerStore } from '../../store/setPicker'
import { useWorkspaceStore } from '../../store/workspace'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'

export function SaveToSetDialog(): React.JSX.Element {
  const target = useSetPickerStore((state) => state.target)
  const close = useSetPickerStore((state) => state.close)
  const [sets, setSets] = useState<SetSummary[]>([])
  const currentSetId = target?.kind === 'image' ? target.image.setId : target?.product.setId ?? null
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    setNewName('')
    setError(null)
    setLoading(true)
    void unwrap(window.moss.sets.list())
      .then(setSets)
      .catch((caught) => setError(messageOf(caught)))
      .finally(() => setLoading(false))
  }, [target])

  const assign = async (setId: string | null, label: string): Promise<void> => {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      if (target.kind === 'image') {
        await unwrap(window.moss.images.assignSet({ imageId: target.image.id, setId }))
        const workspace = useWorkspaceStore.getState()
        if (workspace.project?.id === target.image.projectId) void workspace.refresh()
      } else {
        await unwrap(window.moss.products.assignSet({ productId: target.product.id, setId }))
      }
      target.onSaved?.(setId)
      toast.status(label)
      close()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const createAndAssign = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) {
      setError('Give the Set a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await unwrap(window.moss.sets.create({ name }))
      await assign(created.id, `Saved to "${created.name}".`)
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => { if (!open) close() }}
      title="Add to Set"
      description="Sets keep related images and products together. An item can be in one Set at a time."
      width={480}
      footer={<Button variant="ghost" onClick={close}>Cancel</Button>}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          <Icon icon={Loader2} size="sm" className="animate-spin" /> Loading Sets...
        </div>
      ) : (
        <>
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {sets.length === 0 && <p className="hint py-2">No Sets yet. Create one below.</p>}
            {sets.map((set) => {
              const selected = currentSetId === set.id
              return (
                <button
                  key={set.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[8px] border p-2 text-left"
                  style={{
                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                    background: selected ? 'var(--accent-soft)' : 'transparent'
                  }}
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => void assign(set.id, `Saved to "${set.name}".`)}
                >
                  {set.coverUrl ? (
                    <img src={set.coverUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded" style={{ background: 'var(--surface-2)' }}>
                      <Icon icon={Layers} size="sm" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">{set.name}</span>
                    <span className="meta">{set.imageCount} {set.imageCount === 1 ? 'image' : 'images'}</span>
                  </span>
                  {selected && <Icon icon={Check} size="sm" className="shrink-0" />}
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <label className="field-label" htmlFor="save-to-new-set">New Set</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="save-to-new-set"
                className="field min-w-0 flex-1"
                value={newName}
                maxLength={80}
                placeholder="For example: Spring collection"
                disabled={busy}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void createAndAssign() }}
              />
              <Button variant="secondary" disabled={busy || !newName.trim()} onClick={() => void createAndAssign()}>
                Create &amp; Save
              </Button>
            </div>
          </div>

          {currentSetId && (
            <Button
              variant="ghost"
              className="mt-3"
              disabled={busy}
              onClick={() => void assign(null, 'Removed from Set.')}
            >
              Remove from Set
            </Button>
          )}
          {error && <p className="error-text mt-2" role="alert">{error}</p>}
        </>
      )}
    </Dialog>
  )
}
