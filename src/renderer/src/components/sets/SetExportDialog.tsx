import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { EXPORT_PRESETS } from '@shared/exportPresets'
import type { ExportPreset } from '@shared/exportPresets'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'

export function SetExportDialog({
  open,
  onOpenChange,
  setName,
  busy,
  onExport
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  setName: string
  busy: boolean
  onExport: (preset: ExportPreset) => void
}): React.JSX.Element {
  const [preset, setPreset] = useState<ExportPreset>('original')

  useEffect(() => {
    if (open) setPreset('original')
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!busy) onOpenChange(next) }}
      title="Export Set"
      description={`Choose how the images in "${setName}" are saved. Each export creates a new folder, so earlier exports stay.`}
      width={560}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => onExport(preset)}>
            {busy ? 'Exporting...' : <><Icon icon={Download} size="sm" /> Export Set</>}
          </Button>
        </>
      }
    >
      <div className="grid gap-2" role="group" aria-label="Export preset">
        {EXPORT_PRESETS.map((option) => {
          const selected = option.id === preset
          return (
            <button
              key={option.id}
              type="button"
              className="export-preset-card"
              aria-pressed={selected}
              data-selected={selected}
              disabled={busy}
              onClick={() => setPreset(option.id)}
            >
              <span className="export-preset-frame" data-preset={option.id} aria-hidden />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-semibold">{option.label}</span>
                <span className="meta block">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
