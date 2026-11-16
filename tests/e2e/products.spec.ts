import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('a generated image becomes a reusable product across the editor and generator', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-products-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_USER_DATA_DIR: userData },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.waitForTimeout(300)
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-products-key' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Skip for Now' }).waitFor({ timeout: 20_000 })
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Skip for Now' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()

    const projectId = await page.evaluate(async () => {
      const result = await window.moss.projects.create({ type: 'image', name: 'Mug generator' })
      return result.ok ? result.data.project.id : null
    })
    expect(projectId).toBeTruthy()
    await page.evaluate((id) => { window.location.hash = `#/project/${id}` }, projectId)
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.locator('textarea').first().fill('A ceramic mug on a pure white background, product photo.')
    await page.getByRole('button', { name: /Make 1 Image · \$0\.01/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /More actions for/ }).first().click()
    await page.getByRole('menuitem', { name: 'Save as Product' }).click()
    const save = page.getByRole('dialog')
    await expect(save.getByRole('heading', { name: 'Save as Product' })).toBeVisible()
    await save.getByLabel('Product name').fill('Ceramic Mug')
    await save.getByRole('button', { name: 'Save Product' }).click()
    await expect(page.getByText('Saved to Products.', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Ceramic Mug' })).toBeVisible()

    await page.getByRole('link', { name: 'All work', exact: true }).click()
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('menuitem', { name: /Image Editor/ }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Image Editor', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Choose a Saved Photo' }).click()
    const picker = page.getByRole('dialog')
    await expect(picker.getByRole('heading', { name: 'Choose a Photo to Edit' })).toBeVisible()
    await picker.getByRole('button', { name: 'Use Ceramic Mug' }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Choose a Person' })).toBeVisible()
    await expect(page.getByText('Quick Looks')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save as Person' })).toBeVisible()

    // The editor's person picker matches the generator: portraits in a menu and
    // a larger preview from the selected avatar.
    await page.getByRole('button', { name: /^Held\./ }).click()
    await expect(page.getByRole('button', { name: 'Person: Maya' })).toBeVisible()
    await page.getByRole('button', { name: 'Person: Maya' }).click()
    await expect(page.getByRole('menuitem').filter({ hasText: 'Maya' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'See Maya larger' }).click()
    const personPreview = page.getByRole('dialog', { name: 'Maya' })
    await expect(personPreview).toBeVisible()
    await personPreview.getByRole('button', { name: 'Close' }).last().click()
    await page.getByRole('button', { name: 'Remove person' }).click()
    await expect(page.getByRole('button', { name: 'Choose a Person' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Person: Maya' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Make This Change/ })).toBeEnabled()

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Ceramic Mug' }).click()

    // Clicking the title renames in place; Enter saves and Escape leaves the name alone.
    await page.getByRole('button', { name: 'Ceramic Mug', exact: true }).click()
    const productName = page.getByRole('textbox', { name: 'Product name' })
    await expect(productName).toBeFocused()
    await productName.fill('Studio Mug')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Studio Mug', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Studio Mug', exact: true }).click()
    await productName.fill('Discarded')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Studio Mug', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Studio Mug', exact: true }).click()
    await productName.fill('Ceramic Mug')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Ceramic Mug', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Make an Image with this Product' }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Choose a Person' }).click()
    await page.getByRole('menuitem').filter({ hasText: 'Maya' }).click()
    await expect(page.getByText('Maya · 20s')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Person: Maya' })).toBeVisible()
    await page.getByRole('button', { name: 'See Maya larger' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Maya' })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).first().click()
    await page.getByRole('button', { name: /Output settings/ }).click()
    await expect(page.getByText('With a product, person, or scene, Moss makes one image at a time.')).toBeVisible()
    await expect(page.getByRole('group', { name: 'How many images' })).toHaveCount(0)
    await page.locator('textarea').first().fill('holding the ceramic mug')
    await page.getByRole('button', { name: /Make 1 Image · \$0\.01/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Ceramic Mug' }).click()
    await page.getByRole('button', { name: /More actions for Ceramic Mug/ }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'become projects without a product' })
    await expect(confirm.getByRole('heading', { name: 'Delete "Ceramic Mug"?' })).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete Product' }).click()
    await expect(page.getByText('No saved products yet')).toBeVisible()

    await page.getByRole('link', { name: 'All work', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByText('Mug generator', { exact: true })).toBeVisible()
    await expect(page.getByText('Ceramic Mug', { exact: true }).first()).toBeVisible()

    await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const context = canvas.getContext('2d')!
      context.fillStyle = '#e8e0d4'
      context.fillRect(0, 0, 800, 600)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      for (let index = 0; index < 21; index += 1) {
        await window.moss.products.createFromBytes({ bytes, name: `Paged product ${index}` })
      }
    })
    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await expect(page.getByText('Page 1 of 2', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open Paged product/ })).toHaveCount(20)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Page 2 of 2', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open Paged product/ })).toHaveCount(1)
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
