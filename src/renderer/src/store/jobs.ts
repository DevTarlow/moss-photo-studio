import { create } from 'zustand'
import type { JobState } from '@shared/types'
import { unwrap } from '../lib/ipc'

interface JobsStore {
  jobs: Record<string, JobState>
  revision: number
  subscribe: () => () => void
  loadActive: () => Promise<void>
  upsert: (job: JobState) => void
  forProject: (projectId: string) => JobState[]
  runningForProject: (projectId: string) => JobState | null
}

export const useJobsStore = create<JobsStore>((set, get) => ({
  jobs: {},
  revision: 0,
  subscribe: () => {
    return window.moss.onJobUpdate((job) => {
      set((state) => ({
        jobs: { ...state.jobs, [job.id]: job },
        revision: state.revision + 1
      }))
    })
  },
  loadActive: async () => {
    try {
      const active = await unwrap(window.moss.jobs.active())
      set((state) => {
        const jobs = { ...state.jobs }
        for (const job of active) jobs[job.id] = job
        return { jobs, revision: state.revision + 1 }
      })
    } catch {
      // A failed active-job read must not block the studio.
    }
  },
  upsert: (job) => set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, revision: state.revision + 1 })),
  forProject: (projectId) =>
    Object.values(get().jobs)
      .filter((job) => job.projectId === projectId)
      .sort((a, b) => b.startedAt - a.startedAt),
  runningForProject: (projectId) =>
    Object.values(get().jobs).find(
      (job) => job.projectId === projectId && job.status === 'running'
    ) ?? null
}))
