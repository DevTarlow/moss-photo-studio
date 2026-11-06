import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import type { Format, Image, Project } from '@shared/types'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { formatLabel, extensionForFormat } from '@shared/shapes'

export function ExportDialog({
  open,
  onOpenChange,
  project,
  image
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  image: Image | null
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [format, setFormat] = useState<Format>(settings?.exportDefaults.format ?? project.format)
  const [quality, setQuality] = useState(settings?.exportDefaults.quality ?? 90)
  const [maxDimension, setMaxDimension] = useState<string>(
    String(settings?.exportDefaults.maxDimension ?? 'original')
  )
  const [filename, setFilename] = useState(project.name)
  const [busy, setBusy] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (!open) return
    setFormat(settings?.exportDefaults.format ?? project.format)
    setQuality(settings?.exportDefaults.quality ?? 90)
    setMaxDimension(String(settings?.exportDefaults.maxDimension ?? 'original'))
    setFilename(image?.label ?? project.name)
  }, [open, project.format, project.name, settings?.exportDefaults, image?.label])

  const run = async (): Promise<void> => {
    if (!image) return
    setBusy(true)
    try {
      const max = maxDimension === 'original' ? null : Number(maxDimension)
      const result = await unwrap(window.moss.exports.images({
        projectId: project.id,
        imageIds: [image.id],
        options: { format, quality, maxDimension: max, filename }
      }))
      await unwrap(window.moss.settings.set({
        key: 'exportDefaults',
        value: { format, quality, maxDimension: max }
      }))
      await refreshSettings()
      if (result.paths.length) toast.status('Image exported.')
      onOpenChange(false)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (): Promise<void> => {
    if (!image) return
    setCopying(true)
    try {
      await unwrap(window.moss.app.copyImage({ imageId: image.id }))
      toast.status('Image copied.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setCopying(false)
    }
  }

  const extension = extensionForFormat(format)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Export image"
      description={`A ${formatLabel(format)} copy of ${image?.label ?? 'this version'}.`}
      width={460}
      footer={
        <>
          <Button variant="ghost" disabled={copying || busy} onClick={() => void copy()}>
            {copying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Copy Image
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || !image}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Export
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <p className="field-label">Format</p>
          <Segmented label="Format" value={format} onChange={setFormat} options={[
            { value: 'webp' as const, label: 'WebP' },
            { value: 'jpeg' as const, label: 'JPEG' },
            { value: 'png' as const, label: 'PNG' }
          ]} />
        </div>
        {format !== 'png' && (
          <div>
            <label className="field-label" htmlFor="export-quality">Quality {quality}</label>
            <input id="export-quality" type="range" min={60} max={100} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="slider" />
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="export-size">Max dimension</label>
          <select id="export-size" className="field" value={maxDimension} onChange={(event) => setMaxDimension(event.target.value)}>
            <option value="original">Original</option>
            <option value="2048">2048 px</option>
            <option value="1600">1600 px</option>
            <option value="1080">1080 px</option>
            <option value="800">800 px</option>
          </select>
        </div>
        <Field label="File name" value={filename} onChange={(event) => setFilename(event.target.value)} hint={`.${extension} is added if you leave it off.`} />
      </div>
    </Dialog>
  )
}
