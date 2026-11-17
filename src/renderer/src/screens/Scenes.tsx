import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mountain, Plus, Search, Sparkles } from 'lucide-react'
import type { ScenePreset } from '@shared/types'
import { BUNDLED_SCENE_CATEGORIES } from '@shared/scene-presets'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Field } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { SceneCard } from '../components/scenes/SceneCard'
import { AddSceneDialog } from '../components/scenes/AddSceneDialog'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { toast } from '../lib/toast'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { Heading, Icon, Selector, Text, TextInput, ToggleButton, ToggleButtonGroup } from '@astryxdesign/core'

export function Scenes(): React.JSX.Element {
  const navigate = useNavigate()
  const scenes = useAppStore((state) => state.scenes)
  const refreshScenes = useAppStore((state) => state.refreshScenes)
  const canUseStudio = useAppStore((state) => state.canUseStudio)
  const confirm = useConfirm()
  const [loading, setLoading] = useState(scenes.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'name'>('recent')
  const [category, setCategory] = useState('all')
  const [starterPage, setStarterPage] = useState(1)
  const [yoursPage, setYoursPage] = useState(1)
  const [preview, setPreview] = useState<ScenePreset | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renaming, setRenaming] = useState<ScenePreset | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      await refreshScenes()
    } catch {
      setLoadError('Could not load scenes. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const bundled = scenes.filter((scene) => scene.source === 'bundled')
  const yours = scenes.filter((scene) => scene.source === 'user')
  const categories = ['all', ...BUNDLED_SCENE_CATEGORIES]
  const needle = search.trim().toLowerCase()
  const matches = (scene: ScenePreset): boolean =>
    !needle ||
    [scene.name, scene.category ?? '', scene.blurb ?? ''].some((value) => value.toLowerCase().includes(needle))

  const filteredStarters = bundled.filter(
    (scene) => matches(scene) && (category === 'all' || scene.category === category)
  )
  const filteredYours = yours
    .filter(matches)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'oldest') return a.createdAt - b.createdAt
      return b.createdAt - a.createdAt
    })
  const matchingCount = filteredStarters.length + filteredYours.length

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredStarters.length / COLLECTION_PAGE_SIZE))
    if (starterPage > pages) setStarterPage(pages)
  }, [filteredStarters.length, starterPage])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredYours.length / COLLECTION_PAGE_SIZE))
    if (yoursPage > pages) setYoursPage(pages)
  }, [filteredYours.length, yoursPage])

  useEffect(() => {
    setStarterPage(1)
    setYoursPage(1)
  }, [search, sort, category])

  const visibleStarters = filteredStarters.slice(
    (starterPage - 1) * COLLECTION_PAGE_SIZE,
    starterPage * COLLECTION_PAGE_SIZE
  )
  const visibleYours = filteredYours.slice(
    (yoursPage - 1) * COLLECTION_PAGE_SIZE,
    yoursPage * COLLECTION_PAGE_SIZE
  )

  const startSceneProject = async (scene: ScenePreset): Promise<void> => {
    setPreview(null)
    setBusy(true)
    try {
      const detail = await unwrap(window.moss.projects.create({ type: 'image', draft: true }))
      navigate(`/project/${detail.project.id}?scene=${encodeURIComponent(scene.id)}`)
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
      await unwrap(window.moss.scenes.rename({ id: renaming.id, name: value }))
      await refreshScenes()
      setRenaming(null)
      if (preview?.id === renaming.id) setPreview({ ...preview, name: value })
      toast.status('Scene renamed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const remove = async (scene: ScenePreset): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${scene.name}"?`,
      body: 'Images already made with it stay. This cannot be undone.',
      confirmLabel: 'Delete Scene',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.scenes.delete({ id: scene.id }))
      await refreshScenes()
      if (preview?.id === scene.id) setPreview(null)
      toast.status('Scene deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openRename = (scene: ScenePreset): void => {
    setRenaming(scene)
    setRenameValue(scene.name)
  }

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <Heading level={1}>Scenes</Heading>
              <Text type="supporting" color="secondary" className="block">
                {search.trim()
                  ? `Showing ${matchingCount} of ${scenes.length}`
                  : `${bundled.length} starter scenes · ${yours.length} of yours`}
              </Text>
              <Text type="supporting" color="secondary" className="block">Settings and light for your product photos.</Text>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button variant="primary" disabled={!canUseStudio} onClick={() => setAddOpen(true)}>
                <Icon icon={Plus} size="sm" /> Add Scene Photo
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1 md:max-w-[340px]">
              <TextInput
                label="Search scenes"
                isLabelHidden
                value={search}
                onChange={(value) => { setSearch(value); if (value.trim()) setCategory('all') }}
                placeholder="Search scenes"
                startIcon={<Icon icon={Search} size="sm" />}
                hasClear
                width="100%"
              />
            </div>
            <div className="ml-auto">
              <Selector
                label="Sort your scenes"
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

          {loadError && scenes.length === 0 ? (
            <ErrorState message={loadError} onRetry={() => void load()} />
          ) : loading && scenes.length === 0 ? (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-square" />)}
            </div>
          ) : search.trim() && matchingCount === 0 ? (
            <EmptyState
              icon={<Icon icon={Search} size="lg" />}
              title={`No scenes match "${search.trim()}".`}
              line="Try a different word."
              action={<Button variant="secondary" onClick={() => setSearch('')}>Clear Search</Button>}
            />
          ) : (
            <>
              <section className="mt-8" aria-labelledby="your-scenes-heading">
                <div className="flex items-baseline gap-2">
                  <h2 id="your-scenes-heading" className="section-label">Your Scenes</h2>
                  <span className="meta-faint">{filteredYours.length}</span>
                </div>
                {filteredYours.length === 0 ? (
                  <Text type="supporting" color="secondary" className="mt-2 block">
                    {search.trim()
                      ? 'No scenes of yours match that.'
                      : 'Add a scene photo to keep your own settings here.'}
                  </Text>
                ) : (
                  <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {visibleYours.map((scene) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        onOpen={() => setPreview(scene)}
                        onRename={() => openRename(scene)}
                        onDelete={() => void remove(scene)}
                      />
                    ))}
                  </div>
                )}
                <Pagination page={yoursPage} total={filteredYours.length} onPage={setYoursPage} label="Your scene pages" />
              </section>

              <section className="mt-8" aria-labelledby="starter-scenes-heading">
                <div className="flex items-baseline gap-2">
                  <h2 id="starter-scenes-heading" className="section-label">Starter Scenes</h2>
                  <span className="meta-faint">{filteredStarters.length}</span>
                </div>
                <div className="product-category-pills mt-2" role="group" aria-label="Filter starter scenes">
                  <ToggleButtonGroup
                    type="single"
                    className="flex-wrap"
                    value={category}
                    label="Filter starter scenes"
                    onChange={(value) => { if (value) setCategory(value) }}
                  >
                    {categories.map((value) => (
                      <ToggleButton
                        key={value}
                        value={value}
                        label={value === 'all' ? 'All' : value}
                        size="sm"
                      />
                    ))}
                  </ToggleButtonGroup>
                </div>
                {filteredStarters.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      icon={<Icon icon={Mountain} size="lg" />}
                      title="No starter scenes in this category"
                      line="Choose All to see every starter scene."
                      action={search.trim() ? undefined : <Button variant="secondary" onClick={() => setCategory('all')}>Show All Starter Scenes</Button>}
                      compact
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {visibleStarters.map((scene) => (
                      <SceneCard key={scene.id} scene={scene} onOpen={() => setPreview(scene)} />
                    ))}
                  </div>
                )}
                <Pagination page={starterPage} total={filteredStarters.length} onPage={setStarterPage} label="Starter scene pages" />
                <p className="hint mt-3">Starter scenes are settings for your own product photos. Choose one in the Image Editor or Image Generator.</p>
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => { if (!open) setPreview(null) }}
        title={preview?.name ?? 'Scene'}
        description={preview ? (preview.category ? `${preview.category} · ${preview.blurb}` : 'Your scene') : undefined}
        width={760}
        footer={
          <>
            {preview?.source === 'user' && (
              <>
                <Button variant="ghost" disabled={!canUseStudio} onClick={() => preview && openRename(preview)}>Rename</Button>
                <Button variant="ghost" className="text-[var(--danger)]" onClick={() => preview && void remove(preview)}>Delete</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            <Button variant="primary" disabled={busy || !canUseStudio} onClick={() => preview && void startSceneProject(preview)}>
              <Icon icon={Sparkles} size="sm" /> Make an Image with this Scene
            </Button>
          </>
        }
      >
        {preview && (
          <>
            <div className="overflow-hidden rounded-[10px]" style={{ background: 'var(--canvas)' }}>
              <img src={preview.imageUrl} alt={preview.name} className="mx-auto max-h-[420px] w-full object-contain" />
            </div>
            <p className="hint mt-3">The setting, light, and props are borrowed; the subject is never copied.</p>
          </>
        )}
      </Dialog>

      <AddSceneDialog open={addOpen} onOpenChange={setAddOpen} />

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => { if (!open) setRenaming(null) }}
        title="Rename scene"
        description="The name shows on the Scenes page and in the scene picker."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void rename()}>Save Name</Button>
          </>
        }
      >
        <Field
          label="Scene name"
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
