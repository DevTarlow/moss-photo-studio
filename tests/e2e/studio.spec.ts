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
  // Playwright's screenshot helper can restore the Electron viewport before
  // capturing. Small-window captures are regenerated rather than compared.
  const captureOnly = !compare || name.endsWith('-1024-light')
  await page.waitForTimeout(200)
  const file = path.join(screenshots, `${name}.png`)
  for (let wait = 0; wait < 20 && (await page.locator('.toast').count()) > 0; wait += 1) {
    await page.waitForTimeout(150)
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // Leave the pointer on neutral top-bar space and drop focus so
      // collapsed-nav tooltips and card hover actions do not become part of
      // the baseline.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.mouse.move(700, 10)
      await page.waitForTimeout(180)
      if (captureOnly || !fs.existsSync(file) || process.env.MOSS_UPDATE_SCREENS === '1') {
        await page.screenshot({ path: file, animations: 'disabled' })
      } else {
        await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.01, animations: 'disabled' })
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
  await page.getByRole('link', { name: 'Library', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
}

async function newSetFromLibrary(): Promise<void> {
  await gotoLibrary()
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('menuitem', { name: /^Set/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(productPhoto)
  await expect(page.getByRole('heading', { name: 'What do you sell?' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Ceramics and pottery' }).click()
  await expect(page.getByRole('button', { name: /Make \d+ Images/ })).toBeVisible({ timeout: 10_000 })
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

  test('activation, onboarding, and the first set', async () => {
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
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await screenshot('activation-dark')
    await assertNoSeriousA11y('activation-dark')
    await setAppTheme('light')
    await expect(page.getByRole('heading', { name: 'Activate Moss Photo Studio' })).toBeVisible({ timeout: 20_000 })
    await page.getByLabel('License key').fill('bad')
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByText("That key wasn't accepted. Check it and try again.")).toBeVisible()
    await page.getByLabel('License key').fill('MOSS-E2E-VALID-KEY')
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('heading', { name: "Your personal photo studio." })).toBeVisible({ timeout: 20_000 })
    await screenshot('onboarding')
    await assertNoSeriousA11y('onboarding')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700))
    await page.waitForTimeout(200)
    await noHorizontalOverflow()
    await screenshot('onboarding-1024-light')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    await setAppTheme('dark')
    await expect(page.getByRole('heading', { name: "Your personal photo studio." })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await screenshot('onboarding-dark')
    await assertNoSeriousA11y('onboarding-dark')
    await setAppTheme('light')
    await expect(page.getByRole('heading', { name: "Your personal photo studio." })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Set up the studio' }).click()
    await page.getByRole('button', { name: 'Where do I get a key?' }).click()
    const keyGuide = page.getByRole('dialog')
    await expect(keyGuide.getByRole('heading', { name: 'Get your Meta Muse key' })).toBeVisible()
    await expect(keyGuide.getByRole('listitem')).toHaveCount(6)
    await keyGuide.getByRole('button', { name: 'Got it' }).click()
    await expect(keyGuide).toBeHidden()
    await page.getByLabel('Muse key').fill('LLM|e2e-muse-key')
    await page.getByRole('button', { name: 'Test and connect' }).click()
    await expect(page.getByRole('heading', { name: 'Add your first product' })).toBeVisible({ timeout: 20_000 })
    await page.locator('input[type=file]').first().setInputFiles(productPhoto)
    await expect(page.getByText('Saved as a Product')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make it your own' })).toBeVisible({ timeout: 20_000 })
    await screenshot('onboarding-customize')
    await assertNoSeriousA11y('onboarding-customize')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Make your first photo set' })).toBeVisible({ timeout: 20_000 })
    const make = page.getByRole('button', { name: /Make 6 Images · \$0\.06/ }).first()
    await expect(make).toBeVisible({ timeout: 20_000 })
    const shots = page.getByRole('group', { name: 'Choose the shots' })
    const counts = page.getByRole('radiogroup', { name: 'How many images' })
    await expect(shots).toBeVisible()
    await screenshot('onboarding-first-set')
    await assertNoSeriousA11y('onboarding-first-set')
    await counts.getByRole('radio', { name: '3', exact: true }).click()
    await expect(page.getByRole('button', { name: /Make 3 Images · \$0\.03/ })).toBeVisible()
    await counts.getByRole('radio', { name: '6', exact: true }).click()
    await expect(page.getByRole('button', { name: /Make 6 Images · \$0\.06/ })).toBeVisible()
    const giftPill = shots.getByRole('button', { name: 'Gift-ready', exact: true })
    const giftExample = page
      .getByRole('group', { name: 'Shot examples' })
      .getByRole('button', { name: 'Gift-ready example', exact: true })
    await expect(giftExample).toHaveAttribute('aria-pressed', 'true')
    await giftPill.click()
    await expect(page.getByRole('button', { name: /Make 5 Images · \$0\.05/ })).toBeVisible()
    await expect(giftExample).toHaveAttribute('aria-pressed', 'false')
    await giftExample.click()
    await expect(page.getByRole('button', { name: /Make 6 Images · \$0\.06/ })).toBeVisible()
    await expect(giftPill).toHaveAttribute('aria-pressed', 'true')
    await make.focus()
    await page.keyboard.press('Space')
    const firstDialog = page.getByRole('dialog')
    await expect(firstDialog).toContainText('Meta charges your key $0.01')
    await page.waitForTimeout(350)
    await assertNoSeriousA11y('first-run-confirm', '[role="dialog"]')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const focusedText = await page.evaluate(() => document.activeElement?.textContent ?? '')
      if (focusedText.includes('Make 6 Images')) break
      await page.keyboard.press('Tab')
    }
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: "You're set up." })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Finish Setup' })).toBeVisible()
    // A made set leaves Finish Setup as the only exit; nothing else to open.
    await expect(page.getByRole('button', { name: 'Open Library' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Open Products' })).toBeHidden()
    const preview = page.getByRole('button', { name: 'Preview Main shot' })
    await expect(preview).toBeVisible()
    // ClickableCard keeps the accessible button under a pressable surface, so
    // the journey opens the preview the way a keyboard user does.
    await preview.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog').getByAltText('Main shot')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText("What's next")).toBeVisible()
    await expect(page.getByText('Find these in the studio rail whenever you need them.')).toBeVisible()
    await page.getByRole('button', { name: 'Finish Setup' }).click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New project' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'New Set', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Image Editor', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Image Generator', exact: true })).toBeVisible()
    await screenshot('library-light')
    await page.getByRole('link', { name: /Open product/ }).first().click()
    await expect(page.getByText('Your set is ready. 6 images.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('group', { name: 'Set phase' })).toBeVisible()
    await expect(page.getByText('Read-only', { exact: true })).toBeVisible()
    await screenshot('set-review')
    await assertNoSeriousA11y('set-review')
    expect(muse.requests().length).toBeGreaterThanOrEqual(6)
    expect(pageErrors).toEqual([])
  })

  test('a five-shot set costs five cents and makes five images', async () => {
    await newSetFromLibrary()
    const gift = page.getByRole('switch', { name: 'Gift-ready on' })
    await gift.click()
    const primary = page.getByRole('button', { name: /Make 5 Images · \$0\.05/ })
    await expect(primary).toBeVisible()
    await page.locator('.ws-left .scroll-area').evaluate((el) => { el.scrollTop = 0 })
    const planPanel = page.locator('.ws-left')
    const resizePlan = page.getByRole('separator', { name: 'Resize plan panel' })
    await expect(resizePlan).toBeVisible()
    const planWidth = (await planPanel.boundingBox())?.width ?? 0
    await resizePlan.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await planPanel.boundingBox())?.width ?? 0).toBeGreaterThan(planWidth)
    await expect(resizePlan).toHaveAttribute('aria-valuenow', '312')
    await page.keyboard.press('ArrowLeft')
    await expect.poll(async () => (await planPanel.boundingBox())?.width ?? 0).toBe(planWidth)
    await screenshot('set-plan')
    await assertNoSeriousA11y('set-plan')
    await primary.click()
    await expect(page.getByText('Stop After This Image')).toBeVisible({ timeout: 10_000 })
    await screenshot('set-running')
    await expect(page.getByText('Your set is ready. 5 images.')).toBeVisible({ timeout: 30_000 })
    await screenshot('set-five')
    expect(pageErrors).toEqual([])
  })

  test('a failed set shows the retry price and retries only the missing images', async () => {
    await newSetFromLibrary()
    muse.reset()
    muse.control('fail-indexes:2,5')
    await page.getByRole('button', { name: /Make 6 Images · \$0\.06/ }).click()
    await expect(page.getByText(/4 images made\. 2 did not come through\./)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Try the 2 Again · \$0\.02/ })).toBeVisible()
    await screenshot('set-partial')
    muse.control('normal')
    await page.getByRole('button', { name: /Try the 2 Again · \$0\.02/ }).click()
    await expect(page.getByText('Your set is ready. 6 images.')).toBeVisible({ timeout: 30_000 })
    expect(muse.requests()).toHaveLength(8)
    await screenshot('set-full')
    expect(pageErrors).toEqual([])
  })

  test('the editor makes a new version, compares, and applies a free local adjust', async () => {
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    const preview = page.getByRole('dialog', { name: 'Image preview' })
    await expect(preview).toBeVisible()
    await expect(preview.locator('img')).toHaveCSS('opacity', '1')
    const backdrop = page.locator('.lightbox-overlay')
    await expect(backdrop).toBeVisible()
    const blur = await backdrop.evaluate((element) => getComputedStyle(element).backdropFilter)
    expect(blur).toContain('blur')
    await screenshot('set-lightbox')
    await assertNoSeriousA11y('set-lightbox', '[role="dialog"]')
    await page.mouse.click(60, 450)
    await expect(preview).toBeHidden()
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await expect(preview).toBeVisible()
    await preview.getByRole('button', { name: 'Close preview' }).click()
    await expect(preview).toBeHidden()
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await page.getByRole('button', { name: /Open in Editor/ }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => menuEnabled('menu-copy-image')).toBe(true)
    expect(await menuEnabled('menu-export')).toBe(true)
    expect(await menuEnabled('menu-zoom-in')).toBe(true)
    expect(await menuEnabled('menu-toggle-panel')).toBe(true)
    expect(await menuEnabled('menu-undo')).toBe(false)
    expect(await menuEnabled('menu-paste-image')).toBe(true)
    await screenshot('photo-editor')
    await assertNoSeriousA11y('photo-editor')
    const editorPreview = page.getByRole('dialog', { name: 'Image preview' })
    await page.locator('.canvas-stage img').first().click()
    await expect(editorPreview).toBeVisible()
    await editorPreview.getByRole('button', { name: 'Close preview' }).click()
    await expect(editorPreview).toBeHidden()
    await page.getByRole('button', { name: 'Preview larger' }).click()
    await expect(editorPreview).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editorPreview).toBeHidden()
    await page.getByRole('button', { name: /Kitchen table/ }).first().click()
    await expect(page.getByLabel('Describe the change')).toHaveValue(/warm wooden kitchen table/)
    // Hold the run open long enough to check that the status text stays legible
    // over the photo; a normal fake reply lands in a fraction of a second.
    muse.control('slow')
    await page.getByRole('button', { name: /Make This Change · \$0\.01/ }).click()
    const runningStatus = page.locator('.canvas-stage [role="status"]')
    await expect(runningStatus).toBeVisible({ timeout: 10_000 })
    const statusColor = await runningStatus.locator('p').first().evaluate((element) => getComputedStyle(element).color)
    expect(statusColor).toBe('rgb(255, 255, 255)')
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
    const divider = page.locator('.compare-divider')
    await expect(divider).toBeVisible()
    const dividerBox = await divider.boundingBox()
    const stageBox = await page.locator('.canvas-stage').boundingBox()
    if (dividerBox && stageBox) {
      await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(stageBox.x + stageBox.width * 0.4, dividerBox.y + dividerBox.height / 2)
      await page.mouse.up()
    }
    expect(Number(await slider.inputValue())).toBeLessThan(100)
    await screenshot('photo-compare')
    await page.getByRole('button', { name: 'Done Comparing' }).click()
    const canvas = page.getByRole('group', { name: /Photo canvas/ })
    await canvas.focus()
    await page.keyboard.down('Space')
    await expect(page.locator('.canvas-stage').getByText('Original', { exact: true })).toBeVisible()
    await page.keyboard.up('Space')
    await page.getByRole('button', { name: /Local Adjust/ }).click()
    await page.getByRole('button', { name: '1:1', exact: true }).click()
    await page.getByRole('button', { name: /Right/, exact: true }).click()
    const brightness = page.getByRole('slider', { name: 'Brightness' })
    await brightness.focus()
    await page.keyboard.press('ArrowRight')
    const sharpen = page.getByRole('slider', { name: 'Sharpen' })
    await sharpen.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => menuEnabled('menu-undo')).toBe(true)
    await screenshot('photo-adjust-preview')
    await assertNoSeriousA11y('photo-adjust-preview')
    const crop = page.getByRole('group', { name: /Crop area/ })
    await expect(crop).toBeVisible()
    const fullCrop = await crop.boundingBox()
    await crop.focus()
    await page.keyboard.press('Alt+ArrowLeft')
    await expect.poll(async () => (await crop.boundingBox())?.width ?? 0).toBeLessThan(fullCrop?.width ?? 0)
    const narrowCrop = await crop.boundingBox()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await crop.boundingBox())?.x ?? 0).toBeGreaterThan(narrowCrop?.x ?? 0)
    await page.getByRole('button', { name: '1:1', exact: true }).click()
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
      const read = await window.moss.app.readClipboardImage()
      return {
        copied: copied.ok,
        read: read.ok ? { mime: read.data.mime, size: read.data.bytes?.byteLength ?? 0 } : null
      }
    })
    expect(clipboardCheck?.copied).toBe(true)
    expect(clipboardCheck?.read?.mime).toMatch(/^image\//)
    expect(clipboardCheck?.read?.size ?? 0).toBeGreaterThan(1000)
    expect(pageErrors).toEqual([])
  })

  test('create makes four images and opens one in the editor', async () => {
    await page.keyboard.press('Control+3')
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Examples', { exact: true })).toBeVisible()
    await expect.poll(() => menuEnabled('menu-toggle-panel')).toBe(true)
    expect(await menuEnabled('menu-zoom-in')).toBe(false)
    expect(await menuEnabled('menu-export')).toBe(false)
    await screenshot('create-empty')
    await assertNoSeriousA11y('create-empty')
    await expect(page.getByRole('button', { name: /Create 1 Image · \$0\.01/ })).toBeVisible()
    await page.getByRole('button', { name: 'Start from an Idea' }).click()
    const personCategory = page.getByText('With a person', { exact: true })
    await expect(personCategory).toBeVisible()
    await expect(personCategory).toHaveCSS('font-weight', '700')
    await page.getByRole('button', { name: 'Holding it', exact: true }).click()
    await expect(page.locator('textarea').first()).toHaveValue(/holding the product/i)
    await page.getByRole('group', { name: 'How many images' }).getByRole('button', { name: '4', exact: true }).click()
    await page.locator('textarea').first().fill('A ceramic mug alone on a pure white background, centred and filling most of the frame, soft even lighting, product photo.')
    await expect(page.getByRole('button', { name: /Create 4 Images · \$0\.04/ })).toBeVisible()
    await page.getByRole('button', { name: /Create 4 Images · \$0\.04/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('separator', { name: 'Resize runs panel' })).toBeVisible()
    await expect.poll(() => menuEnabled('menu-export')).toBe(true)
    await screenshot('create-results')
    await assertNoSeriousA11y('create-results')
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Back to Image Generator' })).toBeVisible({ timeout: 20_000 })
    await screenshot('create-photo')
    expect(pageErrors).toEqual([])
  })

  test('export set writes six named files and a plain set.txt', async () => {
    await gotoLibrary()
    const card = page.locator('article.lib-card').filter({ hasText: '6 images' }).first()
    await card.getByRole('link', { name: /Open/ }).click()
    await expect(page.getByRole('button', { name: 'Export Set', exact: true })).toBeVisible({ timeout: 20_000 })
    await stubDialogs()
    await page.getByRole('button', { name: 'Export Set', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await page.waitForTimeout(350)
    await assertNoSeriousA11y('export-set-dialog', '[role="dialog"]')
    await dialog.getByRole('button', { name: 'Export', exact: true }).click()
    await expect.poll(() => fs.existsSync(path.join(exportFolder, 'set.txt')), { timeout: 20_000 }).toBe(true)
    const files = fs.readdirSync(exportFolder)
    const images = files.filter((file) => file.endsWith('.webp'))
    expect(images.length).toBe(6)
    expect(files).not.toContain('source.jpg')
    expect(images.sort()).toEqual([
      '01-main-shot.webp',
      '02-in-use.webp',
      '03-close-up.webp',
      '04-size-reference.webp',
      '05-flat-lay.webp',
      '06-gift-ready.webp'
    ])
    await expect(page.getByText(/6 images exported to "exports"\./)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Open Folder' })).toBeVisible()
    const manifest = fs.readFileSync(path.join(exportFolder, 'set.txt'), 'utf8')
    expect(manifest).toContain('Shot:')
    expect(manifest).toContain('Direction:')
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
    await expect(ledgerRows).toHaveCount(20)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible({ timeout: 15_000 })
    expect(await ledgerRows.count()).toBeGreaterThan(0)
    const before = await spendCents()
    expect(before).toBeGreaterThan(0)
    await stubDialogs()
    await page.getByRole('button', { name: /Export CSV/ }).click()
    await expect.poll(() => fs.readdirSync(exportFolder).some((file) => file.endsWith('.csv')), { timeout: 15_000 }).toBe(true)
    const csv = fs.readdirSync(exportFolder).find((file) => file.endsWith('.csv'))!
    const contents = fs.readFileSync(path.join(exportFolder, csv), 'utf8')
    const rows = contents.trim().split('\n')
    expect(rows[0]).toBe('date,project,action,requested,returned,cost_usd,duration_ms,result,error')
    expect(rows.length).toBeGreaterThan(2)
    const csvCents = rows.slice(1).reduce((sum, row) => sum + Math.round(Number(row.split(',')[5]) * 100), 0)
    expect(csvCents).toBe(before)
    await page.locator('#budget').fill('0.23')
    await page.getByRole('button', { name: 'Save Limit' }).click()
    await expect(page.getByText('Monthly limit saved.').last()).toBeVisible()
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ hasText: '6 images' }).first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByRole('button', { name: 'Make More' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Make More' }).click()
    await expect(page.getByText(/This run would pass your \$0\.23 monthly limit/)).toBeVisible()
    await page.getByRole('button', { name: 'Make Fewer Images' }).click()
    await expect(page.getByText(/This run would pass your \$0\.23 monthly limit/)).toBeHidden()
    await expect(page.getByRole('button', { name: /Remake 1 Image · \$0\.01/ })).toBeVisible()
    await page.getByRole('link', { name: 'Usage', exact: true }).first().click()
    await page.locator('#budget').fill('10.00')
    await page.getByRole('button', { name: 'Save Limit' }).click()
    await expect(page.getByText('Monthly limit saved.').last()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('people, settings, dark theme, persistence, keyboard zoom, and accessibility', async () => {
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
    await expect
      .poll(() =>
        personDialog
          .locator('img')
          .evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0))
      )
      .toBe(true)
    await screenshot('people-looks')
    await assertNoSeriousA11y('people-looks', '[role="dialog"]')
    await personDialog.getByRole('button', { name: 'Close' }).last().click()
    await expect(personDialog).toBeHidden()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('link', { name: 'API key', exact: true })).toBeVisible()
    await screenshot('settings-light')
    await assertNoSeriousA11y('settings-light')
    await page.getByRole('link', { name: 'Logo & Colors', exact: true }).click()
    await expect(page.locator('.brand-preview')).toBeVisible()
    await page.getByRole('link', { name: 'Appearance', exact: true }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await screenshot('settings-dark')
    await page.getByRole('link', { name: 'Products', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await screenshot('products-dark')
    await assertNoSeriousA11y('products-dark')
    await gotoLibrary()
    await screenshot('library-dark')
    await assertNoSeriousA11y('library-dark')
    await page.locator('article.lib-card').filter({ hasText: '6 images' }).first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByRole('button', { name: /Main shot of the product/ }).first()).toBeVisible()
    await screenshot('set-dark')
    await assertNoSeriousA11y('set-dark')
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await page.getByRole('button', { name: /Open in Editor/ }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 15_000 })
    await screenshot('photo-dark')
    await assertNoSeriousA11y('photo-dark')
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ has: page.getByText('Image Generator', { exact: true }) }).first().getByRole('link', { name: /Open/ }).click()
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
    await expect(page.getByRole('heading', { name: 'API key', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('settings-1024-light')
    await page.getByRole('link', { name: 'Products', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('products-1024-light')
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ hasText: '6 images' }).first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByRole('button', { name: /Main shot of the product/ }).first()).toBeVisible()
    await noHorizontalOverflow()
    await screenshot('set-1024-light')
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await page.getByRole('button', { name: /Open in Editor/ }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 15_000 })
    await noHorizontalOverflow()
    await screenshot('photo-1024-light')
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ has: page.getByText('Image Generator', { exact: true }) }).first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await noHorizontalOverflow()
    await screenshot('create-1024-light')
    await gotoLibrary()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1.5))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1.5))
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await screenshot('library-zoom-150', false)
    await assertNoSeriousA11y('library-zoom-150')
    await page.locator('article.lib-card').first().getByRole('link', { name: /Open/ }).click()
    await page.waitForTimeout(400)
    const workspaceOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(workspaceOverflow).toBeLessThanOrEqual(1)
    await expect(page.locator('.ws-bottom .btn-primary')).toBeVisible()
    await screenshot('set-zoom-150', false)
    await page.getByRole('link', { name: 'People', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await page.getByRole('link', { name: 'Usage', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'API key', exact: true })).toBeVisible()
    await noHorizontalOverflow()
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ has: page.getByText('Image Generator', { exact: true }) }).first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByRole('button', { name: 'Describe', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Describe', exact: true }).click()
    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 10_000 })
    await noHorizontalOverflow()
    await page.keyboard.press('Escape')
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ hasText: '6 images' }).first().getByRole('link', { name: /Open/ }).click()
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await page.getByRole('button', { name: /Open in Editor/ }).click()
    await expect(page.getByRole('button', { name: 'Open change panel' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Open change panel' }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 10_000 })
    await noHorizontalOverflow()
    await page.keyboard.press('Escape')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900))
    expect(pageErrors).toEqual([])
  })

  test('generation goes offline in plain words without a cost, and the library still works', async () => {
    muse.control('offline')
    await gotoLibrary()
    await page.locator('article.lib-card').filter({ hasText: '6 images' }).first().getByRole('link', { name: /Open/ }).click()
    await page.getByRole('button', { name: /Main shot of the product/ }).first().click()
    await page.getByRole('button', { name: /Open in Editor/ }).click()
    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 15_000 })
    const before = await spendCents()
    await page.getByRole('button', { name: /Quick fix/ }).click()
    await page.getByRole('button', { name: /Make This Change/ }).click()
    await expect(page.getByText(/The request timed out\./)).toBeVisible({ timeout: 20_000 })
    expect(await spendCents()).toBe(before)
    await page.getByRole('link', { name: 'Library', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
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

  test('the Muse key can be tested, replaced, and removed without exposing it', async () => {
    muse.control('normal')
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'API key', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Test Connection' }).click()
    await expect(page.getByText('Connection checked.')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
    await page.getByLabel('Muse key').fill('LLM|e2e-replacement-key-WXYZ')
    await page.getByRole('button', { name: 'Test and Save' }).click()
    await expect(page.getByText(/WXYZ/).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toContainText('Remove the Muse key?')
    await confirm.getByRole('button', { name: 'Remove Key' }).click()
    await expect(page.getByLabel('Muse key')).toBeVisible({ timeout: 15_000 })
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
    await expect(page.getByText("License checks resume when you're connected.", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Settings' }).first()).toBeVisible()
    await expect(page.getByText('Finish setting up')).toHaveCount(0)
    await expect(page.getByText('Make a first set')).toHaveCount(0)
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
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
    await screenshot('license-expired-readonly')
    await page.locator('article.lib-card').first().getByRole('link', { name: /Open/ }).click()
    await expect(page.getByText(/Reactivate to make images/).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Export/ }).first()).toBeVisible()
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
    const exported = await page.evaluate(async ({ id, imageId }) => {
      const result = await window.moss.exports.images({
        projectId: id,
        imageIds: [imageId],
        options: { format: 'webp', quality: 90, maxDimension: null }
      })
      return result.ok ? result.data : null
    }, { id: projectId, imageId: adjusted!.imageId })
    expect(exported?.count).toBe(1)
    expect(fs.readdirSync(exportFolder).some((file) => file.endsWith('.webp'))).toBe(true)
    license.control('active')
    expect(pageErrors).toEqual([])
  })

  test('a library above 500 projects is paginated', async () => {
    await page.evaluate(async () => {
      for (let index = 0; index < 510; index += 1) {
        await window.moss.projects.create({ type: 'image', name: `Perf project ${index}` })
      }
    })
    await page.getByRole('link', { name: 'Library', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({ timeout: 20_000 })
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
