import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Images,
  Layers,
  Loader2,
  Package,
  PackageCheck,
  Search
} from 'lucide-react'
import type {
  Image,
  LibraryImage,
  Product,
  ProductDetail,
  Project,
  ProjectDetail,
  ProjectType
} from '@shared/types'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Pagination } from '../components/ui/Pagination'
import { Skeleton } from '../components/ui/Skeleton'
import { KitExportDialog } from '../components/set/KitExportDialog'
import { ListingPanel } from '../components/listings/ListingPanel'
import { SaveProductDialog } from '../components/products/SaveProductDialog'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { toast } from '../lib/toast'
import {
  Heading,
  Icon,
  Selector,
  Text,
  TextInput,
  ToggleButton,
  ToggleButtonGroup
} from '@astryxdesign/core'

const typeLabel: Record<ProjectType, string> = {
  set: 'Set',
  photo: 'Photo edit',
  image: 'Image'
}

type SourceTab = 'products' | 'sets' | 'images'

type KitSource =
  | { kind: 'product'; product: Product; detail: ProductDetail; set: ProjectDetail | null }
  | { kind: 'set'; project: Project; detail: ProjectDetail; product: Product | null }
  | { kind: 'image'; image: Image; project: Project; detail: ProjectDetail; product: Product | null }

const gridStyle = { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }

async function resolveProduct(productId: string | null): Promise<Product | null> {
  if (!productId) return null
  const cached = useAppStore.getState().products.find((product) => product.id === productId)
  if (cached) return cached
  try {
    return (await unwrap(window.moss.products.detail({ id: productId }))).product
  } catch {
    return null
  }
}

