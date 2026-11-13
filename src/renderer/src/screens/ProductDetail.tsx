import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Package,
  Scissors,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { ProductDetail as ProductDetailData, Project, ProjectType } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Field } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { KitExportDialog } from '../components/set/KitExportDialog'
import { ListingPanel } from '../components/listings/ListingPanel'
import { useAppStore } from '../store/app'
import { LISTING_COST_LABEL } from '@shared/cost'
import { unwrap, messageOf } from '../lib/ipc'
import { formatDateTime, relativeTime } from '../lib/format'
import { toast } from '../lib/toast'
import { Heading, Text, TextInput, TextArea } from '@astryxdesign/core'

const typeLabel: Record<ProjectType, string> = {
  set: 'Set',
  photo: 'Photo edit',
  image: 'Image'
}

const typeIcon: Record<ProjectType, React.JSX.Element> = {
  set: <Layers size={16} />,
  photo: <ImageIcon size={16} />,
  image: <Sparkles size={16} />
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
        <ArrowUpRight size={15} style={{ color: 'var(--text-faint)' }} />
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
  const secrets = useAppStore((state) => state.secrets)
  const confirm = useConfirm()
  const [detail, setDetail] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [form, setForm] = useState({ category: '', audience: '', notes: '' })
  const [savingDetails, setSavingDetails] = useState(false)
  const [reading, setReading] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [kitOpen, setKitOpen] = useState(false)
  const [unfiled, setUnfiled] = useState<Project[]>([])

  const load = async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const next = await unwrap(window.moss.products.detail({ id }))
      setDetail(next)
      setRenameValue(next.product.name)
      setForm({
        category: next.product.category ?? '',
        audience: next.product.audience ?? '',
        notes: next.product.notes ?? ''
      })
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

  const rename = async (): Promise<void> => {
    if (!detail || !renameValue.trim()) return
    try {
      const updated = await unwrap(window.moss.products.update({ id: detail.product.id, patch: { name: renameValue.trim() } }))
      setDetail({ ...detail, product: { ...detail.product, name: updated.name } })
      setRenaming(false)
      await refreshProducts()
      toast.status('Product renamed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const saveDetails = async (): Promise<void> => {
    if (!detail) return
    setSavingDetails(true)
    try {
      const updated = await unwrap(
        window.moss.products.update({
          id: detail.product.id,
          patch: {
            category: form.category.trim() || null,
            audience: form.audience.trim() || null,
            notes: form.notes.trim() || null
          }
        })
      )
      setDetail({ ...detail, product: { ...detail.product, ...updated } })
      await refreshProducts()
      toast.status('Product details saved.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setSavingDetails(false)
    }
  }

  const readPhoto = async (): Promise<void> => {
    if (!detail) return
    setReading(true)
    try {
      const next = await unwrap(window.moss.products.analyze({ id: detail.product.id }))
      setDetail(next)
      setForm({
        category: next.product.category ?? '',
        audience: next.product.audience ?? '',
        notes: next.product.notes ?? ''
      })
      await refreshProducts()
      toast.status('Photo read. Check what we saw.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setReading(false)
    }
  }

  const cleanShot = async (): Promise<void> => {
    if (!detail) return
    setCleaning(true)
    try {
      const result = await unwrap(window.moss.products.cleanShot({ id: detail.product.id }))
      setDetail(result.detail)
      await refreshProducts()
      toast.status('Clean shot ready.')
      navigate(`/project/${result.projectId}`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setCleaning(false)
    }
  }

  const archive = async (): Promise<void> => {
    if (!detail) return
    const ok = await confirm({
      title: `Archive "${detail.product.name}"?`,
      body: 'Its sets and images stay linked. You can bring it back later from the archived products.',
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
      body: 'Its sets and images stay, but they become unfiled work. This cannot be undone.',
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
      toast.status('Work linked to this product.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const unlink = async (projectId: string): Promise<void> => {
    try {
      await unwrap(window.moss.products.unlinkProject({ projectId }))
      await load()
      await refreshProducts()
      toast.status('Work unlinked.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  if (loading && !detail) {
    return (
      <AppFrame backTo="/products">
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
      <AppFrame backTo="/products">
        <div className="page-scroll">
          <div className="page-pad page-max">
            <ErrorState message={error ?? 'That product is not here anymore.'} onRetry={() => void load()} />
          </div>
        </div>
      </AppFrame>
    )
  }

  const { product, projects, counts, latestSet } = detail
  const latest = latestSet ?? null

  return (
    <AppFrame backTo="/products">
      <div className="page-scroll">
        <div className="page-pad page-max">
          <button type="button" className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--text-muted)' }} onClick={() => navigate('/products')}>
            <ArrowLeft size={14} /> Products
          </button>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div>
              <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: 'var(--border)', background: 'var(--canvas)' }}>
                <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-contain" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="card p-2 text-center"><p className="text-[16px] font-semibold tabular">{counts.projects}</p><p className="meta">work</p></div>
                <div className="card p-2 text-center"><p className="text-[16px] font-semibold tabular">{counts.sets}</p><p className="meta">sets</p></div>
                <div className="card p-2 text-center"><p className="text-[16px] font-semibold tabular">{counts.images}</p><p className="meta">images</p></div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Heading level={1}>{product.name}</Heading>
                  <Text type="supporting" color="secondary" className="mt-1 block">
                    {product.category || 'No category yet'} · saved {formatDateTime(product.createdAt)}
                  </Text>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`More actions for ${product.name}`}>More</Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                      <DropdownMenu.Item className="menu-item" onSelect={() => setRenaming(true)}>Rename</DropdownMenu.Item>
                      <DropdownMenu.Item className="menu-item" onSelect={() => void archive()}><Archive size={14} /> Archive</DropdownMenu.Item>
                      <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={() => void remove()}><Trash2 size={14} /> Delete</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void start('set')}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Layers size={15} />} Make a Set
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void start('photo')}>
                  <ImageIcon size={15} /> Change a Photo
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void start('image')}>
                  <Sparkles size={15} /> New Image
                </Button>
              </div>

              <div className="card mt-5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="section-label">Listing kit</p>
                  <Button variant="ghost" size="sm" onClick={() => void openLink()}><Link2 size={14} /> Link existing work</Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>✓</span>
                    <span>Source photo ready</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: counts.images ? 'var(--accent-soft)' : 'var(--surface-2)', color: counts.images ? 'var(--accent)' : 'var(--text-faint)' }}>{counts.images ? '✓' : '2'}</span>
                    <span>{counts.images ? `${counts.images} listing ${counts.images === 1 ? 'image' : 'images'} made` : 'No listing images yet'}</span>
                    {!counts.images && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void start('set')}>Make a set</Button>}
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}>
                      {latest ? '→' : '3'}
                    </span>
                    <span>{latest ? 'Open the latest set to review and export' : 'Export comes after the first set'}</span>
                    {latest && (
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${latest.id}`)}>Open set</Button>
                        <Button variant="secondary" size="sm" onClick={() => setKitOpen(true)}>Export Kit</Button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="hint mt-3">A kit writes marketplace-sized images, alt text, a manifest, and the untouched original when the shop needs it.</p>
              </div>

              <div className="card mt-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="section-label">Clean shot</p>
                    <p className="hint mt-1">Cut the product out of its photo and place it on a clean background. The product pixels stay the same.</p>
                  </div>
                  <Button variant="secondary" disabled={cleaning || !secrets?.hasKey} onClick={() => void cleanShot()}>
                    {cleaning ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />} Make a clean shot · {LISTING_COST_LABEL}
                  </Button>
                </div>
                {product.cutoutUrl && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
                    <img src={product.cutoutUrl} alt={`${product.name} cutout`} className="h-20 w-20 rounded object-contain" style={{ background: 'var(--surface-2)' }} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold">Cutout ready</p>
                      <p className="meta">Confidence {Math.round((product.cutoutConfidence ?? 0) * 100)}% · the exact pixels from the photo</p>
                      <p className="hint mt-1">Make another clean shot to add a fresh 2048 px version to this product’s work.</p>
                    </div>
                  </div>
                )}
              </div>

              <ListingPanel productId={product.id} productName={product.name} projectId={latest?.id ?? null} />

              <div className="card mt-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="section-label">Product details</p>
                  <div className="flex items-center gap-2">
                    {!secrets?.hasKey && <span className="hint">Add your key first</span>}
                    <Button variant="secondary" size="sm" disabled={reading || !secrets?.hasKey} onClick={() => void readPhoto()}>
                      {reading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Read the photo · {LISTING_COST_LABEL}
                    </Button>
                  </div>
                </div>
                {product.analysis && (
                  <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="field-label">What we see</p>
                    <p className="mt-1 text-[12px] font-semibold">{product.analysis.product || product.name}</p>
                    {product.analysis.category && <p className="meta">{product.analysis.category}</p>}
                    {product.analysis.audience && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{product.analysis.audience}</p>}
                    {product.analysis.points.length > 0 && (
                      <ul className="mt-2 grid gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {product.analysis.points.map((point, index) => <li key={index}>- {point}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <TextInput label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} placeholder="Ceramics and pottery" width="100%" />
                  <TextInput label="Who buys it" value={form.audience} onChange={(value) => setForm({ ...form, audience: value })} placeholder="People setting up a calm home office" width="100%" />
                </div>
                <div className="mt-3">
                  <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} placeholder="Materials, sizes, or anything the listing should remember." rows={3} width="100%" />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="secondary" disabled={savingDetails} onClick={() => void saveDetails()}>
                    {savingDetails ? <Loader2 size={14} className="animate-spin" /> : null} Save Details
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8" aria-labelledby="product-work-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="product-work-heading" className="section-label">Work for this product</h2>
              <span className="meta-faint">{projects.length}</span>
            </div>
            {projects.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={<Package size={22} />}
                  title="No work yet"
                  line="Make a set from the source photo, or link an existing set or edit."
                  action={<Button variant="secondary" onClick={() => void start('set')}>Make a Set</Button>}
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

      {latest && (
        <KitExportDialog
          open={kitOpen}
          onOpenChange={setKitOpen}
          project={latest}
          productName={product.name}
          imageCount={latest.imageCount}
        />
      )}

      <Dialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename product"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void rename()}>Save Name</Button>
          </>
        }
      >
        <Field label="Product name" value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void rename() }} autoFocus />
      </Dialog>

      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Link existing work"
        description="Unfiled sets, edits, and images move under this product. Their files stay where they are."
        width={620}
        footer={<Button variant="secondary" onClick={() => setLinkOpen(false)}>Close</Button>}
      >
        {unfiled.length === 0 ? (
          <p className="hint">There is no unfiled work right now.</p>
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
