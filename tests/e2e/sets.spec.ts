import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')
const screenshots = path.resolve(__dirname, '../screenshots')

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const body = document.documentElement.scrollWidth - window.innerWidth
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll')
    return Math.max(body, pageScroll ? pageScroll.scrollWidth - pageScroll.clientWidth : 0)
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

async function assertNoSeriousA11y(page: Page, where: string): Promise<void> {
  const source = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8')
  const cdp = await page.context().newCDPSession(page)
  const injected = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${source}\nreturn JSON.stringify(await axe.run(document)) })()`,
    awaitPromise: true,
    returnByValue: true
  })
  const raw = (injected as { result?: { value?: unknown } }).result?.value
  expect(typeof raw, `${where}: axe did not return a result`).toBe('string')
  const result = JSON.parse(String(raw)) as AxeResults
  const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious, `${where}: ${serious.map((violation) => violation.id).join(', ')}`).toEqual([])
}

async function screenshot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(screenshots, { recursive: true })
  await page.waitForTimeout(250)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(700, 10)
  await page.waitForTimeout(180)
  await page.screenshot({ path: path.join(screenshots, `${name}.png`), animations: 'disabled' })
}

async function firstRun(page: Page): Promise<void> {
  const confirm = page.getByRole('dialog', { name: 'Before your first run' })
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: /Create 1 Image/ }).click()
  }
}

test('a Set keeps images together and starts new work from them', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-sets-e2e-'))
  const exportFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-sets-export-'))
  let app: ElectronApplication | null = null
  try {
    app = await electron.launch({
      args: ['.', '--no-sandbox'],
      env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
      timeout: 60_000
    })
    const page = await app.firstWindow()
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await page.evaluate(async () => { await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-sets-key' }) })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })

    const product = await page.evaluate(async (bytes) => {
      const result = await window.moss.products.createFromBytes({ bytes: Uint8Array.from(bytes), name: 'Studio mug' })
      return result.ok ? result.data : null
    }, Array.from(fs.readFileSync(productPhoto)))
    expect(product).toBeTruthy()
    await page.evaluate((id) => { window.location.hash = `#/product/${id}` }, product!.id)
    await expect(page.getByRole('heading', { name: 'Studio mug', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'New Image from Reference', exact: true }).click()
    await expect(page.getByText('Image Generator', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await page.locator('textarea').first().fill('A ceramic mug on a warm wooden table, soft morning light')
    await page.getByRole('button', { name: /Create 1 Image · \$0\.01/ }).click()
    await firstRun(page)
    await expect(page.getByRole('button', { name: /Open .* larger/ }).first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /Open .* larger/ }).first().click()
    await page.getByRole('button', { name: 'Save to Set', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Save to Set' })).toBeVisible()
    await page.locator('#save-to-new-set').fill('Spring collection')
    await screenshot(page, 'save-to-set')
    await page.getByRole('button', { name: 'Create & Save', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Save to Set' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Spring collection/ }).first()).toBeVisible()
    const setsFilter = page.getByRole('button', { name: 'Sets', exact: true })
    await expect(setsFilter.locator('svg')).toHaveCount(0)
    await setsFilter.click()
    const filteredSet = page.getByRole('button', { name: /Spring collection/ }).first()
    await expect(filteredSet).toContainText('1 image')
    await screenshot(page, 'all-work-sets')
    await filteredSet.click()
    await expect(page.getByRole('heading', { name: 'Spring collection', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    const setCard = page.getByRole('button', { name: /Spring collection/ }).first()
    await expect(setCard).toBeVisible()
    await expect(setCard).toContainText('1 image')
    await screenshot(page, 'sets')
    await setCard.click()
    await expect(page.getByRole('heading', { name: 'Spring collection', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Image', exact: true })).toHaveCount(1)
    await screenshot(page, 'set-detail')

    await page.getByRole('button', { name: 'New Image', exact: true }).click()
    await expect(page.getByText('Image Generator', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await page.locator('textarea').first().fill('The same ceramic mug on a pale linen table with window light')
    await page.getByRole('button', { name: /Create 1 Image · \$0\.01/ }).click()
    await firstRun(page)
    await expect(page.getByRole('button', { name: /Open .* larger/ }).first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Spring collection/ }).first()).toContainText('3 images')
    await page.getByRole('button', { name: /Spring collection/ }).first().click()
    await expect(page.getByText('3 images', { exact: true })).toBeVisible()
    await screenshot(page, 'set-detail-many')
    await assertNoSeriousA11y(page, 'set-detail')

    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as typeof dialog.showOpenDialog
    }, exportFolder)
    await page.getByRole('button', { name: 'Export Set', exact: true }).click()
    await expect.poll(() => {
      const folders = fs.readdirSync(exportFolder).filter((name) => name.startsWith('Moss Set'))
      return folders.find((name) => fs.readdirSync(path.join(exportFolder, name)).length >= 3) ?? null
    }, { timeout: 20_000 }).not.toBeNull()
    const exported = fs.readdirSync(exportFolder).find((name) => name.startsWith('Moss Set'))!
    const exportedFiles = fs.readdirSync(path.join(exportFolder, exported))
    expect(exportedFiles.filter((file) => /\.(webp|jpg|png)$/.test(file))).toHaveLength(3)
    expect(exportedFiles[0]).toMatch(/^01-/)

    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(250)
    await noHorizontalOverflow(page)
    await screenshot(page, 'sets-1024-light')
    await page.evaluate(async () => { await window.moss.settings.set({ key: 'theme', value: 'dark' }) })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => { window.location.hash = '#/sets' })
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await screenshot(page, 'sets-dark')
    await assertNoSeriousA11y(page, 'sets-dark')

    await page.getByRole('button', { name: /Spring collection/ }).first().click()
    await page.getByRole('button', { name: /Remove .* from Spring collection/ }).first().click()
    await expect(page.getByText('2 images', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Actions for Spring collection' }).click()
    await page.getByRole('menuitem', { name: 'Delete Set' }).click()
    await page.getByRole('button', { name: 'Delete Set', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sets', exact: true })).toBeVisible()
    await expect(page.getByText('No Sets yet', { exact: true })).toBeVisible()
    await screenshot(page, 'sets-empty')
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()

    await page.evaluate((id) => { window.location.hash = `#/product/${id}` }, product!.id)
    await expect(page.getByRole('heading', { name: 'Studio mug', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Add to Set', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Add to Set' })).toBeVisible()
    await page.locator('#save-to-new-set').fill('Product picks')
    await page.getByRole('button', { name: 'Create & Save', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Add to Set' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    const productSetCard = page.getByRole('button', { name: /Product picks/ }).first()
    await expect(productSetCard).toContainText('1 image')
    await productSetCard.click()
    await expect(page.getByText('Product source', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'New Image from Reference', exact: true }).click()
    await expect(page.getByText('Image Generator', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await page.locator('textarea').first().fill('The same mug on a soft grey background')
    await page.getByRole('button', { name: /Create 1 Image · \$0\.01/ }).click()
    await firstRun(page)
    await expect(page.getByRole('button', { name: /Open .* larger/ }).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('link', { name: 'Sets', exact: true }).click()
    await expect(page.getByRole('button', { name: /Product picks/ }).first()).toContainText('3 images')
    expect(pageErrors).toEqual([])
  } finally {
    await app?.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(exportFolder, { recursive: true, force: true })
  }
})
