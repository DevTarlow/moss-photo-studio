import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

async function projectIdFromPage(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => window.location.hash.split('/project/')[1]?.split(/[?#]/)[0] ?? null)
}

async function savedPlan(page: import('@playwright/test').Page): Promise<{ category: string; types: string[] } | null> {
  return page.evaluate(async () => {
    const id = window.location.hash.split('/project/')[1]?.split(/[?#]/)[0]
    if (!id) return null
    const detail = await window.moss.projects.get({ id })
    if (!detail.ok || !detail.data.plan) return null
    return {
      category: detail.data.plan.json.category,
      types: detail.data.plan.json.shots.map((shot) => shot.type)
    }
  })
}

test('a set asks what you sell and the plan can change category before images', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-set-category-e2e-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      MOSS_DEV_UNLOCK: '1',
      MOSS_MUSE_FAKE: '1',
      MOSS_USER_DATA_DIR: userData
    },
    timeout: 60_000
  })

  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor({ timeout: 20_000 })

    const bytes = Array.from(fs.readFileSync(productPhoto))
    const product = await page.evaluate(async (photo) => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-set-category' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
      const created = await window.moss.products.createFromBytes({
        bytes: Uint8Array.from(photo),
        name: 'Category Mug'
      })
      return created.ok ? created.data : null
    }, bytes)
    expect(product).toBeTruthy()

    // Reload so the app store sees the saved key and settings for the fake run.
    await page.reload()
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('button', { name: 'Open Category Mug' }).click()
    await page.getByRole('button', { name: 'Make a Set' }).first().click()

    await expect(page.getByRole('heading', { name: 'What do you sell?' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Clothing and accessories' }).click()
    await expect(page.locator('#plan-category')).toHaveValue('clothing', { timeout: 20_000 })
    await expect.poll(() => savedPlan(page)).toMatchObject({
      category: 'clothing',
      types: ['hero', 'onmodel', 'detail', 'lifestyle', 'flatlay', 'gift']
    })

    const dialog = page.getByRole('dialog')
    await page.locator('#plan-category').selectOption('ceramics')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Switch to the Ceramics and pottery recipe?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('#plan-category')).toHaveValue('clothing')
    await expect.poll(() => savedPlan(page)).toMatchObject({ category: 'clothing' })

    await page.locator('#plan-category').selectOption('ceramics')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Switch Recipe' }).click()
    await expect(page.locator('#plan-category')).toHaveValue('ceramics')
    await expect.poll(() => savedPlan(page)).toMatchObject({
      category: 'ceramics',
      types: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift']
    })

    // One fake set run. The fake provider makes no network request and bills
    // nothing, so this checks the category lock without spending.
    await page.getByRole('button', { name: /Make 6 Images · \$0\.06/ }).click()
    await expect(page.getByText('Your set is ready. 6 images.')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('#plan-category')).toBeDisabled()
    await expect(
      page.getByText('The recipe is fixed after the first image. Start a new set to use a different one.')
    ).toBeVisible()
    expect(await projectIdFromPage(page)).toBeTruthy()
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
