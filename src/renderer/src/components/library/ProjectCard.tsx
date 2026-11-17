import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Copy, FolderPlus, Image as ImageIcon, MoreHorizontal, Sparkles, Trash2, UserRound } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Project } from '@shared/types'
import type { JobState } from '@shared/types'
import { formatDate } from '../../lib/format'
import { Progress } from '../ui/Progress'
import { IconButton } from '../ui/IconButton'
import { DropdownMenu } from 'radix-ui'
import { ProjectMenuContent } from './ProjectMenu'

const typeLabel = { photo: 'Image Editor', image: 'Image Generator' } as const
const TypeIcon = { photo: ImageIcon, image: Sparkles } as const

export interface ProjectDraftInfo {
  prompt: string | null
  productName: string | null
  personName: string | null
}

export interface ProjectCardProps {
  project: Project
  view: 'grid' | 'list'
  job?: JobState
  selected: boolean
  selecting: boolean
  draft?: ProjectDraftInfo | null
  onSelect: (selected: boolean) => void
  onOpen: () => void
  onRename: (name: string) => Promise<boolean>
  onDuplicate: () => void
  onAddToSet: () => void
  onExport: () => void
  onDelete: () => void
}

function DraftMeta({ draft }: { draft: ProjectDraftInfo }): React.JSX.Element {
  return (
    <>
      <p className="lib-draft-prompt">
        {draft.prompt ? `“${draft.prompt}”` : 'No description saved yet.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {draft.productName && (
          <span className="badge" title={`Product: ${draft.productName}`}>
            <Icon icon={ImageIcon} size="xsm" /> {draft.productName}
          </span>
        )}
        {draft.personName && (
          <span className="badge" title={`Person: ${draft.personName}`}>
            <Icon icon={UserRound} size="xsm" /> {draft.personName}
          </span>
        )}
        <span className="badge" data-tone="success">Continue draft →</span>
      </div>
    </>
  )
}

