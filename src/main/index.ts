import path from 'node:path'
import { app, BrowserWindow, dialog, nativeTheme, Notification } from 'electron'
import { APP_ID, APP_NAME, APP_VERSION, DEFAULT_BUDGET_CENTS, EMPTY_MENU_CONTEXT, SUPPORT_EMAIL } from '@shared/constants'
import type { JobState } from '@shared/types'
import { runtimeEnv, appResourceRoot, defaultLibraryPath, isReleaseBuild } from './env'
import { Logger } from './logger'
import { closeDatabase, openDatabase } from './db/connection'
import { applyPendingRestore } from './backup'
import { SettingsStore } from './settings'
import { ProjectRepository } from './db/repositories/projects'
import { PlanRepository } from './db/repositories/plans'
import { ImageRepository } from './db/repositories/images'
import { JobRepository } from './db/repositories/jobs'
import { UsageRepository } from './db/repositories/usage'
import { BrandRepository } from './db/repositories/brand'
import { PeopleRepository } from './db/repositories/people'
import { ProductRepository } from './db/repositories/products'
import { ListingRepository } from './db/repositories/listings'
import { ProductService } from './products/service'
import { ListingsService } from './listings/service'
import { LicenseRepository } from './db/repositories/license'
import { SecretStore } from './secrets'
import { SafeTextCipher } from './secretCipher'
import { MediaService } from './media/service'
import { JobQueue, reconcileOnStartup } from './jobs/queue'
import { MuseClient } from './muse/client'
import { FakeMuseClient } from './muse/fake'
import { FakeTextProvider, MuseTextClient } from './muse/text'
import { FakeSamProvider, MuseSamClient } from './muse/sam'
import { LicenseController } from './license/controller'
import { MossLicenseProvider } from './license/moss'
import { UpdateService } from './updates'
import { AutoUpdateService, type AutoUpdaterLike } from './autoUpdate'
import { autoUpdater } from 'electron-updater'
import { registerMediaScheme, installMediaProtocol } from './protocol'
import { installSessionSecurity, hardenWebContents } from './security'
import { createMainWindow } from './window'
import { buildAppMenu } from './menu'
import { registerIpcHandlers } from './ipc'
import type { AppContext } from './context'
import type { MenuContext } from '@shared/types'

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)
// Stop Chromium's own background traffic. The only intentional network calls
// are the Muse and license requests made by the main process.
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-sync')
app.commandLine.appendSwitch('no-pings')
// The native color chooser ships an eye-dropper button, and the EyeDropper
// dialog is not supported on Linux Wayland. The app does not need it, so the
// color well stays a plain color picker.
app.commandLine.appendSwitch('disable-features', 'EyeDropper')
if (runtimeEnv.userDataDir) {
  app.setPath('userData', runtimeEnv.userDataDir)
}

registerMediaScheme()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let context: AppContext | null = null
let quitConfirmed = false
let notifiedUpdateVersion: string | null = null
let pendingRestoreError: string | null = null
let menuContext: MenuContext = { ...EMPTY_MENU_CONTEXT }
let reopenMainWindow: (() => void) | null = null
const broadcastTimers = new Map<string, NodeJS.Timeout>()
const lastBroadcast = new Map<string, number>()

function broadcastJob(state: JobState): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) return
  const now = Date.now()
  const last = lastBroadcast.get(state.id) ?? 0
  const existing = broadcastTimers.get(state.id)
  if (existing) clearTimeout(existing)
  if (now - last >= 100) {
    lastBroadcast.set(state.id, now)
    window.webContents.send('moss:job:update', state)
    if (state.status !== 'running') {
      lastBroadcast.delete(state.id)
      const timer = broadcastTimers.get(state.id)
      if (timer) clearTimeout(timer)
      broadcastTimers.delete(state.id)
    }
    return
  }
  const timer = setTimeout(() => {
    broadcastTimers.delete(state.id)
    lastBroadcast.set(state.id, Date.now())
    if (!window.isDestroyed()) window.webContents.send('moss:job:update', state)
  }, 100 - (now - last))
  broadcastTimers.set(state.id, timer)
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    reopenMainWindow?.()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('before-quit', (event) => {
  if (quitConfirmed || !context) return
  const active = context.queue.active()
  const runningCount = active.reduce(
    (sum, job) => sum + job.items.filter((item) => item.status === 'running').length,
    0
  )
  if (runningCount === 0) return
  event.preventDefault()
  const singular = runningCount === 1
  void dialog
    .showMessageBox({
      type: 'warning',
      title: APP_NAME,
      message: singular
        ? '1 image is still being made. Quitting stops the rest.'
        : `${runningCount} images are still being made. Quitting stops the rest.`,
      buttons: ['Quit', 'Stay'],
      defaultId: 1,
      cancelId: 1
    })
    .then((choice) => {
      if (choice.response === 0) {
        quitConfirmed = true
        app.quit()
      }
    })
})

