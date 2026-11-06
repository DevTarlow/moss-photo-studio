import path from 'node:path'
import { app, BrowserWindow, dialog, nativeTheme } from 'electron'
import { APP_ID, APP_NAME, DEFAULT_BUDGET_CENTS, EMPTY_MENU_CONTEXT } from '@shared/constants'
import type { JobState } from '@shared/types'
import { runtimeEnv, appResourceRoot, defaultLibraryPath, isReleaseBuild } from './env'
import { Logger } from './logger'
import { openDatabase } from './db/connection'
import { SettingsStore } from './settings'
import { ProjectRepository } from './db/repositories/projects'
import { PlanRepository } from './db/repositories/plans'
import { ImageRepository } from './db/repositories/images'
import { JobRepository } from './db/repositories/jobs'
import { UsageRepository } from './db/repositories/usage'
import { BrandRepository } from './db/repositories/brand'
import { PeopleRepository } from './db/repositories/people'
import { LicenseRepository } from './db/repositories/license'
import { SecretStore } from './secrets'
import { SafeTextCipher } from './secretCipher'
import { MediaService } from './media/service'
import { JobQueue, reconcileOnStartup } from './jobs/queue'
import { MuseClient } from './muse/client'
import { FakeMuseClient } from './muse/fake'
import { LicenseController } from './license/controller'
import { LemonSqueezyProvider } from './license/lemonsqueezy'
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
  const licenseRepo = new LicenseRepository(db)
  const cipher = new SafeTextCipher(userDataDir)
  const secrets = new SecretStore({ userDataDir, db, logger, cipher })
  const resourceRoot = appResourceRoot()

  reconcileOnStartup({ jobs, images, logger })
  if (settings.budgetCents() === null) {
    // A null budget is explicit; do not overwrite it.
  } else if (!Number.isFinite(settings.budgetCents())) {
    settings.set('budgetCents', DEFAULT_BUDGET_CENTS)
  }

  const licenseProvider = new LemonSqueezyProvider({ baseUrl: runtimeEnv.licenseBaseUrl })
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

  const media = new MediaService({
    projects,
    images,
    plans,
    people,
    brand,
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
    media,
    queue,
    license,
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
    return window
  }
  mainWindow = openMainWindow()
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

  logger.info('app', 'ready', { count: recent.length })
}

void app.whenReady().then(boot).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown'
  // Do not include a path or a key. The message here is an internal code only.
  void dialog.showMessageBox({
    type: 'error',
    title: APP_NAME,
    message: 'Moss Photo Studio could not start.',
    detail: 'Close the app and open it again. If this repeats, the library is safe and can be backed up.',
    buttons: ['Close'],
    defaultId: 0
  })
  app.exit(1)
  process.stderr.write(`startup failed: ${message}\n`)
})
