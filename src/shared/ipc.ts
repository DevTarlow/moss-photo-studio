import type {
  AppInfo,
  Brand,
  CreateJobInput,
  EditJobInput,
  ExportOptions,
  Image,
  ImportResult,
  JobState,
  LicenseChangeListener,
  LicenseState,
  UpdateCheckResult,
  AutoUpdateState,
  UpdateStateListener,
  Person,
  SetDetail,
  SetSummary,
  Product,
  ProductDetail,
  LibraryImage,
  Project,
  ProjectDetail,
  ProjectFilter,
  ProjectSort,
  SettingsAll,
  Shape,
  LibraryStats,
  MenuContext,
  MenuEvent,
  UsageByProject,
  UsageEvent,
  UsageListResult,
  UsageSummary,
  BackupStatus,
  BackupSummary,
  IpcResult,
  AdjustTransform,
  Format,
  JobUpdateListener
} from './types'
import type { PhotoCheck } from './types'

export interface IpcChannels {
  'app:info': { request: undefined; response: AppInfo }
  'app:openExternal': { request: { url: string }; response: { ok: true } }
  'app:setMenuContext': { request: MenuContext; response: { ok: true } }
  'app:openPath': {
    request: { kind: 'library' | 'logs' | 'project' | 'exports'; projectId?: string; setId?: string }
    response: { ok: true }
  }
  'app:libraryStats': { request: undefined; response: LibraryStats }
  'app:deleteLogs': { request: undefined; response: { ok: true } }
  'app:copyImage': { request: { imageId: string }; response: { ok: true } }
  'app:copyLibraryPath': { request: undefined; response: { ok: true } }
  'app:readClipboardImage': { request: undefined; response: { bytes: Uint8Array | null; mime: string | null } }
  'app:reset': { request: undefined; response: { ok: true } }
  'backup:create': { request: undefined; response: { created: boolean; folderName?: string; summary?: BackupSummary } }
  'backup:restore': { request: undefined; response: { started: boolean; folderName?: string; summary?: BackupSummary } }
  'backup:openLast': { request: undefined; response: { ok: true } }
  'backup:status': { request: undefined; response: BackupStatus }
  'diagnostics:create': { request: undefined; response: { folderName: string } }
  'dialog:pickLogo': { request: undefined; response: Brand | null }
  'settings:get': { request: { key: string }; response: { value: unknown } }
  'settings:set': { request: { key: string; value: unknown }; response: { ok: true } }
  'settings:all': { request: undefined; response: SettingsAll }
  'settings:changeLibrary': { request: undefined; response: { libraryPath: string } }
  'secrets:setMuseKey': { request: { key: string }; response: { ok: true; last4: string } }
  'secrets:clearMuseKey': { request: undefined; response: { ok: true } }
  'secrets:testMuseKey': {
    request: { key?: string }
    response: { ok: boolean; code?: string; validatedAt?: number }
  }
  'secrets:status': {
    request: undefined
    response: { hasKey: boolean; last4: string | null; validatedAt: number | null; backend: string }
  }
  'license:state': { request: undefined; response: LicenseState }
  'license:activate': { request: { key: string }; response: LicenseState }
  'license:validate': { request: undefined; response: LicenseState }
  'license:deactivate': { request: undefined; response: LicenseState }
  'updates:check': { request: undefined; response: UpdateCheckResult }
  'updates:autoState': { request: undefined; response: AutoUpdateState }
  'updates:autoCheck': { request: undefined; response: AutoUpdateState }
  'updates:autoInstall': { request: undefined; response: { ok: boolean } }
  'brand:get': { request: undefined; response: Brand }
  'brand:update': { request: Partial<Brand>; response: Brand }
  'brand:setLogo': { request: { bytes: Uint8Array; mime: string }; response: { logoFile: string } }
  'brand:clearLogo': { request: undefined; response: { ok: true } }
  'projects:list': {
    request: {
      filter?: ProjectFilter
      sort?: ProjectSort
      search?: string
      productId?: string | null
      limit?: number
      offset?: number
    }
    response: { items: Project[]; total: number }
  }
  'projects:get': { request: { id: string }; response: ProjectDetail }
  'projects:create': {
    request: { type: 'photo' | 'image'; name?: string; productId?: string; draft?: boolean }
    response: ProjectDetail
  }
  'projects:createFromImage': {
    request: { sourceImageId: string; name?: string; type?: 'photo' | 'image' }
    response: ProjectDetail
  }
  'products:list': { request: undefined; response: Product[] }
  'products:listArchived': { request: undefined; response: Product[] }
  'products:detail': { request: { id: string }; response: ProductDetail }
  'products:createFromImage': { request: { imageId: string; name: string }; response: Product }
  'products:createFromBytes': { request: { bytes: Uint8Array; name: string }; response: Product }
  'products:createFromProject': { request: { projectId: string; name?: string }; response: Product }
  'dialog:pickProduct': { request: undefined; response: Product | null }
  'products:rename': { request: { id: string; name: string }; response: Product }
  'products:update': {
    request: {
      id: string
      patch: { name?: string; category?: string | null; notes?: string | null; status?: 'active' | 'archived' }
    }
    response: Product
  }
  'products:archive': { request: { id: string }; response: Product }
  'products:unarchive': { request: { id: string }; response: Product }
  'products:linkProject': { request: { productId: string; projectId: string }; response: { ok: true } }
  'products:unlinkProject': { request: { projectId: string }; response: { ok: true } }
  'products:delete': { request: { id: string }; response: { ok: true } }
  'products:assignSet': { request: { productId: string; setId: string | null }; response: Product }
  'products:createProject': {
    request: { productId: string; type: 'photo' | 'image'; name?: string }
    response: ProjectDetail
  }
  'products:importIntoProject': {
    request: { productId: string; projectId: string; label?: string }
    response: ImportResult
  }
  'images:library': {
    request: { search?: string; limit?: number; offset?: number }
    response: { items: LibraryImage[]; total: number }
  }
  'media:importFromImage': { request: { projectId: string; imageId: string }; response: ImportResult }
  'media:inspect': { request: { imageId: string }; response: PhotoCheck | null }
  'dialog:importImage': {
    request: { projectId?: string; kind: 'source' | 'person'; type?: 'photo'; name?: string }
    response: ImportResult | null
  }
  'media:importBytes': {
    request: {
      projectId?: string
      kind: 'source' | 'person'
      type?: 'photo'
      bytes: Uint8Array
      name?: string
      mime: string
    }
    response: ImportResult | null
  }
  'projects:update': {
    request: {
      id: string
      patch: {
        name?: string
        shape?: Shape
        format?: Format
        sourceImageId?: string | null
        coverImageId?: string | null
      }
    }
    response: Project
  }
  'projects:duplicate': { request: { id: string }; response: Project }
  'projects:delete': { request: { id: string }; response: { ok: true } }
  'projects:recent': { request: { limit: number }; response: Project[] }
  'sets:list': { request: undefined; response: SetSummary[] }
  'sets:create': { request: { name: string }; response: SetSummary }
  'sets:rename': { request: { id: string; name: string }; response: SetSummary }
  'sets:delete': { request: { id: string }; response: { ok: true } }
  'sets:detail': { request: { id: string }; response: SetDetail }
  'sets:export': {
    request: { id: string; options: ExportOptions }
    response: { count: number; folderName: string; warnings: string[] }
  }
  'images:list': {
    request: { projectId: string; includeFailed?: boolean }
    response: Image[]
  }
  'images:get': { request: { id: string }; response: Image }
  'images:delete': { request: { id: string }; response: { ok: true } }
  'images:setCover': { request: { projectId: string; imageId: string }; response: { ok: true } }
  'images:setSource': { request: { projectId: string; imageId: string }; response: { ok: true } }
  'images:assignSet': { request: { imageId: string; setId: string | null }; response: Image }
  'jobs:startCreate': { request: CreateJobInput; response: { jobId: string } }
  'jobs:startEdit': { request: EditJobInput; response: { jobId: string } }
  'jobs:cancel': { request: { jobId: string }; response: { ok: true } }
  'jobs:state': { request: { jobId: string }; response: JobState }
  'jobs:active': { request: undefined; response: JobState[] }
  'jobs:retryFailed': { request: { jobId: string }; response: { jobId: string } }
  'jobs:listForProject': { request: { projectId: string }; response: JobState[] }
  'adjust:apply': {
    request: { imageId: string; transform: AdjustTransform }
    response: { imageId: string }
  }
  'adjust:applyBatch': {
    request: { projectId: string; transform: AdjustTransform }
    response: { count: number }
  }
  'adjust:sizeLabel': {
    request: { imageId: string; width: number; height: number; unit: 'cm' | 'in' }
    response: { imageId: string }
  }
  'people:list': { request: undefined; response: Person[] }
  'people:create': {
    request: { name: string; bytes: Uint8Array; mime: string }
    response: Person
  }
  'people:createFromImage': {
    request: { imageId: string; name: string }
    response: Person
  }
  'people:rename': { request: { id: string; name: string }; response: Person }
  'people:delete': { request: { id: string }; response: { ok: true } }
  'people:createImageProject': {
    request: { id: string; look?: string }
    response: { projectId: string; imageId: string }
  }
  'usage:summary': { request: { month: string }; response: UsageSummary }
  'usage:list': {
    request: { month: string; projectId?: string; limit?: number; offset?: number }
    response: UsageListResult
  }
  'usage:byProject': { request: { month: string }; response: UsageByProject }
  'usage:exportCsv': { request: { month: string }; response: { saved: boolean } }
  'usage:deleteAll': { request: undefined; response: { ok: true } }
  'export:images': {
    request: { projectId: string; imageIds: string[]; options: ExportOptions }
    response: { count: number; folderName: string }
  }
}