export function ProjectCard({
  project,
  view,
  job,
  selected,
  selecting,
  draft = null,
  onSelect,
  onOpen,
  onRename,
  onDuplicate,
  onAddToSet,
  onExport,
  onDelete
}: ProjectCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [nameBusy, setNameBusy] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const renameReadyAt = useRef(0)
  const TypeGlyph = TypeIcon[project.type]
  const progress = job ? Math.min(100, job.total ? ((job.done + job.failed) / job.total) * 100 : 0) : 0
  const isDraft = project.imageCount === 0
  // While a selection exists, a click anywhere on the card toggles it instead
  // of opening the project. Use the capture phase so the card's links never
  // navigate before the toggle runs.
  const cardClick = selecting
    ? (event: React.MouseEvent<HTMLElement>): void => {
        const target = event.target as HTMLElement
        if (target.closest('button, input, textarea, .project-check')) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(!selected)
      }
    : undefined
  const check = (
    <label className="project-check" data-checked={selected} onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${project.name}`}
        onChange={(event) => onSelect(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
    </label>
  )

  const startRename = (): void => {
    setNameValue(project.name)
    setEditingName(true)
    // The dropdown returns focus to its trigger after onSelect. Do not treat
    // that focus hand-off as the new input blurring, and focus the input once
    // the menu has finished closing.
    renameReadyAt.current = Date.now() + 180
    window.setTimeout(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }, 200)
  }

  const cancelRename = (): void => {
    setEditingName(false)
    setNameValue(project.name)
    window.requestAnimationFrame(() => menuRef.current?.focus())
  }

  const commitRename = async (refocus = false): Promise<void> => {
    if (!editingName || nameBusy) return
    if (!refocus && Date.now() < renameReadyAt.current) return
    const value = nameValue.trim()
    if (!value || value === project.name) {
      setEditingName(false)
      setNameValue(project.name)
      if (refocus) window.requestAnimationFrame(() => menuRef.current?.focus())
      return
    }
    setNameBusy(true)
    const saved = await onRename(value)
    setNameBusy(false)
    if (saved) {
      setEditingName(false)
      setNameValue(value)
      if (refocus) window.requestAnimationFrame(() => menuRef.current?.focus())
    }
  }

  const nameField = editingName ? (
    <input
      ref={nameInputRef}
      className="title-rename-input lib-name-input"
      aria-label={`Rename ${project.name}`}
      value={nameValue}
      maxLength={140}
      disabled={nameBusy}
      onChange={(event) => setNameValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => void commitRename()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commitRename(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancelRename()
        }
      }}
    />
  ) : null

  const quickActions = !selecting ? (
    <div className="lib-quick-actions">
      <IconButton label={`Open ${project.name}`} onClick={(event) => { event.stopPropagation(); onOpen() }}>
        <Icon icon={ArrowUpRight} size="sm" />
      </IconButton>
      <IconButton label={`Duplicate ${project.name}`} onClick={(event) => { event.stopPropagation(); onDuplicate() }}>
        <Icon icon={Copy} size="sm" />
      </IconButton>
      <IconButton
        label={`Add ${project.name} to a Set`}
        disabled={project.imageCount === 0}
        onClick={(event) => { event.stopPropagation(); onAddToSet() }}
      >
        <Icon icon={FolderPlus} size="sm" />
      </IconButton>
      <IconButton label={`Delete ${project.name}`} onClick={(event) => { event.stopPropagation(); onDelete() }}>
        <Icon icon={Trash2} size="sm" />
      </IconButton>
    </div>
  ) : null

  const menu = (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <button ref={menuRef} type="button" className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Actions for ${project.name}`}>
          <Icon icon={MoreHorizontal} size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <ProjectMenuContent
          onRename={startRename}
          onDuplicate={onDuplicate}
          onAddToSet={() => onAddToSet()}
          onExport={onExport}
          onDelete={onDelete}
        />
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )

  if (view === 'list') {
    return (
      <div
        className="lib-list-row group relative"
        data-selected={selected}
        data-selecting={selecting}
        data-draft={isDraft}
        onClickCapture={cardClick}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenuOpen(true)
        }}
      >
        {check}
        <Link to={`/project/${project.id}`} className="absolute inset-0 z-0" aria-label={`Open ${project.name}`} />
        {project.coverUrl ? (
          <img src={project.coverUrl} alt="" className="lib-thumb relative z-10 pointer-events-none" />
        ) : (
          <div className="lib-thumb relative z-10 grid place-items-center pointer-events-none" style={{ color: 'var(--text-faint)' }}>
            <Icon icon={TypeGlyph} size="md" />
          </div>
        )}
        <div className={editingName ? 'min-w-0 flex-1 pointer-events-auto relative z-20' : 'min-w-0 flex-1 pointer-events-none'}>
          {nameField ?? <p className="truncate text-[13px] font-medium">{project.name}</p>}
          {isDraft && draft ? (
            <p className="meta truncate">{draft.prompt ? `Draft · “${draft.prompt}”` : 'Draft · No description saved yet'}</p>
          ) : (
            <p className="meta truncate">
              {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} · {formatDate(project.updatedAt)}
            </p>
          )}
        </div>
        {draft?.productName && <span className="badge pointer-events-none">{draft.productName}</span>}
        {draft?.personName && <span className="badge pointer-events-none">{draft.personName}</span>}
        {isDraft && <span className="badge pointer-events-none" data-tone="success">Continue draft →</span>}
        <span className="badge pointer-events-none">{typeLabel[project.type]}</span>
        {job && (
          <span className="badge" data-tone="success">
            Making {job.done + job.failed} of {job.total}
          </span>
        )}
        {quickActions}
        <div className="relative z-10 pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">{menu}</div>
        {job && (
          <div className="absolute bottom-0 left-0 right-0">
            <Progress value={progress} max={100} label="Making" />
          </div>
        )}
      </div>
    )
  }

  return (
    <article
      className="lib-card card card-hover group relative"
      data-selected={selected}
      data-selecting={selecting}
      data-draft={isDraft}
      onClickCapture={cardClick}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
    >
      {check}
      <Link to={`/project/${project.id}`} aria-label={`Open ${project.name}`} className="absolute inset-0 z-0" />
      {project.coverUrl ? (
        <img src={project.coverUrl} alt="" className={isDraft ? 'lib-cover pointer-events-none relative z-0 lib-cover-draft' : 'lib-cover pointer-events-none relative z-0'} />
      ) : (
        <div className="lib-cover-empty pointer-events-none relative z-0">
          <Icon icon={TypeGlyph} size="lg" />
        </div>
      )}
      {quickActions}
      <div className={editingName ? 'pointer-events-auto relative z-20 p-3' : 'pointer-events-none relative z-10 p-3'}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {nameField ?? (
              <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {project.name}
              </p>
            )}
            {isDraft && draft ? (
              <DraftMeta draft={draft} />
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="badge">{typeLabel[project.type]}</span>
                {job ? (
                  <span className="badge" data-tone="success">Making</span>
                ) : (
                  <span className="meta">{project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} · {formatDate(project.updatedAt)}</span>
                )}
              </div>
            )}
          </div>
          <div className="pointer-events-auto relative z-10">{menu}</div>
        </div>
        {job && (
          <div className="mt-2">
            <Progress value={progress} max={100} label={`Making image ${Math.min(job.total, job.done + job.failed + 1)} of ${job.total}`} />
          </div>
        )}
      </div>
    </article>
  )
}
