import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { freeDiskBytes, hasDiskRoom } from '@main/media/disk'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-disk-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('disk preflight', () => {
  it('reports free space and rejects an impossible request', async () => {
    const free = await freeDiskBytes(dir)
    if (free === null) return
    expect(free).toBeGreaterThan(0)
    expect(await hasDiskRoom(dir, 1)).toBe(true)
    expect(await hasDiskRoom(dir, Number.MAX_SAFE_INTEGER)).toBe(false)
  })
})
