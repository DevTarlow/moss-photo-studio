import { ChevronDown, Download, FolderPlus, Package, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Format, Image, JobState, Shape } from '@shared/types'
import { formatLabel, shapeLabel } from '@shared/shapes'
import { formatDate, formatDateTime, imageCountLabel, usd } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { DescriptionPreview } from '../../components/ui/DescriptionPreview'
import { Segmented } from '../../components/ui/Segmented'
import { ShapePicker } from './ShapePicker'

export interface OutputSettings {
  count: number
  requestedCount: number
  hasReference: boolean
  shape: Shape
  format: Format
  open: boolean
}

function PlaceholderFrames({ count, shape, running }: { count: number; shape: Shape; running: boolean }): React.JSX.Element {
  const ratio = shape === 'square' ? '1 / 1' : shape === 'portrait' ? '2 / 3' : '3 / 2'
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="placeholder-frame"
          data-running={running}
          style={{ aspectRatio: ratio }}
          aria-label={`Placeholder for image ${index + 1}`}
        >
          <span>Image {index + 1}</span>
          <span className="meta">{running ? 'Making…' : 'Waiting'}</span>
        </div>
      ))}
    </div>
  )
}

function runStatus(run: JobState): { label: string; tone?: 'success' | 'danger' } {
  if (run.status === 'done') return { label: 'Made', tone: 'success' }
  if (run.status === 'failed') return { label: 'Failed', tone: 'danger' }
  return { label: 'Stopped' }
}

/**
 * The generator's right-hand inspector.
 *
 * It follows the editor's version panel: the selected image first, then the
 * settings that shape the next make, then History. Keep it presentational; the
 * workspace owns selection, filters, and the paid actions.
 */
