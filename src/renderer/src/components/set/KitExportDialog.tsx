import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Project } from '@shared/types'
import { MARKETPLACES, MARKETPLACES_AS_OF, marketplaceById } from '@shared/marketplaces'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { unwrap } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { showExportToast } from '../../lib/exportFeedback'

export function KitExportDialog({
  open,
  onOpenChange,
  project,
  productName,
  imageCount,
  onExported
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  productName: string
  imageCount: number
  onExported?: (count: number) => void
}): React.JSX.Element {
  const [platform, setPlatform] = useState('etsy')
  const [includeOriginal, setIncludeOriginal] = useState(true)
  const [exporting, setExporting] = useState(false)
  const preset = marketplaceById(platform)

  const choosePlatform = (next: string): void => {
    setPlatform(next)
    setIncludeOriginal(marketplaceById(next).includeOriginal)
  }

  const run = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await unwrap(
        window.moss.kit.export({ projectId: project.id, platform, includeOriginal })
      )
      if (result.count === 0) {
        toast.error('There are no ready images to kit yet.')
        setExporting(false)
        return
      }
      showExportToast(result.count, result.folderName, project.id)
      if (result.warnings.length) toast.error(result.warnings[0]!)
      if (result.includesOriginal) toast.status('The untouched original photo is in the kit.')
      onExported?.(result.count)
      setExporting(false)
      onOpenChange(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'The listing kit could not be written.')
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
      title="Export Listing Kit"
      description={`${productName}: ${imageCount} ready ${imageCount === 1 ? 'image' : 'images'}, written for one shop.`}
      width={480}
      footer={
        exporting ? (
          <Button variant="primary" disabled>
            <Loader2 size={14} className="animate-spin" /> Writing the kit...
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void run()}>Export Kit</Button>
          </>
        )
      }
    >
      <div>
        <label className="field-label" htmlFor="kit-platform">Shop</label>
        <select id="kit-platform" className="field" value={platform} disabled={exporting} onChange={(event) => choosePlatform(event.target.value)}>
          {MARKETPLACES.map((marketplace) => (
            <option key={marketplace.id} value={marketplace.id}>{marketplace.label}</option>
          ))}
        </select>
        <p className="hint mt-2">{preset.note}</p>
      </div>
      <label className="mt-4 flex items-start gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={includeOriginal}
          disabled={exporting}
          onChange={(event) => setIncludeOriginal(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Include the untouched original photo
          <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-faint)' }}>
            Recommended for Etsy. The kit writes `original` beside the listing images and names it in the manifest.
          </span>
        </span>
      </label>
      <div className="mt-4 rounded-[8px] border p-3 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <p>Each image is written at {preset.width} × {preset.height}, with an alt-text line and a CSV manifest.</p>
        <p className="mt-1">Rules checked {MARKETPLACES_AS_OF}. Check the shop's current limits before uploading.</p>
      </div>
    </Dialog>
  )
}
