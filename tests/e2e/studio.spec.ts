import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { startFakeMuse } from '../fake-muse/server'
import { startFakeLicense } from '../fake-license/server'

const productPhoto = path.resolve(__dirname, '../../resources/tiles/examples/product.webp')
const screenshots = path.resolve(__dirname, '../screenshots')
let muse: Awaited<ReturnType<typeof startFakeMuse>>
let license: Awaited<ReturnType<typeof startFakeLicense>>
let userData = ''
let exportFolder = ''
let app: ElectronApplication
let page: Page
let pageErrors: string[] = []
const requestHosts = new Set<string>()

async function launch(): Promise<void> {
  app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      MOSS_USER_DATA_DIR: userData,
      MOSS_MUSE_BASE_URL: muse.baseUrl,
      MOSS_LICENSE_API_BASE: license.baseUrl,
      MOSS_E2E: '1'
    },
    timeout: 60_000
  })
  page = await app.firstWindow()
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    try {
      requestHosts.add(new URL(request.url()).hostname)
    } catch {
      // data: URLs have no host.
    }
  })
  await page.waitForLoadState('domcontentloaded')
  await stubDialogs()
}

async function setAppTheme(theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate(async (value) => {
    await window.moss.settings.set({ key: 'theme', value })
  }, theme)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

async function screenshot(name: string, compare = true): Promise<void> {
  fs.mkdirSync(screenshots, { recursive: true })
  const captureOnly = !compare || name.endsWith('-1024-light')
  await page.waitForTimeout(200)
  const file = path.join(screenshots, `${name}.png`)
  for (let wait = 0; wait < 20 && (await page.locator('.toast').count()) > 0; wait += 1) {
    await page.waitForTimeout(150)
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.mouse.move(700, 10)
      await page.waitForTimeout(180)
      if (captureOnly || !fs.existsSync(file) || process.env.MOSS_UPDATE_SCREENS === '1') {
        await page.screenshot({ path: file, animations: 'disabled' })
      } else {
        await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.01, animations: 'disabled', timeout: 30_000 })
      }
      return
    } catch (error) {
      if (attempt === 3) {
        if (process.env.MOSS_UPDATE_SCREENS === '1') {
          console.warn(`Screenshot ${name} could not be captured: ${error instanceof Error ? error.message : 'unknown'}`)
          return
        }
        throw error
      }
      await page.waitForTimeout(400)
    }
  }
}

async function gotoLibrary(): Promise<void> {
  await page.getByRole('link', { name: 'All work', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
}

async function stubDialogs(): Promise<void> {
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as typeof dialog.showOpenDialog
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as { defaultPath?: string }
      const base = options.defaultPath?.split('/').pop() ?? 'export.webp'
      return { canceled: false, filePath: `${folder}/${base}` }
    }) as typeof dialog.showSaveDialog
  }, exportFolder)
}

