import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CREATE_PERSON_PROMPT } from '../../src/shared/starters'

test('Create a Person opens the generator and saves a generated image as a person', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-create-person-e2e-'))
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
    await page.evaluate(async () => {
      await window.moss.secrets.setMuseKey({ key: 'LLM|e2e-create-person' })
      await window.moss.settings.set({ key: 'firstRunConfirmShown', value: true })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Look Around First' }).waitFor({ timeout: 20_000 })
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Look Around First' }).click()
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'People', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Create a Person' }).click()

    await expect(page.getByText('DESCRIBE THE IMAGE')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Make a new person')).toBeVisible()
    await expect(page.getByText('Click a photo to load a starting description.')).toBeVisible()
    await expect(page.getByRole('button', { name: /A new person/ })).toBeVisible()
    await expect(page.locator('textarea').first()).toHaveValue(CREATE_PERSON_PROMPT)

    await page.getByRole('button', { name: /Create 1 Image/ }).click()
    await expect(page.getByText('Newest')).toBeVisible({ timeout: 30_000 })

    // The lightbox offers the same action as the result card.
    await page.getByRole('button', { name: /Open Created/ }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save as Person' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: 'Save as Person' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Save as Person' })).toBeVisible()
    await dialog.getByLabel('Person name').fill('Test Person')
    await dialog.getByRole('button', { name: 'Save Person' }).click()
    await expect(page.getByText('Saved to People.')).toBeVisible()

    await page.getByRole('link', { name: 'People', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
    await expect(page.getByText('Test Person', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Open Test Person larger' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Test Person' })).toBeVisible()
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
  }
})
