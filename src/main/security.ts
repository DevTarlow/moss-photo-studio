import { app, BrowserWindow, session, shell } from 'electron'
import { APP_ALLOWED_EXTERNAL_HOSTS, SUPPORT_EMAIL } from '@shared/constants'
import type { Logger } from './logger'

function contentSecurityPolicy(dev: boolean): string {
  const connect = dev
    ? "'self' https://api.meta.ai https://api.lemonsqueezy.com ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:* http://localhost:*"
    : "'self' https://api.meta.ai https://api.lemonsqueezy.com"
  return [
    "default-src 'self'",
    "img-src 'self' moss-media: data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    `connect-src ${connect}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}

export function installSessionSecurity(dev: boolean, logger: Logger): void {
  const defaultSession = session.defaultSession
  const csp = contentSecurityPolicy(dev)
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('security', 'permission_denied', { errorCode: permission })
    callback(false)
  })
  defaultSession.setPermissionCheckHandler(() => false)
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'moss-media:' || url.protocol === 'devtools:') return callback({})
      if (url.protocol === 'file:' || url.protocol === 'about:' || url.protocol === 'blob:') {
        return callback({})
      }
      if (dev && (url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
        return callback({})
      }
      const allowed = ['https://api.meta.ai', 'https://api.lemonsqueezy.com']
      if (allowed.some((prefix) => details.url.startsWith(`${prefix}/`))) return callback({})
      logger.warn('security', 'outbound_blocked', { status: 0 })
      return callback({ cancel: true })
    } catch {
      return callback({ cancel: true })
    }
  })
}

export function hardenWebContents(window: BrowserWindow, dev: boolean, logger: Logger): void {
  const contents = window.webContents
  contents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url, logger)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    const allowedOrigin = dev ? process.env['ELECTRON_RENDERER_URL'] : null
    if (url === contents.getURL() || (allowedOrigin && url.startsWith(allowedOrigin))) return
    event.preventDefault()
    void openExternalSafely(url, logger)
  })
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  contents.on('render-process-gone', (_event, details) => {
    logger.error('security', 'renderer_gone', { errorCode: details.reason })
  })
  contents.on('devtools-opened', () => {
    if (!dev) contents.closeDevTools()
  })
}

export async function openExternalSafely(rawUrl: string, logger: Logger): Promise<boolean> {
  try {
    const url = new URL(rawUrl)
    if (url.protocol === 'mailto:') {
      const address = url.pathname.toLowerCase()
      if (address === SUPPORT_EMAIL.toLowerCase()) {
        await shell.openExternal(url.toString())
        return true
      }
      return false
    }
    if (url.protocol !== 'https:') return false
    const allowed = APP_ALLOWED_EXTERNAL_HOSTS.some((host) => url.hostname === host || url.hostname === `www.${host}`)
    if (!allowed) {
      logger.warn('security', 'external_link_blocked')
      return false
    }
    await shell.openExternal(url.toString())
    return true
  } catch {
    return false
  }
}

export function appIsDev(): boolean {
  return !app.isPackaged
}