async function assertNoSeriousA11y(where: string, selector = 'body'): Promise<void> {
  const source = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8')
  const cdp = await page.context().newCDPSession(page)
  const target = selector === 'body' ? 'document' : `document.querySelector(${JSON.stringify(selector)})`
  const injected = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${source}\nreturn JSON.stringify(await axe.run(${target} || document)) })()`,
    awaitPromise: true,
    returnByValue: true
  })
  const raw = (injected as { result?: { value?: unknown } }).result?.value
  expect(typeof raw, `${where}: axe did not return a result`).toBe('string')
  const result = JSON.parse(String(raw)) as AxeResults
  const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious, `${where}: ${serious.map((violation) => violation.id).join(', ')}`).toEqual([])
}

async function noHorizontalOverflow(): Promise<void> {
  const overflow = await page.evaluate(() => {
    const body = document.documentElement.scrollWidth - window.innerWidth
    const page = document.querySelector<HTMLElement>('.page-scroll')
    const main = document.querySelector<HTMLElement>('.app-main')
    const workspace = document.querySelector<HTMLElement>('.workspace')
    return Math.max(
      body,
      page ? page.scrollWidth - page.clientWidth : 0,
      main ? main.scrollWidth - main.clientWidth : 0,
      workspace ? workspace.scrollWidth - workspace.clientWidth : 0
    )
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

async function menuEnabled(id: string): Promise<boolean | undefined> {
  return app.evaluate(({ Menu }, menuId) => {
    const items = Menu.getApplicationMenu()?.items.flatMap((item) => item.submenu?.items ?? []) ?? []
    return items.find((item) => item.id === menuId)?.enabled
  }, id)
}

async function spendCents(): Promise<number> {
  return page.evaluate(async () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const result = await window.moss.usage.summary({ month })
    return result.ok ? result.data.spendCents : -1
  })
}

async function openFirstProject(type: 'photo' | 'image'): Promise<void> {
  await gotoLibrary()
  const card = page.locator('article.lib-card').filter({ has: page.getByText(type === 'photo' ? 'Image Editor' : 'Image Generator', { exact: true }) }).first()
  await card.getByRole('link', { name: /Open/ }).click()
}

test.describe.serial('Moss Photo Studio journey', () => {
  test.beforeAll(async () => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-e2e-'))
    exportFolder = path.join(userData, 'exports')
    fs.mkdirSync(exportFolder, { recursive: true })
    muse = await startFakeMuse({ delayMs: 350 })
    license = await startFakeLicense()
    await launch()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
  })

  test.afterAll(async () => {
    await app.close().catch(() => undefined)
    await muse.close()
    await license.close()
    fs.rmSync(userData, { recursive: true, force: true })
  })

  test('activation, onboarding, and the first product', async () => {
    await expect(page.getByRole('heading', { name: 'Activate Moss Photo Studio' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await screenshot('activation')
    await assertNoSeriousA11y('activation')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(200)
    await noHorizontalOverflow()
    await screenshot('activation-1024-light')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    await setAppTheme('dark')
    await expect(page.getByRole('heading', { name: 'Activate Moss Photo Studio' })).toBeVisible({ timeout: 20_000 })
    await screenshot('activation-dark')
    await setAppTheme('light')
    await page.getByLabel('License key').fill('bad')
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByText("That key wasn't accepted. Check it and try again.")).toBeVisible()
    await page.getByLabel('License key').fill('MOSS-E2E-VALID-KEY')
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your personal photo studio.' })).toBeVisible({ timeout: 20_000 })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    await page.waitForTimeout(200)
    await screenshot('onboarding')
    await assertNoSeriousA11y('onboarding')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(200)
    await screenshot('onboarding-1024-light')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    await setAppTheme('dark')
    await expect(page.getByRole('heading', { name: 'Your personal photo studio.' })).toBeVisible({ timeout: 20_000 })
    await screenshot('onboarding-dark')
    await setAppTheme('light')
    await expect(page.getByRole('heading', { name: 'Your personal photo studio.' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Set up the studio' }).click()
    await expect(page.getByRole('heading', { name: 'Connect Meta Muse' })).toBeVisible()
    await page.getByLabel('Meta Muse key').fill('LLM|e2e-muse-key')
    await page.getByRole('button', { name: 'Test and connect' }).click()
    await expect(page.getByRole('heading', { name: 'Add your first product' })).toBeVisible({ timeout: 20_000 })
    await page.locator('input[type=file]').setInputFiles(productPhoto)
    await expect(page.getByText('Saved as a Product')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible()
    await screenshot('onboarding-customize')
    await assertNoSeriousA11y('onboarding-customize')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: "You're ready to make photos." })).toBeVisible()
    await screenshot('onboarding-ready')
    await assertNoSeriousA11y('onboarding-ready')
    await page.getByRole('button', { name: 'Finish Setup' }).click()
    await expect(page.getByRole('heading', { name: 'product', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Change a Photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Image' })).toBeVisible()
    await expect(page.getByText('Listing Kit', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Make a Set', { exact: true })).toHaveCount(0)
    await screenshot('product-hub')
    await assertNoSeriousA11y('product-hub')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(200)
    await noHorizontalOverflow()
    await screenshot('product-hub-1024-light')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    expect(pageErrors).toEqual([])
  })

  test('the editor makes a version, compares, and applies a free local adjust', async () => {
    await page.getByRole('button', { name: 'Change a Photo' }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Listing Kit', exact: true })).toHaveCount(0)
    await expect.poll(() => menuEnabled('menu-copy-image')).toBe(true)
    expect(await menuEnabled('menu-export')).toBe(true)
    expect(await menuEnabled('menu-zoom-in')).toBe(true)
    expect(await menuEnabled('menu-toggle-panel')).toBe(true)
    expect(await menuEnabled('menu-undo')).toBe(false)
    await screenshot('photo-editor')
    await assertNoSeriousA11y('photo-editor')
    const editorPreview = page.getByRole('dialog', { name: 'Image preview' })
    await page.locator('.canvas-stage img').first().click()
    await expect(editorPreview).toBeVisible()
    await editorPreview.getByRole('button', { name: 'Close preview' }).click()
    await expect(editorPreview).toBeHidden()
    await page.getByRole('button', { name: /Kitchen table/ }).first().click()
    await expect(page.getByLabel('Describe the change')).toHaveValue(/warm wooden kitchen table/)
    muse.control('slow')
    await page.getByRole('button', { name: /Make This Change · \$0\.01/ }).click()
    const confirm = page.getByRole('dialog', { name: 'Before your first run' })
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Make This Change/ }).click()
    }
    const runningStatus = page.locator('.canvas-stage [role="status"]')
    await expect(runningStatus).toBeVisible({ timeout: 10_000 })
    muse.control('normal')
    await expect(page.getByText('Scene 01', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Cost: $0.01').first()).toBeVisible()
    await page.getByRole('button', { name: 'Compare', exact: true }).click()
    const slider = page.getByRole('slider', { name: 'Compare before and after' })
    const track = await slider.boundingBox()
    expect(track).not.toBeNull()
    if (track) await page.mouse.click(track.x + track.width * 0.3, track.y + track.height / 2)
    expect(Number(await slider.inputValue())).toBeGreaterThan(0)
    await slider.focus()
    await page.keyboard.press('Home')
    expect(Number(await slider.inputValue())).toBe(0)
    await page.keyboard.press('ArrowRight')
    expect(Number(await slider.inputValue())).toBe(5)
    await page.keyboard.press('End')
    expect(Number(await slider.inputValue())).toBe(100)
    await screenshot('photo-compare')
    await page.getByRole('button', { name: 'Done Comparing' }).click()
    const canvas = page.getByRole('group', { name: /Photo canvas/ })
    await canvas.focus()
    await page.keyboard.down('Space')
    await expect(page.locator('.canvas-stage').getByText('Original', { exact: true })).toBeVisible()
    await page.keyboard.up('Space')
    await page.getByRole('button', { name: /Local Adjust/ }).click()
    await page.getByRole('button', { name: '1:1', exact: true }).click()
    const brightness = page.getByRole('slider', { name: 'Brightness' })
    await brightness.focus()
    await page.keyboard.press('ArrowRight')
    const sharpen = page.getByRole('slider', { name: 'Sharpen' })
    await sharpen.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => menuEnabled('menu-undo')).toBe(true)
    await screenshot('photo-adjust-preview')
    await assertNoSeriousA11y('photo-adjust-preview')
    await page.getByRole('button', { name: /Apply Locally · Free/ }).click()
    await expect(page.getByText('Adjust 01', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Cost: Free').first()).toBeVisible()
    await screenshot('photo-adjusted')
    await assertNoSeriousA11y('photo-adjusted')
    const clipboardCheck = await page.evaluate(async () => {
      const recent = await window.moss.projects.recent({ limit: 1 })
      const projectId = recent.ok ? recent.data[0]?.id : null
      if (!projectId) return null
      const detail = await window.moss.projects.get({ id: projectId })
      const image = detail.ok ? detail.data.images.find((entry) => entry.status === 'ready') : null
      if (!image) return null
      const copied = await window.moss.app.copyImage({ imageId: image.id })
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const read = await window.moss.app.readClipboardImage()
        if (read.ok && read.data.mime && read.data.bytes?.byteLength) {
          return { copied: copied.ok, read: { mime: read.data.mime, size: read.data.bytes.byteLength } }
        }
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      return { copied: copied.ok, read: null }
    })
    expect(clipboardCheck?.copied).toBe(true)
    expect(clipboardCheck?.read?.mime).toMatch(/^image\//)
    expect(clipboardCheck?.read?.size ?? 0).toBeGreaterThan(1000)
    expect(pageErrors).toEqual([])
  })

  test('create makes four images and opens one in the editor', async () => {
    await page.keyboard.press('Control+2')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Examples', { exact: true })).toBeVisible()
    expect(await menuEnabled('menu-zoom-in')).toBe(false)
    expect(await menuEnabled('menu-export')).toBe(false)
    await screenshot('create-empty')
    await assertNoSeriousA11y('create-empty')
    await page.getByRole('button', { name: 'Start from an Idea' }).click()
    await page.getByRole('button', { name: 'Holding it', exact: true }).click()
    await page.getByRole('group', { name: 'How many images' }).getByRole('button', { name: '4', exact: true }).click()
    await page.locator('textarea').first().fill('A ceramic mug alone on a pure white background, centred and filling most of the frame, soft even lighting, product photo.')
    await expect(page.getByRole('button', { name: /Create 4 Images · \$0\.04/ })).toBeVisible()
    await page.getByRole('button', { name: /Create 4 Images · \$0\.04/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: /More actions for/ }).first().click()
    await expect(page.getByRole('menuitem', { name: 'Make a Listing Kit' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('separator', { name: 'Resize runs panel' })).toBeVisible()
    await expect.poll(() => menuEnabled('menu-export')).toBe(true)
    await screenshot('create-results')
    await assertNoSeriousA11y('create-results')
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Back to Image Generator' })).toBeVisible({ timeout: 20_000 })
    await screenshot('create-photo')
    expect(pageErrors).toEqual([])
  })

  test('export writes a named image file', async () => {
    await page.getByRole('button', { name: /Export/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Export image' })
    await expect(dialog).toBeVisible()
    await stubDialogs()
    await dialog.getByRole('button', { name: 'Export', exact: true }).click()
    await expect.poll(() => fs.readdirSync(exportFolder).some((file) => /\.(webp|jpg|jpeg|png)$/.test(file)), { timeout: 20_000 }).toBe(true)
    await screenshot('export-done')
    expect(pageErrors).toEqual([])
  })

  test('usage totals, CSV, and the budget card', async () => {
    await page.getByRole('link', { name: 'Usage', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    await expect(page.getByText('Images made', { exact: true })).toBeVisible()
    await screenshot('usage')
    await assertNoSeriousA11y('usage')
    const ledgerRows = page.locator('table tbody tr')
    expect(await ledgerRows.count()).toBeGreaterThan(0)
    const before = await spendCents()
    expect(before).toBeGreaterThan(0)
    await stubDialogs()
    await page.getByRole('button', { name: /Export CSV/ }).click()
    await expect.poll(() => fs.readdirSync(exportFolder).some((file) => file.endsWith('.csv')), { timeout: 15_000 }).toBe(true)
    const csv = fs.readdirSync(exportFolder).find((file) => file.endsWith('.csv'))!
    const contents = fs.readFileSync(path.join(exportFolder, csv), 'utf8')
    const rows = contents.trim().split('\n')
    expect(rows[0]).toBe('date,project,action,requested,returned,cost_usd,cost_micros,duration_ms,result,error')
    const csvCents = rows.slice(1).reduce((sum, row) => sum + Math.round(Number(row.split(',')[5]) * 100), 0)
    expect(csvCents).toBe(before)
    await page.locator('#budget').fill('0.23')
    await page.getByRole('button', { name: 'Save Limit' }).click()
    await expect(page.getByText('Monthly limit saved.').last()).toBeVisible()
    await page.locator('#budget').fill('10.00')
    await page.getByRole('button', { name: 'Save Limit' }).click()
    await expect(page.getByText('Monthly limit saved.').last()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('people, settings, dark theme, persistence, and accessibility', async () => {
    await gotoLibrary()
    await screenshot('library-light')
    await assertNoSeriousA11y('library-light')
    await page.getByRole('link', { name: 'Products', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await screenshot('products')
    await assertNoSeriousA11y('products')
    await page.getByRole('link', { name: 'People', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await expect(page.getByText('Maya · 20s')).toBeVisible()
    await screenshot('people')
    await assertNoSeriousA11y('people')
    await page.getByRole('button', { name: 'Open Maya larger' }).click()
    const personDialog = page.getByRole('dialog')
    await expect(personDialog.getByRole('button', { name: /^Use .+ for Maya$/ })).toHaveCount(4)
    await personDialog.getByRole('button', { name: 'Use Studio front for Maya' }).click()
    await expect(personDialog.locator('img').first()).toHaveAttribute('src', /maya-front\.webp/)
    await screenshot('people-looks')
    await personDialog.getByRole('button', { name: 'Close' }).last().click()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('link', { name: 'Meta API key', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Business', exact: true })).toHaveCount(0)
    await screenshot('settings-light')
    await assertNoSeriousA11y('settings-light')
    await page.getByRole('link', { name: 'Logo & Colors', exact: true }).click()
    await expect(page.locator('.brand-preview')).toBeVisible()
    await page.getByRole('link', { name: 'Appearance', exact: true }).click()
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await screenshot('settings-dark')
    await page.getByRole('link', { name: 'Products', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await screenshot('products-dark')
    await gotoLibrary()
    await screenshot('library-dark')
    await openFirstProject('photo')
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    await screenshot('photo-dark')
    await assertNoSeriousA11y('photo-dark')
    await gotoLibrary()
    await openFirstProject('image')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await screenshot('create-dark')
    await assertNoSeriousA11y('create-dark')
    await page.getByRole('link', { name: 'Usage', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    await screenshot('usage-dark')
    await assertNoSeriousA11y('usage-dark')
    await page.getByRole('link', { name: 'People', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await screenshot('people-dark')
    await assertNoSeriousA11y('people-dark')
    await gotoLibrary()
    const bounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds())
    await app.close()
    await launch()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const reopenedBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds())
    expect(reopenedBounds?.width).toBe(bounds?.width)
    expect(reopenedBounds?.height).toBe(bounds?.height)
    await gotoLibrary()
    await assertNoSeriousA11y('library-after-restart')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(300)
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await page.getByRole('link', { name: 'Appearance', exact: true }).click()
    await page.getByRole('button', { name: 'Light', exact: true }).click()
    await gotoLibrary()
    await screenshot('library-1024-light')
    await assertNoSeriousA11y('library-1024-light')
    await page.getByRole('link', { name: 'People', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('people-1024-light')
    await page.getByRole('link', { name: 'Usage', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('usage-1024-light')
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Meta API key', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('settings-1024-light')
    await page.getByRole('link', { name: 'Products', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('products-1024-light')
    await openFirstProject('photo')
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    await noHorizontalOverflow()
    await screenshot('photo-1024-light')
    await gotoLibrary()
    await openFirstProject('image')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await noHorizontalOverflow()
    await screenshot('create-1024-light')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1.5))
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await screenshot('library-zoom-150', false)
    await assertNoSeriousA11y('library-zoom-150')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    expect(pageErrors).toEqual([])
  })

  test('generation goes offline in plain words without a cost, and the library still works', async () => {
    muse.control('offline')
    await openFirstProject('photo')
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    const before = await spendCents()
    await page.getByRole('button', { name: /Quick fix/ }).click()
    await page.getByRole('button', { name: /Make This Change/ }).click()
    await expect(page.getByText(/The request timed out\./)).toBeVisible({ timeout: 20_000 })
    expect(await spendCents()).toBe(before)
    await gotoLibrary()
    muse.control('normal')
    expect(pageErrors).toEqual([])
  })

  test('no unexpected renderer network hosts were used', async () => {
    const allowed = new Set(['', 'moss-media', 'bundled', 'library', '127.0.0.1'])
    const unexpected = [...requestHosts].filter((host) => host && !allowed.has(host) && !host.endsWith('127.0.0.1'))
    expect(unexpected).toEqual([])
    expect(muse.requests().length).toBeGreaterThan(0)
    expect(license.requests().length).toBeGreaterThan(0)
  })

  test('the Meta key can be tested, replaced, and removed without exposing it', async () => {
    muse.control('normal')
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Meta API key', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Test Connection' }).click()
    await expect(page.getByText('Connection checked.')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
    await page.getByLabel('Meta Muse key').fill('LLM|e2e-replacement-key-WXYZ')
    await page.getByRole('button', { name: 'Test and Save' }).click()
    await expect(page.getByText(/WXYZ/).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toContainText('Remove the Meta Muse key?')
    await confirm.getByRole('button', { name: 'Remove Key' }).click()
    await expect(page.getByLabel('Meta Muse key')).toBeVisible({ timeout: 15_000 })
    const secretStatus = await page.evaluate(async () => {
      const result = await window.moss.secrets.status()
      return result.ok ? result.data : { hasKey: true, last4: null, validatedAt: null, backend: 'unknown' }
    })
    expect(secretStatus.hasKey).toBe(false)
    expect(await page.locator('body').innerText()).not.toContain('e2e-replacement-key-WXYZ')
    expect(pageErrors).toEqual([])
  })

  test('license grace and expiry keep the library readable', async () => {
    await app.close()
    const dbPath = path.join(userData, 'library.sqlite')
    const day = 24 * 60 * 60 * 1000
    const updateValidation = (daysAgo: number): void => {
      const db = new Database(dbPath)
      db.prepare('UPDATE license SET last_validated_at = ?, status = ?').run(Date.now() - daysAgo * day, 'licensed')
      db.close()
    }
    updateValidation(13)
    license.control('down')
    await launch()
    await page.getByRole('button', { name: 'New project' }).waitFor({ timeout: 20_000 })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.evaluate(() => { window.location.hash = '#/library' })
    await expect(page.getByText('Working offline', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Settings' }).first()).toBeVisible()
    await expect(page.getByText('Finish setting up')).toHaveCount(0)
    await screenshot('license-grace')
    await app.close()
    updateValidation(15)
    license.control('down')
    await launch()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await expect(page.getByRole('heading', { name: 'Activate Moss Photo Studio' })).toBeVisible({ timeout: 20_000 })
    const browse = page.getByRole('button', { name: 'Browse My Library' })
    await expect(browse).toBeVisible()
    await browse.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible()
    await screenshot('license-expired-readonly')
    await page.locator('article.lib-card').first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByText(/Reactivate to make images/).first()).toBeVisible({ timeout: 20_000 })
    const projectId = new URL(page.url()).hash.split('/')[2]!
    const detail = await page.evaluate(async (id) => {
      const result = await window.moss.projects.get({ id })
      return result.ok ? result.data : null
    }, projectId)
    const source = detail?.images.find((image) => image.status === 'ready')
    expect(source).toBeTruthy()
    const adjusted = await page.evaluate(async (imageId) => {
      const result = await window.moss.adjust.apply({
        imageId,
        transform: { rotate: 0, flipH: false, flipV: false, brightness: 10, contrast: 0, saturation: 0, warmth: 0, sharpen: 0, vignette: 0 }
      })
      return result.ok ? result.data : null
    }, source!.id)
    expect(adjusted?.imageId).toBeTruthy()
    license.control('active')
    expect(pageErrors).toEqual([])
  })

  test('a library above 500 projects is paginated', async () => {
    await page.evaluate(async () => {
      for (let index = 0; index < 510; index += 1) {
        await window.moss.projects.create({ type: 'image', name: `Perf project ${index}` })
      }
    })
    await page.getByRole('link', { name: 'All work', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'All work', exact: true })).toBeVisible({ timeout: 20_000 })
    const total = await page.evaluate(async () => {
      const result = await window.moss.projects.list({ limit: 1 })
      return result.ok ? result.data.total : 0
    })
    expect(total).toBeGreaterThan(500)
    await expect(page.getByText(`${total} projects`, { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('article.lib-card')).toHaveCount(20)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('article.lib-card')).toHaveCount(20)
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'List view' }).click()
    await expect(page.locator('.lib-list-row')).toHaveCount(20)
    await page.getByLabel('Search projects').fill('Perf project 0')
    await expect(page.getByText('Perf project 0', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Page 1 of \d+/)).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
})
