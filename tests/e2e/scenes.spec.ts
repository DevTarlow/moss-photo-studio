import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startFakeMuse } from '../fake-muse/server'
import { assertNoSeriousA11y } from './a11y'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')
const scenePhoto = path.resolve(__dirname, '../../resources/tiles/examples/home.webp')
const presetScene = path.resolve(__dirname, '../../resources/scenes/marble-counter.webp')

test('a preset scene opens the generator and is sent with the product', async () => {
  const muse = await startFakeMuse({ delayMs: 10 })
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-scenes-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      MOSS_DEV_UNLOCK: '1',
      MOSS_E2E: '1',
      MOSS_MUSE_BASE_URL: muse.baseUrl,
      MOSS_USER_DATA_DIR: userData
    },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })

    const productBytes = Array.from(fs.readFileSync(productPhoto))
    const seeded = await page.evaluate(async ({ product }) => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-scenes' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
      const made = await window.moss.products.createFromBytes({
        bytes: new Uint8Array(product),
        name: 'Scene Product'
      })
      return made.ok
    }, { product: productBytes })
    expect(seeded).toBe(true)
    await page.reload()

    await page.getByRole('link', { name: 'Scenes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Scenes', exact: true })).toBeVisible()
    await expect(page.getByText('30 starter scenes · 0 of yours')).toBeVisible()
    await assertNoSeriousA11y(page, 'scenes')
    await page.getByRole('button', { name: 'Lifestyle rooms', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Oak side table' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open White seamless studio' })).toHaveCount(0)
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open White seamless studio' })).toBeVisible()

    await page.getByRole('button', { name: 'Open Marble counter' }).click()
    const preview = page.getByRole('dialog')
    await expect(preview.getByRole('heading', { name: 'Marble counter' })).toBeVisible()
    await preview.getByRole('button', { name: 'Make an Image with this Scene' }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Marble counter', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Add a product photo to use this scene.')).toBeVisible()

    await page.getByRole('button', { name: 'Choose a Product Photo' }).click()
    await page.getByRole('button', { name: 'Use Scene Product' }).click()
    await expect(page.getByText('Scene Product', { exact: true }).first()).toBeVisible()
    await page.locator('textarea').first().fill('A mug on a marble counter')

    await page.getByRole('button', { name: /Make Image/ }).click()
    await expect
      .poll(() => muse.requests().filter((entry) => entry.path.endsWith('/images/edits')).length, { timeout: 30_000 })
      .toBe(1)
    const edit = muse.requests().find((entry) => entry.path.endsWith('/images/edits'))
    expect((edit?.body?.images as unknown[]).length).toBe(2)
    expect(String(edit?.body?.prompt)).toContain('@Image2 as the scene reference')
    const sentImages = edit?.body?.images as Array<{ image_url: string }>
    const sceneSent = Buffer.from(sentImages[1]!.image_url.split(',')[1]!, 'base64')
    expect(sceneSent.equals(fs.readFileSync(presetScene))).toBe(true)
    await expect(page.getByRole('button', { name: /Make Image/ })).toBeEnabled({ timeout: 30_000 })
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    await muse.close()
  }
})

test('the scene picker has three tabs and a saved scene can be renamed and deleted', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-scene-tabs-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.getByRole('link', { name: 'Image Generator', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Choose a Scene' }).click()
    const picker = page.getByRole('dialog', { name: 'Choose a Scene' })
    await expect(picker.getByRole('button', { name: 'Presets', exact: true })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Your Scenes', exact: true })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Projects', exact: true })).toBeVisible()
    await assertNoSeriousA11y(page, 'scene-picker')

    await picker.getByRole('button', { name: 'Your Scenes', exact: true }).click()
    await expect(picker.getByText('No scenes of your own yet.')).toBeVisible()
    await picker.getByRole('button', { name: 'Add Scene Photo' }).first().click()
    const addDialog = page.getByRole('dialog', { name: 'Add Scene Photo' })
    await addDialog.locator('input[type=file]').setInputFiles(scenePhoto)
    await addDialog.getByLabel('Scene name').fill('Sunlit home')
    await addDialog.getByRole('button', { name: 'Add Scene', exact: true }).click()
    await expect(picker.getByRole('button', { name: /Use your scene Sunlit home/ })).toBeVisible()
    await picker.getByRole('button', { name: /Use your scene Sunlit home/ }).click()
    await expect(page.getByText('Sunlit home', { exact: true }).first()).toBeVisible()

    await page.getByRole('link', { name: 'Scenes', exact: true }).click()
    await expect(page.getByText('30 starter scenes · 1 of yours')).toBeVisible()
    const card = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Open Sunlit home' }) })
    await card.hover()
    await page.getByRole('button', { name: 'Actions for Sunlit home' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByLabel('Scene name').fill('Sunlit room')
    await page.getByRole('button', { name: 'Save Name' }).click()
    await expect(page.getByRole('button', { name: 'Open Sunlit room' })).toBeVisible()
    const renamed = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Open Sunlit room' }) })
    await renamed.hover()
    await page.getByRole('button', { name: 'Actions for Sunlit room' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Scene' }).click()
    await expect(page.getByText('30 starter scenes · 0 of yours')).toBeVisible()
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
