import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  snapshotPathTemplate: 'tests/screenshots/{arg}{ext}',
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' }
  },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})
