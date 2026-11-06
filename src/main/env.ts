import { app } from 'electron'
import path from 'node:path'

/**
 * Environment switches are development and test-build tools only.
 *
 * A packaged release ignores every MOSS_* switch, including MOSS_E2E. The only
 * exception is a package built with MOSS_TEST_BUILD=1, which embeds that fact
 * at build time below. This keeps a release artifact from being pointed at any
 * host other than the two in the brief.
 */
// The test build flag is embedded at compile time. A normal packaged release
// cannot be switched into test mode with a runtime environment variable.
export const isReleaseBuild = app.isPackaged && !__MOSS_TEST_BUILD__
const allowOverrides = !isReleaseBuild

export const runtimeEnv = {
  fakeMode: allowOverrides && process.env.MOSS_MUSE_FAKE === '1',
  museBaseUrl: allowOverrides
    ? process.env.MOSS_MUSE_BASE_URL?.replace(/\/+$/, '') || 'https://api.meta.ai/v1'
    : 'https://api.meta.ai/v1',
  licenseBaseUrl: allowOverrides
    ? process.env.MOSS_LICENSE_API_BASE?.replace(/\/+$/, '') || 'https://api.lemonsqueezy.com'
    : 'https://api.lemonsqueezy.com',
  devUnlock: allowOverrides && process.env.MOSS_DEV_UNLOCK === '1',
  e2e: allowOverrides && process.env.MOSS_E2E === '1',
  userDataDir: allowOverrides ? process.env.MOSS_USER_DATA_DIR : undefined,
  overrideActive: allowOverrides && Boolean(
    process.env.MOSS_MUSE_FAKE ||
      process.env.MOSS_MUSE_BASE_URL ||
      process.env.MOSS_LICENSE_API_BASE ||
      process.env.MOSS_DEV_UNLOCK ||
      process.env.MOSS_E2E
  )
}

export function appResourceRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(app.getAppPath(), 'resources')
}

export function appDataRoot(): string {
  return app.getPath('userData')
}

export function defaultLibraryPath(): string {
  return path.join(appDataRoot(), 'library')
}

export function logsPath(): string {
  return path.join(appDataRoot(), 'logs')
}

export const isDev = !app.isPackaged
