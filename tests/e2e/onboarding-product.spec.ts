import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

async function launch(userData: string) {
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
  return { app, page: await app.firstWindow() }
}

test('onboarding saves the first photo as a Product without creating a project', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-onboarding-product-'))
  const { app, page } = await launch(userData)

  try {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.waitForTimeout(800)
    const welcome = page.getByRole('heading', { name: 'Your personal photo studio.' })
    await expect(welcome).toBeVisible({ timeout: 20_000 })
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-onboarding-product' })
      await window.moss.settings.set({ key: 'onboardingDone', value: false })
      await window.moss.settings.set({ key: 'onboardingStep', value: 2 })
    })
    await page.reload()
    await page.getByRole('heading', { name: 'Add your first product' }).waitFor({ timeout: 20_000 })
    await page.locator('input[type=file]').first().setInputFiles(productPhoto)
    await expect(page.getByText('Saved as a Product')).toBeVisible({ timeout: 20_000 })
    const productName = page.getByRole('textbox', { name: 'Product name' })
    await expect(productName).toBeFocused()
    await productName.fill('First product')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Product name' })).toHaveValue('First product')

    const afterProduct = await page.evaluate(async () => {
      const products = await window.moss.products.list()
      const projects = await window.moss.projects.list({})
      return { products: products.ok ? products.data.length : -1, projects: projects.ok ? projects.data.total : -1 }
    })
    expect(afterProduct).toEqual({ products: 1, projects: 0 })

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible()
    await expect(page.getByText('Preview · First product')).toBeVisible()
    await expect(page.getByText('Your product.')).toBeVisible()
    await expect(page.getByText('Corner badge', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: "You're ready to make photos." })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'View Product' }).click()
    await expect(page.getByRole('heading', { name: 'First product', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Edit Photo', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Photo (Free)', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make an Image', exact: true })).toBeVisible()
    await expect(page.getByText('No projects yet')).toBeVisible()

    const afterSave = await page.evaluate(async () => {
      const products = await window.moss.products.list()
      const projects = await window.moss.projects.list({})
      const settings = await window.moss.settings.all()
      return { products: products.ok ? products.data.length : -1, projects: projects.ok ? projects.data.total : -1, done: settings.ok ? settings.data.onboardingDone : null }
    })
    expect(afterSave).toEqual({ products: 1, projects: 0, done: true })
    expect(pageErrors).toEqual([])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('onboarding lets the seller skip the product step and finish in Products', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-onboarding-skip-'))
  const { app, page } = await launch(userData)

  try {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.waitForTimeout(800)
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-onboarding-skip' })
      await window.moss.settings.set({ key: 'onboardingDone', value: false })
      await window.moss.settings.set({ key: 'onboardingStep', value: 2 })
    })
    await page.reload()
    await page.getByRole('heading', { name: 'Add your first product' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Skip for now', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('A sample product.')).toBeVisible()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: "You're ready to make photos." })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('No product yet')).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: "You're ready to make photos." })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Open Studio' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })
    expect(pageErrors).toEqual([])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})

test('onboarding brand step previews the newest product after a restart', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-onboarding-preview-'))
  const { app, page } = await launch(userData)

  try {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.waitForTimeout(800)
    const bytes = Array.from(fs.readFileSync(productPhoto))
    await page.evaluate(async (photoBytes) => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-onboarding-preview' })
      await window.moss.products.createFromBytes({ bytes: new Uint8Array(photoBytes), name: 'Resumed Mug' })
      await window.moss.settings.set({ key: 'onboardingDone', value: false })
      await window.moss.settings.set({ key: 'onboardingStep', value: 3 })
    }, bytes)
    await page.reload()
    await page.getByRole('heading', { name: 'Make it your own' }).waitFor({ timeout: 20_000 })
    await expect(page.getByText('Preview · Resumed Mug')).toBeVisible()
    await expect(page.getByText('Your product.')).toBeVisible()
    expect(pageErrors).toEqual([])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})


test('the ready step explains a missing Meta key and reports skipped steps honestly', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-onboarding-ready-'))
  const { app, page } = await launch(userData)

  try {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.waitForTimeout(800)
    await page.evaluate(async () => {
      await window.moss.settings.set({ key: 'onboardingDone', value: false })
      await window.moss.settings.set({ key: 'onboardingStep', value: 4 })
    })
    await page.reload()
    await expect(page.getByRole('heading', { name: "You're ready to make photos." })).toBeVisible({ timeout: 20_000 })
    const setup = page.getByRole('list', { name: 'Setup steps' })
    await expect(setup.getByRole('listitem').filter({ hasText: 'Welcome' })).toContainText('Completed')
    await expect(setup.getByRole('listitem').filter({ hasText: 'Meta Key' })).toContainText('Skipped')
    await expect(setup.getByRole('listitem').filter({ hasText: 'Product' })).toContainText('Skipped')
    await expect(setup.getByRole('listitem').filter({ hasText: 'Personalize' })).toContainText('Skipped')
    await page.getByRole('button', { name: 'Make an Image · Meta Key Needed' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect Meta' })
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'))).toBe(true)
    await dialog.getByRole('button', { name: 'Not Now' }).click()
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'))).toBe(false)
    expect(pageErrors).toEqual([])
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
