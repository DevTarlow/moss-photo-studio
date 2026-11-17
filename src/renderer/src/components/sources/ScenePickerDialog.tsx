import { useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { Icon, Selector } from '@astryxdesign/core'
import type { LibraryImage, ScenePreset } from '@shared/types'
import { BUNDLED_SCENE_CATEGORIES } from '@shared/scene-presets'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Pagination } from '../ui/Pagination'
import { Segmented } from '../ui/Segmented'
import { AddSceneDialog } from '../scenes/AddSceneDialog'
import { useAppStore } from '../../store/app'
import { unwrap, messageOf } from '../../lib/ipc'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'

export type SceneChoice =
  | { kind: 'scene'; sceneId: string; name: string; category: string | null; thumbUrl: string }
  | { kind: 'image'; imageId: string; label: string; thumbUrl: string | null }

type Tab = 'presets' | 'yours' | 'projects'

export function ScenePickerDialog({
  open,
  onOpenChange,
  onChoose
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (choice: SceneChoice) => void
}): React.JSX.Element {
  const scenes = useAppStore((state) => state.scenes)
  const refreshScenes = useAppStore((state) => state.refreshScenes)
  const [tab, setTab] = useState<Tab>('presets')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState<LibraryImage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [libraryPage, setLibraryPage] = useState(1)
  const [presetPage, setPresetPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [addSceneOpen, setAddSceneOpen] = useState(false)

  const loadLibrary = async (query: string, requestedPage: number): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const listAt = (page: number) =>
        unwrap(
          window.moss.images.library({
            search: query.trim() || undefined,
            limit: COLLECTION_PAGE_SIZE,
            offset: (page - 1) * COLLECTION_PAGE_SIZE
          })
        )
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
    setTab('presets')
    setSearch('')
    setCategory('all')
    setPresetPage(1)
    setUserPage(1)
    setLibraryPage(1)
    setAddSceneOpen(false)
    void refreshScenes().catch(() => undefined)
    void loadLibrary('', 1)
  }, [open, refreshScenes])

  useEffect(() => {
    setPresetPage(1)
    setUserPage(1)
    setLibraryPage(1)
  }, [search, category, tab])

  useEffect(() => {
    if (!open || tab !== 'projects') return
    const timer = window.setTimeout(() => void loadLibrary(search, 1), 150)
    return () => window.clearTimeout(timer)
  }, [open, tab, search])

  const needle = search.trim().toLowerCase()
  const bundled = scenes.filter((scene) => scene.source === 'bundled')
  const userScenes = scenes.filter((scene) => scene.source === 'user')
  const matches = (scene: ScenePreset): boolean =>
    !needle ||
    [scene.name, scene.category ?? '', scene.blurb ?? ''].some((value) => value.toLowerCase().includes(needle))
  const filteredPresets = bundled.filter(
    (scene) => matches(scene) && (category === 'all' || scene.category === category)
  )
  const filteredUsers = userScenes.filter(matches)

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredPresets.length / COLLECTION_PAGE_SIZE))
    if (presetPage > pages) setPresetPage(pages)
  }, [filteredPresets.length, presetPage])

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredUsers.length / COLLECTION_PAGE_SIZE))
    if (userPage > pages) setUserPage(pages)
  }, [filteredUsers.length, userPage])

  const visiblePresets = filteredPresets.slice((presetPage - 1) * COLLECTION_PAGE_SIZE, presetPage * COLLECTION_PAGE_SIZE)
  const visibleUsers = filteredUsers.slice((userPage - 1) * COLLECTION_PAGE_SIZE, userPage * COLLECTION_PAGE_SIZE)

  const chooseScene = (scene: ScenePreset): void => {
    onChoose({ kind: 'scene', sceneId: scene.id, name: scene.name, category: scene.category, thumbUrl: scene.thumbUrl })
    onOpenChange(false)
  }

  const chooseImage = (image: LibraryImage): void => {
    onChoose({ kind: 'image', imageId: image.id, label: image.label, thumbUrl: image.thumbUrl })
    onOpenChange(false)
  }

  const sceneGrid = (list: ScenePreset[], prefix: 'scene' | 'your scene'): React.JSX.Element => (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {list.map((scene) => (
        <div key={scene.id} className="card card-hover overflow-hidden">
          <button
            type="button"
            className="block w-full cursor-pointer"
            aria-label={`Use ${prefix} ${scene.name}`}
            onClick={() => chooseScene(scene)}
          >
            <img src={scene.thumbUrl} alt="" className="aspect-square w-full object-cover" style={{ background: 'var(--surface-2)' }} />
          </button>
          <div className="p-2">
            <p className="truncate text-[12px] font-medium">{scene.name}</p>
            <p className="meta block truncate">{scene.category ?? 'Your scene'}</p>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Choose a Scene"
        description="Borrow the setting, light, and props. Its subject is never copied."
        width={760}
        footer={
          <>
            {tab === 'yours' && (
              <Button variant="ghost" className="mr-auto" onClick={() => setAddSceneOpen(true)}>
                <Icon icon={Plus} size="sm" /> Add Scene Photo
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Scene source"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'presets', label: 'Presets' },
              { value: 'yours', label: 'Your Scenes' },
              { value: 'projects', label: 'Projects' }
            ]}
          />
          {tab === 'presets' && (
            <div className="ml-auto w-[190px]">
              <Selector
                label="Scene category"
                isLabelHidden
                value={category}
                onChange={(value) => { if (value) setCategory(value) }}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...BUNDLED_SCENE_CATEGORIES.map((value) => ({ value, label: value }))
                ]}
                width="100%"
              />
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="relative">
            <Icon icon={Search} size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} aria-hidden />
            <input
              className="field search-field h-8 text-[12px]"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === 'projects' ? 'Search projects and images' : 'Search scenes'}
              aria-label={tab === 'projects' ? 'Search library images' : 'Search scenes'}
            />
          </div>
        </div>

        <div className="mt-4 max-h-[52vh] overflow-y-auto">
          {tab === 'presets' ? (
            filteredPresets.length === 0 ? (
              <p className="meta py-8 text-center">No scenes match that. Try a different word or category.</p>
            ) : (
              <>
                {sceneGrid(visiblePresets, 'scene')}
                <Pagination page={presetPage} total={filteredPresets.length} onPage={setPresetPage} label="Preset scene pages" />
              </>
            )
          ) : tab === 'yours' ? (
            filteredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] font-semibold">{search.trim() ? 'No scenes of yours match that.' : 'No scenes of your own yet.'}</p>
                <p className="meta mx-auto mt-1 max-w-[320px]">
                  {search.trim()
                    ? 'Try a different word.'
                    : 'Add a photo of a setting with an empty surface, no people and no text.'}
                </p>
                {!search.trim() && (
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAddSceneOpen(true)}>
                    <Icon icon={Plus} size="sm" /> Add Scene Photo
                  </Button>
                )}
              </div>
            ) : (
              <>
                {sceneGrid(visibleUsers, 'your scene')}
                <Pagination page={userPage} total={filteredUsers.length} onPage={setUserPage} label="Your scene pages" />
              </>
            )
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
                    className="card card-hover overflow-hidden text-left"
                    aria-label={`Use ${image.label} from ${image.projectName}`}
                    onClick={() => chooseImage(image)}
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
                label="Project scene pages"
              />
            </>
          )}
        </div>
      </Dialog>
      <AddSceneDialog open={addSceneOpen} onOpenChange={setAddSceneOpen} />
    </>
  )
}
