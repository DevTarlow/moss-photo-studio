import { useEffect, useState } from 'react'
import { Loader2, Package, Plus, Search } from 'lucide-react'
import type { LibraryImage } from '@shared/types'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { cn } from '../../lib/cn'

export type SourceChoice =
  | { kind: 'product'; productId: string; name: string; thumbUrl: string }
  | { kind: 'image'; imageId: string; label: string; thumbUrl: string | null }

const PAGE_SIZE = 60

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
  const [tab, setTab] = useState<'products' | 'library'>('products')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<LibraryImage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLibrary = async (query: string, offset: number): Promise<void> => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    if (offset === 0) setError(null)
    try {
      const result = await unwrap(window.moss.images.library({
        search: query.trim() || undefined,
        limit: PAGE_SIZE,
        offset
      }))
      setItems((previous) => offset === 0 ? result.items : [...previous, ...result.items])
      setTotal(result.total)
    } catch (caught) {
      if (offset === 0) setError(messageOf(caught))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTab('products')
    setSearch('')
    void loadLibrary('', 0)
  }, [open])

  useEffect(() => {
    if (!open || tab !== 'library') return
    const timer = window.setTimeout(() => { void loadLibrary(search, 0) }, 150)
    return () => window.clearTimeout(timer)
  }, [open, tab, search])

  const choose = (choice: SourceChoice): void => {
    onChoose(choice)
    onOpenChange(false)
  }

  return (
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
              <Plus size={14} /> Choose a File
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
        {tab === 'library' && (
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} aria-hidden />
            <input
              className="field h-8 pl-8 text-[12px]"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects and images"
              aria-label="Search library images"
            />
          </div>
        )}
      </div>

      <div className="mt-4 max-h-[52vh] overflow-y-auto">
        {tab === 'products' ? (
          products.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Package size={22} style={{ color: 'var(--text-faint)' }} />
              <p className="mt-2 text-[13px] font-semibold">No saved products yet</p>
              <p className="meta mt-1 max-w-[320px]">Save a product photo from an image, or add one from a file.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((product) => (
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
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-faint)' }} />
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
            {items.length < total && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadLibrary(search, items.length)}>
                  {loadingMore ? 'Loading...' : `Show More (${total - items.length} left)`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