export type IpcChannel = keyof IpcChannels
export type IpcRequest<C extends IpcChannel> = IpcChannels[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcChannels[C]['response']

type Call<C extends IpcChannel> = (
  request: IpcRequest<C>
) => Promise<IpcResult<IpcResponse<C>>>
type CallVoid<C extends IpcChannel> = () => Promise<IpcResult<IpcResponse<C>>>

export interface MossApi {
  platform: NodeJS.Platform
  appName: string
  app: {
    info: CallVoid<'app:info'>
    openExternal: Call<'app:openExternal'>
    setMenuContext: Call<'app:setMenuContext'>
    openPath: Call<'app:openPath'>
    libraryStats: CallVoid<'app:libraryStats'>
    deleteLogs: CallVoid<'app:deleteLogs'>
    copyImage: Call<'app:copyImage'>
    copyLibraryPath: CallVoid<'app:copyLibraryPath'>
    readClipboardImage: CallVoid<'app:readClipboardImage'>
    reset: CallVoid<'app:reset'>
    relaunch: () => void
  }
  settings: {
    get: Call<'settings:get'>
    set: Call<'settings:set'>
    all: CallVoid<'settings:all'>
    changeLibrary: CallVoid<'settings:changeLibrary'>
  }
  secrets: {
    setMuseKey: Call<'secrets:setMuseKey'>
    clearMuseKey: CallVoid<'secrets:clearMuseKey'>
    testMuseKey: Call<'secrets:testMuseKey'>
    status: CallVoid<'secrets:status'>
  }
  license: {
    state: CallVoid<'license:state'>
    activate: Call<'license:activate'>
    validate: CallVoid<'license:validate'>
    deactivate: CallVoid<'license:deactivate'>
  }
  updates: {
    check: CallVoid<'updates:check'>
    state: CallVoid<'updates:autoState'>
    autoCheck: CallVoid<'updates:autoCheck'>
    install: CallVoid<'updates:autoInstall'>
  }
  brand: {
    get: CallVoid<'brand:get'>
    update: Call<'brand:update'>
    setLogo: Call<'brand:setLogo'>
    clearLogo: CallVoid<'brand:clearLogo'>
    chooseLogo: CallVoid<'dialog:pickLogo'>
  }
  projects: {
    list: Call<'projects:list'>
    get: Call<'projects:get'>
    create: Call<'projects:create'>
    createFromImage: Call<'projects:createFromImage'>
    update: Call<'projects:update'>
    duplicate: Call<'projects:duplicate'>
    delete: Call<'projects:delete'>
    recent: Call<'projects:recent'>
  }
  sets: {
    list: CallVoid<'sets:list'>
    create: Call<'sets:create'>
    rename: Call<'sets:rename'>
    delete: Call<'sets:delete'>
    detail: Call<'sets:detail'>
    export: Call<'sets:export'>
  }
  products: {
    list: CallVoid<'products:list'>
    listArchived: CallVoid<'products:listArchived'>
    detail: Call<'products:detail'>
    createFromImage: Call<'products:createFromImage'>
    createFromBytes: Call<'products:createFromBytes'>
    createFromProject: Call<'products:createFromProject'>
    rename: Call<'products:rename'>
    update: Call<'products:update'>
    archive: Call<'products:archive'>
    unarchive: Call<'products:unarchive'>
    assignSet: Call<'products:assignSet'>
    linkProject: Call<'products:linkProject'>
    unlinkProject: Call<'products:unlinkProject'>
    delete: Call<'products:delete'>
    createProject: Call<'products:createProject'>
    importIntoProject: Call<'products:importIntoProject'>
  }
  dialogs: {
    importImage: Call<'dialog:importImage'>
    pickProduct: CallVoid<'dialog:pickProduct'>
  }
  media: {
    importBytes: Call<'media:importBytes'>
    importFromImage: Call<'media:importFromImage'>
    inspect: Call<'media:inspect'>
  }
  images: {
    list: Call<'images:list'>
    library: Call<'images:library'>
    get: Call<'images:get'>
    delete: Call<'images:delete'>
    setCover: Call<'images:setCover'>
    setSource: Call<'images:setSource'>
    assignSet: Call<'images:assignSet'>
  }
  jobs: {
    startCreate: Call<'jobs:startCreate'>
    startEdit: Call<'jobs:startEdit'>
    cancel: Call<'jobs:cancel'>
    state: Call<'jobs:state'>
    active: CallVoid<'jobs:active'>
    retryFailed: Call<'jobs:retryFailed'>
    listForProject: Call<'jobs:listForProject'>
  }
  adjust: {
    apply: Call<'adjust:apply'>
    applyBatch: Call<'adjust:applyBatch'>
    sizeLabel: Call<'adjust:sizeLabel'>
  }
  people: {
    list: CallVoid<'people:list'>
    create: Call<'people:create'>
    createFromImage: Call<'people:createFromImage'>
    rename: Call<'people:rename'>
    delete: Call<'people:delete'>
    createImageProject: Call<'people:createImageProject'>
  }
  usage: {
    summary: Call<'usage:summary'>
    list: Call<'usage:list'>
    byProject: Call<'usage:byProject'>
    exportCsv: Call<'usage:exportCsv'>
    deleteAll: CallVoid<'usage:deleteAll'>
  }
  exports: {
    images: Call<'export:images'>
  }
  backup: {
    create: CallVoid<'backup:create'>
    restore: CallVoid<'backup:restore'>
    openLast: CallVoid<'backup:openLast'>
    status: CallVoid<'backup:status'>
  }
  diagnostics: {
    create: CallVoid<'diagnostics:create'>
  }
  onJobUpdate(listener: JobUpdateListener): () => void
  onUpdateState(listener: UpdateStateListener): () => void
  onLicenseChanged(listener: LicenseChangeListener): () => void
  onMenuAction(listener: (event: MenuEvent) => void): () => void
}

export interface UsageEventListCache {
  items: UsageEvent[]
  total: number
}
