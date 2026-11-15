import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckSquare,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  List,
  Package,
  Search,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { Project, ProjectFilter, ProjectSort, SetSummary } from '@shared/types'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { useLibraryStore } from '../store/library'
import { useAppStore } from '../store/app'
import { useJobsStore } from '../store/jobs'
import { AppFrame } from '../components/ui/AppFrame'
import { Dialog } from '../components/ui/Dialog'
import { Field } from '../components/ui/Field'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { LibrarySkeleton } from '../components/ui/Skeleton'
import { ProjectCard } from '../components/library/ProjectCard'
import { ProductCard } from '../components/products/ProductCard'
import { SetCard } from '../components/sets/SetCard'
import { NewProjectDialog } from '../components/library/NewProjectDialog'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { unwrap, messageOf } from '../lib/ipc'
import { usd } from '../lib/format'
import { toast } from '../lib/toast'
import { showExportToast } from '../lib/exportFeedback'
import { onCommand } from '../lib/commands'
import { fileToBytes } from '../lib/files'
import { warnIfSmallPhoto } from '../lib/photoWarnings'
import { Pagination } from '../components/ui/Pagination'
import {
  Banner,
  Button,
  ClickableCard,
  Grid,
  Heading,
  Icon,
  Selector,
  Text,
  TextInput,
  ToggleButton,
  ToggleButtonGroup
} from '@astryxdesign/core'

type LibraryFilter = ProjectFilter | 'products' | 'sets'