let dbClosed = false
app.on('will-quit', () => {
  if (!context || dbClosed) return
  dbClosed = true
  try {
    closeDatabase(context.db)
  } catch {
    // A failed checkpoint or close must not block quitting.
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  reopenMainWindow?.()
})

async function boot(): Promise<void> {
  const userDataDir = app.getPath('userData')
  const logger = new Logger(path.join(userDataDir, 'logs'))
  logger.info('app', 'starting', { status: isReleaseBuild ? 200 : 0 })
  const restore = await applyPendingRestore({ userDataDir, logger })
  pendingRestoreError = restore.error ?? null
  const db = openDatabase({
    file: path.join(userDataDir, 'library.sqlite'),
    libraryPath: defaultLibraryPath(),
    logger
  })
  const settings = new SettingsStore(db)
  const libraryPath = (): string => settings.libraryPath(defaultLibraryPath())
  const projects = new ProjectRepository(db)
  const plans = new PlanRepository(db)
  const images = new ImageRepository(db)
  const jobs = new JobRepository(db)
  const usage = new UsageRepository(db)
  const brand = new BrandRepository(db)
  const people = new PeopleRepository(db)
  const products = new ProductRepository(db)
  const listings = new ListingRepository(db)
  const licenseRepo = new LicenseRepository(db)
  const cipher = new SafeTextCipher(userDataDir)
  const secrets = new SecretStore({ userDataDir, db, logger, cipher })
  const resourceRoot = appResourceRoot()

  reconcileOnStartup({ jobs, images, logger })
  const emptyDrafts = projects.deleteEmptyDrafts()
  if (emptyDrafts) logger.info('app', 'removed_empty_drafts', { count: emptyDrafts })
  if (settings.budgetCents() === null) {
    // A null budget is explicit; do not overwrite it.
  } else if (!Number.isFinite(settings.budgetCents())) {
    settings.set('budgetCents', DEFAULT_BUDGET_CENTS)
  }

  const licenseProvider = new MossLicenseProvider({ baseUrl: runtimeEnv.licenseBaseUrl })
  const updates = new UpdateService({
    baseUrl: runtimeEnv.licenseBaseUrl,
    appSlug: 'moss-photo-studio'
  })
  const autoUpdates = new AutoUpdateService({
    supported: isReleaseBuild && (process.platform !== 'linux' || Boolean(process.env.APPIMAGE)),
    currentVersion: APP_VERSION,
    downloadPageUrl: new URL('/downloads?app=moss-photo-studio', `${runtimeEnv.licenseBaseUrl}/`).toString(),
    updater: autoUpdater as unknown as AutoUpdaterLike
  })
  const license = new LicenseController({
    repo: licenseRepo,
    provider: licenseProvider,
    userDataDir,
    logger,
    devUnlock: runtimeEnv.devUnlock,
    cipher
  })

  const provider = runtimeEnv.fakeMode
    ? new FakeMuseClient()
    : new MuseClient({
        apiKey: () => secrets.read(),
        userId: () => settings.deviceId(),
        baseUrl: runtimeEnv.museBaseUrl,
        logger
      })

  const textProvider = runtimeEnv.fakeMode
    ? new FakeTextProvider()
    : new MuseTextClient({
        apiKey: () => secrets.read(),
        baseUrl: runtimeEnv.museBaseUrl,
        logger
      })

  const samProvider = runtimeEnv.fakeMode
    ? new FakeSamProvider()
    : new MuseSamClient({
        apiKey: () => secrets.read(),
        baseUrl: runtimeEnv.museBaseUrl,
        logger
      })

  const media = new MediaService({
    projects,
    images,
    plans,
    people,
    brand,
    libraryPath,
    logger
  })

  const productService = new ProductService({
    products,
    images,
    projects,
    plans,
    media,
    libraryPath,
    resourceRoot: () => resourceRoot,
    provider: textProvider,
    usage,
    sam: samProvider
  })

  const listingsService = new ListingsService({
    products,
    projects,
    plans,
    images,
    brand,
    listings,
    usage,
    provider: textProvider,
    libraryPath,
    logger
  })

  const queue = new JobQueue({
    projects,
    images,
    plans,
    jobs,
    usage,
    brand,
    people,
    products,
    settings,
    secrets,
    license,
    provider,
    libraryPath,
    resourceRoot: () => resourceRoot,
    logger,
    onUpdate: broadcastJob
  })

  const resolveContext = (): BrowserWindow | null => mainWindow
  let refreshMenu: () => void = () => undefined
  context = {
    db,
    logger,
    settings,
    secrets,
    projects,
    plans,
    images,
    jobs,
    usage,
    brand,
    people,
    products,
    productService,
    listings,
    listingsService,
    media,
    queue,
    license,
    updates,
    autoUpdates,
    provider,
    libraryPath,
    resourceRoot: () => resourceRoot,
    userDataDir,
    fakeMode: runtimeEnv.overrideActive,
    devUnlock: runtimeEnv.devUnlock,
    buildDate: typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : new Date().toISOString(),
    getWindow: resolveContext,
    refreshMenu: () => refreshMenu(),
    updateMenuContext: (next) => {
      menuContext = next
      refreshMenu()
    }
  }

  installSessionSecurity(!app.isPackaged, logger)
  installMediaProtocol({
    resourceRoot: () => resourceRoot,
    libraryPath: () => settings.libraryPath(defaultLibraryPath())
  })
  registerIpcHandlers(context)

  license.onChange((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('moss:license:changed', state)
    }
  })
  autoUpdates.subscribe((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('moss:update:state', state)
    }
    if (
      state.status === 'ready' &&
      state.version &&
      state.version !== notifiedUpdateVersion &&
      Notification.isSupported()
    ) {
      notifiedUpdateVersion = state.version
      new Notification({
        title: 'Update ready',
        body: `Moss Photo Studio ${state.version} will install when you restart.`
      }).show()
    }
  })

  const guardClose = async (): Promise<boolean> => {
    if (quitConfirmed) return true
    const runningCount = context?.queue
      ? context.queue.active().reduce((sum, job) => sum + job.items.filter((item) => item.status === 'running').length, 0)
      : 0
    if (!runningCount) return true
    const singular = runningCount === 1
    const choice = await dialog.showMessageBox({
      type: 'warning',
      title: APP_NAME,
      message: singular
        ? '1 image is still being made. Quitting stops the rest.'
        : `${runningCount} images are still being made. Quitting stops the rest.`,
      buttons: ['Quit', 'Stay'],
      defaultId: 1,
      cancelId: 1
    })
    if (choice.response === 0) {
      quitConfirmed = true
      return true
    }
    return false
  }
  const openMainWindow = (): BrowserWindow => {
    const window = createMainWindow(settings, logger, guardClose)
    hardenWebContents(window, !app.isPackaged, logger)
    window.on('closed', () => {
      if (mainWindow === window) mainWindow = null
    })
    // A long-lived window can outlive the 14 day grace window. Re-check when
    // the seller comes back, at the same 24 hour cadence as launch.
    window.on('focus', () => {
      void license.validateOnLaunch().catch(() => {
        logger.warn('license', 'focus_validation_failed', { errorCode: 'license_offline' })
      })
    })
    return window
  }
  mainWindow = openMainWindow()
  if (autoUpdates.state().supported) {
    const initialCheck = setTimeout(() => { void autoUpdates.check() }, 15_000)
    initialCheck.unref?.()
    const periodicCheck = setInterval(() => { void autoUpdates.check() }, 4 * 60 * 60 * 1000)
    periodicCheck.unref?.()
  }
  if (pendingRestoreError) {
    const message = pendingRestoreError
    void dialog.showMessageBox({
      type: 'warning',
      title: 'Restore did not finish',
      message,
      detail: 'Your current library is unchanged. You can try restoring again from Settings, Storage.',
      buttons: ['OK'],
      defaultId: 0
    })
  }
  const recent = projects.recent(5)
  const rebuildMenu = (): void => {
    buildAppMenu({
      getWindow: () => mainWindow,
      recent: projects.recent(5),
      dev: !app.isPackaged,
      context: menuContext
    })
  }
  refreshMenu = rebuildMenu
  reopenMainWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      return
    }
    mainWindow = openMainWindow()
    rebuildMenu()
  }
  rebuildMenu()
  nativeTheme.on('updated', () => {
    // The renderer listens to prefers-color-scheme; this keeps native title
    // controls legible on Windows when the system theme changes.
    if (mainWindow && process.platform === 'win32') {
      const dark = nativeTheme.shouldUseDarkColors
      mainWindow.setTitleBarOverlay({
        color: dark ? '#131610' : '#FAF7F2',
        symbolColor: dark ? '#E9E4D6' : '#1C1A17',
        height: 52
      })
    }
  })

  const refreshLicense = (): void => {
    void license
      .validateOnLaunch()
      .then((state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('moss:license:changed', state)
        }
      })
      .catch(() => {
        logger.warn('license', 'launch_validation_failed', { errorCode: 'license_offline' })
      })
  }
  refreshLicense()
  const licenseTimer = setInterval(refreshLicense, 6 * 60 * 60 * 1000)
  licenseTimer.unref?.()
  app.once('before-quit', () => clearInterval(licenseTimer))

  logger.info('app', 'ready', { count: recent.length })
}

void app.whenReady().then(boot).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown'
  // Do not include a key, a prompt, or a file path in the log line.
  const newer = message.includes('newer')
  const corrupt = message.includes('corrupt') || message.includes('not a database')
  const detail = newer
    ? 'This library was last opened by a newer version of Moss Photo Studio. Install the newer version to open it again.'
    : corrupt
      ? `The library database could not be opened. Your photos are still in ${defaultLibraryPath()}. Copy that folder somewhere safe and contact ${SUPPORT_EMAIL}.`
      : 'Close the app and open it again. If this repeats, the library folder is safe and can be backed up.'
  void dialog.showMessageBox({
    type: 'error',
    title: APP_NAME,
    message: 'Moss Photo Studio could not start.',
    detail,
    buttons: ['Close'],
    defaultId: 0
  })
  app.exit(1)
  process.stderr.write(`startup failed: ${message}\n`)
})
