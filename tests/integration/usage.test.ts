import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '@main/db/connection'
import type { Db } from '@main/db/connection'
import { Logger } from '@main/logger'
import { ProjectRepository } from '@main/db/repositories/projects'
import { UsageRepository } from '@main/db/repositories/usage'
import { monthBounds, monthKey } from '@shared/cost'

let dir = ''
let db: Db
let projects: ProjectRepository
let usage: UsageRepository

const month = (): { start: number; end: number } => monthBounds(monthKey(new Date()))

function record(projectId: string, projectName: string, costCents = 1): void {
  usage.record({
    projectId,
    projectName,
    action: 'edit',
    requestedN: 1,
    returnedN: 1,
    costCents,
    result: 'ok'
  })
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-usage-'))
  db = openDatabase({
    file: path.join(dir, 'library.sqlite'),
    libraryPath: path.join(dir, 'library'),
    logger: new Logger(path.join(dir, 'logs'))
  })
  projects = new ProjectRepository(db)
  usage = new UsageRepository(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('usage project names', () => {
  it('shows the current title after a rename in the ledger and by-project rows', () => {
    const project = projects.create({ type: 'photo', name: 'Old title' })
    record(project.id, 'Old title')
    record(project.id, 'Old title')
    projects.rename(project.id, 'New title')

    const { start, end } = month()
    expect(usage.list({ monthStart: start, monthEnd: end }).items.map((event) => event.projectName)).toEqual([
      'New title',
      'New title'
    ])
    expect(usage.byProject(start, end)).toEqual([
      { projectId: project.id, name: 'New title', images: 2, spendCents: 2 }
    ])
  })

  it('separates paid images from free adjustments in the month summary', () => {
    const project = projects.create({ type: 'photo', name: 'Summary' })
    record(project.id, 'Summary')
    usage.record({
      projectId: project.id,
      projectName: 'Summary',
      action: 'adjust',
      requestedN: 1,
      returnedN: 1,
      costCents: 0,
      result: 'ok'
    })
    usage.record({
      projectId: project.id,
      projectName: 'Summary',
      action: 'adjust',
      requestedN: 1,
      returnedN: 1,
      costCents: 0,
      result: 'ok'
    })

    const { start, end } = month()
    expect(usage.monthSummary(start, end)).toEqual({
      images: 3,
      paidImages: 1,
      freeAdjustments: 2,
      cents: 1
    })
  })

  it('keeps one by-project row when a project name changed between runs', () => {
    const project = projects.create({ type: 'photo', name: 'First title' })
    record(project.id, 'First title')
    record(project.id, 'Second title', 3)

    const { start, end } = month()
    const rows = usage.byProject(start, end)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ projectId: project.id, name: 'First title', spendCents: 4 })
  })

  it('calls a deleted project Deleted project instead of its old snapshot', () => {
    const project = projects.create({ type: 'photo', name: 'cb1d6ed031a7ef5fe42e75e523b6d294' })
    record(project.id, 'cb1d6ed031a7ef5fe42e75e523b6d294')
    projects.delete(project.id)

    const { start, end } = month()
    expect(usage.list({ monthStart: start, monthEnd: end }).items[0]?.projectName).toBe('Deleted project')
    expect(usage.byProject(start, end)[0]?.name).toBe('Deleted project')
    expect(usage.allForCsv(start, end)[0]?.projectName).toBe('Deleted project')
  })

  it('labels a run with no project as Project', () => {
    usage.record({
      projectId: null,
      projectName: 'cb1d6ed031a7ef5fe42e75e523b6d294',
      action: 'adjust',
      requestedN: 1,
      returnedN: 1,
      costCents: 0,
      result: 'ok'
    })

    const { start, end } = month()
    expect(usage.list({ monthStart: start, monthEnd: end }).items[0]?.projectName).toBe('Project')
    expect(usage.byProject(start, end)[0]?.name).toBe('Project')
  })
})
