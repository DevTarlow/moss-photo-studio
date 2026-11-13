import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')

test('a product exports a marketplace kit with the original and a manifest', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-kit-e2e-'))
  const exportFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-kit-export-'))
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
    await page.getByRole('button', { name: 'Look around first' }).waitFor({ timeout: 20_000 })
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-kit' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
      await window.moss.settings.set({ key: 'onboardingDismissed', value: true })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Look around first' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })

    const bytes = Array.from(fs.readFileSync(productPhoto))
    const ids = await page.evaluate(async (array) => {
      const product = await window.moss.products.createFromBytes({
        bytes: Uint8Array.from(array),
        name: 'Kit candle'
      })
      if (!product.ok) return null
      const set = await window.moss.products.createProject({
        productId: product.data.id,
        type: 'set',
        name: 'Kit candle set'
      })
      if (!set.ok) return null
      return { productId: product.data.id, projectId: set.data.project.id }
    }, bytes)
    expect(ids).toBeTruthy()
    if (!ids) return

    await page.evaluate((id) => { window.location.hash = `#/project/${id}` }, ids.projectId)
    await expect(page.getByRole('heading', { name: 'What do you sell?' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Ceramics and pottery' }).click()
    await page.getByRole('button', { name: /Make 6 Images · \$0\.06/ }).click()
    await expect(page.getByText('Your set is ready. 6 images.')).toBeVisible({ timeout: 30_000 })

    await page.evaluate((id) => { window.location.hash = `#/product/${id}` }, ids.productId)
    await expect(page.getByRole('heading', { name: 'Kit candle', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Listing kit')).toBeVisible()
    await page.getByRole('button', { name: /Read the photo/ }).click()
    await expect(page.getByText('What we see')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Speckled glaze')).toBeVisible()

    await page.getByRole('button', { name: /Make a clean shot/ }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    await page.evaluate((id) => { window.location.hash = `#/product/${id}` }, ids.productId)
    await expect(page.getByRole('heading', { name: 'Kit candle', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Cutout ready')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Listing copy', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Write listing/ }).click()
    await expect(page.getByRole('textbox', { name: 'Title 1', exact: true })).toHaveValue(/Kit candle/)
    await page.getByRole('textbox', { name: 'Title 1', exact: true }).fill('Kit candle - hand poured in small batches')
    await page.getByRole('button', { name: 'Save Listing', exact: true }).click()
    await expect(page.getByText('Listing saved.')).toBeVisible()

    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as typeof dialog.showOpenDialog
    }, exportFolder)
    await page.getByRole('button', { name: 'Export Kit', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Export Listing Kit' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Export Kit', exact: true }).click()

    await expect.poll(() => {
      const folders = fs.readdirSync(exportFolder).filter((name) => fs.statSync(path.join(exportFolder, name)).isDirectory())
      return folders.some((name) => fs.existsSync(path.join(exportFolder, name, 'kit.json')))
    }, { timeout: 20_000 }).toBe(true)
    const folderName = fs.readdirSync(exportFolder).find((name) =>
      fs.existsSync(path.join(exportFolder, name, 'kit.json'))
    )!
    const folder = path.join(exportFolder, folderName)
    const files = fs.readdirSync(folder)
    expect(files.filter((file) => file.endsWith('.jpg'))).toHaveLength(6)
    expect(files).toContain('listing.csv')
    expect(files).toContain('listing.md')
    expect(files).toContain('README.txt')
    expect(files.some((file) => file.startsWith('original.'))).toBe(true)
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'kit.json'), 'utf8')) as {
      platform: string
      images: Array<{ file: string; altText: string }>
    }
    expect(manifest.platform).toBe('Etsy')
    expect(manifest.images).toHaveLength(6)
    expect(manifest.images[0]?.altText).toContain('Kit candle')
    const listingCopy = fs.readFileSync(path.join(folder, 'listing.md'), 'utf8')
    expect(listingCopy).toContain('Kit candle - hand poured in small batches')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(exportFolder, { recursive: true, force: true })
  }
})
