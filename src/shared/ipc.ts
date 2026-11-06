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
  Person,
  PlanJson,
  PlanRecord,
  Project,
  ProjectDetail,
  ProjectFilter,
  ProjectSort,
  SetJobInput,
  SettingsAll,
  Shape,
  LibraryStats,
  MenuContext,
  MenuEvent,
  UsageByProject,
  UsageEvent,
  UsageListResult,
  UsageSummary,
  IpcResult,
  AdjustTransform,
  Format,
  JobUpdateListener
} from './types'

export interface IpcChannels {
  'app:info': { request: undefined; response: AppInfo }
  'app:openExternal': { request: { url: string }; response: { ok: true } }
  'app:setMenuContext': { request: MenuContext; response: { ok: true } }
  'app:openPath': {
    request: { kind: 'library' | 'logs' | 'project' | 'exports'; projectId?: string }
    response: { ok: true }
  }
  'app:libraryStats': { request: undefined; response: LibraryStats }
  'app:deleteLogs': { request: undefined; response: { ok: true } }
  'app:copyImage': { request: { imageId: string }; response: { ok: true } }
  'app:copyLibraryPath': { request: undefined; response: { ok: true } }
  'app:readClipboardImage': { request: undefined; response: { bytes: Uint8Array | null; mime: string | null } }
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
  'brand:get': { request: undefined; response: Brand }
  'brand:update': { request: Partial<Brand>; response: Brand }
  'brand:setLogo': { request: { bytes: Uint8Array; mime: string }; response: { logoFile: string } }
  'brand:clearLogo': { request: undefined; response: { ok: true } }
  'projects:list': {
    request: {
      filter?: ProjectFilter
      sort?: ProjectSort
      search?: string
      limit?: number
      offset?: number
    }
    response: { items: Project[]; total: number }
  }
  'projects:get': { request: { id: string }; response: ProjectDetail }
  'projects:create': {
    request: { type: 'set' | 'photo' | 'image'; name?: string; category?: string }
    response: ProjectDetail
  }
  'projects:createFromImage': {
    request: { sourceImageId: string; name?: string }
    response: ProjectDetail
  }
  'dialog:importImage': {
    request: { projectId?: string; kind: 'source' | 'person'; type?: 'set' | 'photo'; name?: string }
    response: ImportResult | null
  }
  'media:importBytes': {
    request: {
      projectId?: string
      kind: 'source' | 'person'
      type?: 'set' | 'photo'
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
        category?: string
        sourceImageId?: string | null
        coverImageId?: string | null
      }
    }
    response: Project
  }
  'projects:duplicate': { request: { id: string }; response: Project }
  'projects:delete': { request: { id: string }; response: { ok: true } }
  'projects:recent': { request: { limit: number }; response: Project[] }
  'plans:get': { request: { projectId: string }; response: PlanRecord | null }
  'plans:save': { request: { projectId: string; plan: PlanJson }; response: PlanRecord }
  'images:list': {
    request: { projectId: string; includeFailed?: boolean }
    response: Image[]
  }
  'images:get': { request: { id: string }; response: Image }
  'images:delete': { request: { id: string }; response: { ok: true } }
  'images:setCover': { request: { projectId: string; imageId: string }; response: { ok: true } }
  'images:setSource': { request: { projectId: string; imageId: string }; response: { ok: true } }
  'jobs:startSet': { request: SetJobInput; response: { jobId: string } }
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
  'people:list': { request: undefined; response: Person[] }
  'people:create': {
    request: { name: string; bytes: Uint8Array; mime: string }
    response: Person
  }
  'people:rename': { request: { id: string; name: string }; response: Person }
  'people:delete': { request: { id: string }; response: { ok: true } }
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
  'export:set': {
    request: { projectId: string; options: ExportOptions }
    response: { count: number; folderName: string; cancelled?: boolean }
  }
  'export:cancel': { request: { projectId: string }; response: { ok: true } }
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
  dialogs: {
    importImage: Call<'dialog:importImage'>
  }
  media: {
    importBytes: Call<'media:importBytes'>
  }
  plans: {
    get: Call<'plans:get'>
    save: Call<'plans:save'>
  }
  images: {
    list: Call<'images:list'>
    get: Call<'images:get'>
    delete: Call<'images:delete'>
    setCover: Call<'images:setCover'>
    setSource: Call<'images:setSource'>
  }
  jobs: {
    startSet: Call<'jobs:startSet'>
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
  }
  people: {
    list: CallVoid<'people:list'>
    create: Call<'people:create'>
    rename: Call<'people:rename'>
    delete: Call<'people:delete'>
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
    set: Call<'export:set'>
    cancel: Call<'export:cancel'>
  }
  onJobUpdate(listener: JobUpdateListener): () => void
  onLicenseChanged(listener: LicenseChangeListener): () => void
  onMenuAction(listener: (event: MenuEvent) => void): () => void
  onFlushRequest(listener: () => void): () => void
  flushComplete(): void
}

export interface UsageEventListCache {
  items: UsageEvent[]
  total: number
}
