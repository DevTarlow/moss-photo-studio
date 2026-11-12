import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('projects are selected on hover and deleted together after a confirm', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-library-select-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()

    await page.evaluate(async () => {
      await window.moss.projects.create({ type: 'image', name: 'Bulk One' })
      await window.moss.projects.create({ type: 'image', name: 'Bulk Two' })
      await window.moss.projects.create({ type: 'image', name: 'Keep Me' })
    })
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Open Bulk One' })).toBeVisible()

    const firstCard = page.locator('article.lib-card').filter({ hasText: 'Bulk One' })
    const firstCheck = firstCard.locator('.project-check')
    await expect(firstCheck).toHaveCSS('opacity', '0')
    await expect.poll(async () => {
      await firstCard.hover()
      return firstCheck.evaluate((element) => getComputedStyle(element).opacity)
    }, { timeout: 15_000 }).toBe('1')
    await firstCard.getByRole('checkbox', { name: 'Select Bulk One' }).check()
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
    await expect(page.getByText('Click a project to add or remove it.')).toBeVisible()

    const secondCard = page.locator('article.lib-card').filter({ hasText: 'Bulk Two' })
    await secondCard.click()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#/library')
    await secondCard.click()
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
    await secondCard.click()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    await secondCard.click()
    await expect(page.getByText('1 selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'List view' }).click()
    const secondRow = page.locator('.lib-list-row').filter({ hasText: 'Bulk Two' })
    await secondRow.hover()
    await expect(secondRow.locator('.project-check')).toHaveCSS('opacity', '1')
    await secondRow.click()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('#/library')

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByRole('heading', { name: 'Delete 2 projects?' })).toBeVisible()
    await expect(confirm).toContainText("Their 0 images leave this computer. This can't be undone.")
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('2 projects deleted.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Bulk One' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open Bulk Two' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open Keep Me' })).toBeVisible()
    await expect(page.getByText('2 selected', { exact: true })).toHaveCount(0)

    const names = await page.evaluate(async () => {
      const result = await window.moss.projects.list({ limit: 200, offset: 0 })
      return result.ok ? result.data.items.map((item) => item.name) : []
    })
    expect(names).toEqual(['Keep Me'])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
