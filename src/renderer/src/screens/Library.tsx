import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import {
  ChevronDown,
  ChevronsUpDown,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import type { Project, ProjectFilter, ProjectSort } from '@shared/types'
import { useLibraryStore } from '../store/library'
import { useAppStore } from '../store/app'
import { useJobsStore } from '../store/jobs'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { Dialog } from '../components/ui/Dialog'
import { Field } from '../components/ui/Field'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { LibrarySkeleton } from '../components/ui/Skeleton'
import { ProjectCard } from '../components/library/ProjectCard'
import { NewProjectDialog } from '../components/library/NewProjectDialog'
import { SetupCard } from '../components/library/SetupCard'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { unwrap, messageOf } from '../lib/ipc'
import { usd } from '../lib/format'
import { toast } from '../lib/toast'
import { showExportToast } from '../lib/exportFeedback'
import { onCommand } from '../lib/commands'
import { fileToBytes } from '../lib/files'
import { warnIfSmallPhoto } from '../lib/photoWarnings'
import { Pagination } from '../components/ui/Pagination'

const filters: Array<{ id: ProjectFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sets', label: 'Sets' },
  { id: 'photos', label: 'Photos' },
  { id: 'images', label: 'Images' }
]
const sorts: Array<{ id: ProjectSort; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'Name' }
]

