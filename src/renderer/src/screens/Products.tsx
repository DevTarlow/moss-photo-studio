import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import { Image as ImageIcon, Layers, Loader2, Package, Plus, Search, Sparkles } from 'lucide-react'
import type { Product, ProjectType } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Field } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { formatDate } from '../lib/format'
import { toast } from '../lib/toast'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { Heading, Selector, Text, TextInput } from '@astryxdesign/core'

function ProductCard({
  product,
  onOpen,
  onRename,
  onDelete
}: {
  product: Product
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <div className="card card-hover group relative overflow-hidden">
      <button type="button" className="block w-full cursor-zoom-in" onClick={onOpen} aria-label={`Open ${product.name} larger`}>
        <img src={product.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
      </button>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{product.name}</p>
        <p className="meta mt-0.5">Saved {formatDate(product.createdAt)}</p>
      </div>
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="icon-btn" style={{ background: 'var(--surface)' }} aria-label={`Actions for ${product.name}`}>
              ⋯
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
              <DropdownMenu.Item className="menu-item" onSelect={onRename}>Rename</DropdownMenu.Item>
              <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>Delete</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}

export function Products(): React.JSX.Element {
  const navigate = useNavigate()
  const products = useAppStore((state) => state.products)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const confirm = useConfirm()
  const [loading, setLoading] = useState(products.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'name'>('recent')
  const [preview, setPreview] = useState<Product | null>(null)
  const [renaming, setRenaming] = useState<Product | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      await refreshProducts()
    } catch {
      setLoadError('Could not load products. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredProducts = products
    .filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'oldest') return a.createdAt - b.createdAt
      return b.createdAt - a.createdAt
    })

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

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex items-start gap-3">
            <div>
              <Heading level={1}>Products</Heading>
              <Text type="supporting" color="secondary" className="block">
                {search.trim()
                  ? `Showing ${filteredProducts.length} of ${products.length}`
                  : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
              </Text>
              <Text type="supporting" color="secondary" className="block">The product photos you reuse in sets, the editor, and the generator.</Text>
            </div>
            <Button className="ml-auto" variant="primary" onClick={() => void addProduct()} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add Product
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1 md:max-w-[340px]">
              <TextInput
                label="Search products"
                isLabelHidden
                value={search}
                onChange={setSearch}
                placeholder="Search products"
                startIcon={<Search size={15} />}
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
          ) : loading && products.length === 0 ? (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3]" />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title="No saved products yet"
              line="Save a product photo from an image, or add one from a file."
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title={`No products match "${search.trim()}".`}
              line="Try a different word."
              action={<Button variant="secondary" onClick={() => setSearch('')}>Clear Search</Button>}
            />
          ) : (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={() => setPreview(product)}
                  onRename={() => openRename(product)}
                  onDelete={() => void remove(product)}
                />
              ))}
            </div>
          )}
          <Pagination
            page={page}
            total={filteredProducts.length}
            onPage={setPage}
            label="Product pages"
          />
        </div>
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => { if (!open) setPreview(null) }}
        title={preview?.name ?? 'Product'}
        description={preview ? `Saved ${formatDate(preview.createdAt)} · ${preview.width} × ${preview.height}` : undefined}
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => preview && openRename(preview)}>Rename</Button>
            <Button variant="ghost" className="text-[var(--danger)]" onClick={() => preview && void remove(preview)}>Delete</Button>
          </>
        }
      >
        {preview && (
          <>
            <div className="overflow-hidden rounded-[10px]" style={{ background: 'var(--canvas)' }}>
              <img src={preview.imageUrl} alt={preview.name} className="mx-auto max-h-[420px] w-full object-contain" />
            </div>
            <div className="mt-4">
              <p className="section-label">Start with this product</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void startProject(preview, 'set')}>
                  <Layers size={15} /> Use in a Set
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void startProject(preview, 'photo')}>
                  <ImageIcon size={15} /> Edit This Photo
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void startProject(preview, 'image')}>
                  <Sparkles size={15} /> New Image from Reference
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
