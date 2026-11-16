import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('an untouched Image Generator leaves no project behind', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-create-draft-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      MOSS_DEV_UNLOCK: '1',
      MOSS_MUSE_FAKE: '1',
      MOSS_E2E: '1',
      MOSS_USER_DATA_DIR: userData
    },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('0 projects', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Image Editor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Image Generator' })).toBeVisible()
    await page.getByText('Keep related images together.', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByText('Image Editor', { exact: true }).last().click()
    await page.getByRole('button', { name: 'Choose a Saved Photo' }).click()
    const picker = page.getByRole('dialog', { name: 'Choose a Photo to Edit' })
    await picker.getByRole('button', { name: 'Add Product Photo' }).click()
    const addProduct = page.getByRole('dialog', { name: 'Add Product Photo' })
    await addProduct.locator('input[type=file]').setInputFiles(productPhoto)
    await addProduct.getByLabel('Product name').fill('Test product')
    await addProduct.getByRole('button', { name: 'Add Product' }).click()
    await expect(picker.getByRole('button', { name: 'Use Test product' })).toBeVisible({ timeout: 20_000 })
    await picker.getByRole('button', { name: 'Library' }).click()
    await expect(picker.getByLabel('Search library images')).toHaveCSS('padding-left', '34px')
    await picker.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('dialog', { name: 'Image Editor' }).getByRole('button', { name: 'Cancel' }).click()

    // Opening the tool and leaving again must not add an Images card.
    await page.getByRole('link', { name: 'Image Generator', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('0 projects', { exact: true })).toBeVisible()
    await expect(page.locator('article.lib-card')).toHaveCount(0)

    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-create-draft' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
    })
    await page.reload()
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('0 projects', { exact: true })).toBeVisible()

    // The first image turns the draft into a real Library project, whether the
    // generator is opened from the rail or the Ctrl+3 shortcut.
    await page.keyboard.press('Control+2')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await page.locator('textarea').first().fill('A ceramic mug on a pure white background, product photo.')
    await page.getByRole('button', { name: /Make 1 Image/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('1 project', { exact: true })).toBeVisible()
    await expect(page.locator('article.lib-card')).toHaveCount(1)
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