export function Library(): React.JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const confirm = useConfirm()
  const store = useLibraryStore()
  const jobs = useJobsStore((state) => state.jobs)
  const secrets = useAppStore((state) => state.secrets)
  const license = useAppStore((state) => state.license)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const applyLicense = useAppStore((state) => state.applyLicense)
  const [newType, setNewType] = useState<'set' | 'photo' | null>(null)
  const [newPersonId, setNewPersonId] = useState<string | null>(null)
  const [renameProject, setRenameProject] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [search, setSearch] = useState(store.search)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void store.load()
    void store.refreshMonth()
    // Initial load only. Filter changes load themselves.
  }, [])

  useEffect(() => {
    // The input starts from the store value. Skip the initial effect so the
    // mount load is not raced by a second debounced load.
    if (search === store.search) return
    const timer = window.setTimeout(() => {
      store.setSearch(search)
      void store.load()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [search, store.search])

  const runningCount = Object.values(jobs).filter((job) => job.status === 'running').length
  const previousRunning = useRef(runningCount)
  useEffect(() => {
    if (previousRunning.current > 0 && runningCount === 0) {
      void store.refresh()
      void store.refreshMonth()
    }
    previousRunning.current = runningCount
  }, [runningCount, store])

  useEffect(() => {
    const nextType = params.get('new')
    if (nextType === 'set' || nextType === 'photo') {
      setNewType(nextType)
      setNewPersonId(params.get('person'))
      setParams({}, { replace: true })
    } else if (nextType === 'image') {
      setParams({}, { replace: true })
      void createImageProject()
    }
    if (params.get('focus') === 'search') {
      setParams({}, { replace: true })
      window.setTimeout(() => searchRef.current?.focus(), 30)
    }
  }, [params])

  useEffect(() => {
    return onCommand((command) => {
      if (command === 'focus-search') searchRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    const loaded = new Set(store.items.map((item) => item.id))
    setSelected((previous) => {
      const next = new Set([...previous].filter((id) => loaded.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [store.items])

  const createImageProject = async (): Promise<void> => {
    try {
      const detail = await unwrap(window.moss.projects.create({ type: 'image' }))
      navigate(`/project/${detail.project.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openNew = (type: 'set' | 'photo' | 'image'): void => {
    if (!canGenerate && type !== 'image') {
      toast.error(license?.status === 'expired' ? 'Reactivate to make images.' : 'Add your Muse key in Settings to make images.')
    }
    if (type === 'image') {
      void createImageProject()
      return
    }
    setNewPersonId(null)
    setNewType(type)
  }

  const duplicate = async (project: Project): Promise<void> => {
    try {
      await store.duplicate(project.id)
      toast.status('Project duplicated.')
    } catch {
      toast.error('The project could not be duplicated.')
    }
  }

  const remove = async (project: Project): Promise<void> => {
    const count = project.imageCount
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      body: `Its ${count} ${count === 1 ? 'image leaves' : 'images leave'} this computer. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    try {
      await store.remove(project.id)
      toast.status('Project deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const toggleSelect = (id: string, next: boolean): void => {
    setSelected((previous) => {
      const updated = new Set(previous)
      if (next) updated.add(id)
      else updated.delete(id)
      return updated
    })
  }

  const removeSelected = async (): Promise<void> => {
    const projects = store.items.filter((project) => selected.has(project.id))
    if (!projects.length) return
    const count = projects.length
    const images = projects.reduce((sum, project) => sum + project.imageCount, 0)
    const ok = await confirm({
      title: count === 1 ? `Delete "${projects[0]!.name}"?` : `Delete ${count} projects?`,
      body: `${count === 1 ? 'Its' : 'Their'} ${images} ${images === 1 ? 'image leaves' : 'images leave'} this computer. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    setDeleting(true)
    try {
      const failed = await store.removeMany(projects.map((project) => project.id))
      const deleted = count - failed.length
      if (deleted > 0) {
        toast.status(`${deleted} ${deleted === 1 ? 'project' : 'projects'} deleted.`)
      }
      if (failed.length > 0) {
        setSelected(new Set(failed))
        toast.error(`${failed.length === 1 ? 'One project' : `${failed.length} projects`} could not be deleted. Stop any run and try again.`)
      } else {
        setSelected(new Set())
      }
    } finally {
      setDeleting(false)
    }
  }

  const exportProject = async (project: Project): Promise<void> => {
    try {
      if (project.type === 'set') {
        const result = await unwrap(window.moss.exports.set({ projectId: project.id, options: { format: project.format, quality: 90, maxDimension: null } }))
        showExportToast(result.count, result.folderName, project.id)
        return
      }
      const images = await unwrap(window.moss.images.list({ projectId: project.id }))
      const image = images.find((entry) => entry.id === project.coverImageId) ?? images[images.length - 1]
      if (!image) {
        toast.error('Make an image first.')
        return
      }
      const result = await unwrap(window.moss.exports.images({
        projectId: project.id,
        imageIds: [image.id],
        options: {
          format: project.format,
          quality: 90,
          maxDimension: null,
          filename: project.name
        }
      }))
      showExportToast(result.count, result.folderName, project.id)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const rename = async (): Promise<void> => {
    if (!renameProject) return
    const value = renameValue.trim()
    if (!value) return
    try {
      await store.rename(renameProject.id, value)
      setRenameProject(null)
      toast.status('Project renamed.')
    } catch {
      toast.error('The project could not be renamed.')
    }
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragOver(false)
    const file = [...event.dataTransfer.files].find((entry) => ['image/jpeg', 'image/png', 'image/webp'].includes(entry.type))
    if (!file) {
      toast.error('That file is not a JPEG, PNG, or WebP photo.')
      return
    }
    try {
      const result = await unwrap(window.moss.media.importBytes({
        kind: 'source',
        type: event.shiftKey ? 'set' : 'photo',
        bytes: await fileToBytes(file),
        mime: file.type,
        name: file.name
      }))
      warnIfSmallPhoto(result)
      if (result?.projectId) navigate(`/project/${result.projectId}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const jobFor = (projectId: string) =>
    Object.values(jobs)
      .filter((job) => job.projectId === projectId && job.status === 'running')
      .sort((a, b) => b.startedAt - a.startedAt)[0]

  const selectedProjects = store.items.filter((project) => selected.has(project.id))

  const changePage = (page: number): void => {
    store.goToPage(page)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const empty = !store.loading && store.items.length === 0
  const filtering = Boolean(store.search.trim()) || store.filter !== 'all'

  const renderProject = (project: Project, view: 'grid' | 'list'): React.ReactNode => (
    <ProjectCard
      project={project}
      view={view}
      job={jobFor(project.id)}
      selected={selected.has(project.id)}
      selecting={selected.size > 0}
      onSelect={(next) => toggleSelect(project.id, next)}
      onRename={() => { setRenameProject(project); setRenameValue(project.name) }}
      onDuplicate={() => void duplicate(project)}
      onExport={() => void exportProject(project)}
      onDelete={() => void remove(project)}
    />
  )

  return (
    <AppFrame>
      <div
        ref={scrollRef}
        className="page-scroll relative"
        onDragEnter={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            dragDepth.current += 1
            setDragOver(true)
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragOver(false)
        }}
        onDrop={(event) => void handleDrop(event)}
      >
        <div className="page-pad page-max">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="page-title">Library</h1>
              <p className="meta">{store.total} {store.total === 1 ? 'project' : 'projects'}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="pill"
                onClick={() => navigate('/usage')}
                title="Open Usage"
              >
                {usd(store.monthCents)} this month
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="primary" aria-label="New project">
                    <Plus size={16} /> New <ChevronDown size={14} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-content" align="end" sideOffset={6}>
                    <DropdownMenu.Item className="menu-item menu-item-stack" onSelect={() => openNew('set')}>
                      <span className="flex items-center gap-2 font-semibold"><Layers size={15} /> Set Creator</span>
                      <span className="pl-6 text-[11px]" style={{ color: 'var(--text-faint)' }}>One photo in, a full set out.</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="menu-item menu-item-stack" onSelect={() => openNew('photo')}>
                      <span className="flex items-center gap-2 font-semibold"><ImageIcon size={15} /> Image Editor</span>
                      <span className="pl-6 text-[11px]" style={{ color: 'var(--text-faint)' }}>Change a photo you already have.</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="menu-item menu-item-stack" onSelect={() => openNew('image')}>
                      <span className="flex items-center gap-2 font-semibold"><Sparkles size={15} /> Image Generator</span>
                      <span className="pl-6 text-[11px]" style={{ color: 'var(--text-faint)' }}>Describe a picture and make it.</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>

          {license?.status === 'grace' && (
            <div className="readonly-banner mt-4" role="status">
              <span>Working offline. License checks resume when you're connected.</span>
              <Button size="sm" variant="secondary" onClick={() => {
                void unwrap(window.moss.license.validate()).then((state) => {
                  applyLicense(state)
                  if (state.status === 'licensed') toast.status('License checked.')
                }).catch(() => toast.error('Could not reach the license server. Try again.'))
              }}>Check Now</Button>
            </div>
          )}
          {!canGenerate && license && (
            <div className="readonly-banner mt-4" role="status">
              <span>
                {license.status === 'expired'
                  ? 'Reactivate to make images. Your library, edits and exports still work.'
                  : 'Add your Muse key in Settings to make images.'}
              </span>
              <Button size="sm" variant="secondary" onClick={() => navigate(license.status === 'expired' ? '/settings/license' : '/settings/studio')}>
                {license.status === 'expired' ? 'Open License' : 'Open Studio'}
              </Button>
            </div>
          )}
          {license?.status !== 'grace' && secrets?.hasKey === false && (
            <div className="readonly-banner mt-4" role="status">
              <span>Add your Muse key in Settings to make images.</span>
              <Button size="sm" variant="secondary" onClick={() => navigate('/settings/studio')}>Open Studio</Button>
            </div>
          )}

          <div className="mt-4">
            <SetupCard />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 md:max-w-[340px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} aria-hidden />
              <input
                ref={searchRef}
                className="field search-field"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter projects">
              {filters.map((filter) => (
                <Chip key={filter.id} selected={store.filter === filter.id} onClick={() => store.setFilter(filter.id)}>
                  {filter.label}
                </Chip>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="btn btn-ghost btn-sm">
                    <ChevronsUpDown size={14} /> {sorts.find((sort) => sort.id === store.sort)?.label}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                    {sorts.map((sort) => (
                      <DropdownMenu.Item key={sort.id} className="menu-item" onSelect={() => store.setSort(sort.id)}>
                        {sort.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <div className="segmented" role="group" aria-label="View as">
                <button type="button" data-selected={store.view === 'grid'} aria-pressed={store.view === 'grid'} aria-label="Grid view" onClick={() => store.setView('grid')}>
                  <Grid2X2 size={14} />
                </button>
                <button type="button" data-selected={store.view === 'list'} aria-pressed={store.view === 'list'} aria-label="List view" onClick={() => store.setView('list')}>
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {selectedProjects.length > 0 && (
            <div
              className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
              role="status"
              aria-live="polite"
            >
              <p className="text-[12px] font-semibold">{selectedProjects.length} selected</p>
              <p className="meta">Click a project to add or remove it.</p>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button variant="danger" size="sm" disabled={deleting} onClick={() => void removeSelected()}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5">
            {store.loading ? (
              <LibrarySkeleton />
            ) : store.error ? (
              <ErrorState message={store.error} onRetry={() => void store.load()} />
            ) : empty ? (
              filtering ? (
                <EmptyState
                  icon={<Search size={22} />}
                  title={`No projects match "${store.search.trim() || filters.find((f) => f.id === store.filter)?.label}".`}
                  line="Try a different word."
                  action={<Button variant="secondary" onClick={() => { setSearch(''); store.setFilter('all'); store.setSearch(''); void store.load() }}>Clear Search</Button>}
                />
              ) : (
                <div>
                  <p className="text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Start with a photo of something you sell.</p>
                  <div className="mx-auto mt-4 grid max-w-[900px] gap-4 md:grid-cols-3">
                    {[
                      { type: 'set' as const, icon: Layers, title: 'Set Creator', line: 'One photo in, a full set out.' },
                      { type: 'photo' as const, icon: ImageIcon, title: 'Image Editor', line: 'New scene, new light, same product.' },
                      { type: 'image' as const, icon: Sparkles, title: 'Image Generator', line: 'Describe it, and Meta makes it.' }
                    ].map((card) => {
                      const Icon = card.icon
                      return (
                        <button key={card.type} type="button" className="card card-hover p-6 text-left" onClick={() => openNew(card.type)}>
                          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            <Icon size={20} />
                          </span>
                          <h2 className="empty-title mt-4">{card.title}</h2>
                          <p className="meta mt-1">{card.line}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            ) : store.view === 'grid' ? (
              <div className="grid-library">
                {store.items.map((project) => (
                  <div key={project.id} style={{ display: 'contents' }}>{renderProject(project, 'grid')}</div>
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                {store.items.map((project) => (
                  <div key={project.id} style={{ display: 'contents' }}>{renderProject(project, 'list')}</div>
                ))}
              </div>
            )}
          </div>

          {!empty && (
            <Pagination
              page={store.page}
              total={store.total}
              onPage={changePage}
              busy={store.loading}
              label="Library pages"
            />
          )}

          {!secrets?.hasKey && !store.loading && !empty && (
            <p className="hint mt-6 flex items-center gap-2">
              <TriangleAlert size={14} style={{ color: 'var(--warning)' }} />
              Add your Muse key in Settings to make images.
            </p>
          )}
        </div>
        {dragOver && (
          <div className="drop-overlay">
            <div className="drop-overlay-inner">Drop to add. Hold Shift for a set, or drop for a photo.</div>
          </div>
        )}
      </div>

      <NewProjectDialog
        open={Boolean(newType)}
        type={newType}
        personId={newPersonId}
        onOpenChange={(open) => {
          if (!open) {
            setNewType(null)
            setNewPersonId(null)
          }
        }}
      />

      <Dialog
        open={Boolean(renameProject)}
        onOpenChange={(open) => { if (!open) setRenameProject(null) }}
        title="Rename project"
        description="The new name shows in the Library and on exports."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameProject(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void rename()}>Save Name</Button>
          </>
        }
      >
        <Field
          label="Project name"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void rename()
          }}
          autoFocus
          maxLength={140}
        />
      </Dialog>
    </AppFrame>
  )
}
