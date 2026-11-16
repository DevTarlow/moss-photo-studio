import { useEffect, useState } from 'react'
import { Image as ImageIcon, Loader2, Plus, Search } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { LibraryImage, Product } from '@shared/types'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { EmptyState } from '../ui/EmptyState'
import { Pagination } from '../ui/Pagination'
import { Segmented } from '../ui/Segmented'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'

/** Add existing products or ready images to a Set, from the Set itself. */
export function AddToSetDialog({
  open,
  setId,
  setName,
  onOpenChange,
  onAdded
}: {
  open: boolean
  setId: string
  setName: string
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}): React.JSX.Element {
  const products = useAppStore((state) => state.products)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const [tab, setTab] = useState<'products' | 'images'>('products')
  const [search, setSearch] = useState('')
  const [images, setImages] = useState<LibraryImage[]>([])
  const [imageTotal, setImageTotal] = useState(0)
  const [imagePage, setImagePage] = useState(1)
  const [imageLoading, setImageLoading] = useState(false)
  const [existingImages, setExistingImages] = useState<Set<string>>(() => new Set())
  const [existingProducts, setExistingProducts] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const needle = search.trim().toLowerCase()
  const visibleProducts = products.filter(
    (product) => !existingProducts.has(product.id) && (!needle || product.name.toLowerCase().includes(needle))
  )

  const loadDetail = async (): Promise<void> => {
    try {
      const detail = await unwrap(window.moss.sets.detail({ id: setId }))
      setExistingImages(new Set(detail.images.map((image) => image.id)))
      setExistingProducts(new Set(detail.products.map((product) => product.id)))
    } catch {
      setExistingImages(new Set())
      setExistingProducts(new Set())
    }
  }

  const loadImages = async (query: string, requestedPage: number): Promise<void> => {
    setImageLoading(true)
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
      setImages(result.items)
      setImageTotal(result.total)
      setImagePage(target)
    } catch {
      setImages([])
      setImageTotal(0)
    } finally {
      setImageLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTab('products')
    setSearch('')
    setImagePage(1)
    setBusy(null)
    void refreshProducts().catch(() => undefined)
    void loadDetail()
    void loadImages('', 1)
  }, [open, setId, refreshProducts])

  useEffect(() => {
    if (!open || tab !== 'images') return
    const timer = window.setTimeout(() => {
      setImagePage(1)
      void loadImages(search, 1)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [open, tab, search])

  const addProduct = async (product: Product): Promise<void> => {
    setBusy(`product:${product.id}`)
    try {
      await unwrap(window.moss.products.assignSet({ productId: product.id, setId }))
      setExistingProducts((current) => new Set(current).add(product.id))
      toast.status(`Added to "${setName}".`)
      onAdded()
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const addImage = async (image: LibraryImage): Promise<void> => {
    setBusy(`image:${image.id}`)
    try {
      await unwrap(window.moss.images.assignSet({ imageId: image.id, setId }))
      setExistingImages((current) => new Set(current).add(image.id))
      setImages((current) => current.filter((item) => item.id !== image.id))
      setImageTotal((current) => Math.max(0, current - 1))
      toast.status(`Added to "${setName}".`)
      onAdded()
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add to ${setName}`}
      description="Add a saved product photo or a ready image. If it is already in another Set, it moves here."
      width={620}
      footer={<Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button>}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="What to add"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'products', label: `Products (${Math.max(0, products.length - existingProducts.size)})` },
            { value: 'images', label: 'Images' }
          ]}
        />
        <div className="min-w-[180px] flex-1">
          <div className="relative">
            <Icon icon={Search} size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} aria-hidden />
            <input
              className="field search-field h-8 text-[12px]"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === 'products' ? 'Search products' : 'Search images'}
              aria-label={tab === 'products' ? 'Search products to add' : 'Search images to add'}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 max-h-[50vh] overflow-y-auto">
        {tab === 'products' ? (
          visibleProducts.length === 0 ? (
            <EmptyState
              icon={<Icon icon={ImageIcon} size="lg" />}
              title={needle ? `No products match "${search.trim()}".` : 'No products to add'}
              line={needle ? 'Try a different word.' : 'Add a product photo from Products, then come back here.'}
              compact
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="card card-hover overflow-hidden text-left"
                  onClick={() => void addProduct(product)}
                  disabled={busy !== null}
                  aria-label={`Add ${product.name} to ${setName}`}
                >
                  <img src={product.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
                  <span className="flex items-center justify-between gap-2 p-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{product.name}</span>
                    {busy === `product:${product.id}` ? (
                      <Icon icon={Loader2} size="sm" className="animate-spin" />
                    ) : (
                      <Icon icon={Plus} size="sm" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : imageLoading ? (
          <div className="flex items-center justify-center py-10">
            <Icon icon={Loader2} size="md" className="animate-spin" style={{ color: 'var(--text-faint)' }} />
          </div>
        ) : images.filter((image) => !existingImages.has(image.id)).length === 0 ? (
          <EmptyState
            icon={<Icon icon={ImageIcon} size="lg" />}
            title={needle ? `No images match "${search.trim()}".` : 'No images to add'}
            line={needle ? 'Try a different word.' : 'Make or edit an image first.'}
            compact
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images
                .filter((image) => !existingImages.has(image.id))
                .map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    className="card card-hover overflow-hidden text-left"
                    onClick={() => void addImage(image)}
                    disabled={busy !== null}
                    aria-label={`Add ${image.label} to ${setName}`}
                  >
                    {image.thumbUrl ? (
                      <img src={image.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" style={{ background: 'var(--surface-2)' }} />
                    ) : (
                      <span className="block aspect-[4/3] w-full" style={{ background: 'var(--surface-2)' }} />
                    )}
                    <span className="block min-w-0 p-2">
                      <span className="block truncate text-[12px] font-medium">{image.label}</span>
                      <span className="meta block truncate">{image.projectName}</span>
                    </span>
                  </button>
                ))}
            </div>
            <Pagination
              page={imagePage}
              total={imageTotal}
              onPage={(next) => void loadImages(search, next)}
              label="Image pages"
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
