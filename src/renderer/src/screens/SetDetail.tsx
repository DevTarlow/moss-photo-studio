import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Image as ImageIcon, Layers, Loader2, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Heading, Icon, Text } from '@astryxdesign/core'
import { DropdownMenu } from 'radix-ui'
import type { LibraryImage, SetDetail as SetDetailData } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { SetNameDialog } from '../components/sets/SetNameDialog'
import { AddToSetDialog } from '../components/sets/AddToSetDialog'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { showExportToast } from '../lib/exportFeedback'
import { toast } from '../lib/toast'

export function SetDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const settings = useAppStore((state) => state.settings)
  const [detail, setDetail] = useState<SetDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

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

  const createFromImage = async (image: LibraryImage, type: 'photo' | 'image'): Promise<void> => {
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

  const removeImage = async (image: LibraryImage): Promise<void> => {
    setBusy(`${image.id}:remove`)
    try {
      await unwrap(window.moss.images.assignSet({ imageId: image.id, setId: null }))
      toast.status('Removed from Set. The image stays in its project.')
      await load()
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

  const removeProduct = async (productId: string): Promise<void> => {
    setBusy(`product:${productId}:remove`)
    try {
      await unwrap(window.moss.products.assignSet({ productId, setId: null }))
      toast.status('Removed from Set. The product stays in Products.')
      await load()
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

  const exportSet = async (): Promise<void> => {
    if (!detail || !id) return
    const options = settings?.exportDefaults ?? { format: 'webp' as const, quality: 90, maxDimension: null }
    setBusy('export')
    try {
      const result = await unwrap(window.moss.sets.export({ id, options }))
      if (result.count < 1) {
        toast.error(result.warnings[0] ?? 'Make at least one image first.')
        return
      }
      showExportToast(result.count, result.folderName, null, detail.set.id)
      if (result.warnings.length) toast.error(result.warnings.join(' '))
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  if (!id) {
    return <ErrorState message="That Set is not here anymore." onRetry={() => navigate('/sets')} />
  }

  return (
    <AppFrame backTo="/sets" backLabel="Back to Sets" title="Set">
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
                  <Button variant="primary" disabled={busy !== null} onClick={() => setAddOpen(true)}>
                    <Icon icon={Plus} size="sm" /> Add to Set
                  </Button>
                  <Button variant="secondary" disabled={busy !== null || detail.total === 0} onClick={() => void exportSet()}>
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
                  action={<Button variant="primary" onClick={() => setAddOpen(true)}><Icon icon={Plus} size="sm" /> Add to Set</Button>}
                />
              ) : (
                <>
                  {detail.products.length > 0 && (
                    <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                      {detail.products.map((product) => (
                        <article key={product.id} className="card overflow-hidden">
                          <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                            <img src={product.thumbUrl} alt="" className="h-full w-full object-cover" />
                            <span className="badge absolute left-2 top-2">Product</span>
                          </div>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold">{product.name}</p>
                                <p className="meta mt-0.5">Product Photo</p>
                              </div>
                              <button type="button" className="icon-btn shrink-0" aria-label={`Remove product ${product.name} from ${detail.set.name}`} disabled={busy !== null} onClick={() => void removeProduct(product.id)}>
                                <Icon icon={X} size="sm" />
                              </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromProduct(product.id, 'photo')}>
                                {busy === `product:${product.id}:photo` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Pencil} size="sm" />} Edit This Photo
                              </Button>
                              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromProduct(product.id, 'image')}>
                                {busy === `product:${product.id}:image` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Sparkles} size="sm" />} Make an Image with this Product
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {detail.images.length > 0 && (
                    <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                      {detail.images.map((image) => (
                        <article key={image.id} className="card overflow-hidden">
                          <div className="aspect-[4/3] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                            {image.thumbUrl ? (
                              <img src={image.thumbUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center" style={{ color: 'var(--text-faint)' }}>
                                <Icon icon={ImageIcon} size="lg" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold">{image.label}</p>
                                <p className="meta mt-0.5 truncate">From {image.projectName}</p>
                              </div>
                              <button type="button" className="icon-btn shrink-0" aria-label={`Remove ${image.label} from ${detail.set.name}`} disabled={busy !== null} onClick={() => void removeImage(image)}>
                                <Icon icon={X} size="sm" />
                              </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromImage(image, 'photo')}>
                                {busy === `${image.id}:photo` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Pencil} size="sm" />} Edit This Photo
                              </Button>
                              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void createFromImage(image, 'image')}>
                                {busy === `${image.id}:image` ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Sparkles} size="sm" />} Make an Image with This Photo
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
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
    </AppFrame>
  )
}
