import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('the editor pans the zoomed canvas with the middle mouse button', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-photo-pan-'))
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
    await page.getByRole('button', { name: 'Skip for Now' }).click({ timeout: 20_000 })

    // Seed a product from canvas bytes and open the Image Editor on it, so the
    // spec needs no Meta request or generation.
    const projectId = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 900
      const context = canvas.getContext('2d')!
      context.fillStyle = '#d8cdbd'
      context.fillRect(0, 0, 1200, 900)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const product = await window.moss.products.createFromBytes({ bytes, name: 'Pan test product' })
      if (!product.ok) return null
      const created = await window.moss.products.createProject({ productId: product.data.id, type: 'photo' })
      return created.ok ? created.data.project.id : null
    })
    expect(projectId).toBeTruthy()
    await page.evaluate((id) => {
      window.location.hash = `#/project/${id}`
    }, projectId)

    await expect(page.getByText('CHANGE THIS PHOTO')).toBeVisible({ timeout: 20_000 })
    const stage = page.locator('.canvas-stage')
    await expect(stage).toHaveAttribute('data-zoomed', 'false')

    // At Fit the stage has nothing to scroll, so a middle drag must do nothing.
    const fitted = await stage.boundingBox()
    expect(fitted).not.toBeNull()
    await page.mouse.move(fitted!.x + fitted!.width / 2, fitted!.y + fitted!.height / 2)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(fitted!.x + fitted!.width / 2 - 120, fitted!.y + fitted!.height / 2 - 80, { steps: 4 })
    await page.mouse.up({ button: 'middle' })
    expect(await stage.evaluate((element) => element.scrollLeft + element.scrollTop)).toBe(0)

    // Past Fit the photo overflows. The dragged photo follows the pointer, so
    // the scroll offsets move against the drag and the cursor says so.
    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    for (let click = 0; click < 5; click += 1) await zoomIn.click()
    await expect(stage).toHaveAttribute('data-zoomed', 'true')
    const before = await stage.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }))
    const bounds = await stage.boundingBox()
    expect(bounds).not.toBeNull()
    const startX = bounds!.x + bounds!.width / 2
    const startY = bounds!.y + bounds!.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down({ button: 'middle' })
    await expect(stage).toHaveAttribute('data-panning', 'true')
    await page.mouse.move(startX - 120, startY - 80, { steps: 8 })
    await page.mouse.up({ button: 'middle' })
    await expect(stage).not.toHaveAttribute('data-panning', 'true')
    const after = await stage.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }))
    expect(after.left - before.left).toBeGreaterThan(100)
    expect(after.top - before.top).toBeGreaterThan(60)
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
