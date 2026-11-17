import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Image as ImageIcon, Layers, Loader2, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Heading, Icon, Text } from '@astryxdesign/core'
import { DropdownMenu } from 'radix-ui'
import type { LibraryImage, SetDetail as SetDetailData } from '@shared/types'
import type { ExportPreset } from '@shared/exportPresets'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Segmented } from '../components/ui/Segmented'
import { MediaLightbox } from '../components/ui/MediaLightbox'
import type { MediaItem } from '../components/ui/MediaLightbox'
import { SetNameDialog } from '../components/sets/SetNameDialog'
import { AddToSetDialog } from '../components/sets/AddToSetDialog'
import { SetExportDialog } from '../components/sets/SetExportDialog'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { showExportToast } from '../lib/exportFeedback'
import { toast } from '../lib/toast'

type SetFilter = 'all' | 'products' | 'images'

export function SetDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const settings = useAppStore((state) => state.settings)
  const canUseStudio = useAppStore((state) => state.canUseStudio)
  const [detail, setDetail] = useState<SetDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [filter, setFilter] = useState<SetFilter>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxSource, setLightboxSource] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setDetail(await unwrap(window.moss.sets.detail({ id })))
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  useEffect(() => {
    setLightboxIndex(null)
    setLightboxSource(null)
  }, [filter])

  const createFromImage = async (image: LibraryImage, type: 'photo' | 'image'): Promise<void> => {
    if (!canUseStudio) {
      toast.error('Reactivate to use the studio.')
      return
    }
    setBusy(`${image.id}:${type}`)
    try {
      const project = await unwrap(window.moss.projects.createFromImage({ sourceImageId: image.id, type }))
      navigate(projectUrl(project.project.id))
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const projectUrl = (projectId: string): string =>
    `/project/${projectId}${id ? `?fromSet=${encodeURIComponent(id)}` : ''}`

  const restoreImage = async (imageId: string): Promise<void> => {
    if (!id) return
    try {
      await unwrap(window.moss.images.assignSet({ imageId, setId: id }))
      await load()
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const removeImage = async (image: LibraryImage): Promise<void> => {
    setBusy(`${image.id}:remove`)
    try {
      await unwrap(window.moss.images.assignSet({ imageId: image.id, setId: null }))
      await load()
      toast.status(`Removed ${image.label} from this Set.`, {
        label: 'Undo',
        onClick: () => void restoreImage(image.id)
      })
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const createFromProduct = async (productId: string, type: 'photo' | 'image'): Promise<void> => {
    setBusy(`product:${productId}:${type}`)
    try {
      const project = await unwrap(window.moss.products.createProject({ productId, type }))
      navigate(projectUrl(project.project.id))
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const restoreProduct = async (productId: string): Promise<void> => {
    if (!id) return
    try {
      await unwrap(window.moss.products.assignSet({ productId, setId: id }))
      await load()
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const removeProduct = async (productId: string, name: string): Promise<void> => {
    setBusy(`product:${productId}:remove`)
    try {
      await unwrap(window.moss.products.assignSet({ productId, setId: null }))
      await load()
      toast.status(`Removed ${name} from this Set.`, {
        label: 'Undo',
        onClick: () => void restoreProduct(productId)
      })
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const rename = async (name: string): Promise<void> => {
    if (!id) return
    const updated = await unwrap(window.moss.sets.rename({ id, name }))
    setDetail((current) => current ? { ...current, set: updated } : current)
    toast.status('Set renamed.')
  }

  const removeSet = async (): Promise<void> => {
    if (!detail) return
    const ok = await confirm({
      title: `Delete "${detail.set.name}"?`,
      body: 'The Set is removed, but its images stay in their projects. This cannot be undone.',
      confirmLabel: 'Delete Set',
      danger: true
    })
    if (!ok) return
    setDeleting(true)
    try {
      await unwrap(window.moss.sets.delete({ id: detail.set.id }))
      toast.status('Set deleted. Its images are still in your projects.')
      navigate('/sets')
    } catch (caught) {
      toast.error(messageOf(caught))
      setDeleting(false)
    }
  }

  const runExport = async (preset: ExportPreset): Promise<void> => {
    if (!detail || !id) return
    const defaults = settings?.exportDefaults ?? { format: 'webp' as const, quality: 90, maxDimension: null }
    setBusy('export')
    try {
      const result = await unwrap(window.moss.sets.export({ id, options: { ...defaults, preset } }))
      if (result.count < 1) {
        toast.error(result.warnings[0] ?? 'Make at least one image first.')
        return
      }
      setExportOpen(false)
      showExportToast(result.count, result.folderName, null, detail.set.id)
      if (result.warnings.length) toast.error(result.warnings.join(' '))
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const mediaItems: MediaItem[] = detail
    ? [
        ...detail.products.map((product) => ({
          id: product.id,
          label: product.name,
          caption: 'Product photo',
          url: product.imageUrl,
          thumbUrl: product.thumbUrl
        })),
        ...detail.images.map((image) => ({
          id: image.id,
          label: image.label,
          caption: `From ${image.projectName}`,
          url: image.url ?? image.thumbUrl,
          thumbUrl: image.thumbUrl
        }))
      ]
    : []

  const openImage = async (image: LibraryImage): Promise<void> => {
    const index = mediaItems.findIndex((item) => item.id === image.id)
    setLightboxSource(null)
    setLightboxIndex(index >= 0 ? index : 0)
    try {
      const project = await unwrap(window.moss.projects.get({ id: image.projectId }))
      const source =
        project.images.find((entry) => entry.id === project.project.sourceImageId) ??
        project.images.find((entry) => entry.isOriginal)
      setLightboxSource(source?.url ?? null)
    } catch {
      setLightboxSource(null)
    }
  }

  if (!id) {
    return <ErrorState message="That Set is not here anymore." onRetry={() => navigate('/sets')} />
  }

  const products = detail?.products ?? []
  const images = detail?.images ?? []
  const visibleProducts = filter === 'images' ? [] : products
  const visibleImages = filter === 'products' ? [] : images
  const filterEmpty = Boolean(detail) && (visibleProducts.length + visibleImages.length === 0)

  const productCard = (product: NonNullable<typeof products[number]>): React.JSX.Element => (
    <article key={product.id} className="card set-card overflow-hidden">
      <div className="set-card-media">
        <button
          type="button"
          className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
          aria-label={`Open ${product.name} larger`}
          onClick={() => {
            const index = mediaItems.findIndex((item) => item.id === product.id)
            setLightboxSource(null)
            setLightboxIndex(index >= 0 ? index : 0)
          }}
        >
          <img src={product.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" />
        </button>
        <span className="badge absolute left-2 top-2">Product</span>
        <div className="set-card-menu">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="icon-btn"
                style={{ background: 'var(--surface)' }}
                aria-label={`Actions for ${product.name}`}
              >
                <Icon icon={MoreHorizontal} size="sm" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                <DropdownMenu.Item className="menu-item" onSelect={() => setAddOpen(true)}>
                  <Icon icon={Plus} size="sm" /> Add to Set
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="menu-item"
                  data-danger="true"
                  disabled={busy !== null}
                  onSelect={() => void removeProduct(product.id, product.name)}
                >
                  <Icon icon={Trash2} size="sm" /> Remove from Set
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{product.name}</p>
        <p className="meta mt-0.5">Product Photo</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromProduct(product.id, 'photo')}>
            {busy === `product:${product.id}:photo` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Pencil} size="sm" />} Edit Photo
          </Button>
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromProduct(product.id, 'image')}>
            {busy === `product:${product.id}:image` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Sparkles} size="sm" />} Make an Image with this Product
          </Button>
        </div>
      </div>
    </article>
  )

  const imageCard = (image: LibraryImage): React.JSX.Element => (
    <article key={image.id} className="card set-card overflow-hidden">
      <div className="set-card-media">
        <button
          type="button"
          className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
          aria-label={`Open ${image.label} larger`}
          onClick={() => void openImage(image)}
        >
          {image.thumbUrl ? (
            <img src={image.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <span className="grid aspect-[4/3] w-full place-items-center" style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}>
              <Icon icon={ImageIcon} size="lg" />
            </span>
          )}
        </button>
        <div className="set-card-menu">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="icon-btn"
                style={{ background: 'var(--surface)' }}
                aria-label={`Actions for ${image.label}`}
              >
                <Icon icon={MoreHorizontal} size="sm" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                <DropdownMenu.Item className="menu-item" onSelect={() => setAddOpen(true)}>
                  <Icon icon={Plus} size="sm" /> Add to Set
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="menu-item"
                  data-danger="true"
                  disabled={busy !== null}
                  onSelect={() => void removeImage(image)}
                >
                  <Icon icon={Trash2} size="sm" /> Remove from Set
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{image.label}</p>
        <p className="meta mt-0.5 truncate">From {image.projectName}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" disabled={busy !== null || !canUseStudio} onClick={() => void createFromImage(image, 'photo')}>
            {busy === `${image.id}:photo` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Pencil} size="sm" />} Edit Photo
          </Button>
          <Button variant="secondary" size="sm" disabled={busy !== null || !canUseStudio} onClick={() => void createFromImage(image, 'image')}>
            {busy === `${image.id}:image` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Sparkles} size="sm" />} Make an Image with this Photo
          </Button>
        </div>
      </div>
    </article>
  )

  return (
    <AppFrame backTo="/sets" backLabel="Back to Sets" backText="Sets" title="Set">
      <div className="page-scroll">
        <div className="page-pad page-max">
          {loading && !detail ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3]" />)}
            </div>
          ) : error || !detail ? (
            <ErrorState message={error ?? 'That Set is not here anymore.'} onRetry={() => void load()} />
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Heading level={1} className="truncate">{detail.set.name}</Heading>
                    <span className="badge">{detail.total} {detail.total === 1 ? 'image' : 'images'}</span>
                  </div>
                  <Text type="supporting" color="secondary" className="block">
                    Images and products in this Set stay together. Start something new from any of them.
                  </Text>
                </div>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <Button variant="primary" disabled={busy !== null || !canUseStudio} onClick={() => setAddOpen(true)}>
                    <Icon icon={Plus} size="sm" /> Add to Set
                  </Button>
                  <Button variant="secondary" disabled={busy !== null || detail.total === 0} onClick={() => setExportOpen(true)}>
                    {busy === 'export' ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Download} size="sm" />} Export Set
                  </Button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className="icon-btn" aria-label={`Actions for ${detail.set.name}`}>
                        <Icon icon={MoreHorizontal} size="sm" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                        <DropdownMenu.Item className="menu-item" onSelect={() => setRenameOpen(true)}>
                          <Icon icon={Pencil} size="sm" /> Rename
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className="menu-item" data-danger="true" disabled={deleting} onSelect={() => void removeSet()}>
                          <Icon icon={Trash2} size="sm" /> Delete Set
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              {detail.total === 0 ? (
                <EmptyState
                  icon={<Icon icon={Layers} size="lg" />}
                  title="This Set is empty"
                  line="Add a product photo or an image to this Set."
                  action={<Button variant="primary" disabled={!canUseStudio} onClick={() => setAddOpen(true)}><Icon icon={Plus} size="sm" /> Add to Set</Button>}
                />
              ) : (
                <>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Segmented
                      label="Filter Set contents"
                      value={filter}
                      onChange={setFilter}
                      options={[
                        { value: 'all', label: `All (${detail.total})` },
                        { value: 'products', label: `Products (${products.length})` },
                        { value: 'images', label: `Generated & Edited (${images.length})` }
                      ]}
                    />
                    <p className="hint">Choose a card to preview it larger.</p>
                  </div>

                  {filterEmpty ? (
                    <div className="mt-6">
                      <EmptyState
                        icon={<Icon icon={Layers} size="lg" />}
                        title={filter === 'products' ? 'No product photos in this Set' : 'No generated or edited images in this Set'}
                        line="Add one from Add to Set, or choose another filter."
                        compact
                      />
                    </div>
                  ) : (
                    <>
                      {visibleProducts.length > 0 && (
                        <section className="mt-6" aria-labelledby="set-products-heading">
                          <div className="flex items-baseline gap-2">
                            <h2 id="set-products-heading" className="section-label">Products</h2>
                            <span className="meta-faint">{visibleProducts.length}</span>
                          </div>
                          <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                            {visibleProducts.map(productCard)}
                          </div>
                        </section>
                      )}
                      {visibleImages.length > 0 && (
                        <section className="mt-6" aria-labelledby="set-images-heading">
                          <div className="flex items-baseline gap-2">
                            <h2 id="set-images-heading" className="section-label">Generated & Edited</h2>
                            <span className="meta-faint">{visibleImages.length}</span>
                          </div>
                          <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                            {visibleImages.map(imageCard)}
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {detail && (
        <SetNameDialog
          open={renameOpen}
          title="Rename Set"
          initialName={detail.set.name}
          submitLabel="Save Name"
          onOpenChange={setRenameOpen}
          onSubmit={rename}
        />
      )}
      {detail && (
        <AddToSetDialog
          open={addOpen}
          setId={detail.set.id}
          setName={detail.set.name}
          onOpenChange={setAddOpen}
          onAdded={() => void load()}
        />
      )}
      {detail && (
        <SetExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          setName={detail.set.name}
          busy={busy === 'export'}
          onExport={(preset) => void runExport(preset)}
        />
      )}
      <MediaLightbox
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) { setLightboxIndex(null); setLightboxSource(null) } }}
        items={mediaItems}
        index={lightboxIndex ?? 0}
        onIndex={setLightboxIndex}
        sourceUrl={lightboxSource}
      />
    </AppFrame>
  )
}
