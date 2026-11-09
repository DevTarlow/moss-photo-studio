import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Image as ImageIcon, Layers, MoreHorizontal, Sparkles } from 'lucide-react'
import type { Project } from '@shared/types'
import type { JobState } from '@shared/types'
import { formatDate } from '../../lib/format'
import { Progress } from '../ui/Progress'
import { DropdownMenu } from 'radix-ui'
import { ProjectMenuContent } from './ProjectMenu'

const typeLabel = { set: 'Set', photo: 'Image Editor', image: 'Image Generator' } as const
const TypeIcon = { set: Layers, photo: ImageIcon, image: Sparkles } as const

export interface ProjectCardProps {
  project: Project
  view: 'grid' | 'list'
  job?: JobState
  selected: boolean
  selecting: boolean
  onSelect: (selected: boolean) => void
  onRename: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

export function ProjectCard({
  project,
  view,
  job,
  selected,
  selecting,
  onSelect,
  onRename,
  onDuplicate,
  onExport,
  onDelete
}: ProjectCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const Icon = TypeIcon[project.type]
  const progress = job ? Math.min(100, job.total ? ((job.done + job.failed) / job.total) * 100 : 0) : 0
  // While a selection exists, a click anywhere on the card toggles it instead
  // of opening the project. Use the capture phase so the card's links never
  // navigate before the toggle runs.
  const cardClick = selecting
    ? (event: React.MouseEvent<HTMLElement>): void => {
        const target = event.target as HTMLElement
        if (target.closest('button, .project-check')) return
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
  const menu = (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <button ref={menuRef} type="button" className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Actions for ${project.name}`}>
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <ProjectMenuContent onRename={onRename} onDuplicate={onDuplicate} onExport={onExport} onDelete={onDelete} />
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )

  if (view === 'list') {
    return (
      <div
        className="lib-list-row group relative"
        data-selected={selected}
        data-selecting={selecting}
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
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1 pointer-events-none">
          <p className="truncate text-[13px] font-medium">{project.name}</p>
          <p className="meta truncate">
            {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} · {formatDate(project.updatedAt)}
          </p>
        </div>
        <span className="badge pointer-events-none">{typeLabel[project.type]}</span>
        {job && (
          <span className="badge" data-tone="success">
            Making {job.done + job.failed} of {job.total}
          </span>
        )}
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
      onClickCapture={cardClick}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
    >
      {check}
      <Link to={`/project/${project.id}`} aria-label={`Open ${project.name}`} className="absolute inset-0 z-0" />
      {project.coverUrl ? (
        <img src={project.coverUrl} alt="" className="lib-cover pointer-events-none relative z-0" />
      ) : (
        <div className="lib-cover-empty pointer-events-none relative z-0">
          <Icon size={24} />
        </div>
      )}
      <div className="pointer-events-none relative z-10 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {project.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="badge">{typeLabel[project.type]}</span>
              {job ? (
                <span className="badge" data-tone="success">Making</span>
              ) : (
                <span className="meta">{project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} · {formatDate(project.updatedAt)}</span>
              )}
            </div>
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