const filters: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'photos', label: 'Edited' },
  { id: 'images', label: 'Generated' },
  { id: 'products', label: 'Products' },
  { id: 'sets', label: 'Sets' }
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
  const settings = useAppStore((state) => state.settings)
  const license = useAppStore((state) => state.license)
  const applyLicense = useAppStore((state) => state.applyLicense)
  const products = useAppStore((state) => state.products)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const [newType, setNewType] = useState<'photo' | null>(null)
  const [newPersonId, setNewPersonId] = useState<string | null>(null)
  const [newPersonLook, setNewPersonLook] = useState<string | null>(null)
  const [renameProject, setRenameProject] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [search, setSearch] = useState(store.search)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const [productsTab, setProductsTab] = useState(false)
  const [setsTab, setSetsTab] = useState(false)
  const [sets, setSets] = useState<SetSummary[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [setPage, setSetPage] = useState(1)
  const [productPage, setProductPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [allTotal, setAllTotal] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void store.load()
    void store.refreshMonth()
    void refreshTotal()
    // Initial load only. Filter changes load themselves.
  }, [])

  useEffect(() => {
    void refreshProducts().catch(() => undefined)
  }, [refreshProducts])

  useEffect(() => {
    setProductPage(1)
    setSetPage(1)
  }, [search])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setSelected(new Set())
      setSelectMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    // The input starts from the store value. Skip the initial effect so the
    // mount load is not raced by a second debounced load.
    if (setsTab || search === store.search) return
    const timer = window.setTimeout(() => {
      store.setSearch(search)
      void store.load()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [search, store.search, setsTab])

  const loadSets = async (): Promise<void> => {
    setSetsLoading(true)
    setSetsError(null)
    try {
      setSets(await unwrap(window.moss.sets.list()))
    } catch (caught) {
      setSetsError(messageOf(caught))
    } finally {
      setSetsLoading(false)
    }
  }

  useEffect(() => {
    void loadSets()
  }, [])

  useEffect(() => {
    if (setsTab) void loadSets()
    // Re-read whenever the tab is opened; Set membership may have changed.
  }, [setsTab])

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
    if (nextType === 'photo') {
      setNewType(nextType)
      setNewPersonId(params.get('person'))
      setNewPersonLook(params.get('look'))
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

  async function refreshTotal(): Promise<void> {
    try {
      const result = await unwrap(window.moss.projects.list({ limit: 1 }))
      setAllTotal(result.total)
    } catch {
      // The header falls back to the filtered total.
    }
  }

  const createImageProject = async (): Promise<void> => {
    try {
      const detail = await unwrap(window.moss.projects.create({ type: 'image', draft: true }))
      navigate(`/project/${detail.project.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openNew = (type: 'photo' | 'image'): void => {
    if (type === 'image') {
      void createImageProject()
      return
    }
    setNewPersonId(null)
    setNewPersonLook(null)
    setNewType(type)
  }

  const duplicate = async (project: Project): Promise<void> => {
    try {
      await store.duplicate(project.id)
      void refreshTotal()
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
      void refreshTotal()
      toast.status('Project deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const selectAll = (): void => {
    setSelectMode(true)
    setSelected(new Set(store.items.map((project) => project.id)))
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
      void refreshTotal()
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
        type: 'photo',
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
  const userProducts = products.filter((product) => product.source === 'user')
  const productNeedle = search.trim().toLowerCase()
  const filteredProducts = userProducts
    .filter(
      (product) =>
        !productNeedle ||
        [product.name, product.category ?? '', product.blurb ?? ''].some((value) =>
          value.toLowerCase().includes(productNeedle)
        )
    )
    .sort((a, b) => {
      if (store.sort === 'name') return a.name.localeCompare(b.name)
      if (store.sort === 'oldest') return a.createdAt - b.createdAt
      return b.createdAt - a.createdAt
    })
  const setNeedle = search.trim().toLowerCase()
  const filteredSets = sets
    .filter((set) => !setNeedle || set.name.toLowerCase().includes(setNeedle))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const setPages = Math.max(1, Math.ceil(filteredSets.length / COLLECTION_PAGE_SIZE))
  const visibleSetPage = Math.min(setPage, setPages)
  const pagedSets = filteredSets.slice(
    (visibleSetPage - 1) * COLLECTION_PAGE_SIZE,
    visibleSetPage * COLLECTION_PAGE_SIZE
  )
  const productPages = Math.max(1, Math.ceil(filteredProducts.length / COLLECTION_PAGE_SIZE))
  const visibleProductPage = Math.min(productPage, productPages)
  const pagedProducts = filteredProducts.slice(
    (visibleProductPage - 1) * COLLECTION_PAGE_SIZE,
    visibleProductPage * COLLECTION_PAGE_SIZE
  )
  const showSetup = Boolean(settings && !settings.onboardingDone)
  const showNoKey = Boolean(settings?.onboardingDone && secrets?.hasKey === false && license?.status !== 'expired')
  const showBanners = license?.status === 'grace' || license?.status === 'expired' || showSetup || showNoKey

  useEffect(() => {
    if (productPage > productPages) setProductPage(productPages)
  }, [productPage, productPages])

  useEffect(() => {
    if (setPage > setPages) setSetPage(setPages)
  }, [setPage, setPages])

  const renderProject = (project: Project, view: 'grid' | 'list'): React.ReactNode => {
    return (
      <ProjectCard
        project={project}
        view={view}
        job={jobFor(project.id)}
        selected={selected.has(project.id)}
        selecting={selectMode || selected.size > 0}
        onSelect={(next) => toggleSelect(project.id, next)}
        onRename={() => { setRenameProject(project); setRenameValue(project.name) }}
        onDuplicate={() => void duplicate(project)}
        onExport={() => void exportProject(project)}
        onDelete={() => void remove(project)}
      />
    )
  }

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
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <Heading level={1}>All work</Heading>
              <Text type="supporting" color="secondary">
                {setsTab ? (
                  setNeedle
                    ? `Showing ${filteredSets.length} of ${sets.length}`
                    : `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`
                ) : productsTab ? (
                  productNeedle
                    ? `Showing ${filteredProducts.length} of ${userProducts.length}`
                    : `${userProducts.length} ${userProducts.length === 1 ? 'product' : 'products'}`
                ) : store.filter === 'all' && !filtering ? (
                  <>
                    <span>
                      {`${allTotal || store.total} ${(allTotal || store.total) === 1 ? 'project' : 'projects'}`}
                    </span>
                    {userProducts.length > 0 && (
                      <span>
                        {` · ${userProducts.length} ${userProducts.length === 1 ? 'product' : 'products'}`}
                      </span>
                    )}
                    {sets.length > 0 && (
                      <span>
                        {` · ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`}
                      </span>
                    )}
                  </>
                ) : filtering ? (
                  `Showing ${store.total} of ${allTotal || store.total}`
                ) : (
                  `${allTotal || store.total} ${(allTotal || store.total) === 1 ? 'project' : 'projects'}`
                )}
              </Text>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                label={`${usd(store.monthCents)} this month`}
                variant="ghost"
                size="sm"
                onClick={() => navigate('/usage')}
              />
              {!productsTab && !setsTab && (
                <Button
                  label={selectMode ? 'Done selecting' : 'Select'}
                  variant={selectMode ? 'secondary' : 'ghost'}
                  size="sm"
                  icon={<Icon icon={CheckSquare} size="sm" />}
                  onClick={() => {
                    if (selectMode) setSelected(new Set())
                    setSelectMode((current) => !current)
                  }}
                />
              )}
            </div>
          </div>

          {showBanners && (
            <div className="mt-4 flex flex-col gap-2">
              {license?.status === 'grace' && (
                <Banner
                  status="warning"
                  title="Working offline"
                  description="License checks resume when you're connected."
                  endContent={
                    <Button
                      label="Check Now"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void unwrap(window.moss.license.validate())
                          .then((state) => {
                            applyLicense(state)
                            if (state.status === 'licensed') toast.status('License checked.')
                          })
                          .catch(() => toast.error('Could not reach the license server. Try again.'))
                      }}
                    />
                  }
                  collapsible={false}
                />
              )}
              {license?.status === 'expired' && (
                <Banner
                  status="error"
                  title="Reactivate to make images"
                  description="Your library, edits, and exports still work."
                  endContent={<Button label="Open License" variant="secondary" size="sm" onClick={() => navigate('/settings/license')} />}
                  collapsible={false}
                />
              )}
              {showSetup && (
                <Banner
                  status="info"
                  title="Finish setting up"
                  description="Add a product photo and make your first image when you're ready."
                  endContent={<Button label="Resume Setup" variant="secondary" size="sm" onClick={() => navigate('/onboarding')} />}
                  collapsible={false}
                />
              )}
              {showNoKey && (
                <Banner
                  status="warning"
                  title="Add your Muse key"
                  description="Making images needs a Meta Muse key. Your library and local edits still work."
                  endContent={<Button label="Open Settings" variant="secondary" size="sm" onClick={() => navigate('/settings/studio')} />}
                  collapsible={false}
                />
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1 md:max-w-[340px]">
              <TextInput
                ref={searchRef}
                label={setsTab ? 'Search Sets' : productsTab ? 'Search products' : 'Search projects'}
                isLabelHidden
                value={search}
                onChange={setSearch}
                placeholder={setsTab ? 'Search Sets' : productsTab ? 'Search products' : 'Search projects'}
                startIcon={<Icon icon={Search} size="sm" />}
                hasClear
                width="100%"
              />
            </div>
            <ToggleButtonGroup
              type="single"
              className="shrink-0"
              label="Filter all work"
              value={setsTab ? 'sets' : productsTab ? 'products' : store.filter}
              onChange={(value) => {
                if (value === 'sets') {
                  setSetsTab(true)
                  setSetsLoading(true)
                  setProductsTab(false)
                  setSelected(new Set())
                  setSelectMode(false)
                  return
                }
                setSetsTab(false)
                if (value === 'products') {
                  setProductsTab(true)
                  setSelected(new Set())
                  setSelectMode(false)
                  return
                }
                setProductsTab(false)
                store.setFilter((value as ProjectFilter | null) ?? 'all')
              }}
            >
              {filters.map((filter) => (
                <ToggleButton key={filter.id} value={filter.id} label={filter.label} size="sm" />
              ))}
            </ToggleButtonGroup>
            {!setsTab && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Selector
                  label={productsTab ? 'Sort products' : 'Sort projects'}
                  isLabelHidden
                  value={store.sort}
                  onChange={(value) => {
                    if (value) {
                      store.setSort(value as ProjectSort)
                      setProductPage(1)
                    }
                  }}
                  options={sorts.map((sort) => ({ value: sort.id, label: sort.label }))}
                  width={140}
                />
                {!productsTab && (
                  <ToggleButtonGroup
                    type="single"
                    label="View as"
                    value={store.view}
                    onChange={(value) => {
                      if (value === 'grid' || value === 'list') store.setView(value)
                    }}
                  >
                    <ToggleButton value="grid" label="Grid view" isIconOnly icon={<Icon icon={Grid2X2} size="sm" />} size="sm" />
                    <ToggleButton value="list" label="List view" isIconOnly icon={<Icon icon={List} size="sm" />} size="sm" />
                  </ToggleButtonGroup>
                )}
              </div>
            )}
          </div>

          <Text type="supporting" color="secondary" className="mt-2 block">
            {setsTab
              ? 'Sets keep related images and products together, ready to revisit or export all at once.'
              : productsTab
              ? 'Saved products. Open one to see its photo work.'
              : store.filter === 'photos'
                ? 'Projects you started from a photo you already had in the Image Editor.'
                : store.filter === 'images'
                  ? 'Projects you started from a prompt in the Image Generator.'
                  : 'Your products, edited photos, and generated images.'}
          </Text>

          {!productsTab && selectedProjects.length > 0 && (
            <div
              className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2"
              style={{ borderColor: 'var(--color-border-emphasized)', background: 'var(--color-background-surface)' }}
              role="status"
              aria-live="polite"
            >
              <Text weight="bold">{selectedProjects.length} selected</Text>
              <Text type="supporting" color="secondary">Click a project to add or remove it.</Text>
              <div className="ml-auto flex items-center gap-2">
                <Button label="Select all" variant="ghost" size="sm" onClick={selectAll} />
                <Button label="Clear" variant="ghost" size="sm" isDisabled={deleting} onClick={() => setSelected(new Set())} />
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  icon={<Icon icon={Trash2} size="sm" />}
                  isLoading={deleting}
                  isDisabled={deleting}
                  onClick={() => void removeSelected()}
                />
              </div>
            </div>
          )}

          {!productsTab && !setsTab && store.filter === 'all' && !selectMode && selected.size === 0 && filteredProducts.length > 0 && (
            <section className="mt-5" aria-labelledby="all-products-heading">
              <div className="flex items-baseline gap-2">
                <h2 id="all-products-heading" className="section-label">Products</h2>
                <span className="meta-faint">{filteredProducts.length}</span>
              </div>
              <div
                className="mt-3 grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpen={() => navigate(`/product/${product.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {!productsTab && !setsTab && store.filter === 'all' && !selectMode && selected.size === 0 && filteredSets.length > 0 && (
            <section className="mt-5" aria-labelledby="all-sets-heading">
              <div className="flex items-baseline gap-2">
                <h2 id="all-sets-heading" className="section-label">Sets</h2>
                <span className="meta-faint">{filteredSets.length}</span>
              </div>
              <div
                className="mt-3 grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              >
                {filteredSets.map((set) => (
                  <SetCard key={set.id} set={set} onOpen={() => navigate(`/sets/${set.id}`)} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-5">
            {setsTab ? (
              setsLoading ? (
                <LibrarySkeleton />
              ) : setsError ? (
                <ErrorState message={setsError} onRetry={() => void loadSets()} />
              ) : filteredSets.length === 0 ? (
                sets.length === 0 ? (
                  <EmptyState
                    icon={<Icon icon={Layers} size="lg" />}
                    title="No Sets yet"
                    line="Open any image or product and choose Add to Set, or open Sets to create one."
                    action={<Button label="Open Sets" variant="secondary" onClick={() => navigate('/sets')} />}
                  />
                ) : (
                  <EmptyState
                    icon={<Icon icon={Search} size="lg" />}
                    title={`No Sets match "${search.trim()}".`}
                    line="Try a different word."
                    action={<Button label="Clear Search" variant="secondary" onClick={() => setSearch('')} />}
                  />
                )
              ) : (
                <>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {pagedSets.map((set) => (
                      <SetCard key={set.id} set={set} onOpen={() => navigate(`/sets/${set.id}`)} />
                    ))}
                  </div>
                  <Pagination
                    page={visibleSetPage}
                    total={filteredSets.length}
                    onPage={setSetPage}
                    label="Set pages"
                  />
                </>
              )
            ) : productsTab ? (
              filteredProducts.length === 0 ? (
                productNeedle ? (
                  <EmptyState
                    icon={<Icon icon={Search} size="lg" />}
                    title={`No products match "${search.trim()}".`}
                    line="Try a different word."
                    action={<Button label="Clear Search" variant="secondary" onClick={() => { setSearch(''); setProductPage(1); store.setSearch(''); void store.load() }} />}
                  />
                ) : (
                  <EmptyState
                    icon={<Icon icon={Package} size="lg" />}
                    title="No saved products yet"
                    line="Save a product from an image, or add one from a file."
                    action={<Button label="Open Products" variant="secondary" onClick={() => navigate('/products')} />}
                  />
                )
              ) : (
                <>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {pagedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} onOpen={() => navigate(`/product/${product.id}`)} />
                    ))}
                  </div>
                  <Pagination
                    page={visibleProductPage}
                    total={filteredProducts.length}
                    onPage={setProductPage}
                    label="Product pages"
                  />
                </>
              )
            ) : store.loading ? (
              <LibrarySkeleton />
            ) : store.error ? (
              <ErrorState message={store.error} onRetry={() => void store.load()} />
            ) : empty ? (
              filtering ? (
                <EmptyState
                  icon={<Icon icon={Search} size="lg" />}
                  title={`No projects match "${store.search.trim() || filters.find((f) => f.id === store.filter)?.label}".`}
                  line="Try a different word."
                  action={<Button label="Clear Search" variant="secondary" onClick={() => { setSearch(''); store.setFilter('all'); store.setSearch(''); void store.load() }} />}
                />
              ) : (
                <div>
                  <Text type="supporting" color="secondary" className="text-center">Start with a photo, an idea, or a Set.</Text>
                  <Grid columns={{ minWidth: 220, max: 3 }} gap={4} className="mx-auto mt-4 max-w-[900px]">
                    {[
                      { type: 'photo' as const, icon: ImageIcon, title: 'Image Editor', line: 'New scene, new light, same product.' },
                      { type: 'image' as const, icon: Sparkles, title: 'Image Generator', line: 'Describe it, and Meta makes it.' },
                      { type: 'sets' as const, icon: Layers, title: 'Sets & Offline Library', line: 'Keep related images together, all on this computer.' }
                    ].map((card) => {
                      const Icon = card.icon
                      return (
                        <ClickableCard
                          key={card.type}
                          label={card.title}
                          onClick={card.type === 'sets' ? () => navigate('/sets') : () => openNew(card.type)}
                          padding={5}
                          elevation="low"
                        >
                          <span
                            className="grid h-10 w-10 place-items-center rounded-full"
                            style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}
                          >
                            <Icon size={20} />
                          </span>
                          <Text weight="bold" display="block" className="mt-4">{card.title}</Text>
                          <Text type="supporting" color="secondary" display="block" className="mt-1">{card.line}</Text>
                        </ClickableCard>
                      )
                    })}
                  </Grid>
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

          {!productsTab && !setsTab && !empty && (
            <Pagination
              page={store.page}
              total={store.total}
              onPage={changePage}
              busy={store.loading}
              label="All work pages"
            />
          )}
        </div>
        {dragOver && (
          <div className="drop-overlay">
            <div className="drop-overlay-inner">Drop to add. The photo opens in the Image Editor.</div>
          </div>
        )}
      </div>

      <NewProjectDialog
        open={Boolean(newType)}
        type={newType}
        personId={newPersonId}
        personLook={newPersonLook}
        onOpenChange={(open) => {
          if (!open) {
            setNewType(null)
            setNewPersonId(null)
            setNewPersonLook(null)
          }
        }}
      />

      <Dialog
        open={Boolean(renameProject)}
        onOpenChange={(open) => { if (!open) setRenameProject(null) }}
        title="Rename project"
        description="The new name shows in All work and on exports."
        footer={
          <>
            <Button label="Cancel" variant="secondary" onClick={() => setRenameProject(null)} />
            <Button label="Save Name" variant="primary" onClick={() => void rename()} />
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
