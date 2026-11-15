import fs from 'node:fs/promises'
import type { Db } from './db/connection'
import type { Logger } from './logger'
import { absoluteInLibrary, projectDir } from './media/paths'

interface RemovedFeatureCleanup {
  projects: string[]
  files: string[]
}

function parseCleanup(raw: string | null): RemovedFeatureCleanup | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RemovedFeatureCleanup>
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects.filter((id): id is string => typeof id === 'string') : [],
      files: Array.isArray(parsed.files) ? parsed.files.filter((file): file is string => typeof file === 'string') : []
    }
  } catch {
    return null
  }
}

/**
 * Remove the files for projects and cutouts that migration 10 retired. The
 * queue is written before the rows are deleted, so a crash here leaves a
 * retryable meta key instead of orphaned folders with no record of them.
 */
export async function runPendingRemovedDataCleanup(input: {
  db: Db
  libraryPath: string
  logger: Logger
}): Promise<{ projects: number; files: number }> {
  const row = input.db
    .prepare("SELECT value FROM meta WHERE key = 'removedFeatureCleanup'")
    .get() as { value: string } | undefined
  const cleanup = parseCleanup(row?.value ?? null)
  if (!cleanup) return { projects: 0, files: 0 }
  let removedProjects = 0
  let removedFiles = 0
  let failed = 0
  for (const projectId of cleanup.projects) {
    try {
      const target = absoluteInLibrary(input.libraryPath, projectDir(projectId))
      await fs.rm(target, { recursive: true, force: true })
      removedProjects += 1
    } catch {
      failed += 1
      input.logger.warn('db', 'removed_project_cleanup_failed', { count: 1 })
    }
  }
  for (const file of cleanup.files) {
    try {
      const target = absoluteInLibrary(input.libraryPath, file)
      await fs.rm(target, { force: true })
      removedFiles += 1
    } catch {
      failed += 1
      input.logger.warn('db', 'removed_file_cleanup_failed', { count: 1 })
    }
  }
  if (failed === 0) {
    input.db.prepare("DELETE FROM meta WHERE key = 'removedFeatureCleanup'").run()
  }
  input.logger.info('db', 'removed_data_cleaned', { count: removedProjects + removedFiles, failed })
  return { projects: removedProjects, files: removedFiles }
}
