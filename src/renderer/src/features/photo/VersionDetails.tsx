import { FolderPlus, Package, Plus, UserPlus } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Image, Project } from '@shared/types'
import { templateById } from '@shared/prompts/templates'
import { shapeLabel } from '@shared/shapes'
import { usd, formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/Segmented'

export function VersionDetails({
  project,
  selected,
  parentLabel,
  onNewVersion,
  onFormatChange,
  onSaveProduct,
  onSavePerson,
  onSaveToSet
}: {
  project: Project
  selected: Image | null
  parentLabel: string | null
  onNewVersion: () => void
  onFormatChange: (format: Project['format']) => void
  onSaveProduct?: () => void
  onSavePerson?: () => void
  onSaveToSet?: () => void
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
              {selected.isOriginal ? 'The original upload. It never changes.' : selected.adjust ? 'A free adjustment. Stored as a version.' : 'Made with Meta.'}
            </p>
            {selected.userText && (
              <div>
                <p className="section-label mt-3">Your words</p>
                <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{selected.userText}</p>
              </div>
            )}
            {templateName && (
              <p className="meta">Look: {templateName}</p>
            )}
            <p className="meta">Shape: {shapeLabel(project.shape)}</p>
            {selected.setId && <p className="meta">In a Set</p>}
            <div>
              <p className="meta">File format</p>
              <div className="mt-1">
                <Segmented
                  label="File format"
                  value={project.format}
                  onChange={onFormatChange}
                  options={[
                    { value: 'webp' as const, label: 'WebP' },
                    { value: 'jpeg' as const, label: 'JPEG' },
                    { value: 'png' as const, label: 'PNG' }
                  ]}
                />
              </div>
            </div>
            <p className="meta">Made: {formatDateTime(selected.createdAt)}</p>
            <p className="meta">Cost: {selected.adjust ? 'Free' : usd(selected.costCents)}</p>
            {selected.badge && <p className="meta">Logo badge added.</p>}
            {parentLabel && <p className="meta">From {parentLabel}</p>}
          </div>
          {(onSaveProduct || onSavePerson || onSaveToSet) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onSaveProduct && (
                <Button variant="secondary" size="sm" onClick={onSaveProduct}>
                  <Icon icon={Package} size="sm" /> Save as Product
                </Button>
              )}
              {onSavePerson && (
                <Button variant="secondary" size="sm" onClick={onSavePerson}>
                  <Icon icon={UserPlus} size="sm" /> Save as Person
                </Button>
              )}
              {onSaveToSet && (
                <Button variant="secondary" size="sm" onClick={onSaveToSet}>
                  <Icon icon={FolderPlus} size="sm" /> Add to Set
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="meta mt-2">Choose a version.</p>
      )}

      {selected && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" size="sm" onClick={onNewVersion}>
            <Icon icon={Plus} size="sm" /> New Version
          </Button>
        </div>
      )}
    </div>
  )
}
