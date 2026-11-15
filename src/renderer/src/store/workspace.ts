import { create } from 'zustand'
import type { Image, PackJson, Project, ProjectDetail } from '@shared/types'
import { unwrap } from '../lib/ipc'

interface WorkspaceStore {
  project: Project | null
  images: Image[]
  pack: PackJson | null
  usageCents: number
  activeJob: ProjectDetail['activeJob']
  selectedImageId: string | null
  loading: boolean
  error: string | null
  load: (projectId: string, selectImageId?: string) => Promise<void>
  refresh: (selectImageId?: string) => Promise<void>
  refreshImages: () => Promise<void>
  selectImage: (id: string | null) => void
  updateProject: (patch: { name?: string; shape?: Project['shape']; format?: Project['format']; productId?: string | null }) => Promise<void>
  savePack: (next?: PackJson) => Promise<PackJson | null>
  deleteImage: (imageId: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  project: null,
  images: [],
  pack: null,
  usageCents: 0,
  activeJob: null,
  selectedImageId: null,
  loading: true,
  error: null,
  load: async (projectId, selectImageId) => {
    set({ loading: true, error: null })
    try {
      const detail = await unwrap(window.moss.projects.get({ id: projectId }))
      const ready = detail.images.filter((image) => image.status === 'ready')
      const selected =
        selectImageId && ready.some((image) => image.id === selectImageId)
          ? selectImageId
          : ready.length
            ? ready[ready.length - 1]!.id
            : null
      set({
        project: detail.project,
        images: detail.images,
        pack: detail.pack,
        usageCents: detail.usageCents,
        activeJob: detail.activeJob,
        selectedImageId: selected,
        loading: false,
        error: null
      })
    } catch {
      set({ loading: false, error: 'Could not open that project. Nothing is lost. Try again.' })
    }
  },
  refresh: async (selectImageId) => {
    const current = get().project
    if (!current) return
    try {
      const detail = await unwrap(window.moss.projects.get({ id: current.id }))
      const ready = detail.images.filter((image) => image.status === 'ready')
      const state = get()
      const desired = selectImageId ?? state.selectedImageId
      const selected = desired && ready.some((image) => image.id === desired)
        ? desired
        : ready.length
          ? ready[ready.length - 1]!.id
          : null
      set({
        project: detail.project,
        images: detail.images,
        pack: detail.pack,
        usageCents: detail.usageCents,
        activeJob: detail.activeJob,
        selectedImageId: selected
      })
    } catch {
      // Keep the last good open project.
    }
  },
  refreshImages: async () => {
    const project = get().project
    if (!project) return
    try {
      const images = await unwrap(window.moss.images.list({ projectId: project.id, includeFailed: true }))
      set({ images })
    } catch {
      // Keep the current view.
    }
  },
  selectImage: (id) => set({ selectedImageId: id }),
  savePack: async (next) => {
    const project = get().project
    const pack = next ?? get().pack
    if (!project || project.type !== 'pack' || !pack) return null
    const saved = await unwrap(window.moss.packs.save({ projectId: project.id, pack }))
    set({ pack: saved })
    return saved
  },
  updateProject: async (patch) => {
    const project = get().project
    if (!project) return
    const updated = await unwrap(window.moss.projects.update({ id: project.id, patch }))
    set({ project: updated })
  },
  deleteImage: async (imageId) => {
    await unwrap(window.moss.images.delete({ id: imageId }))
    await get().refresh()
  }
}))
