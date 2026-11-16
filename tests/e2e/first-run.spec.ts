import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function launch(userData: string) {
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })
  return { app, page: await app.firstWindow() }
}

test('the free photo path opens before setup, and setup resumes from Products', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-first-run-e2e-'))
  const { app, page } = await launch(userData)

  try {
    await expect(page.getByRole('heading', { name: 'Your personal photo studio.' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Open a Photo' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Image Editor' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByText('Finish setting up')).toBeVisible()
    await page.getByRole('button', { name: 'Resume Setup' }).click()
    await expect(page.getByRole('heading', { name: 'Your personal photo studio.' })).toBeVisible()
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('a missing Meta key offers the connection dialog in the generator', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-meta-prompt-e2e-'))
  const { app, page } = await launch(userData)

  try {
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.keyboard.press('Control+2')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Add a Meta key to make images', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Connect Meta to Make Images' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect Meta' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Meta key').fill('LLM|e2e-meta-prompt')
    await dialog.getByRole('button', { name: 'Save Meta Key' }).click()
    await expect(page.getByText('Meta key saved. You can make images now.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Add a Meta key to make images', { exact: true })).toHaveCount(0)
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('a draft description survives leaving and returning in the same session', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-draft-retain-e2e-'))
  const { app, page } = await launch(userData)

  try {
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.keyboard.press('Control+2')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    const projectId = await page.evaluate(() => window.location.hash.split('/project/')[1]?.split(/[?#]/)[0] ?? null)
    expect(projectId).toBeTruthy()
    await page.locator('textarea').first().fill('A warm linen table with a single ceramic mug')

    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.evaluate((id) => { window.location.hash = `#/project/${id}` }, projectId)
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('textarea').first()).toHaveValue('A warm linen table with a single ceramic mug')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
