import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import {
  Archive,
  ArrowUpRight,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Package,
  Pencil,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { ProductDetail as ProductDetailData, Project, ProjectType } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { formatDateTime, relativeTime } from '../lib/format'
import { toast } from '../lib/toast'
import { openProductSetPicker } from '../store/setPicker'
import { Heading, Icon, Text } from '@astryxdesign/core'

const typeLabel: Record<ProjectType, string> = {
  photo: 'Photo edit',
  image: 'Image'
}

const typeIcon: Record<ProjectType, React.JSX.Element> = {
  photo: <Icon icon={ImageIcon} size="sm" />,
  image: <Icon icon={Sparkles} size="sm" />
}

function ProjectRow({
  project,
  onOpen,
  onUnlink
}: {
  project: Project
  onOpen: () => void
  onUnlink: () => void
}): React.JSX.Element {
  return (
    <div className="card flex items-center gap-3 p-3">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px]" style={{ background: 'var(--surface-2)' }}>
          {project.coverUrl ? <img src={project.coverUrl} alt="" className="h-full w-full object-cover" /> : typeIcon[project.type]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{project.name}</span>
          <span className="meta block">
            {typeLabel[project.type]} · {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'} · {relativeTime(project.updatedAt)}
          </span>
        </span>
        <Icon icon={ArrowUpRight} size="sm" style={{ color: 'var(--text-faint)' }} />
      </button>
      <Button variant="ghost" size="sm" onClick={onUnlink} aria-label={`Unlink ${project.name} from this product`}>
        Unlink
      </Button>
    </div>
  )
}

export function ProductDetail(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const confirm = useConfirm()
  const [detail, setDetail] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const titleButtonRef = useRef<HTMLButtonElement>(null)
  const renameBusy = useRef(false)
  const renameCancelled = useRef(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [unfiled, setUnfiled] = useState<Project[]>([])

  const load = async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const next = await unwrap(window.moss.products.detail({ id }))
      setDetail(next)
      setRenameValue(next.product.name)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const start = async (type: ProjectType): Promise<void> => {
    if (!detail) return
    setBusy(true)
    try {
      const created = await unwrap(window.moss.products.createProject({ productId: detail.product.id, type }))
      navigate(`/project/${created.project.id}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const startRename = (): void => {
    if (!detail) return
    renameCancelled.current = false
    setRenameValue(detail.product.name)
    setEditingTitle(true)
  }

  const cancelRename = (): void => {
    renameCancelled.current = true
    setEditingTitle(false)
    setRenameValue(detail?.product.name ?? '')
    window.requestAnimationFrame(() => {
      titleButtonRef.current?.focus()
      renameCancelled.current = false
    })
  }

  const commitRename = async (refocus = false): Promise<void> => {
    if (!detail || renameBusy.current || renameCancelled.current) return
    const current = detail.product.name
    const value = renameValue.trim()
    setEditingTitle(false)
    if (refocus) window.requestAnimationFrame(() => titleButtonRef.current?.focus())
    if (!value || value === current) {
      setRenameValue(current)
      return
    }
    renameBusy.current = true
    try {
      const updated = await unwrap(window.moss.products.update({ id: detail.product.id, patch: { name: value } }))
      setDetail((previous) => (previous ? { ...previous, product: { ...previous.product, name: updated.name } } : previous))
      await refreshProducts()
      toast.status('Product renamed.')
    } catch (caught) {
      setRenameValue(current)
      toast.error(messageOf(caught))
    } finally {
      renameBusy.current = false
    }
  }

  const archive = async (): Promise<void> => {
    if (!detail) return
    const ok = await confirm({
      title: `Archive "${detail.product.name}"?`,
      body: 'Its images stay linked. You can bring it back later from the archived products.',
      confirmLabel: 'Archive Product'
    })
    if (!ok) return
    try {
      await unwrap(window.moss.products.archive({ id: detail.product.id }))
      await refreshProducts()
      toast.status('Product archived.')
      navigate('/products')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const remove = async (): Promise<void> => {
    if (!detail) return
    const ok = await confirm({
      title: `Delete "${detail.product.name}"?`,
      body: 'Its images stay, but they become projects without a product. This cannot be undone.',
      confirmLabel: 'Delete Product',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.products.delete({ id: detail.product.id }))
      await refreshProducts()
      toast.status('Product deleted.')
      navigate('/products')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openLink = async (): Promise<void> => {
    setLinkOpen(true)
    try {
      const result = await unwrap(window.moss.projects.list({ productId: null, limit: 50 }))
      setUnfiled(result.items)
    } catch {
      setUnfiled([])
    }
  }

  const link = async (projectId: string): Promise<void> => {
    if (!detail) return
    try {
      await unwrap(window.moss.products.linkProject({ productId: detail.product.id, projectId }))
      setLinkOpen(false)
      await load()
      await refreshProducts()
      toast.status('Project linked to this product.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const unlink = async (projectId: string): Promise<void> => {
    try {
      await unwrap(window.moss.products.unlinkProject({ projectId }))
      await load()
      await refreshProducts()
      toast.status('Project unlinked.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  if (loading && !detail) {
    return (
      <AppFrame backTo="/products" backLabel="Back to Products">
        <div className="page-scroll">
          <div className="page-pad page-max">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-6 h-64 w-full" />
          </div>
        </div>
      </AppFrame>
    )
  }

  if (error || !detail) {
    return (
      <AppFrame backTo="/products" backLabel="Back to Products">
        <div className="page-scroll">
          <div className="page-pad page-max">
            <ErrorState message={error ?? 'That product is not here anymore.'} onRetry={() => void load()} />
          </div>
        </div>
      </AppFrame>
    )
  }

  const { product, projects, counts } = detail

  return (
    <AppFrame backTo="/products" backLabel="Back to Products">
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div>
              <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: 'var(--border)', background: 'var(--canvas)' }}>
                <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-contain" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="card p-2 text-center"><p className="text-[16px] font-semibold tabular">{counts.projects}</p><p className="meta">projects</p></div>
                <div className="card p-2 text-center"><p className="text-[16px] font-semibold tabular">{counts.images}</p><p className="meta">images</p></div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Heading level={1}>
                    {editingTitle ? (
                      <input
                        className="title-rename-input"
                        aria-label="Product name"
                        value={renameValue}
                        maxLength={80}
                        autoFocus
                        onChange={(event) => setRenameValue(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={() => void commitRename()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitRename(true)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelRename()
                          }
                        }}
                      />
                    ) : (
                      <button ref={titleButtonRef} type="button" className="title-rename" title="Rename product" onClick={startRename}>
                        <span className="min-w-0 truncate">{product.name}</span>
                        <Icon icon={Pencil} size="sm" className="title-rename-icon" />
                      </button>
                    )}
                  </Heading>
                  <Text type="supporting" color="secondary" className="mt-1 block">
                    Saved {formatDateTime(product.createdAt)}
                  </Text>
                  {product.setId && product.setName && (
                    <Link to={`/sets/${product.setId}`} className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium">
                      <Icon icon={Layers} size="xsm" /> Set: {product.setName}
                    </Link>
                  )}
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`More actions for ${product.name}`}>More</Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                      <DropdownMenu.Item className="menu-item" onSelect={startRename}>Rename</DropdownMenu.Item>
                      <DropdownMenu.Item className="menu-item" onSelect={() => void archive()}><Icon icon={Archive} size="sm" /> Archive</DropdownMenu.Item>
                      <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={() => void remove()}><Icon icon={Trash2} size="sm" /> Delete</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void start('photo')}>
                  {busy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={ImageIcon} size="sm" />} Edit Photo
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void start('image')}>
                  <Icon icon={Sparkles} size="sm" /> Make an Image with this Product
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => openProductSetPicker(detail.product, () => void load())}>
                  <Icon icon={FolderPlus} size="sm" /> Add to Set
                </Button>
              </div>

            </div>
          </div>

          <section className="mt-8" aria-labelledby="product-work-heading">
            <div className="flex items-center gap-2">
              <h2 id="product-work-heading" className="section-label">Projects for This Product</h2>
              <span className="meta-faint">{projects.length}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void openLink()}><Icon icon={Link2} size="sm" /> Link Existing Projects</Button>
            </div>
            {projects.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={<Icon icon={Package} size="lg" />}
                  title="No projects yet"
                  line="Make an image from the source photo, or link an existing project."
                  action={<Button variant="secondary" onClick={() => void start('image')}>Make the First Image</Button>}
                  compact
                />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onOpen={() => navigate(`/project/${project.id}`)}
                    onUnlink={() => void unlink(project.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Link Existing Projects"
        description="Projects not in a product move under this product. Their files stay where they are."
        width={620}
        footer={<Button variant="secondary" onClick={() => setLinkOpen(false)}>Close</Button>}
      >
        {unfiled.length === 0 ? (
          <p className="hint">There are no projects to link right now.</p>
        ) : (
          <div className="grid max-h-[420px] gap-2 overflow-y-auto">
            {unfiled.map((project) => (
              <div key={project.id} className="flex items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: 'var(--border)' }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">{project.name}</span>
                  <span className="meta block">{typeLabel[project.type]} · {project.imageCount} {project.imageCount === 1 ? 'image' : 'images'}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => void link(project.id)}>Link</Button>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </AppFrame>
  )
}
