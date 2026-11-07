import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('a person opens larger, seeds a set, and seeds the image generator', async () => {
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
    await preview.getByRole('button', { name: 'Create an Image' }).click()
    await page.getByText('Describe the image').waitFor({ timeout: 20_000 })
    await expect(page.getByText('Image Generator', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Mei', { exact: true })).toBeVisible()
    const seeded = await page.evaluate(async () => {
      const id = window.location.hash.split('/project/')[1]?.split(/[?#]/)[0]
      if (!id) return null
      const result = await window.moss.projects.get({ id })
      if (!result.ok) return null
      const source = result.data.images.find((image) => image.id === result.data.project.sourceImageId)
      return { type: result.data.project.type, personId: source?.personId, label: source?.label }
    })
    expect(seeded).toEqual({ type: 'image', personId: 'mei', label: 'Mei' })
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
