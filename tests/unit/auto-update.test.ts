import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { AutoUpdateService, type AutoUpdaterLike } from '@main/autoUpdate'

class FakeUpdater extends EventEmitter implements AutoUpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  checks = 0
  installed = false

  async checkForUpdates(): Promise<unknown> {
    this.checks += 1
    this.emit('checking-for-update')
    return null
  }

  quitAndInstall(): void {
    this.installed = true
  }
}

function service(supported = true): { updater: FakeUpdater; updates: AutoUpdateService } {
  const updater = new FakeUpdater()
  const updates = new AutoUpdateService({
    supported,
    currentVersion: '1.0.1',
    downloadPageUrl: 'https://license.test/downloads?app=moss-photo-studio',
    updater
  })
  return { updater, updates }
}

describe('auto updates', () => {
  it('is unsupported outside a release AppImage', async () => {
    const { updater, updates } = service(false)
    await updates.check()
    expect(updater.checks).toBe(0)
    expect(updates.state()).toMatchObject({ supported: false, status: 'unsupported' })
  })

  it('moves from checking to ready and installs only when asked', async () => {
    const { updater, updates } = service()
    const seen: string[] = []
    updates.subscribe((state) => seen.push(state.status))
    await updates.check()
    expect(updates.state().status).toBe('checking')
    updater.emit('update-available', { version: '1.0.2', releaseNotes: 'Faster sets' })
    updater.emit('download-progress', { percent: 42 })
    expect(updates.state()).toMatchObject({ status: 'downloading', progress: 42 })
    updater.emit('update-downloaded', { version: '1.0.2', releaseNotes: 'Faster sets' })
    expect(updates.state()).toMatchObject({
      status: 'ready',
      version: '1.0.2',
      notes: 'Faster sets',
      progress: 100,
      canInstall: true
    })
    expect(updater.installed).toBe(false)
    expect(updates.install()).toEqual({ ok: true })
    expect(updater.installed).toBe(true)
    expect(seen).toContain('downloading')
  })

  it('reports up to date and errors without throwing', async () => {
    const { updater, updates } = service()
    updater.emit('update-not-available')
    expect(updates.state().status).toBe('idle')
    updater.emit('error', new Error('network down'))
    expect(updates.state()).toMatchObject({ status: 'error', error: 'network down' })
  })
})
