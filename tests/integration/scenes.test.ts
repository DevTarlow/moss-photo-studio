import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { ImageRepository } from '@main/db/repositories/images'
import { PeopleRepository } from '@main/db/repositories/people'
import { BrandRepository } from '@main/db/repositories/brand'
import { SceneRepository } from '@main/db/repositories/scenes'
import { MediaService } from '@main/media/service'
import { BUNDLED_SCENE_PRESETS } from '@shared/scene-presets'

let dir = ''
let db: Db
let scenes: SceneRepository
let media: MediaService

const libraryPath = (): string => path.join(dir, 'library')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-scenes-'))
  const logger = new Logger(path.join(dir, 'logs'))
  db = openDatabase({ file: path.join(dir, 'library.sqlite'), libraryPath: libraryPath(), logger })
  const projects = new ProjectRepository(db)
  const images = new ImageRepository(db)
  const people = new PeopleRepository(db)
  const brand = new BrandRepository(db)
  scenes = new SceneRepository(db)
  media = new MediaService({ projects, images, people, scenes, brand, libraryPath, logger })
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

function scenePhoto(width = 900, height = 700): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 110, b: 100 } } })
    .jpeg()
    .toBuffer()
}

describe('scenes', () => {
  it('lists the bundled presets and resolves their bundled files', () => {
    const list = scenes.list()
    expect(list.filter((scene) => scene.source === 'bundled')).toHaveLength(BUNDLED_SCENE_PRESETS.length)
    expect(list.filter((scene) => scene.source === 'user')).toHaveLength(0)
    const reference = scenes.refFor('white-seamless')
    expect(reference).toEqual({ root: 'bundled', file: 'scenes/white-seamless.webp' })
    expect(fs.existsSync(path.join(__dirname, '../../resources', reference!.file))).toBe(true)
    expect(scenes.refFor('not-a-scene')).toBeNull()
  })

  it('imports a user scene, lists it, renames it and deletes its rows', async () => {
    const { sceneId } = await media.importScene({ name: 'My table', bytes: await scenePhoto() })
    const scene = scenes.getUser(sceneId)!
    expect(scene.source).toBe('user')
    expect(scene.name).toBe('My table')
    expect(scene.category).toBeNull()
    expect(scene.width).toBe(900)
    expect(scene.height).toBe(700)
    expect(scene.imageUrl).toMatch(/^moss-media:\/\/library\/scenes\//)

    const reference = scenes.refFor(sceneId)
    expect(reference?.root).toBe('library')
    expect(fs.existsSync(path.join(libraryPath(), reference!.file))).toBe(true)
    expect(fs.existsSync(path.join(libraryPath(), reference!.file.replace(/\.webp$/, '-thumb.webp')))).toBe(true)

    expect(scenes.rename(sceneId, 'Renamed table')?.name).toBe('Renamed table')
    expect(scenes.list().filter((entry) => entry.source === 'user')).toHaveLength(1)
    expect(scenes.exists(sceneId)).toBe(true)
    const removed = scenes.delete(sceneId)!
    expect(removed.files).toHaveLength(2)
    expect(scenes.exists(sceneId)).toBe(false)
    expect(scenes.list().filter((entry) => entry.source === 'user')).toHaveLength(0)
  })

  it('rejects a scene photo that is too small', async () => {
    await expect(media.importScene({ name: 'Tiny', bytes: await scenePhoto(100, 100) })).rejects.toMatchObject({
      code: 'too_small'
    })
  })
})
