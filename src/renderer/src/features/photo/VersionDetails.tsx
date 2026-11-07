import { Package, Plus } from 'lucide-react'
import type { Image, Project } from '@shared/types'
import { templateById } from '@shared/prompts/templates'
import { shapeLabel } from '@shared/shapes'
import { usd, formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/Button'

export function VersionDetails({
  project,
  selected,
  images,
  parentLabel,
  onSelect,
  onNewVersion,
  onFormatChange,
  onSaveProduct
}: {
  project: Project
  selected: Image | null
  images: Image[]
  parentLabel: string | null
  onSelect: (id: string) => void
  onNewVersion: () => void
  onFormatChange: (format: Project['format']) => void
  onSaveProduct?: () => void
}): React.JSX.Element {
  const template = selected?.templateId ? templateById(selected.templateId) : undefined
  const templateName = selected?.templateId === 'quick-fix' ? 'Quick fix' : template?.label
  return (
    <div className="p-4">
      <p className="section-label">Version</p>
      {selected ? (
        <>
          <h2 className="mt-2 text-[14px] font-semibold">{selected.label}</h2>
          <div className="mt-2 space-y-1.5 text-[12px]">
            <p style={{ color: 'var(--text-muted)' }}>
              {selected.isOriginal ? 'The original upload. It never changes.' : selected.adjust ? 'A local adjust. Free and stored as a version.' : 'Made with Meta Muse.'}
            </p>
            {selected.userText && (
              <div>
                <p className="section-label mt-3">Your words</p>
                <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{selected.userText}</p>
              </div>
            )}
            {templateName && (
              <p className="meta">Tile: {templateName}</p>
            )}
            <p className="meta">Shape: {shapeLabel(project.shape)}</p>
            <div className="flex items-center gap-2">
              <label htmlFor="version-output-format" className="meta">Next change format</label>
              <select id="version-output-format" className="field h-7 w-[86px] text-[11px]" value={project.format} onChange={(event) => onFormatChange(event.target.value as Project['format'])}>
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </div>
            <p className="meta">Made: {formatDateTime(selected.createdAt)}</p>
            <p className="meta">Cost: {selected.adjust ? 'Free' : usd(selected.costCents)}</p>
            {selected.badge && <p className="meta">Logo badge added.</p>}
            {parentLabel && <p className="meta">From {parentLabel}</p>}
          </div>
          {onSaveProduct && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onSaveProduct}>
              <Package size={14} /> Save as Product
            </Button>
          )}
        </>
      ) : (
        <p className="meta mt-2">Choose a version.</p>
      )}

      <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="section-label">Versions</p>
          {selected && (
            <Button variant="secondary" size="sm" onClick={onNewVersion}>
              <Plus size={14} /> New Version
            </Button>
          )}
        </div>
        <div className="mt-2 space-y-1">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-[6px] p-1.5 text-left"
              style={{ background: selected?.id === image.id ? 'var(--accent-soft)' : 'transparent', color: selected?.id === image.id ? 'var(--accent)' : 'var(--text)' }}
              onClick={() => onSelect(image.id)}
            >
              {image.thumbUrl ? (
                <img src={image.thumbUrl} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <span className="h-8 w-8 rounded" style={{ background: 'var(--surface-2)' }} />
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{image.label}</span>
              {image.isOriginal && <span className="badge pill-sm">Original</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
