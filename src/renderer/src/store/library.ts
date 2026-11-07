import { create } from 'zustand'
import type { Project, ProjectFilter, ProjectSort } from '@shared/types'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { unwrap } from '../lib/ipc'

interface LibraryStore {
  items: Project[]
  total: number
  page: number
  loading: boolean
  error: string | null
  filter: ProjectFilter
  sort: ProjectSort
  search: string
  view: 'grid' | 'list'
  monthCents: number
  load: () => Promise<void>
  refresh: () => Promise<void>
  goToPage: (page: number) => void
  setFilter: (filter: ProjectFilter) => void
  setSort: (sort: ProjectSort) => void
  setSearch: (search: string) => void
  setView: (view: 'grid' | 'list') => void
  refreshMonth: () => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  duplicate: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => Promise<string[]>
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const useLibraryStore = create<LibraryStore>((set, get) => {
  const fetchPage = async (requestedPage: number): Promise<{ items: Project[]; total: number; page: number }> => {
    const { filter, sort, search } = get()
    const list = (page: number) =>
      unwrap(
        window.moss.projects.list({
          filter,
          sort,
          search: search.trim() || undefined,
          limit: COLLECTION_PAGE_SIZE,
          offset: (page - 1) * COLLECTION_PAGE_SIZE
        })
      )
    let result = await list(Math.max(1, requestedPage))
    const pages = Math.max(1, Math.ceil(result.total / COLLECTION_PAGE_SIZE))
    const page = Math.min(Math.max(1, requestedPage), pages)
    if (page !== requestedPage) result = await list(page)
    return { items: result.items, total: result.total, page }
  }

  return {
    items: [],
    total: 0,
    page: 1,
    loading: true,
    error: null,
    filter: 'all',
    sort: 'recent',
    search: '',
    view: 'grid',
    monthCents: 0,
    load: async () => {
      set({ loading: true, error: null })
      try {
        set({ ...(await fetchPage(get().page)), loading: false })
      } catch {
        set({ loading: false, error: 'Could not load your projects. Nothing is lost. Try again.' })
      }
    },
    refresh: async () => {
      try {
        set(await fetchPage(get().page))
      } catch {
        // Keep the last good list visible.
      }
    },
    goToPage: (page) => {
      set({ page })
      void get().load()
    },
    setFilter: (filter) => {
      set({ filter, page: 1 })
      void get().load()
    },
    setSort: (sort) => {
      set({ sort, page: 1 })
      void get().load()
    },
    setSearch: (search) => set({ search, page: 1 }),
    setView: (view) => set({ view }),
    refreshMonth: async () => {
      try {
        const summary = await unwrap(window.moss.usage.summary({ month: currentMonth() }))
        set({ monthCents: summary.spendCents })
      } catch {
        // Leave the last known month total; it is not a library blocker.
      }
    },
    rename: async (id, name) => {
      await unwrap(window.moss.projects.update({ id, patch: { name: name.trim() } }))
      await get().refresh()
    },
    duplicate: async (id) => {
      await unwrap(window.moss.projects.duplicate({ id }))
      await get().refresh()
    },
    remove: async (id) => {
      await unwrap(window.moss.projects.delete({ id }))
      await get().refresh()
      await get().refreshMonth()
    },
    removeMany: async (ids) => {
      const failed: string[] = []
      for (const id of ids) {
        try {
          await unwrap(window.moss.projects.delete({ id }))
        } catch {
          failed.push(id)
        }
      }
      await get().refresh()
      await get().refreshMonth()
      return failed
    }
  }
})
