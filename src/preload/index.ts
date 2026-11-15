import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcRequest, IpcResponse, MossApi } from '../shared/ipc'
import type { IpcResult } from '../shared/types'

function invoke<C extends IpcChannel>(
  channel: C
): (request: IpcRequest<C>) => Promise<IpcResult<IpcResponse<C>>> {
  return (request) => ipcRenderer.invoke(channel, request) as Promise<IpcResult<IpcResponse<C>>>
}

function invokeVoid<C extends IpcChannel>(
  channel: C
): () => Promise<IpcResult<IpcResponse<C>>> {
  return () => ipcRenderer.invoke(channel) as Promise<IpcResult<IpcResponse<C>>>
}

function subscribe(channel: string, listener: (...args: never[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
    ;(listener as unknown as (...values: unknown[]) => void)(...args)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: MossApi = {
  platform: process.platform,
  appName: 'Moss Photo Studio',
  app: {
    info: invokeVoid('app:info'),
    openExternal: invoke('app:openExternal'),
    setMenuContext: invoke('app:setMenuContext'),
    openPath: invoke('app:openPath'),
    libraryStats: invokeVoid('app:libraryStats'),
    deleteLogs: invokeVoid('app:deleteLogs'),
    copyImage: invoke('app:copyImage'),
    copyLibraryPath: invokeVoid('app:copyLibraryPath'),
    readClipboardImage: invokeVoid('app:readClipboardImage'),
    reset: invokeVoid('app:reset'),
    relaunch: () => {
      ipcRenderer.send('app:relaunch')
    }
  },
  settings: {
    get: invoke('settings:get'),
    set: invoke('settings:set'),
    all: invokeVoid('settings:all'),
    changeLibrary: invokeVoid('settings:changeLibrary')
  },
  secrets: {
    setMuseKey: invoke('secrets:setMuseKey'),
    clearMuseKey: invokeVoid('secrets:clearMuseKey'),
    testMuseKey: invoke('secrets:testMuseKey'),
    status: invokeVoid('secrets:status')
  },
  license: {
    state: invokeVoid('license:state'),
    activate: invoke('license:activate'),
    validate: invokeVoid('license:validate'),
    deactivate: invokeVoid('license:deactivate')
  },
  updates: {
    check: invokeVoid('updates:check'),
    state: invokeVoid('updates:autoState'),
    autoCheck: invokeVoid('updates:autoCheck'),
    install: invokeVoid('updates:autoInstall')
  },
  brand: {
    get: invokeVoid('brand:get'),
    update: invoke('brand:update'),
    setLogo: invoke('brand:setLogo'),
    clearLogo: invokeVoid('brand:clearLogo'),
    chooseLogo: invokeVoid('dialog:pickLogo')
  },
  products: {
    list: invokeVoid('products:list'),
    listArchived: invokeVoid('products:listArchived'),
    detail: invoke('products:detail'),
    createFromImage: invoke('products:createFromImage'),
    createFromBytes: invoke('products:createFromBytes'),
    createFromProject: invoke('products:createFromProject'),
    rename: invoke('products:rename'),
    update: invoke('products:update'),
    archive: invoke('products:archive'),
    unarchive: invoke('products:unarchive'),
    linkProject: invoke('products:linkProject'),
    unlinkProject: invoke('products:unlinkProject'),
    delete: invoke('products:delete'),
    createProject: invoke('products:createProject'),
    importIntoProject: invoke('products:importIntoProject')
  },
  projects: {
    list: invoke('projects:list'),
    get: invoke('projects:get'),
    create: invoke('projects:create'),
    createFromImage: invoke('projects:createFromImage'),
    update: invoke('projects:update'),
    duplicate: invoke('projects:duplicate'),
    delete: invoke('projects:delete'),
    recent: invoke('projects:recent')
  },
  sets: {
    list: invokeVoid('sets:list'),
    create: invoke('sets:create'),
    rename: invoke('sets:rename'),
    delete: invoke('sets:delete'),
    detail: invoke('sets:detail'),
    export: invoke('sets:export')
  },
  dialogs: {
    importImage: invoke('dialog:importImage'),
    pickProduct: invokeVoid('dialog:pickProduct')
  },
  media: {
    importBytes: invoke('media:importBytes'),
    importFromImage: invoke('media:importFromImage'),
    inspect: invoke('media:inspect')
  },
  images: {
    list: invoke('images:list'),
    library: invoke('images:library'),
    get: invoke('images:get'),
    delete: invoke('images:delete'),
    setCover: invoke('images:setCover'),
    setSource: invoke('images:setSource'),
    assignSet: invoke('images:assignSet')
  },
  jobs: {
    startCreate: invoke('jobs:startCreate'),
    startEdit: invoke('jobs:startEdit'),
    cancel: invoke('jobs:cancel'),
    state: invoke('jobs:state'),
    active: invokeVoid('jobs:active'),
    retryFailed: invoke('jobs:retryFailed'),
    listForProject: invoke('jobs:listForProject')
  },
  adjust: {
    apply: invoke('adjust:apply'),
    applyBatch: invoke('adjust:applyBatch'),
    sizeLabel: invoke('adjust:sizeLabel')
  },
  people: {
    list: invokeVoid('people:list'),
    create: invoke('people:create'),
    createFromImage: invoke('people:createFromImage'),
    rename: invoke('people:rename'),
    delete: invoke('people:delete'),
    createImageProject: invoke('people:createImageProject')
  },
  usage: {
    summary: invoke('usage:summary'),
    list: invoke('usage:list'),
    byProject: invoke('usage:byProject'),
    exportCsv: invoke('usage:exportCsv'),
    deleteAll: invokeVoid('usage:deleteAll')
  },
  exports: {
    images: invoke('export:images')
  },
  backup: {
    create: invokeVoid('backup:create'),
    restore: invokeVoid('backup:restore'),
    openLast: invokeVoid('backup:openLast'),
    status: invokeVoid('backup:status')
  },
  diagnostics: {
    create: invokeVoid('diagnostics:create')
  },
  onJobUpdate: (listener) => subscribe('moss:job:update', listener as never),
  onUpdateState: (listener) => subscribe('moss:update:state', listener as never),
  onLicenseChanged: (listener) => subscribe('moss:license:changed', listener as never),
  onMenuAction: (listener) => subscribe('moss:menu-action', listener as never),
}

for (const group of Object.values(api)) {
  if (group && typeof group === 'object') Object.freeze(group)
}
contextBridge.exposeInMainWorld('moss', Object.freeze(api))
