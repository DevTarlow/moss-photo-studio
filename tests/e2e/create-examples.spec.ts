import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startFakeMuse } from '../fake-muse/server'
import { EXAMPLE_SCENES } from '../../src/shared/starters'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')
const productScene = EXAMPLE_SCENES.find((scene) => scene.key === 'product')!

test('an example can use the selected product photo or stay as shown', async () => {
  const muse = await startFakeMuse({ delayMs: 10 })
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-create-examples-'))
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

    const bytes = Array.from(fs.readFileSync(productPhoto))
    await page.evaluate(async (array) => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-examples' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
      await window.moss.products.createFromBytes({ bytes: new Uint8Array(array), name: 'Example Product' })
    }, bytes)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Image Generator', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Choose a Product Photo' }).click()
    await page.getByRole('button', { name: 'Use Example Product' }).click()
    await expect(page.getByText('Example Product', { exact: true })).toBeVisible()
    await expect(page.getByText('Click a photo to load a starting description.')).toBeVisible()
    await expect(page.getByRole('button', { name: /A person holding product/ })).toBeVisible()

    await page.getByRole('button', { name: /Output Settings/ }).click()
    const editor = page.locator('textarea').first()
    const countTwo = page
      .getByRole('group', { name: 'How many images' })
      .getByRole('button', { name: '2', exact: true })

    // The switch starts on with a reference, so the example is written for it.
    await expect(page.getByRole('switch', { name: 'Use my product photo in examples' })).toBeChecked()
    await page.getByRole('button', { name: /A product shot/ }).click()
    await expect(editor).toHaveValue(productScene.productText)
    await expect(countTwo).toBeDisabled()

    // Off: the example returns to its own product, and the reference is left out.
    await page.getByRole('switch', { name: 'Use my product photo in examples' }).click()
    await expect(editor).toHaveValue(productScene.exampleText)
    await expect(page.getByText('Not used with this example.')).toBeVisible()
    await expect(countTwo).toBeEnabled()

    await page.getByRole('button', { name: /Make 1 Image/ }).click()
    await expect
      .poll(() => muse.requests().filter((entry) => entry.path.endsWith('/images/generations')).length, { timeout: 30_000 })
      .toBe(1)
    const generation = muse.requests().find((entry) => entry.path.endsWith('/images/generations'))
    expect(String(generation?.body?.prompt)).toBe(productScene.exampleText)
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Make 1 Image/ })).toBeEnabled({ timeout: 30_000 })

    // The examples grid is gone now; the reference card keeps the switch reachable.
    await page.getByRole('switch', { name: 'Use my product photo in examples' }).click()
    await expect(editor).toHaveValue(productScene.productText)
    await expect(page.getByText('Sent with the request so the product stays the same.')).toBeVisible()

    await page.getByRole('button', { name: /Make 1 Image/ }).click()
    await expect
      .poll(() => muse.requests().filter((entry) => entry.path.endsWith('/images/edits')).length, { timeout: 30_000 })
      .toBe(1)
    const edit = muse.requests().find((entry) => entry.path.endsWith('/images/edits'))
    expect(String(edit?.body?.prompt)).toContain(productScene.productText)
    expect(String(edit?.body?.prompt)).toContain('Keep the product exactly as pictured in the reference.')
    // Let the run finish before closing; a running job makes the app ask for
    // confirmation on quit, which would block a headless teardown.
    await expect(page.getByRole('button', { name: /Make 1 Image/ })).toBeEnabled({ timeout: 30_000 })
  } finally {
    await app.close().catch(() => undefined)
    await muse.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
