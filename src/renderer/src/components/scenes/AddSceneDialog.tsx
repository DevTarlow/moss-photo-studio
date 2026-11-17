import { useEffect, useState } from 'react'
import type { ScenePreset } from '@shared/types'
import { useAppStore } from '../../store/app'
import { fileToBytes } from '../../lib/files'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Dropzone } from '../ui/Dropzone'
import { Field } from '../ui/Field'

function nameFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Scene'
}

/** Add a scene photo with a real name, instead of inheriting the camera filename. */
export function AddSceneDialog({
  open,
  onOpenChange,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (scene: ScenePreset) => void
}): React.JSX.Element {
  const refreshScenes = useAppStore((state) => state.refreshScenes)
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
      setError('Choose a scene photo first.')
      return
    }
    if (!name.trim()) {
      setError('Give the scene a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const scene = await unwrap(
        window.moss.scenes.create({
          name: name.trim(),
          bytes: await fileToBytes(file)
        })
      )
      await refreshScenes()
      toast.status('Scene added.')
      onSaved?.(scene)
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
      title="Add Scene Photo"
      description="Save a setting as a reusable scene. Use a photo with an empty surface, no people and no text."
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !file}>
            {busy ? 'Adding...' : 'Add Scene'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Dropzone
          onFiles={chooseFile}
          line={file ? file.name : 'Drop a scene photo, or choose a file'}
          hint="JPEG, PNG, or WebP. Up to 40 MB. The original stays untouched."
          label="Choose a Scene Photo"
        />
        <Field
          label="Scene name"
          value={name}
          maxLength={80}
          onChange={(event) => {
            setNameTouched(true)
            setName(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
          }}
          placeholder="For example: Marble counter"
          hint="This name shows in Scenes and in the scene picker."
          error={error}
        />
      </div>
    </Dialog>
  )
}
