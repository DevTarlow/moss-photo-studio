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
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.waitForTimeout(300)
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-products-key' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()

    const projectId = await page.evaluate(async () => {
      const result = await window.moss.projects.create({ type: 'image', name: 'Mug generator' })
      return result.ok ? result.data.project.id : null
    })
    expect(projectId).toBeTruthy()
    await page.evaluate((id) => { window.location.hash = `#/project/${id}` }, projectId)
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.locator('textarea').first().fill('A ceramic mug on a pure white background, product photo.')
    await page.getByRole('button', { name: /Create 1 Image · \$0\.01/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Save as Product' }).first().click()
    const save = page.getByRole('dialog')
    await expect(save.getByRole('heading', { name: 'Save as Product' })).toBeVisible()
    await save.getByLabel('Product name').fill('Ceramic Mug')
    await save.getByRole('button', { name: 'Save Product' }).click()
    await expect(page.getByText('Saved to Products.', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Ceramic Mug larger' })).toBeVisible()

    await page.getByRole('link', { name: 'Library', exact: true }).click()
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('menuitem', { name: /Image Editor/ }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Image Editor', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Choose a Saved Photo' }).click()
    const picker = page.getByRole('dialog')
    await expect(picker.getByRole('heading', { name: 'Choose a Photo to Edit' })).toBeVisible()
    await picker.getByRole('button', { name: 'Use Ceramic Mug' }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Ceramic Mug larger' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'New Image from Reference' }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Choose a Person' }).click()
    await page.getByRole('menuitem').filter({ hasText: 'Maya' }).click()
    await expect(page.getByText('Maya · 20s')).toBeVisible()
    await expect(page.getByRole('group', { name: 'How many images' }).getByRole('button', { name: '4', exact: true })).toBeDisabled()
    await page.locator('textarea').first().fill('holding the ceramic mug')
    await page.getByRole('button', { name: /Create 1 Image · \$0\.01/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Ceramic Mug larger' }).click()
    const preview = page.getByRole('dialog')
    await preview.getByRole('button', { name: 'Delete', exact: true }).click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Projects and images already made from it stay' })
    await expect(confirm.getByRole('heading', { name: 'Delete "Ceramic Mug"?' })).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete Product' }).click()
    await expect(page.getByText('No saved products yet')).toBeVisible()

    await page.getByRole('link', { name: 'Library', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
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
