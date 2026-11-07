import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('a person opens larger and preselects set and photo projects', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-people-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await page.getByRole('link', { name: 'People', exact: true }).click()

    await page.getByRole('button', { name: 'Open Omar larger' }).click()
    const preview = page.getByRole('dialog')
    await expect(preview.getByRole('heading', { name: 'Omar · 20s' })).toBeVisible()
    await expect(preview.locator('img')).toBeVisible()
    await expect
      .poll(() =>
        preview.locator('img').evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0)
      )
      .toBe(true)

    await preview.getByRole('button', { name: 'Create a Set' }).click()
    await page.locator('input[type=file]').setInputFiles(productPhoto)
    await page.getByRole('heading', { name: 'What do you sell?' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Clothing and accessories' }).click()
    const setPerson = page.getByRole('button', { name: 'Person for On a person' })
    await expect(setPerson).toContainText('Omar · 20s')

    await page.getByRole('link', { name: 'People', exact: true }).click()
    await page.getByRole('button', { name: 'Open Mei larger' }).click()
    await expect(preview.getByRole('heading', { name: 'Mei · 30s' })).toBeVisible()
    await preview.getByRole('button', { name: 'Create a Photo' }).click()
    await page.locator('input[type=file]').setInputFiles(productPhoto)
    await page.getByText('CHANGE THIS PHOTO').waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: /Worn, waist-up/ }).click()
    await expect(page.locator('#editor-person')).toHaveValue('mei')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
