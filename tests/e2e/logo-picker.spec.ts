import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

test('the logo color sampler adds the sampled color', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-logo-e2e-'))
  const logo = path.join(userData, 'logo.png')
  await sharp({
    create: { width: 120, height: 80, channels: 4, background: { r: 0xcc, g: 0x22, b: 0x44, alpha: 1 } }
  })
    .png()
    .toFile(logo)

  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await page.getByRole('link', { name: 'Logo & Colors' }).click()
    await page.getByRole('heading', { name: 'Logo & Colors' }).waitFor()

    await page.locator('input[type=file]').setInputFiles(logo)
    await page.getByText('A logo is saved.').waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Pick from Logo' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const image = dialog.locator('img')
    await expect(image).toBeVisible()
    await page.waitForFunction(() => {
      const element = document.querySelector('[role="dialog"] img')
      return element instanceof HTMLImageElement && element.naturalWidth > 0
    })
    await image.click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('#cc2244', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Logo and colors saved.')).toBeVisible()

    const colors = await page.evaluate(async () => {
      const result = await window.moss.brand.get()
      return result.ok ? result.data.colors : null
    })
    expect(colors).toContain('#cc2244')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