export function CreateInspector({
  selected,
  completeJobs,
  runFilterId,
  isRunning,
  canSaveAsPerson,
  settings,
  onOutputOpenChange,
  onCount,
  onShape,
  onFormat,
  onSelectRun,
  onShowAll,
  onEdit,
  onDownload,
  onSaveProduct,
  onSavePerson,
  onSaveToSet,
  onDelete,
  onOpenSet
}: {
  selected: Image | null
  completeJobs: JobState[]
  runFilterId: string | null
  isRunning: boolean
  canSaveAsPerson: boolean
  settings: OutputSettings
  onOutputOpenChange: (open: boolean) => void
  onCount: (count: number) => void
  onShape: (shape: Shape) => void
  onFormat: (format: Format) => void
  onSelectRun: (run: JobState) => void
  onShowAll: () => void
  onEdit: (image: Image) => void
  onDownload: (image: Image) => void
  onSaveProduct: (image: Image) => void
  onSavePerson: (image: Image) => void
  onSaveToSet: (image: Image) => void
  onDelete: (image: Image) => void
  onOpenSet: (setId: string) => void
}): React.JSX.Element {
  const description = selected?.userText?.trim() ?? ''
  const resultSetId = selected?.setId ?? null
  const showTips = !selected && !runFilterId && !isRunning && completeJobs.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="section-label">This image</p>
        {selected ? (
          <>
            <h2 className="mt-2 text-[15px] font-semibold">{selected.label}</h2>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>Made with Meta.</p>

            <div className="mt-4">
              <p className="section-label">Use this image</p>
              <div className="mt-2 space-y-2">
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => onEdit(selected)}>
                  <Icon icon={Pencil} size="sm" /> Edit
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => onDownload(selected)}>
                  <Icon icon={Download} size="sm" /> Download
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => onSaveProduct(selected)}>
                  <Icon icon={Package} size="sm" /> Save as Product
                </Button>
                {canSaveAsPerson && (
                  <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => onSavePerson(selected)}>
                    <Icon icon={UserPlus} size="sm" /> Save as Person
                  </Button>
                )}
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => onSaveToSet(selected)}>
                  <Icon icon={FolderPlus} size="sm" /> Add to Set
                </Button>
              </div>
            </div>

            {description && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <p className="section-label">Description</p>
                <DescriptionPreview key={selected.id} id="create-result-description" text={description} />
              </div>
            )}

            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="section-label">Details</p>
              <dl className="mt-2 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12px]">
                {selected.width != null && selected.height != null && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>Size</dt>
                    <dd style={{ color: 'var(--text)' }}>{selected.width} × {selected.height}</dd>
                  </>
                )}
                {resultSetId && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>In a Set</dt>
                    <dd>
                      <button
                        type="button"
                        className="text-[12px] font-medium"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => onOpenSet(resultSetId)}
                      >
                        Open Set
                      </button>
                    </dd>
                  </>
                )}
                <dt style={{ color: 'var(--text-faint)' }}>Created</dt>
                <dd style={{ color: 'var(--text)' }}>{formatDateTime(selected.createdAt)}</dd>
                <dt style={{ color: 'var(--text-faint)' }}>Cost</dt>
                <dd style={{ color: 'var(--text)' }}>{selected.costCents > 0 ? usd(selected.costCents) : 'Free'}</dd>
              </dl>
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                style={{ color: 'var(--danger)' }}
                onClick={() => onDelete(selected)}
              >
                <Icon icon={Trash2} size="sm" /> Delete Image
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-2">
            <p className="text-[13px] font-semibold">
              {settings.requestedCount > 1 && !settings.hasReference && !runFilterId
                ? isRunning ? `Making ${settings.requestedCount} images…` : `${settings.requestedCount} images will come back`
                : isRunning ? 'Making your first image…' : runFilterId ? 'No images from this make.' : 'Nothing made yet'}
            </p>
            <p className="meta mt-1">
              {settings.requestedCount > 1 && !settings.hasReference && !runFilterId
                ? 'Each frame fills in as its image comes back.'
                : isRunning
                  ? 'It will show here when it comes back.'
                  : runFilterId
                    ? 'Choose Show all to see your other images.'
                    : 'Make an image and it will show here.'}
            </p>
            {settings.requestedCount > 1 && !settings.hasReference && !runFilterId && (
              <PlaceholderFrames count={settings.requestedCount} shape={settings.shape} running={isRunning} />
            )}
            {showTips && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <p className="section-label">For a better picture</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  <li>Name the product and what it sits on.</li>
                  <li>Describe the light and the angle you want.</li>
                  <li>Add a product photo to keep the product exactly the same.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            className="w-full text-left"
            aria-expanded={settings.open}
            aria-controls="create-output-settings"
            onClick={() => onOutputOpenChange(!settings.open)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="section-label">Output settings</span>
              <Icon icon={ChevronDown} size="xsm" style={{ transform: settings.open ? 'rotate(180deg)' : undefined }} />
            </span>
            <span className="meta mt-1 block">
              {[imageCountLabel(settings.requestedCount), shapeLabel(settings.shape), formatLabel(settings.format)].filter(Boolean).join(' · ')}
            </span>
          </button>
          <div id="create-output-settings" hidden={!settings.open} className="mt-4 space-y-4">
            <div>
              <p className="field-label">How many</p>
              {settings.hasReference ? (
                <p className="hint">With a product, person, or scene, Moss makes one image at a time.</p>
              ) : (
                <Segmented
                  label="How many images"
                  value={String(settings.count) as '1' | '2' | '3' | '4'}
                  onChange={(value) => onCount(Number(value))}
                  options={[1, 2, 3, 4].map((value) => ({
                    value: String(value) as '1' | '2' | '3' | '4',
                    label: String(value)
                  }))}
                />
              )}
            </div>
            <div>
              <p className="field-label">Shape</p>
              <ShapePicker value={settings.shape} onChange={onShape} />
            </div>
            <div>
              <p className="field-label">Format</p>
              <Segmented
                label="Format"
                value={settings.format}
                onChange={onFormat}
                options={[
                  { value: 'webp' as const, label: 'WebP' },
                  { value: 'jpeg' as const, label: 'JPEG' },
                  { value: 'png' as const, label: 'PNG' }
                ]}
              />
              <p className="hint mt-1">The file type for made and downloaded images.</p>
            </div>
            <p className="hint">Shape sets the frame. Meta chooses the exact size.</p>
          </div>
        </div>

        {completeJobs.length > 0 && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="section-label">History</p>
              {runFilterId && (
                <button type="button" className="text-[11px]" style={{ color: 'var(--accent)' }} onClick={onShowAll}>
                  Show all
                </button>
              )}
            </div>
            {completeJobs.length > 1 && !runFilterId && (
              <p className="hint mt-1">Choose a date to see only its images.</p>
            )}
            <div className="mt-2 space-y-1.5">
              {completeJobs.map((run) => {
                const status = runStatus(run)
                const isSelected = run.id === runFilterId
                return (
                  <button
                    key={run.id}
                    type="button"
                    aria-pressed={isSelected}
                    className="w-full rounded-[8px] border p-2 text-left"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--accent-soft)' : 'transparent'
                    }}
                    onClick={() => onSelectRun(run)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium">{formatDate(run.startedAt, true)}</span>
                      <span className="badge" data-tone={status.tone}>{status.label}</span>
                    </div>
                    <p className="meta mt-0.5">{[imageCountLabel(run.done), usd(run.costCents)].filter(Boolean).join(' · ')}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
