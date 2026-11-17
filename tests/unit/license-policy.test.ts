import { describe, expect, it } from 'vitest'
import { LICENSE_REQUIRED_CHANNELS, requiresActiveLicense } from '@main/license/policy'

describe('license IPC policy', () => {
  it('blocks every content-producing channel', () => {
    for (const channel of [
      'projects:create',
      'projects:createFromImage',
      'projects:duplicate',
      'media:importBytes',
      'dialog:importImage',
      'jobs:startCreate',
      'jobs:startEdit',
      'adjust:apply',
      'adjust:applyBatch',
      'adjust:sizeLabel',
      'sets:create',
      'products:createFromBytes',
      'products:createProject',
      'people:create'
    ] as const) {
      expect(requiresActiveLicense(channel)).toBe(true)
    }
  })

  it('keeps reads, exports, copies, deletes, settings, and license management open', () => {
    for (const channel of [
      'app:info',
      'license:activate',
      'license:state',
      'settings:set',
      'secrets:setMuseKey',
      'projects:list',
      'projects:get',
      'projects:delete',
      'images:list',
      'images:delete',
      'export:images',
      'sets:export',
      'backup:create',
      'diagnostics:create',
      'updates:check'
    ] as const) {
      expect(requiresActiveLicense(channel)).toBe(false)
    }
  })

  it('has no duplicates', () => {
    const size = new Set(LICENSE_REQUIRED_CHANNELS).size
    expect(size).toBe(LICENSE_REQUIRED_CHANNELS.size)
  })
})
