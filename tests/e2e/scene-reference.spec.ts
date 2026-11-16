import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startFakeMuse } from '../fake-muse/server'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')
const scenePhoto = path.resolve(__dirname, '../../resources/tiles/examples/home.webp')

test('a scene reference is sent as the second image and never as the product', async () => {
  const muse = await startFakeMuse({ delayMs: 10 })
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-scene-ref-'))
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
    const sceneBytes = Array.from(fs.readFileSync(scenePhoto))
    const seeded = await page.evaluate(async ({ product, scene }) => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-scene' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
      const made = await window.moss.products.createFromBytes({
        bytes: new Uint8Array(product),
        name: 'Scene Product'
      })
      const project = await window.moss.projects.create({ type: 'photo', name: 'Scene ref' })
      if (!project.ok) return false
      const imported = await window.moss.media.importBytes({
        projectId: project.data.project.id,
        kind: 'source',
        type: 'photo',
        bytes: new Uint8Array(scene),
        name: 'Windowsill',
        mime: 'image/jpeg'
      })
      return made.ok && imported.ok
    }, { product: productBytes, scene: sceneBytes })
    expect(seeded).toBe(true)

    await page.reload()
    await page.getByRole('link', { name: 'Image Generator', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Choose a Product Photo' }).click()
    await page.getByRole('button', { name: 'Use Scene Product' }).click()
    await expect(page.getByText('Scene Product', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Choose a Scene' }).click()
    const dialog = page.getByRole('dialog', { name: 'Choose a Scene' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /Use .* from Windowsill/ }).click()
    await expect(page.getByText('The setting and light are borrowed; its subject is not.')).toBeVisible()

    await page.locator('textarea').first().fill('A mug on a calm windowsill')
    await page.getByRole('button', { name: /Make Image/ }).click()
    await expect
      .poll(() => muse.requests().filter((entry) => entry.path.endsWith('/images/edits')).length, { timeout: 30_000 })
      .toBe(1)
    const edit = muse.requests().find((entry) => entry.path.endsWith('/images/edits'))
    expect((edit?.body?.images as unknown[]).length).toBe(2)
    expect(String(edit?.body?.prompt)).toContain('@Image2 as the scene reference')
    expect(String(edit?.body?.prompt)).toContain('Keep the product exactly as pictured in the reference.')
    await expect(page.getByRole('button', { name: /Make Image/ })).toBeEnabled({ timeout: 30_000 })
  } finally {
    await app.close()
  }
})
