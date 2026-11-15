import type { Db } from './db/connection'
import type { ProjectRepository } from './db/repositories/projects'
import type { ImageRepository } from './db/repositories/images'
import type { JobRepository } from './db/repositories/jobs'
import type { UsageRepository } from './db/repositories/usage'
import type { BrandRepository } from './db/repositories/brand'
import type { PeopleRepository } from './db/repositories/people'
import type { ProductRepository } from './db/repositories/products'
import type { ProductService } from './products/service'
import type { SettingsStore } from './settings'
import type { SecretStore } from './secrets'
import type { Logger } from './logger'
import type { MediaService } from './media/service'
import type { JobQueue } from './jobs/queue'
import type { LicenseController } from './license/controller'
import type { UpdateService } from './updates'
import type { AutoUpdateService } from './autoUpdate'
import type { ImageProvider } from './muse/provider'
import type { BrowserWindow } from 'electron'
import type { MenuContext } from '@shared/types'

export interface AppContext {
  db: Db
  logger: Logger
  settings: SettingsStore
  secrets: SecretStore
  projects: ProjectRepository
  images: ImageRepository
  jobs: JobRepository
  usage: UsageRepository
  brand: BrandRepository
  people: PeopleRepository
  products: ProductRepository
  productService: ProductService
  media: MediaService
  queue: JobQueue
  license: LicenseController
  updates: UpdateService
  autoUpdates: AutoUpdateService
  provider: ImageProvider
  libraryPath: () => string
  resourceRoot: () => string
  userDataDir: string
  fakeMode: boolean
  devUnlock: boolean
  buildDate: string
  getWindow: () => BrowserWindow | null
  refreshMenu: () => void
  updateMenuContext: (context: MenuContext) => void
}
