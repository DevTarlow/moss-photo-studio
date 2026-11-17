import { useEffect, useState } from 'react'
import { Loader2, Package, Plus, Search } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { LibraryImage } from '@shared/types'
import { bundledProductCards } from '@shared/products'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Pagination } from '../ui/Pagination'
import { Segmented } from '../ui/Segmented'
import { AddProductDialog } from '../products/AddProductDialog'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'

export type SourceChoice =
  | { kind: 'product'; productId: string; name: string; thumbUrl: string }
  | { kind: 'image'; imageId: string; label: string; thumbUrl: string | null }

export function SourcePickerDialog({
  open,
  onOpenChange,
  onChoose,
  onUpload,
  title = 'Choose a Photo',
  description = 'Use a saved product or any ready image in your library.'
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (choice: SourceChoice) => void
  onUpload?: () => void
  title?: string
  description?: string
}): React.JSX.Element {
  const products = useAppStore((state) => state.products)
  const starterProducts = bundledProductCards()
  const [tab, setTab] = useState<'products' | 'library'>('products')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<LibraryImage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [libraryPage, setLibraryPage] = useState(1)
  const [productPage, setProductPage] = useState(1)
  const [starterPage, setStarterPage] = useState(1)
  const [addProductOpen, setAddProductOpen] = useState(false)

  const loadLibrary = async (query: string, requestedPage: number): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const listAt = (page: number) =>
        unwrap(window.moss.images.library({
          search: query.trim() || undefined,
          limit: COLLECTION_PAGE_SIZE,
          offset: (page - 1) * COLLECTION_PAGE_SIZE
        }))
      let result = await listAt(requestedPage)
      const pages = Math.max(1, Math.ceil(result.total / COLLECTION_PAGE_SIZE))
      const target = Math.min(Math.max(1, requestedPage), pages)
      if (target !== requestedPage) result = await listAt(target)
      setItems(result.items)
      setTotal(result.total)
      setLibraryPage(target)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTab('products')
    setSearch('')
    setLibraryPage(1)
    setProductPage(1)
    setStarterPage(1)
    setAddProductOpen(false)
    void loadLibrary('', 1)
  }, [open])

  useEffect(() => {
    setProductPage(1)
    setStarterPage(1)
  }, [search])

  useEffect(() => {
    if (!open || tab !== 'library') return
    const timer = window.setTimeout(() => {
      setLibraryPage(1)
      void loadLibrary(search, 1)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [open, tab, search])

  const needle = search.trim().toLowerCase()
  const filteredProducts = products.filter((product) => !needle || product.name.toLowerCase().includes(needle))
  const filteredStarters = starterProducts.filter(
    (product) =>
      !needle ||
      [product.name, product.category ?? '', product.blurb ?? ''].some((value) => value.toLowerCase().includes(needle))
  )

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredProducts.length / COLLECTION_PAGE_SIZE))
    if (productPage > pages) setProductPage(pages)
  }, [filteredProducts.length, productPage])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredStarters.length / COLLECTION_PAGE_SIZE))
    if (starterPage > pages) setStarterPage(pages)
  }, [filteredStarters.length, starterPage])

  const visibleProducts = filteredProducts.slice(
    (productPage - 1) * COLLECTION_PAGE_SIZE,
    productPage * COLLECTION_PAGE_SIZE
  )

  const visibleStarters = filteredStarters.slice(
    (starterPage - 1) * COLLECTION_PAGE_SIZE,
    starterPage * COLLECTION_PAGE_SIZE
  )

  const choose = (choice: SourceChoice): void => {
    onChoose(choice)
    onOpenChange(false)
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={720}
      footer={
        <>
          {onUpload && (
            <Button variant="ghost" className="mr-auto" onClick={() => { onUpload(); onOpenChange(false) }}>
              <Icon icon={Plus} size="sm" /> Choose a File
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Source type"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'products', label: `Products (${products.length})` },
            { value: 'library', label: 'Library' }
          ]}
        />
        <div className="relative min-w-[200px] flex-1">
          <Icon icon={Search} size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} aria-hidden />
          <input
            className="field search-field h-8 text-[12px]"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tab === 'products' ? 'Search products' : 'Search projects and images'}
            aria-label={tab === 'products' ? 'Search products' : 'Search library images'}
          />
        </div>
      </div>

      <div className="mt-4 max-h-[52vh] overflow-y-auto">
        {tab === 'products' ? (
          <div className="space-y-5">
            {filteredProducts.length === 0 ? (
              !needle ? (
                <div className="rounded-[8px] border p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                  <Icon icon={Package} size="lg" style={{ color: 'var(--text-faint)' }} />
                  <p className="mt-2 text-[13px] font-semibold">No saved products yet</p>
                  <p className="meta mt-1 max-w-[320px] mx-auto">Save a product photo from an image, or add one from a file.</p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAddProductOpen(true)}>
                    <Icon icon={Plus} size="sm" /> Add Product Photo
                  </Button>
                </div>
              ) : null
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="section-label">Your Products</p>
                  <Button variant="ghost" size="sm" onClick={() => setAddProductOpen(true)}>
                    <Icon icon={Plus} size="sm" /> Add Product Photo
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="card card-hover overflow-hidden text-left"
                      aria-label={`Use ${product.name}`}
                      onClick={() => choose({ kind: 'product', productId: product.id, name: product.name, thumbUrl: product.thumbUrl })}
                    >
                      <img src={product.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
                      <span className="block p-2">
                        <span className="block truncate text-[12px] font-medium">{product.name}</span>
                        <span className="meta">Saved product</span>
                      </span>
                    </button>
                  ))}
                  <Pagination
                    page={productPage}
                    total={filteredProducts.length}
                    onPage={setProductPage}
                    className="col-span-2 sm:col-span-3"
                    label="Product source pages"
                  />
                </div>
              </div>
            )}
            {filteredStarters.length > 0 && (
              <div>
                <p className="section-label">Starter Products</p>
                <p className="meta mt-1">Use one as the product in this project. It is added to the project as a photo.</p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {visibleStarters.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="card card-hover overflow-hidden text-left"
                      aria-label={`Use starter ${product.name}`}
                      onClick={() => choose({ kind: 'product', productId: product.id, name: product.name, thumbUrl: product.thumbUrl })}
                    >
                      <img src={product.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
                      <span className="block p-2">
                        <span className="block truncate text-[12px] font-medium">{product.name}</span>
                        <span className="meta block truncate">{product.category}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <Pagination
                  page={starterPage}
                  total={filteredStarters.length}
                  onPage={setStarterPage}
                  label="Starter source pages"
                />
              </div>
            )}
            {filteredProducts.length === 0 && filteredStarters.length === 0 && (
              <p className="meta text-center">Nothing matches that. Try a different word.</p>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon icon={Loader2} size="md" className="animate-spin" style={{ color: 'var(--text-faint)' }} />
          </div>
        ) : error ? (
          <p className="error-text py-6 text-center" role="alert">{error}</p>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[13px] font-semibold">No images found</p>
            <p className="meta mt-1">{search.trim() ? 'Try a different word.' : 'Make an image first, or choose a file.'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={cn('card card-hover overflow-hidden text-left')}
                  aria-label={`Use ${image.label} from ${image.projectName}`}
                  onClick={() => choose({ kind: 'image', imageId: image.id, label: image.label, thumbUrl: image.thumbUrl })}
                >
                  {image.thumbUrl ? (
                    <img src={image.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
                  ) : (
                    <span className="block aspect-[4/3] w-full" style={{ background: 'var(--surface-2)' }} />
                  )}
                  <span className="block p-2">
                    <span className="block truncate text-[12px] font-medium">{image.label}</span>
                    <span className="meta block truncate">{image.projectName}</span>
                  </span>
                </button>
              ))}
            </div>
            <Pagination
              page={libraryPage}
              total={total}
              onPage={(next) => void loadLibrary(search, next)}
              label="Library source pages"
            />
          </>
        )}
      </div>
    </Dialog>
    <AddProductDialog open={addProductOpen} onOpenChange={setAddProductOpen} />
    </>
  )
}
