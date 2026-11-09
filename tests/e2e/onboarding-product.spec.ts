import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('onboarding saves the first photo as a Product without creating a set', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-onboarding-product-'))
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
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.waitForTimeout(800)
    // The Welcome heading takes focus so screen readers announce the step, but
    // a non-interactive title must not paint the keyboard focus ring.
    const welcome = page.getByRole('heading', { name: "Your shop's photo studio." })
    await expect(welcome).toBeVisible({ timeout: 20_000 })
    await expect(welcome).toBeFocused()
    await expect(welcome).toHaveCSS('outline-style', 'none')
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-onboarding-product' })
      await window.moss.settings.set({ key: 'onboardingDone', value: false })
      await window.moss.settings.set({ key: 'onboardingStep', value: 2 })
      await window.moss.settings.set({ key: 'onboardingCategory', value: 'other' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
    })
    await page.reload()
    await page.getByRole('heading', { name: 'Add your first product' }).waitFor({ timeout: 20_000 })

    await page.locator('input[type=file]').first().setInputFiles(productPhoto)
    await expect(page.getByText('Saved as a Product')).toBeVisible({ timeout: 20_000 })

    const afterProduct = await page.evaluate(async () => {
      const products = await window.moss.products.list()
      const projects = await window.moss.projects.list({})
      return {
        products: products.ok ? products.data.length : -1,
        projects: projects.ok ? projects.data.total : -1
      }
    })
    expect(afterProduct.products).toBe(1)
    expect(afterProduct.projects).toBe(0)

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make your first set' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Save product only' }).click()

    await expect(page.getByRole('heading', { name: "You're set up." })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Open Products' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Open product larger' })).toBeVisible()

    const afterSave = await page.evaluate(async () => {
      const products = await window.moss.products.list()
      const projects = await window.moss.projects.list({})
      const settings = await window.moss.settings.all()
      return {
        products: products.ok ? products.data.length : -1,
        projects: projects.ok ? projects.data.total : -1,
        done: settings.ok ? settings.data.onboardingDone : null
      }
    })
    expect(afterSave).toEqual({ products: 1, projects: 0, done: true })
    expect(pageErrors).toEqual([])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
