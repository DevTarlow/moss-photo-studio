import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CREATE_PRODUCT_PROMPT } from '../../src/shared/starters'

test('included products start an editor and generator project, and Create a Product seeds the generator', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-included-products-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByText('20 starter products · 0 of yours')).toBeVisible()
    await expect(page.getByText('Starter Products', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Amber dropper bottle' })).toBeVisible()
    await page.getByRole('button', { name: 'Ceramics and pottery', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Speckled mug' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Amber dropper bottle' })).toHaveCount(0)
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Amber dropper bottle' })).toBeVisible()
    const starterCard = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Open Amber dropper bottle' }) })
    await starterCard.hover()
    await expect(page.getByRole('button', { name: 'Use Amber dropper bottle in the Image Generator' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try Amber dropper bottle in the Image Editor' })).toBeVisible()

    await page.getByRole('button', { name: 'Open Amber dropper bottle' }).click()
    const preview = page.getByRole('dialog')
    await expect(preview.getByRole('heading', { name: 'Amber dropper bottle' })).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Rename' })).toHaveCount(0)
    await preview.getByRole('button', { name: 'Edit Photo' }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    const photoSource = await page.evaluate(async () => {
      const id = window.location.hash.split('/project/')[1]?.split(/[?#]/)[0]
      if (!id) return null
      const result = await window.moss.projects.get({ id })
      if (!result.ok) return null
      const source = result.data.images.find((image) => image.id === result.data.project.sourceImageId)
      return { type: result.data.project.type, label: source?.label }
    })
    expect(photoSource).toEqual({ type: 'photo', label: 'Amber dropper bottle' })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Amber dropper bottle' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Make an Image with this Product' }).click()
    await page.getByText('Describe the image').waitFor({ timeout: 20_000 })
    await expect(page.getByText('Amber dropper bottle', { exact: true }).first()).toBeVisible()
    const imageSource = await page.evaluate(async () => {
      const id = window.location.hash.split('/project/')[1]?.split(/[?#]/)[0]
      if (!id) return null
      const result = await window.moss.projects.get({ id })
      if (!result.ok) return null
      const source = result.data.images.find((image) => image.id === result.data.project.sourceImageId)
      return { type: result.data.project.type, label: source?.label }
    })
    expect(imageSource).toEqual({ type: 'image', label: 'Amber dropper bottle' })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Generate Product Photo' }).click()
    await expect(page.getByText('Make a new product')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('textarea').first()).toHaveValue(CREATE_PRODUCT_PROMPT)
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