function PickerSkeleton(): React.JSX.Element {
  return (
    <div className="grid gap-4" style={gridStyle} aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-1 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function ListingKit(): React.JSX.Element {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const productParam = params.get('product')
  const projectParam = params.get('project')
  const imageParam = params.get('image')
  const hasSource = Boolean(productParam || projectParam || imageParam)

  const products = useAppStore((state) => state.products)
  const refreshProducts = useAppStore((state) => state.refreshProducts)

  const [tab, setTab] = useState<SourceTab>('products')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [listRevision, setListRevision] = useState(0)
  const [sets, setSets] = useState<{ items: Project[]; total: number }>({ items: [], total: 0 })
  const [images, setImages] = useState<{ items: LibraryImage[]; total: number }>({ items: [], total: 0 })
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [sourceRevision, setSourceRevision] = useState(0)
  const [loadingSource, setLoadingSource] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null)
  const [selectedSetDetail, setSelectedSetDetail] = useState<ProjectDetail | null>(null)
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [image, setImage] = useState<Image | null>(null)
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [startingSet, setStartingSet] = useState(false)
  const [saveImageProductOpen, setSaveImageProductOpen] = useState(false)
  const [kitOpen, setKitOpen] = useState(false)

  useEffect(() => {
    void refreshProducts().catch(() => undefined)
  }, [refreshProducts])

  // Picker data only matters while no source is open.
  useEffect(() => {
    if (hasSource || tab === 'products') return
    let alive = true
    setListLoading(true)
    setListError(null)
    const timer = window.setTimeout(() => {
      const load = async (): Promise<void> => {
        try {
          if (tab === 'sets') {
            const result = await unwrap(
              window.moss.projects.list({
                filter: 'sets',
                sort: 'recent',
                search: search.trim() || undefined,
                limit: COLLECTION_PAGE_SIZE,
                offset: (page - 1) * COLLECTION_PAGE_SIZE
              })
            )
            if (alive) setSets(result)
          } else {
            const result = await unwrap(
              window.moss.images.library({
                search: search.trim() || undefined,
                limit: COLLECTION_PAGE_SIZE,
                offset: (page - 1) * COLLECTION_PAGE_SIZE
              })
            )
            if (alive) setImages(result)
          }
        } catch (caught) {
          if (alive) setListError(messageOf(caught))
        } finally {
          if (alive) setListLoading(false)
        }
      }
      void load()
    }, 150)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [hasSource, tab, search, page, listRevision])

  // Load the selected source from the URL.
  useEffect(() => {
    let alive = true
    setSourceError(null)
    setKitOpen(false)
    if (!hasSource) {
      setProductDetail(null)
      setSelectedSetDetail(null)
      setProjectDetail(null)
      setImage(null)
      setLinkedProduct(null)
      setLoadingSource(false)
      return () => {
        alive = false
      }
    }
    setLoadingSource(true)
    const load = async (): Promise<void> => {
      try {
        if (productParam) {
          const detail = await unwrap(window.moss.products.detail({ id: productParam }))
          if (!alive) return
          const firstSet = detail.latestSet
          const setDetail = firstSet
            ? await unwrap(window.moss.projects.get({ id: firstSet.id }))
            : null
          if (!alive) return
          setProductDetail(detail)
          setSelectedSetDetail(setDetail)
          setProjectDetail(null)
          setImage(null)
          setLinkedProduct(detail.product)
          return
        }
        if (imageParam) {
          const found = await unwrap(window.moss.images.get({ id: imageParam }))
          if (!alive) return
          if (found.status !== 'ready') throw new Error('That image is not ready yet.')
          const detail = await unwrap(window.moss.projects.get({ id: found.projectId }))
          if (!alive) return
          const linked = await resolveProduct(detail.project.productId)
          if (!alive) return
          setImage(found)
          setProjectDetail(detail)
          setProductDetail(null)
          setSelectedSetDetail(null)
          setLinkedProduct(linked)
          return
        }
        if (projectParam) {
          const detail = await unwrap(window.moss.projects.get({ id: projectParam }))
          if (!alive) return
          const linked = await resolveProduct(detail.project.productId)
          if (!alive) return
          setProjectDetail(detail)
          setProductDetail(null)
          setSelectedSetDetail(null)
          setLinkedProduct(linked)
          if (detail.project.type !== 'set') {
            const coverId = detail.project.coverImageId
            if (!coverId) throw new Error('That project has no ready image to pack.')
            const found = await unwrap(window.moss.images.get({ id: coverId }))
            if (!alive) return
            if (found.status !== 'ready') throw new Error('That project has no ready image to pack.')
            setImage(found)
          } else {
            setImage(null)
          }
        }
      } catch (caught) {
        if (alive) setSourceError(messageOf(caught))
      } finally {
        if (alive) setLoadingSource(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [hasSource, productParam, projectParam, imageParam, sourceRevision])

  const source = useMemo<KitSource | null>(() => {
    if (productParam) {
      if (!productDetail) return null
      return { kind: 'product', product: productDetail.product, detail: productDetail, set: selectedSetDetail }
    }
    if (imageParam) {
      if (!image || !projectDetail) return null
      return { kind: 'image', image, project: projectDetail.project, detail: projectDetail, product: linkedProduct }
    }
    if (projectParam) {
      if (!projectDetail) return null
      if (projectDetail.project.type === 'set') {
        return { kind: 'set', project: projectDetail.project, detail: projectDetail, product: linkedProduct }
      }
      if (image) {
        return { kind: 'image', image, project: projectDetail.project, detail: projectDetail, product: linkedProduct }
      }
    }
    return null
  }, [productParam, productDetail, selectedSetDetail, imageParam, image, projectDetail, projectParam, linkedProduct])

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products
      .filter((product) => product.source === 'user')
      .filter(
        (product) =>
          !needle ||
          [product.name, product.category ?? ''].some((value) => value.toLowerCase().includes(needle))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [products, search])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredProducts.length / COLLECTION_PAGE_SIZE))
    if (page > pages) setPage(pages)
  }, [filteredProducts.length, page])

  const activeSet: ProjectDetail | null = source
    ? source.kind === 'product'
      ? source.set
      : source.kind === 'set'
        ? source.detail
        : source.project.type === 'set'
          ? source.detail
          : null
    : null
  const plan = activeSet?.plan?.json ?? null
  const enabledShots = plan?.shots.filter((shot) => shot.enabled) ?? []
  const readyShots = activeSet
    ? enabledShots.filter((shot) =>
        activeSet.images.some((image) => image.shotId === shot.id && image.status === 'ready')
      ).length
    : 0
  const imageReady = source?.kind === 'image' && source.image.status === 'ready'
  const canExport = source ? (source.kind === 'image' ? imageReady : readyShots > 0) : false
  const exportProject = source
    ? source.kind === 'image'
      ? source.project
      : activeSet?.project ?? null
    : null
  const exportImageIds = source?.kind === 'image' ? [source.image.id] : undefined
  const exportImageCount = source?.kind === 'image' ? 1 : readyShots
  const listingProduct = source?.product ?? null
  const listingProjectId = source
    ? source.kind === 'product'
      ? source.set?.project.id ?? null
      : source.project.id
    : null
  const searchActive = Boolean(search.trim())
  const pagedProducts = filteredProducts.slice(
    (page - 1) * COLLECTION_PAGE_SIZE,
    page * COLLECTION_PAGE_SIZE
  )

  const changeSource = (): void => {
    navigate('/listing-kit')
  }

  const chooseProduct = (id: string): void => {
    navigate(`/listing-kit?product=${encodeURIComponent(id)}`)
  }

  const chooseSet = (id: string): void => {
    navigate(`/listing-kit?project=${encodeURIComponent(id)}`)
  }

  const chooseImage = (id: string): void => {
    navigate(`/listing-kit?image=${encodeURIComponent(id)}`)
  }

  const selectSet = async (setId: string): Promise<void> => {
    try {
      setSelectedSetDetail(await unwrap(window.moss.projects.get({ id: setId })))
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const startSet = async (): Promise<void> => {
    if (!source || source.kind !== 'product' || startingSet) return
    setStartingSet(true)
    try {
      const created = await unwrap(
        window.moss.products.createProject({ productId: source.product.id, type: 'set' })
      )
      navigate(`/project/${created.project.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setStartingSet(false)
    }
  }

  const saveSetAsProduct = async (): Promise<void> => {
    if (!source || source.kind !== 'set' || savingProduct) return
    setSavingProduct(true)
    try {
      await unwrap(window.moss.products.createFromProject({ projectId: source.project.id }))
      await refreshProducts()
      setSourceRevision((value) => value + 1)
      toast.status('Saved as a product. Listing copy is ready.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setSavingProduct(false)
    }
  }

  const clearSearch = (): void => {
    setSearch('')
    setPage(1)
  }

  const renderProductCard = (product: Product): React.JSX.Element => (
    <button
      key={product.id}
      type="button"
      className="card card-hover overflow-hidden text-left"
      onClick={() => chooseProduct(product.id)}
    >
      <span className="sr-only">Choose product </span>
      <img
        src={product.thumbUrl}
        alt=""
        className="aspect-[4/3] w-full object-cover"
        style={{ background: 'var(--surface-2)' }}
      />
      <span className="block p-3">
        <span className="block truncate text-[13px] font-semibold">{product.name}</span>
        <span className="meta mt-0.5 block truncate">
          {product.projectCount ?? 0} work · {product.imageCount ?? 0} images
        </span>
      </span>
    </button>
  )

  const renderSetCard = (project: Project): React.JSX.Element => {
    const linked = project.productId
      ? products.find((product) => product.id === project.productId)
      : null
    return (
      <button
        key={project.id}
        type="button"
        className="card card-hover overflow-hidden text-left"
        onClick={() => chooseSet(project.id)}
      >
        <span className="sr-only">Choose set </span>
        {project.coverUrl ? (
          <img
            src={project.coverUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover"
            style={{ background: 'var(--surface-2)' }}
          />
        ) : (
          <span
            className="grid aspect-[4/3] w-full place-items-center"
            style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}
          >
            <Icon icon={Layers} size="lg" />
          </span>
        )}
        <span className="block p-3">
          <span className="block truncate text-[13px] font-semibold">{project.name}</span>
          <span className="meta mt-0.5 block truncate">
            {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} ·{' '}
            {linked?.name ?? 'Unfiled'}
          </span>
        </span>
      </button>
    )
  }

  const renderImageCard = (entry: LibraryImage): React.JSX.Element => (
    <button
      key={entry.id}
      type="button"
      className="card card-hover overflow-hidden text-left"
      onClick={() => chooseImage(entry.id)}
    >
      <span className="sr-only">Choose image </span>
      {entry.thumbUrl ? (
        <img
          src={entry.thumbUrl}
          alt=""
          className="aspect-[4/3] w-full object-cover"
          style={{ background: 'var(--surface-2)' }}
        />
      ) : (
        <span className="block aspect-[4/3] w-full" style={{ background: 'var(--surface-2)' }} />
      )}
      <span className="block p-3">
        <span className="block truncate text-[13px] font-semibold">{entry.label}</span>
        <span className="meta mt-0.5 block truncate">
          {entry.projectName} · {typeLabel[entry.projectType]}
          {entry.kind === 'upload' ? ' · Source' : ''}
        </span>
      </span>
    </button>
  )

  if (hasSource && loadingSource) {
    return (
      <AppFrame>
        <div className="page-scroll">
          <div className="page-pad page-max">
            <Skeleton className="h-8 w-44" />
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <Skeleton className="aspect-square w-full" />
              <div>
                <Skeleton className="h-7 w-56" />
                <Skeleton className="mt-4 h-52 w-full" />
              </div>
            </div>
          </div>
        </div>
      </AppFrame>
    )
  }

  if (hasSource && sourceError) {
    return (
      <AppFrame>
        <div className="page-scroll">
          <div className="page-pad page-max">
            <Button variant="ghost" size="sm" onClick={changeSource}>
              <Icon icon={ArrowLeft} size="sm" /> Choose another source
            </Button>
            <ErrorState
              message={sourceError}
              onRetry={() => setSourceRevision((value) => value + 1)}
            />
          </div>
        </div>
      </AppFrame>
    )
  }

  if (hasSource && !source) {
    return (
      <AppFrame>
        <div className="page-scroll">
          <div className="page-pad page-max">
            <Button variant="ghost" size="sm" onClick={changeSource}>
              <Icon icon={ArrowLeft} size="sm" /> Choose another source
            </Button>
            <ErrorState
              message="That source could not be opened."
              onRetry={() => setSourceRevision((value) => value + 1)}
            />
          </div>
        </div>
      </AppFrame>
    )
  }

  if (!source) {
    return (
      <AppFrame>
        <div className="page-scroll">
          <div className="page-pad page-max">
            <Heading level={1}>Listing Kit</Heading>
            <Text type="supporting" color="secondary" className="mt-1 block">
              Start from a product, a finished set, or one image. The kit writes the shop-sized
              images, alt text, listing copy, and the untouched original when you ask for it.
            </Text>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ToggleButtonGroup
                type="single"
                label="Choose a source type"
                value={tab}
                onChange={(value) => {
                  if (value !== 'products' && value !== 'sets' && value !== 'images') return
                  setTab(value)
                  setPage(1)
                  setSearch('')
                }}
              >
                <ToggleButton value="products" label="Products" size="sm" />
                <ToggleButton value="sets" label="Sets" size="sm" />
                <ToggleButton value="images" label="Images" size="sm" />
              </ToggleButtonGroup>
              <div className="min-w-[220px] flex-1 md:max-w-[340px]">
                <TextInput
                  label="Search sources"
                  isLabelHidden
                  value={search}
                  onChange={(value) => {
                    setSearch(value)
                    setPage(1)
                  }}
                  placeholder={
                    tab === 'products'
                      ? 'Search products'
                      : tab === 'sets'
                        ? 'Search sets'
                        : 'Search images'
                  }
                  startIcon={<Icon icon={Search} size="sm" />}
                  hasClear
                  width="100%"
                />
              </div>
            </div>

            <Text type="supporting" color="secondary" className="mt-2 block">
              {tab === 'products'
                ? 'A product gives the kit its latest set and its listing copy.'
                : tab === 'sets'
                  ? 'A set packs the main version of every ready shot.'
                  : 'One image packs that image alone for the shop.'}
            </Text>

            <div className="mt-4">
              {tab === 'products' ? (
                filteredProducts.length === 0 ? (
                  searchActive ? (
                    <EmptyState
                      icon={<Icon icon={Search} size="lg" />}
                      title={`No products match "${search.trim()}".`}
                      line="Try a different word."
                      action={
                        <Button variant="secondary" onClick={clearSearch}>
                          Clear Search
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Icon icon={Package} size="lg" />}
                      title="No saved products yet"
                      line="Add a product from a photo, then come back to pack its listing."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/products')}>
                          Open Products
                        </Button>
                      }
                    />
                  )
                ) : (
                  <>
                    <div className="grid gap-4" style={gridStyle}>
                      {pagedProducts.map(renderProductCard)}
                    </div>
                    <Pagination
                      page={page}
                      total={filteredProducts.length}
                      onPage={setPage}
                      label="Product source pages"
                    />
                  </>
                )
              ) : tab === 'sets' ? (
                listLoading && sets.items.length === 0 ? (
                  <PickerSkeleton />
                ) : listError ? (
                  <ErrorState
                    message={listError}
                    onRetry={() => setListRevision((value) => value + 1)}
                  />
                ) : sets.items.length === 0 ? (
                  searchActive ? (
                    <EmptyState
                      icon={<Icon icon={Search} size="lg" />}
                      title={`No sets match "${search.trim()}".`}
                      line="Try a different word."
                      action={
                        <Button variant="secondary" onClick={clearSearch}>
                          Clear Search
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Icon icon={Layers} size="lg" />}
                      title="No finished sets yet"
                      line="Make a set from a product photo, then come back to pack its images."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/library?new=set')}>
                          Make a Set
                        </Button>
                      }
                    />
                  )
                ) : (
                  <>
                    <div className="grid gap-4" style={gridStyle}>
                      {sets.items.map(renderSetCard)}
                    </div>
                    <Pagination
                      page={page}
                      total={sets.total}
                      onPage={setPage}
                      busy={listLoading}
                      label="Set source pages"
                    />
                  </>
                )
              ) : listLoading && images.items.length === 0 ? (
                <PickerSkeleton />
              ) : listError ? (
                <ErrorState
                  message={listError}
                  onRetry={() => setListRevision((value) => value + 1)}
                />
              ) : images.items.length === 0 ? (
                searchActive ? (
                  <EmptyState
                    icon={<Icon icon={Search} size="lg" />}
                    title={`No images match "${search.trim()}".`}
                    line="Try a different word."
                    action={
                      <Button variant="secondary" onClick={clearSearch}>
                        Clear Search
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<Icon icon={Images} size="lg" />}
                    title="No ready images yet"
                    line="Make a set or an image, then come back to pack one."
                    action={
                      <Button variant="secondary" onClick={() => navigate('/library?new=set')}>
                        Make a Set
                      </Button>
                    }
                  />
                )
              ) : (
                <>
                  <div className="grid gap-4" style={gridStyle}>
                    {images.items.map(renderImageCard)}
                  </div>
                  <Pagination
                    page={page}
                    total={images.total}
                    onPage={setPage}
                    busy={listLoading}
                    label="Image source pages"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </AppFrame>
    )
  }

  const sourceName =
    source.kind === 'product'
      ? source.product.name
      : source.kind === 'set'
        ? source.project.name
        : source.image.label
  const sourceMeta =
    source.kind === 'product'
      ? `Product · ${source.detail.counts.sets} ${source.detail.counts.sets === 1 ? 'set' : 'sets'} · ${source.detail.counts.images} images`
      : source.kind === 'set'
        ? `Set · ${source.project.imageCount} images${source.product ? ` · ${source.product.name}` : ' · Unfiled'}`
        : `${typeLabel[source.project.type]} · ${source.project.name}`
  const previewUrl =
    source.kind === 'product'
      ? source.product.imageUrl
      : source.kind === 'set'
        ? source.project.coverUrl
        : source.image.url
  const projectPath =
    source.kind === 'product'
      ? null
      : source.project.type === 'set'
        ? `/project/${source.project.id}`
        : `/project/${source.project.id}?view=photo&image=${source.kind === 'image' ? source.image.id : ''}`
  const openProjectLabel =
    source.kind !== 'product' && source.project.type === 'set' ? 'Open set' : 'Open project'
  const linkedProductId = source.kind === 'product' ? source.product.id : source.product?.id ?? null
  const exportProductName = listingProduct?.name ?? exportProject?.name ?? 'Listing'
  const packageStatus =
    source.kind === 'image'
      ? '1 image'
      : source.kind === 'product' && !source.set
        ? 'No set yet'
        : `${readyShots} of ${enabledShots.length} ${enabledShots.length === 1 ? 'shot' : 'shots'}`
  const exportHint =
    source.kind === 'product' && !source.set
      ? 'Make a set from this product first. Listing copy still works.'
      : source.kind === 'image'
        ? imageReady
          ? null
          : 'That image is not ready yet.'
        : !activeSet
          ? 'Open the set to plan it.'
          : !plan
            ? 'Plan the set first.'
            : readyShots === 0
              ? 'Make at least one image in the set first.'
              : null
  const sourceKey = `${source.kind}-${productParam ?? ''}-${projectParam ?? ''}-${imageParam ?? ''}-${
    source.kind === 'product' ? source.set?.project.id ?? 'none' : source.project.id
  }-${sourceRevision}`
  const setOptions =
    source.kind === 'product'
      ? source.detail.projects
          .filter((project) => project.type === 'set')
          .map((project) => ({
            value: project.id,
            label: `${project.name} · ${project.imageCount} ${project.imageCount === 1 ? 'image' : 'images'}`
          }))
      : []

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--text-muted)' }}
            onClick={changeSource}
          >
            <Icon icon={ArrowLeft} size="sm" /> Choose another source
          </button>

          <div className="mt-3">
            <Heading level={1}>Listing Kit</Heading>
          </div>
          <Text type="supporting" color="secondary" className="mt-1 block">
            Review what is ready, write the copy, then export one shop-size package.
          </Text>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <aside>
              <div
                className="overflow-hidden rounded-[14px] border"
                style={{ borderColor: 'var(--border)', background: 'var(--canvas)' }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="aspect-square w-full object-contain" />
                ) : (
                  <div className="grid aspect-square w-full place-items-center" style={{ color: 'var(--text-faint)' }}>
                    <Icon
                      icon={source.kind === 'product' ? Package : source.kind === 'set' ? Layers : Images}
                      size="lg"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {source.kind === 'product' ? (
                  <>
                    <div className="card p-2 text-center">
                      <p className="text-[16px] font-semibold tabular">{source.detail.counts.sets}</p>
                      <p className="meta">sets</p>
                    </div>
                    <div className="card p-2 text-center">
                      <p className="text-[16px] font-semibold tabular">{source.detail.counts.images}</p>
                      <p className="meta">images</p>
                    </div>
                  </>
                ) : source.kind === 'set' ? (
                  <>
                    <div className="card p-2 text-center">
                      <p className="text-[16px] font-semibold tabular">{source.project.imageCount}</p>
                      <p className="meta">images</p>
                    </div>
                    <div className="card p-2 text-center">
                      <p className="text-[16px] font-semibold tabular">{readyShots}</p>
                      <p className="meta">ready shots</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="card p-2 text-center">
                      <p className="text-[13px] font-semibold tabular">
                        {source.image.width && source.image.height
                          ? `${source.image.width} × ${source.image.height}`
                          : '—'}
                      </p>
                      <p className="meta">pixels</p>
                    </div>
                    <div className="card p-2 text-center">
                      <p className="text-[16px] font-semibold uppercase tabular">{source.image.format}</p>
                      <p className="meta">format</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1">
                {source.kind === 'product' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/product/${source.product.id}`)}
                  >
                    Open product
                  </Button>
                ) : (
                  <>
                    {projectPath && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(projectPath)}>
                        {openProjectLabel}
                      </Button>
                    )}
                    {linkedProductId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/product/${linkedProductId}`)}
                      >
                        Open product
                      </Button>
                    )}
                  </>
                )}
              </div>

              {source.kind === 'product' && setOptions.length > 0 && (
                <div className="mt-3">
                  <Selector
                    label="Set for this kit"
                    value={source.set?.project.id ?? ''}
                    onChange={(value) => {
                      if (value) void selectSet(value)
                    }}
                    options={setOptions}
                    width="100%"
                  />
                </div>
              )}
              {source.kind === 'product' && setOptions.length === 0 && (
                <p className="hint mt-3">No set yet. Make one to pack listing images.</p>
              )}
            </aside>

            <div className="min-w-0">
              <Heading level={2}>{sourceName}</Heading>
              <Text type="supporting" color="secondary" className="mt-1 block">
                {sourceMeta}
              </Text>

              {listingProduct ? (
                <ListingPanel
                  key={`listing-${listingProduct.id}-${listingProjectId ?? 'none'}`}
                  productId={listingProduct.id}
                  productName={listingProduct.name}
                  projectId={listingProjectId}
                />
              ) : source.kind !== 'product' ? (
                <div className="card mt-4 p-4">
                  <p className="section-label">Listing copy</p>
                  {source.project.productId ? (
                    <>
                      <p className="hint mt-1">
                        This work is linked to a product that is not available. Restore it in
                        Products to write copy.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => navigate('/products')}
                      >
                        Open Products
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="hint mt-1">
                        Listing copy needs a saved product. The kit can still be exported without
                        it.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        disabled={savingProduct}
                        onClick={() => {
                          if (source.kind === 'set') void saveSetAsProduct()
                          else setSaveImageProductOpen(true)
                        }}
                      >
                        {savingProduct ? (
                          <Icon icon={Loader2} size="sm" className="animate-spin" />
                        ) : (
                          <Icon icon={Package} size="sm" />
                        )}{' '}
                        Save as a Product
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              <div className="card mt-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="section-label">Package</p>
                    <p className="hint mt-1">
                      {source.kind === 'image'
                        ? 'One image, written for the shop you choose.'
                        : 'One JPEG per ready shot, written for the shop you choose.'}
                    </p>
                  </div>
                  <span className="badge">{packageStatus}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="primary" disabled={!canExport} onClick={() => setKitOpen(true)}>
                    <Icon icon={PackageCheck} size="sm" /> Export Kit
                  </Button>
                  {source.kind === 'product' && !source.set && (
                    <Button
                      variant="secondary"
                      disabled={startingSet}
                      onClick={() => void startSet()}
                    >
                      {startingSet ? (
                        <Icon icon={Loader2} size="sm" className="animate-spin" />
                      ) : (
                        <Icon icon={Layers} size="sm" />
                      )}{' '}
                      Make a Set
                    </Button>
                  )}
                  {source.kind === 'image' && source.project.type === 'set' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/listing-kit?project=${source.project.id}`)}
                    >
                      Pack the Whole Set
                    </Button>
                  )}
                </div>
                {exportHint && <p className="hint mt-2">{exportHint}</p>}
                <p className="hint mt-3">
                  The kit is written to a folder you choose and never uploaded.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {exportProject && (
        <KitExportDialog
          key={`kit-${sourceKey}`}
          open={kitOpen}
          onOpenChange={setKitOpen}
          project={exportProject}
          productName={exportProductName}
          imageCount={exportImageCount}
          imageIds={exportImageIds}
        />
      )}
      {source.kind === 'image' && (
        <SaveProductDialog
          open={saveImageProductOpen}
          onOpenChange={setSaveImageProductOpen}
          imageId={source.image.id}
          defaultName={source.project.name}
          onSaved={() => setSourceRevision((value) => value + 1)}
        />
      )}
    </AppFrame>
  )
}
