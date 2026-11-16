import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { assertNoSeriousA11y } from './a11y'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('a Set can take a product from its own page and return to it', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-set-add-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.getByRole('link', { name: 'Products', exact: true }).click()

    await page.getByRole('button', { name: 'Add Product Photo' }).click()
    const addProduct = page.getByRole('dialog')
    await expect(addProduct).toBeVisible()
    await assertNoSeriousA11y(page, 'add-product-dialog')
    await addProduct.locator('input[type=file]').setInputFiles(productPhoto)
    await addProduct.getByLabel('Product name').fill('Test Mug')
    await addProduct.getByRole('button', { name: 'Add Product' }).click()
    await expect(page.getByRole('button', { name: 'Open Test Mug' })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    await page.getByRole('button', { name: 'New Set' }).first().click()
    const setDialog = page.getByRole('dialog')
    await setDialog.getByLabel('Set name').fill('Spring picks')
    await setDialog.getByRole('button', { name: 'Create Set' }).click()
    await expect(page.getByRole('heading', { name: 'Spring picks', exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Add to Set', exact: true }).first().click()
    const addTo = page.getByRole('dialog')
    await expect(addTo.getByRole('heading', { name: 'Add to Spring picks' })).toBeVisible()
    await assertNoSeriousA11y(page, 'add-to-set-dialog')
    await addTo.getByRole('button', { name: 'Add Test Mug to Spring picks' }).click()
    await addTo.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(addTo).toHaveCount(0)
    await expect(page.getByText('Test Mug', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Make an Image with This Product', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    const backToSet = page.getByRole('button', { name: 'Back to Set', exact: true })
    await expect(backToSet).toBeVisible({ timeout: 20_000 })
    await backToSet.click()
    await expect(page.getByRole('heading', { name: 'Spring picks', exact: true })).toBeVisible({ timeout: 20_000 })
    expect(page.url()).toContain('/sets/')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('the product picker offers a starter product when there are no saved products', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-starter-pick-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await page.keyboard.press('Control+2')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Choose a Product Photo' }).click()
    const picker = page.getByRole('dialog', { name: 'Choose a Product Photo' })
    await expect(picker.getByText('Starter Products', { exact: true })).toBeVisible()
    await picker.getByRole('button', { name: 'Use starter Speckled mug' }).click()
    await expect(page.getByText('Speckled mug', { exact: true })).toBeVisible({ timeout: 20_000 })
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
