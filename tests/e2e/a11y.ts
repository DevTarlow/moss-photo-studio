import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'
import fs from 'node:fs'
import path from 'node:path'

/** Shared axe gate for focused specs that open dialogs outside the serial journey. */
export async function assertNoSeriousA11y(page: Page, where: string, selector = 'body'): Promise<void> {
  // Let dialog entrance opacity settle before axe computes contrast.
  await page.waitForTimeout(350)
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
