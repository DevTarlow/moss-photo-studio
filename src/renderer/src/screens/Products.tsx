import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Image as ImageIcon, Loader2, Package, Plus, Search, Sparkles } from 'lucide-react'
import type { Product, Project, ProjectType } from '@shared/types'
import { bundledProductCards } from '@shared/products'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Field } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { SetupBanner } from '../components/ui/SetupBanner'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { ProductCard } from '../components/products/ProductCard'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { formatDate } from '../lib/format'
import { toast } from '../lib/toast'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { Heading, Icon, Selector, Text, TextInput } from '@astryxdesign/core'

export function Products(): React.JSX.Element {
  const navigate = useNavigate()
  const products = useAppStore((state) => state.products)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const confirm = useConfirm()
  const included = bundledProductCards()
  const [loading, setLoading] = useState(products.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'name'>('recent')
  const [preview, setPreview] = useState<Product | null>(null)
  const [renaming, setRenaming] = useState<Product | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [unfiled, setUnfiled] = useState<Project[]>([])
  const [archived, setArchived] = useState<Product[]>([])

  const load = async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      await refreshProducts()
      const loose = await unwrap(window.moss.projects.list({ productId: null, limit: 6 }))
      setUnfiled(loose.items)
      setArchived(await unwrap(window.moss.products.listArchived()))
    } catch {
      setLoadError('Could not load products. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const needle = search.trim().toLowerCase()
  const matches = (product: Product): boolean =>
    !needle ||
    [product.name, product.category ?? '', product.blurb ?? ''].some((value) =>
      value.toLowerCase().includes(needle)
    )

  const filteredIncluded = included.filter(matches)
  const filteredProducts = products
    .filter(matches)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'oldest') return a.createdAt - b.createdAt
      return b.createdAt - a.createdAt
    })
  const matchingCount = filteredIncluded.length + filteredProducts.length

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredProducts.length / COLLECTION_PAGE_SIZE))
    if (page > pages) setPage(pages)
  }, [filteredProducts.length, page])

  useEffect(() => {
    setPage(1)
  }, [search, sort])

  const visibleProducts = filteredProducts.slice(
    (page - 1) * COLLECTION_PAGE_SIZE,
    page * COLLECTION_PAGE_SIZE
  )

  const addProduct = async (): Promise<void> => {
    setBusy(true)
    try {
      const product = await unwrap(window.moss.dialogs.pickProduct())
      if (product) {
        await refreshProducts()
        toast.status('Product added.')
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const createProduct = async (): Promise<void> => {
    setCreatingProduct(true)
    try {
      const detail = await unwrap(window.moss.projects.create({
        type: 'image',
        name: 'New product',
        draft: true
      }))
      navigate(`/project/${detail.project.id}?createProduct=1`)
    } catch {
      toast.error('A new product could not be started.')
    } finally {
      setCreatingProduct(false)
    }
  }

  const startProject = async (product: Product, type: ProjectType): Promise<void> => {
    setBusy(true)
    try {
      const detail = await unwrap(window.moss.products.createProject({ productId: product.id, type }))
      setPreview(null)
      navigate(`/project/${detail.project.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const rename = async (): Promise<void> => {
    if (!renaming) return
    const value = renameValue.trim()
    if (!value) return
    try {
      await unwrap(window.moss.products.rename({ id: renaming.id, name: value }))
      await refreshProducts()
      setRenaming(null)
      if (preview?.id === renaming.id) setPreview({ ...preview, name: value })
      toast.status('Product renamed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const remove = async (product: Product): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${product.name}"?`,
      body: 'Projects and images already made from it stay. This cannot be undone.',
      confirmLabel: 'Delete Product',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.products.delete({ id: product.id }))
      await refreshProducts()
      if (preview?.id === product.id) setPreview(null)
      toast.status('Product deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openRename = (product: Product): void => {
    setRenaming(product)
    setRenameValue(product.name)
  }

  const restore = async (product: Product): Promise<void> => {
    try {
      await unwrap(window.moss.products.unarchive({ id: product.id }))
      await load()
      toast.status('Product restored.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const makeProductFromProject = async (project: Project): Promise<void> => {
    setBusy(true)
    try {
      const product = await unwrap(window.moss.products.createFromProject({ projectId: project.id, name: project.name }))
      await refreshProducts()
      toast.status('Product created.')
      navigate(`/product/${product.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <Heading level={1}>Products</Heading>
              <Text type="supporting" color="secondary" className="block">
                {search.trim()
                  ? `Showing ${matchingCount} of ${included.length + products.length}`
                  : `${included.length} starter products · ${products.length} of yours`}
              </Text>
              <Text type="supporting" color="secondary" className="block">Your reusable product photos and the projects made from them.</Text>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" disabled={creatingProduct} onClick={() => void createProduct()}>
                <Icon icon={Sparkles} size="sm" /> Generate Product Photo
              </Button>
              <Button variant="primary" onClick={() => void addProduct()} disabled={busy}>
                {busy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Plus} size="sm" />} Add Product Photo
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <SetupBanner />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1 md:max-w-[340px]">
              <TextInput
                label="Search products"
                isLabelHidden
                value={search}
                onChange={setSearch}
                placeholder="Search products"
                startIcon={<Icon icon={Search} size="sm" />}
                hasClear
                width="100%"
              />
            </div>
            <div className="ml-auto">
              <Selector
                label="Sort products"
                isLabelHidden
                value={sort}
                onChange={(value) => { if (value) setSort(value as 'recent' | 'oldest' | 'name') }}
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'name', label: 'Name' }
                ]}
                width={140}
              />
            </div>
          </div>

          {loadError && products.length === 0 ? (
            <ErrorState message={loadError} onRetry={() => void load()} />
          ) : search.trim() && matchingCount === 0 ? (
            <EmptyState
              icon={<Icon icon={Search} size="lg" />}
              title={`No products match "${search.trim()}".`}
              line="Try a different word."
              action={<Button variant="secondary" onClick={() => setSearch('')}>Clear Search</Button>}
            />
          ) : (
            <>
              {(filteredProducts.length > 0 || !search.trim()) && (
                <section className="mt-8" aria-labelledby="your-products-heading">
                  <div className="flex items-baseline gap-2">
                    <h2 id="your-products-heading" className="section-label">Your Products</h2>
                    <span className="meta-faint">{filteredProducts.length}</span>
                  </div>
                  {loading && products.length === 0 ? (
                    <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                      {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3]" />)}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="mt-3">
                      <EmptyState
                        icon={<Icon icon={Package} size="lg" />}
                        title="No saved products yet"
                        line="Save a product photo from an image, or add one from a file."
                        action={<Button variant="secondary" onClick={() => void addProduct()}>Add Product Photo</Button>}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                      {visibleProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onOpen={() => navigate(`/product/${product.id}`)}
                          onRename={() => openRename(product)}
                          onDelete={() => void remove(product)}
                        />
                      ))}
                    </div>
                  )}
                  {filteredProducts.length > 0 && (
                    <Pagination
                      page={page}
                      total={filteredProducts.length}
                      onPage={setPage}
                      label="Your product pages"
                    />
                  )}
                </section>
              )}

              {!search.trim() && unfiled.length > 0 && (
                <section className="mt-8" aria-labelledby="unfiled-work-heading">
                  <div className="flex items-baseline gap-2">
                    <h2 id="unfiled-work-heading" className="section-label">Not in a Product</h2>
                    <span className="meta-faint">{unfiled.length}</span>
                  </div>
                  <p className="hint mt-1">Projects that are not under a product yet. Save one as a product to keep it here.</p>
                  <div className="mt-3 grid gap-2">
                    {unfiled.map((project) => (
                      <div key={project.id} className="card flex flex-wrap items-center gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{project.name}</p>
                          <p className="meta">{project.type === 'photo' ? 'Photo edit' : 'Image'} · {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${project.id}`)}>Open</Button>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void makeProductFromProject(project)}>Save as Product</Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {archived.length > 0 && !search.trim() && (
                <section className="mt-8" aria-labelledby="archived-products-heading">
                  <div className="flex items-baseline gap-2">
                    <h2 id="archived-products-heading" className="section-label">Archived</h2>
                    <span className="meta-faint">{archived.length}</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {archived.map((product) => (
                      <div key={product.id} className="card flex flex-wrap items-center gap-2 p-3">
                        <img src={product.thumbUrl} alt="" className="h-10 w-10 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{product.name}</p>
                          <p className="meta">Archived · {product.projectCount ?? 0} {(product.projectCount ?? 0) === 1 ? 'project' : 'projects'} kept</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => void restore(product)}>Restore</Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {filteredIncluded.length > 0 && (
                <section className="mt-8" aria-labelledby="included-products-heading">
                  <div className="flex items-baseline gap-2">
                    <h2 id="included-products-heading" className="section-label">Starter Products</h2>
                    <span className="meta-faint">{filteredIncluded.length}</span>
                  </div>
                  <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {filteredIncluded.map((product) => (
                      <ProductCard key={product.id} product={product} onOpen={() => setPreview(product)} />
                    ))}
                  </div>
                  <p className="hint mt-3">Starter products to use as a starting point for your own product photos.</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => { if (!open) setPreview(null) }}
        title={preview?.name ?? 'Product'}
        description={
          preview
            ? preview.source === 'bundled'
              ? `${preview.category} · ${preview.blurb}`
              : `Saved ${formatDate(preview.createdAt)} · ${preview.width} × ${preview.height}`
            : undefined
        }
        width={620}
        footer={
          preview?.source === 'bundled' ? (
            <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => preview && openRename(preview)}>Rename</Button>
              <Button variant="ghost" className="text-[var(--danger)]" onClick={() => preview && void remove(preview)}>Delete</Button>
            </>
          )
        }
      >
        {preview && (
          <>
            <div className="overflow-hidden rounded-[10px]" style={{ background: 'var(--canvas)' }}>
              <img src={preview.imageUrl} alt={preview.name} className="mx-auto max-h-[420px] w-full object-contain" />
            </div>
            <div className="mt-4">
              <p className="section-label">Start with This Product</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void startProject(preview, 'photo')}>
                  <Icon icon={ImageIcon} size="sm" /> Edit This Photo
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void startProject(preview, 'image')}>
                  <Icon icon={Sparkles} size="sm" /> Make an Image with This Product
                </Button>
              </div>
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => { if (!open) setRenaming(null) }}
        title="Rename product"
        description="The name shows on the Products page and in the pickers."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void rename()}>Save Name</Button>
          </>
        }
      >
        <Field
          label="Product name"
          value={renameValue}
          maxLength={80}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void rename() }}
          autoFocus
        />
      </Dialog>
    </AppFrame>
  )
}
