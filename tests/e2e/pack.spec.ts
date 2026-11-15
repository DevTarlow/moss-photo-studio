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
    const workspace = document.querySelector<HTMLElement>('.workspace')
    return Math.max(
      body,
      pageScroll ? pageScroll.scrollWidth - pageScroll.clientWidth : 0,
      workspace ? workspace.scrollWidth - workspace.clientWidth : 0
    )
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

test('an Image Pack is made, reviewed, and exported as a folder', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-pack-e2e-'))
  const exportFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-pack-export-'))
  let app: ElectronApplication | null = null
  try {
    app = await electron.launch({
      args: ['.', '--no-sandbox'],
      env: { ...process.env, MOSS_DEV_UNLOCK: '1', MOSS_MUSE_FAKE: '1', MOSS_E2E: '1', MOSS_USER_DATA_DIR: userData },
      timeout: 60_000
    })
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-pack-key' })
    })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible({ timeout: 20_000 })

    const product = await page.evaluate(async (bytes) => {
      const result = await window.moss.products.createFromBytes({ bytes: Uint8Array.from(bytes), name: 'Studio mug' })
      return result.ok ? result.data : null
    }, Array.from(fs.readFileSync(productPhoto)))
    expect(product).toBeTruthy()
    await page.evaluate((id) => { window.location.hash = `#/product/${id}` }, product!.id)
    await expect(page.getByRole('heading', { name: 'Studio mug', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'New Image Pack' }).click()
    await expect(page.getByText('Pack setup', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('From a photo', { exact: true })).toBeVisible()
    await expect(page.locator('#pack-preset')).toHaveValue('studio-essentials')
    await expect(page.getByLabel('Label')).toHaveCount(0)
    await page.getByRole('button', { name: 'Alternate angle', exact: true }).click()
    await expect(page.getByLabel('Label')).toHaveValue('Alternate angle')
    await page.getByRole('button', { name: 'Detail', exact: true }).click()
    await expect(page.getByLabel('Label')).toHaveValue('Detail')
    await expect(page.getByLabel('Label')).toHaveCount(1)
    await screenshot(page, 'pack-shot-settings')
    await page.getByRole('button', { name: 'Detail', exact: true }).click()
    await expect(page.getByLabel('Label')).toHaveCount(0)

    await page.getByRole('button', { name: 'Person: No person' }).click()
    const mayaItem = page.getByRole('menuitem', { name: /Maya/ })
    await expect(mayaItem.locator('img')).toBeVisible()
    await mayaItem.click()
    await expect(page.getByRole('button', { name: 'Person: Maya · 20s' })).toBeVisible()
    const personThumb = page.getByRole('button', { name: 'See Maya larger' })
    const beforeLook = await personThumb.locator('img').getAttribute('src')
    await page.locator('#pack-person-look').selectOption({ index: 1 })
    await expect.poll(() => personThumb.locator('img').getAttribute('src')).not.toBe(beforeLook)
    await personThumb.click()
    await expect(page.getByRole('dialog', { name: 'Maya' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Maya' })).toHaveCount(0)

    await screenshot(page, 'pack-workspace')
    await assertNoSeriousA11y(page, 'pack-workspace')

    await page.getByRole('button', { name: /Make 6 Images · \$0\.06/ }).click()
    const confirm = page.getByRole('dialog', { name: 'Before your first run' })
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Make 6 Images/ }).click()
    }
    await expect(page.getByText('6 of 6 ready', { exact: true })).toBeVisible({ timeout: 30_000 })
    await screenshot(page, 'pack-review')
    await assertNoSeriousA11y(page, 'pack-review')

    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Back to Image Pack' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Back to Image Pack' }).click()
    await expect(page.getByText('Pack setup', { exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New Version', exact: true }).first().click()
    await expect(page.getByText('7 of 6 ready', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel(/Version for Hero/)).toBeVisible({ timeout: 20_000 })

    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as typeof dialog.showOpenDialog
    }, exportFolder)
    await page.getByRole('button', { name: 'Export Pack', exact: true }).click()
    await expect.poll(() => {
      const folders = fs.readdirSync(exportFolder).filter((name) => name.startsWith('Moss Pack'))
      return folders.find((name) => fs.existsSync(path.join(exportFolder, name, 'pack.json'))) ?? null
    }, { timeout: 20_000 }).not.toBeNull()
    const folderName = fs.readdirSync(exportFolder).find((name) => name.startsWith('Moss Pack'))!
    const folder = path.join(exportFolder, folderName)
    const files = fs.readdirSync(folder)
    expect(files.filter((file) => /\.(webp|jpg|jpeg|png)$/.test(file))).toHaveLength(6)
    expect(files).toContain('pack.json')
    expect(files).toContain('README.txt')
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'pack.json'), 'utf8')) as { shots: unknown[]; name: string }
    expect(manifest.name).toBe('Studio mug')
    expect(manifest.shots).toHaveLength(6)

    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Packs', exact: true }).click()
    const packCard = page.locator('article.lib-card').filter({ hasText: 'Studio mug' })
    await expect(packCard).toBeVisible()
    await expect(packCard.getByText('Image Pack', { exact: true })).toBeVisible()
    await packCard.getByRole('link', { name: /Open/ }).click()
    await expect(page.getByText('Pack setup', { exact: true })).toBeVisible({ timeout: 20_000 })

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(250)
    await noHorizontalOverflow(page)
    await screenshot(page, 'pack-1024-light')
    await page.evaluate(async () => { await window.moss.settings.set({ key: 'theme', value: 'dark' }) })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => { window.location.hash = '#/library' })
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Packs', exact: true }).click()
    await page.locator('article.lib-card').filter({ hasText: 'Studio mug' }).getByRole('link', { name: /Open/ }).click()
    await expect(page.getByText('Pack setup', { exact: true })).toBeVisible({ timeout: 20_000 })
    await screenshot(page, 'pack-dark')
    await assertNoSeriousA11y(page, 'pack-dark')
    expect(pageErrors).toEqual([])
  } finally {
    await app?.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(exportFolder, { recursive: true, force: true })
  }
})
