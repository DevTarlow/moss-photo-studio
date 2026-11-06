import path from 'node:path'
import { BrowserWindow, ipcMain, nativeTheme, screen } from 'electron'
import type { WindowState } from '@shared/types'
import type { SettingsStore } from './settings'
import { appResourceRoot } from './env'
import type { Logger } from './logger'

function isVisible(state: WindowState): boolean {
  const displays = screen.getAllDisplays()
  const x = state.x ?? 0
  const y = state.y ?? 0
  return displays.some((display) => {
    const area = display.workArea
    return (
      x < area.x + area.width &&
      x + state.width > area.x &&
      y < area.y + area.height &&
      y + state.height > area.y
    )
  })
}

export function createMainWindow(settings: SettingsStore, logger?: Logger, canClose?: () => Promise<boolean>): BrowserWindow {
  const saved = settings.windowState()
  const defaults: WindowState = { width: 1440, height: 900, isMaximized: false }
  let state = saved ?? defaults
  if (state.width < 1024) state = { ...state, width: 1024 }
  if (state.height < 700) state = { ...state, height: 700 }
  if (!isVisible(state)) {
    state = { ...defaults, isMaximized: false }
  }
  const dark = settings.all().theme === 'dark' || (settings.all().theme === 'system' && nativeTheme.shouldUseDarkColors)
  const options: Electron.BrowserWindowConstructorOptions = {
    width: state.width,
    height: state.height,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: dark ? '#0B0B09' : '#20201C',
    title: 'Moss Photo Studio',
    icon: path.join(appResourceRoot(), 'brand', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false
    }
  }
  if (state.x !== undefined && state.y !== undefined) {
    options.x = state.x
    options.y = state.y
  }
  if (process.platform === 'darwin') {
    options.titleBarStyle = 'hiddenInset'
    options.trafficLightPosition = { x: 18, y: 18 }
  } else if (process.platform === 'win32') {
    options.titleBarStyle = 'hidden'
    options.titleBarOverlay = { color: dark ? '#131610' : '#FAF7F2', symbolColor: dark ? '#E9E4D6' : '#1C1A17', height: 52 }
  }
  let window: BrowserWindow
  try {
    window = new BrowserWindow(options)
  } catch (error) {
    // Some Windows shells do not support a custom title bar overlay. Fall
    // back to the standard frame rather than failing to start.
    logger?.warn('window', 'window_chrome_fallback', {
      errorCode: error instanceof Error ? error.message : 'unknown'
    })
    delete options.titleBarStyle
    delete options.titleBarOverlay
    options.frame = true
    window = new BrowserWindow(options)
  }

  const saveState = (): void => {
    if (window.isDestroyed()) return
    const maximized = window.isMaximized()
    if (maximized) {
      settings.set('windowState', {
        ...(saved ?? {}),
        width: saved?.width ?? 1440,
        height: saved?.height ?? 900,
        isMaximized: true
      })
      return
    }
    const bounds = window.getBounds()
    settings.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false
    })
  }
  let flushed = false
  let waitingForFlush = false
  window.on('close', (event) => {
    saveState()
    if (flushed) return
    event.preventDefault()
    if (waitingForFlush) return
    waitingForFlush = true
    const continueClose = (): void => {
      const finish = (): void => {
        if (flushed) return
        flushed = true
        waitingForFlush = false
        ipcMain.removeListener('moss:flush-complete', finish)
        if (!window.isDestroyed()) window.close()
      }
      ipcMain.once('moss:flush-complete', finish)
      if (!window.webContents.isDestroyed()) window.webContents.send('moss:flush-before-close')
      setTimeout(finish, 450)
    }
    if (!canClose) {
      continueClose()
      return
    }
    void canClose()
      .then((allowed) => {
        if (allowed) continueClose()
        else waitingForFlush = false
      })
      .catch(() => {
        waitingForFlush = false
      })
  })
  let saveTimer: NodeJS.Timeout | null = setInterval(saveState, 30_000)
  saveTimer.unref?.()
  window.on('closed', () => {
    if (saveTimer) clearInterval(saveTimer)
    saveTimer = null
  })
  window.once('ready-to-show', () => {
    if (state.isMaximized) window.maximize()
    window.show()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) void window.loadURL(rendererUrl)
  else void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  return window
}
