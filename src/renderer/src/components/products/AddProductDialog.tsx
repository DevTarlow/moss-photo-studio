import { useEffect, useState } from 'react'
import type { Product } from '@shared/types'
import { useAppStore } from '../../store/app'
import { fileToBytes } from '../../lib/files'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Dropzone } from '../ui/Dropzone'
import { Field } from '../ui/Field'

function nameFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Product'
}

/** Add a product photo with a real name, instead of inheriting the camera filename. */
export function AddProductDialog({
  open,
  onOpenChange,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (product: Product) => void
}): React.JSX.Element {
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setName('')
    setNameTouched(false)
    setBusy(false)
    setError(null)
  }, [open])

  const chooseFile = (files: File[]): void => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setError(null)
    if (!nameTouched || !name.trim()) setName(nameFromFile(next.name))
  }

  const save = async (): Promise<void> => {
    if (!file) {
      setError('Choose a product photo first.')
      return
    }
    if (!name.trim()) {
      setError('Give the product a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const product = await unwrap(
        window.moss.products.createFromBytes({
          bytes: await fileToBytes(file),
          name: name.trim()
        })
      )
      await refreshProducts()
      toast.status('Product added.')
      onSaved?.(product)
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
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
      title="Add Product Photo"
      description="Save one clear photo as a reusable Product. You can use it in the editor or generator."
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !file}>
            {busy ? 'Adding...' : 'Add Product'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Dropzone
          onFiles={chooseFile}
          line={file ? file.name : 'Drop a product photo, or choose a file'}
          hint="JPEG, PNG, or WebP. Up to 40 MB. The original stays untouched."
          label="Choose a Photo"
        />
        <Field
          label="Product name"
          value={name}
          maxLength={80}
          onChange={(event) => {
            setNameTouched(true)
            setName(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
          }}
          placeholder="For example: Studio mug"
          hint="This name shows in Products and in the pickers."
          error={error}
        />
      </div>
    </Dialog>
  )
}
