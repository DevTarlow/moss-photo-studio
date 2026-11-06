import type { Db } from './db/connection'
import type { ProjectRepository } from './db/repositories/projects'
import type { PlanRepository } from './db/repositories/plans'
import type { ImageRepository } from './db/repositories/images'
import type { JobRepository } from './db/repositories/jobs'
import type { UsageRepository } from './db/repositories/usage'
import type { BrandRepository } from './db/repositories/brand'
import type { PeopleRepository } from './db/repositories/people'
import type { SettingsStore } from './settings'
import type { SecretStore } from './secrets'
import type { Logger } from './logger'
import type { MediaService } from './media/service'
import type { JobQueue } from './jobs/queue'
import type { LicenseController } from './license/controller'
import type { ImageProvider } from './muse/provider'
import type { BrowserWindow } from 'electron'

export interface ExportFolderRegistry {
  add(folder: string): void
  has(folder: string): boolean
}

export interface AppContext {
  db: Db
  logger: Logger
  settings: SettingsStore
  secrets: SecretStore
  projects: ProjectRepository
  plans: PlanRepository
  images: ImageRepository
  jobs: JobRepository
  usage: UsageRepository
  brand: BrandRepository
  people: PeopleRepository
  media: MediaService
  queue: JobQueue
  license: LicenseController
  provider: ImageProvider
  libraryPath: () => string
  resourceRoot: () => string
  userDataDir: string
  fakeMode: boolean
  devUnlock: boolean
  buildDate: string
  exportFolders: ExportFolderRegistry
  getWindow: () => BrowserWindow | null
  refreshMenu: () => void
}
