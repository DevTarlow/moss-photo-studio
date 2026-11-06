import { create } from 'zustand'
import type { Project, ProjectFilter, ProjectSort } from '@shared/types'
import { unwrap } from '../lib/ipc'

interface LibraryStore {
  items: Project[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  filter: ProjectFilter
  sort: ProjectSort
  search: string
  view: 'grid' | 'list'
  monthCents: number
  load: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  setFilter: (filter: ProjectFilter) => void
  setSort: (sort: ProjectSort) => void
  setSearch: (search: string) => void
  setView: (view: 'grid' | 'list') => void
  refreshMonth: () => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  duplicate: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  items: [],
  total: 0,
  loading: true,
  loadingMore: false,
  error: null,
  filter: 'all',
  sort: 'recent',
  search: '',
  view: 'grid',
  monthCents: 0,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const { filter, sort, search } = get()
      const result = await unwrap(
        window.moss.projects.list({
          filter,
          sort,
          search: search.trim() || undefined,
          limit: 200,
          offset: 0
        })
      )
      set({ items: result.items, total: result.total, loading: false })
    } catch {
      set({ loading: false, error: 'Could not load your projects. Nothing is lost. Try again.' })
    }
  },
  loadMore: async () => {
    const { items, total, filter, sort, search } = get()
    if (items.length >= total) return
    set({ loadingMore: true })
    try {
      const result = await unwrap(window.moss.projects.list({
        filter, sort, search: search.trim() || undefined, limit: 200, offset: items.length
      }))
      const known = new Set(items.map((item) => item.id))
      set({ items: [...items, ...result.items.filter((item) => !known.has(item.id))], total: result.total })
    } catch {
      // Keep the loaded projects.
    } finally {
      set({ loadingMore: false })
    }
  },
  refresh: async () => {
    const { filter, sort, search } = get()
    try {
      const result = await unwrap(
        window.moss.projects.list({
          filter,
          sort,
          search: search.trim() || undefined,
          limit: 200,
          offset: 0
        })
      )
      set({ items: result.items, total: result.total })
    } catch {
      // Keep the last good list visible.
    }
  },
  setFilter: (filter) => {
    set({ filter })
    void get().load()
  },
  setSort: (sort) => {
    set({ sort })
    void get().load()
  },
  setSearch: (search) => set({ search }),
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
  }
}))
