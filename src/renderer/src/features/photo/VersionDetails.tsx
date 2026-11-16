import { Copy, Download, FolderPlus, Package, Plus, Trash2, UserPlus } from 'lucide-react'
import { Badge, Icon } from '@astryxdesign/core'
import type { Image, Project } from '@shared/types'
import { templateById } from '@shared/prompts/templates'
import { shapeLabel } from '@shared/shapes'
import { usd, formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { DescriptionPreview } from '../../components/ui/DescriptionPreview'
import { Segmented } from '../../components/ui/Segmented'

export function VersionDetails({
  project,
  selected,
  parentId,
  parentLabel,
  busy = false,
  onNewVersion,
  onFormatChange,
  onSelectVersion,
  onOpenSet,
  onExport,
  onCopy,
  onDelete,
  onSaveProduct,
  onSavePerson,
  onSaveToSet
}: {
  project: Project
  selected: Image | null
  parentId?: string | null
  parentLabel: string | null
  busy?: boolean
  onNewVersion: () => void
  onFormatChange: (format: Project['format']) => void
  onSelectVersion?: (id: string) => void
  onOpenSet?: () => void
  onExport?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onSaveProduct?: () => void
  onSavePerson?: () => void
  onSaveToSet?: () => void
}): React.JSX.Element {
  const template = selected?.templateId ? templateById(selected.templateId) : undefined
  const templateName = selected?.templateId === 'quick-fix' ? 'Quick fix' : template?.label
  const status = selected?.isOriginal
    ? { label: 'Original', variant: 'neutral' as const }
    : selected?.adjust
      ? { label: 'Adjusted', variant: 'success' as const }
      : { label: 'AI edit', variant: 'info' as const }
  const description = selected?.userText?.trim() ?? ''
  const cost = selected ? (selected.costCents > 0 ? usd(selected.costCents) : 'Free') : ''
  const hasActions = Boolean(onSaveProduct || onSavePerson || onSaveToSet || onExport || onCopy)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="section-label">Version</p>
        {selected ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">{selected.label}</h2>
              <Badge label={status.label} variant={status.variant} />
            </div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {selected.isOriginal
                ? 'The original upload. It never changes.'
                : selected.adjust
                  ? 'A free local adjustment.'
                  : 'Made with Meta.'}
            </p>

            {hasActions && (
              <div className="mt-4">
                <p className="section-label">Use this version</p>
                <div className="mt-2 space-y-2">
                  {onSaveProduct && (
                    <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onSaveProduct}>
                      <Icon icon={Package} size="sm" /> Save as Product
                    </Button>
                  )}
                  {onSavePerson && (
                    <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onSavePerson}>
                      <Icon icon={UserPlus} size="sm" /> Save as Person
                    </Button>
                  )}
                  {onSaveToSet && (
                    <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onSaveToSet}>
                      <Icon icon={FolderPlus} size="sm" /> Add to Set
                    </Button>
                  )}
                  {onExport && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      disabled={busy}
                      onClick={onExport}
                    >
                      <Icon icon={Download} size="sm" /> Export Version
                    </Button>
                  )}
                  {onCopy && (
                    <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onCopy}>
                      <Icon icon={Copy} size="sm" /> Copy Image
                    </Button>
                  )}
                </div>
              </div>
            )}

            {description && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <p className="section-label">Description</p>
                <DescriptionPreview key={selected.id} id="version-description" text={description} />
              </div>
            )}

            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="section-label">Details</p>
              <dl className="mt-2 grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12px]">
                {templateName && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>Quick Look</dt>
                    <dd className="min-w-0" style={{ color: 'var(--text)' }}>{templateName}</dd>
                  </>
                )}
                <dt style={{ color: 'var(--text-faint)' }}>Shape</dt>
                <dd style={{ color: 'var(--text)' }}>{shapeLabel(project.shape)}</dd>
                {selected.width != null && selected.height != null && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>Size</dt>
                    <dd style={{ color: 'var(--text)' }}>{selected.width} × {selected.height}</dd>
                  </>
                )}
                {selected.setId && onOpenSet && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>In a Set</dt>
                    <dd>
                      <button
                        type="button"
                        className="text-[12px] font-medium"
                        style={{ color: 'var(--accent)' }}
                        onClick={onOpenSet}
                      >
                        Open Set
                      </button>
                    </dd>
                  </>
                )}
                {parentId && parentLabel && onSelectVersion && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>Based on</dt>
                    <dd className="min-w-0">
                      <button
                        type="button"
                        className="text-left text-[12px] font-medium"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => onSelectVersion(parentId)}
                      >
                        View {parentLabel}
                      </button>
                    </dd>
                  </>
                )}
                {selected.badge && (
                  <>
                    <dt style={{ color: 'var(--text-faint)' }}>Logo badge</dt>
                    <dd style={{ color: 'var(--text)' }}>Added</dd>
                  </>
                )}
                <dt style={{ color: 'var(--text-faint)' }}>Created</dt>
                <dd style={{ color: 'var(--text)' }}>{formatDateTime(selected.createdAt)}</dd>
                <dt style={{ color: 'var(--text-faint)' }}>Cost</dt>
                <dd style={{ color: 'var(--text)' }}>{cost}</dd>
              </dl>
            </div>

            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="field-label">Export format</p>
              <Segmented
                label="Export format"
                value={project.format}
                onChange={onFormatChange}
                options={[
                  { value: 'webp' as const, label: 'WebP' },
                  { value: 'jpeg' as const, label: 'JPEG' },
                  { value: 'png' as const, label: 'PNG' }
                ]}
              />
              <p className="hint mt-1">Used when you export this version.</p>
            </div>

            {onDelete && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  style={{ color: 'var(--danger)' }}
                  disabled={busy}
                  onClick={onDelete}
                >
                  <Icon icon={Trash2} size="sm" /> Delete Version
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-2">
            <p className="text-[13px] font-semibold">No version selected</p>
            <p className="meta mt-1">Choose a version in the strip below.</p>
          </div>
        )}
      </div>
      {selected && (
        <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" size="sm" className="w-full justify-center" onClick={onNewVersion}>
            <Icon icon={Plus} size="sm" /> New Version
          </Button>
        </div>
      )}
    </div>
  )
}
