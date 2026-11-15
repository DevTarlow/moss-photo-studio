import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { SetRepository } from '@main/db/repositories/sets'

let dir = ''
let db: Db
let projects: ProjectRepository
let images: ImageRepository
let sets: SetRepository

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-sets-'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: path.join(dir, 'library'), logger: new Logger(path.join(dir, 'logs')) })
  projects = new ProjectRepository(db)
  images = new ImageRepository(db)
  sets = new SetRepository(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('sets', () => {
  it('creates, lists, renames, and deletes organisation without deleting images', () => {
    const set = sets.create('Spring collection')
    const project = projects.create({ type: 'image', name: 'Spring shoot' })
    const older = images.create({
      projectId: project.id,
      kind: 'render',
      status: 'ready',
      file: 'projects/spring/images/older.webp',
      thumb: 'projects/spring/thumbs/older.webp',
      label: 'Older',
      setId: set.id,
      now: 1000
    })
    const newer = images.create({
      projectId: project.id,
      kind: 'render',
      status: 'ready',
      file: 'projects/spring/images/newer.webp',
      label: 'Newer',
      setId: set.id,
      now: 2000
    })
    images.create({ projectId: project.id, kind: 'render', status: 'failed', label: 'Failed', setId: set.id, now: 3000 })

    const listed = sets.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ id: set.id, name: 'Spring collection', imageCount: 2 })
    expect(listed[0]?.coverUrl).toContain('newer.webp')

    const detail = sets.get(set.id)
    expect(detail?.imageCount).toBe(2)
    expect(images.listBySet(set.id).map((image) => image.label)).toEqual(['Newer', 'Older'])
    expect(images.listBySet(set.id)[0]?.projectName).toBe('Spring shoot')

    expect(sets.rename(set.id, 'Spring 2026')).toMatchObject({ name: 'Spring 2026' })
    expect(sets.delete(set.id)).toBe(true)
    expect(sets.get(set.id)).toBeNull()
    expect(images.get(older.id)?.setId).toBeNull()
    expect(images.get(newer.id)?.setId).toBeNull()
    expect(images.get(older.id)).toBeTruthy()
  })

  it('moves an image between Sets and can clear membership', () => {
    const first = sets.create('First')
    const second = sets.create('Second')
    const project = projects.create({ type: 'photo', name: 'Mug' })
    const image = images.create({ projectId: project.id, kind: 'render', status: 'ready', label: 'Mug', setId: first.id })

    expect(sets.get(first.id)?.imageCount).toBe(1)
    expect(images.setSet(image.id, second.id)?.setId).toBe(second.id)
    expect(sets.get(first.id)?.imageCount).toBe(0)
    expect(sets.get(second.id)?.imageCount).toBe(1)
    expect(images.setSet(image.id, null)?.setId).toBeNull()
    expect(sets.get(second.id)?.imageCount).toBe(0)
  })

  it('updates counts when an image is removed', () => {
    const set = sets.create('Delete image')
    const project = projects.create({ type: 'photo', name: 'Mug' })
    const image = images.create({ projectId: project.id, kind: 'render', status: 'ready', label: 'Mug', setId: set.id })
    expect(sets.get(set.id)?.imageCount).toBe(1)
    images.softDelete(image.id)
    expect(sets.get(set.id)?.imageCount).toBe(0)
    expect(sets.get(set.id)).toBeTruthy()
  })
})
