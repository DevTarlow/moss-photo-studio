import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Format, Project } from '@shared/types'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { unwrap } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { useAppStore } from '../../store/app'
import { showExportToast } from '../../lib/exportFeedback'

export function SetExportDialog({
  open,
  onOpenChange,
  project,
  imageCount,
  onExported
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  imageCount: number
  onExported: (count: number) => void
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [includeVersions, setIncludeVersions] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [format, setFormat] = useState<Format>(settings?.exportDefaults.format ?? project.format)
  const [quality, setQuality] = useState(settings?.exportDefaults.quality ?? 90)
  const maxDimension = settings?.exportDefaults.maxDimension ?? null

  const run = async (): Promise<void> => {
    setExporting(true)
    setCancelling(false)
    try {
      const result = await unwrap(window.moss.exports.set({
        projectId: project.id,
        options: { format, quality, maxDimension, includeVersions }
      }))
      await unwrap(window.moss.settings.set({ key: 'exportDefaults', value: { format, quality, maxDimension } })).catch(() => undefined)
      await refreshSettings().catch(() => undefined)
      if (result.cancelled) {
        toast.status('Export stopped. Completed files are in the folder.')
      } else {
        showExportToast(result.count, result.folderName, project.id)
      }
      if (result.count > 0) onExported(result.count)
      setExporting(false)
      onOpenChange(false)
    } catch {
      toast.error('Those images could not be exported. Nothing is lost. Try again.')
      setExporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (exporting) return
        onOpenChange(next)
      }}
      title="Export Set"
      description={`${imageCount} ${imageCount === 1 ? 'image' : 'images'} will be written to a folder you choose.`}
      width={460}
      footer={
        exporting ? (
          <>
            <Button variant="secondary" disabled={cancelling} onClick={() => {
              setCancelling(true)
              void window.moss.exports.cancel({ projectId: project.id })
            }}>
              {cancelling ? 'Stopping...' : 'Cancel'}
            </Button>
            <Button variant="primary" disabled>
              <Loader2 size={14} className="animate-spin" /> Exporting...
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void run()}>Export</Button>
          </>
        )
      }
    >
      <label className="flex items-start gap-2 text-[12px]">
        <input type="checkbox" checked={includeVersions} onChange={(event) => setIncludeVersions(event.target.checked)} className="mt-0.5" />
        <span>
          Include every version
          <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-faint)' }}>Older versions get a -v2, -v3 suffix. The main version for each shot stays unsuffixed.</span>
        </span>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="set-export-format">Format</label>
          <select id="set-export-format" className="field" value={format} disabled={exporting} onChange={(event) => setFormat(event.target.value as Format)}>
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
        {format !== 'png' && (
          <div>
            <label className="field-label" htmlFor="set-export-quality">Quality {quality}</label>
            <input id="set-export-quality" type="range" min={60} max={100} className="slider" value={quality} disabled={exporting} onChange={(event) => setQuality(Number(event.target.value))} />
          </div>
        )}
      </div>
      {exporting && <p className="hint mt-2" role="status">Writing your set. Cancel stops before the next image.</p>}
      <p className="sr-only" aria-live="polite">{exporting ? 'Exporting images' : ''}</p>
    </Dialog>
  )
}
