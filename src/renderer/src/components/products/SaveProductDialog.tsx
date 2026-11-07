import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Field } from '../ui/Field'
import { Button } from '../ui/Button'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'

export function SaveProductDialog({
  open,
  onOpenChange,
  imageId,
  defaultName
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageId: string | null
  defaultName: string
}): React.JSX.Element {
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setName(defaultName)
  }, [open, defaultName])

  const save = async (): Promise<void> => {
    const value = name.trim()
    if (!value) {
      toast.error('Give the product a name first.')
      return
    }
    if (!imageId) return
    setBusy(true)
    try {
      await unwrap(window.moss.products.createFromImage({ imageId, name: value }))
      await refreshProducts()
      toast.status('Saved to Products.')
      onOpenChange(false)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save as Product"
      description="Saved products can be reused in sets, the editor, and the generator."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save Product
          </Button>
        </>
      }
    >
      <Field
        label="Product name"
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') void save() }}
        autoFocus
      />
    </Dialog>
  )
}
