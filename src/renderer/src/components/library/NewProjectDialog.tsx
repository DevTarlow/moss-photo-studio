import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ImportResult } from '@shared/types'
import { unwrap, messageOf } from '../../lib/ipc'
import { fileToBytes } from '../../lib/files'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { Dialog } from '../ui/Dialog'
import { Dropzone } from '../ui/Dropzone'
import { Button } from '../ui/Button'
import { SourcePickerDialog } from '../sources/SourcePickerDialog'
import type { SourceChoice } from '../sources/SourcePickerDialog'

export function NewProjectDialog({
  open,
  type,
  personId,
  onOpenChange
}: {
  open: boolean
  type: 'set' | 'photo' | null
  personId?: string | null
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const finish = (result: ImportResult | null): void => {
    if (!result?.projectId) return
    warnIfSmallPhoto(result)
    onOpenChange(false)
    navigate(`/project/${result.projectId}${personId ? `?person=${encodeURIComponent(personId)}` : ''}`)
  }

  const openPicker = async (): Promise<void> => {
    if (!type) return
    setBusy(true)
    setError(null)
    try {
      finish(await unwrap(window.moss.dialogs.importImage({ kind: 'source', type })))
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const importFiles = async (files: File[]): Promise<void> => {
    if (!type) return
    const file = files[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(
        window.moss.media.importBytes({
          kind: 'source',
          type,
          bytes: await fileToBytes(file),
          mime: file.type,
          name: file.name
        })
      )
      finish(result)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const chooseSaved = async (choice: SourceChoice): Promise<void> => {
    if (!type) return
    setBusy(true)
    setError(null)
    try {
      const detail = choice.kind === 'product'
        ? await unwrap(window.moss.products.createProject({ productId: choice.productId, type }))
        : await unwrap(window.moss.projects.createFromImage({ sourceImageId: choice.imageId, type }))
      onOpenChange(false)
      navigate(`/project/${detail.project.id}${personId ? `?person=${encodeURIComponent(personId)}` : ''}`)
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
      title={type === 'set' ? 'New Set' : 'New Image Editor'}
      description={type === 'set' ? 'One clear photo of the product. The better the light, the better the set.' : 'Open a photo to start changing it.'}
      width={540}
      footer={<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>}
    >
      <Dropzone
        line={busy ? 'Opening...' : 'One clear photo of the product.'}
        hint={type === 'set' ? 'JPEG, PNG or WebP. Up to 40 MB.' : 'JPEG, PNG or WebP. Up to 40 MB. The original stays untouched.'}
        onFiles={(files) => void importFiles(files)}
        onClick={() => void openPicker()}
        label="Choose a photo"
      />
      <div className="mt-3 flex justify-center">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setPickerOpen(true)}>
          Choose a Saved Photo
        </Button>
      </div>
      {error && <p className="error-text mt-2" role="alert">{error}</p>}
      {type === 'set' && (
        <p className="hint mt-3">Next you'll pick what you sell. The studio plans six images and tells you the cost before it starts.</p>
      )}
      <SourcePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onChoose={(choice) => void chooseSaved(choice)}
        title={type === 'set' ? 'Choose a Set Photo' : 'Choose a Photo to Edit'}
      />
    </Dialog>
  )
}
