#!/usr/bin/env node
/**
 * Release-only gate. The build:linux/win/mac scripts pass --release, so a
 * package build fails while the store URL or homepage is still the documented
 * placeholder. Normal development builds (`npm run build`) are unaffected.
 */
import fs from 'node:fs'

const release = process.env.MOSS_RELEASE === '1' || process.argv.includes('--release')
if (!release) {
  console.log('Release gate skipped (pass --release or set MOSS_RELEASE=1 for a release build).')
  process.exit(0)
}
if (process.env.MOSS_TEST_BUILD === '1') {
  console.error('Release gate: MOSS_TEST_BUILD=1 must not be used for a release build. Test overrides would be compiled in.')
  process.exit(1)
}
if (!fs.existsSync('LICENSE')) {
  console.error('Release gate: add the proprietary LICENSE file before release.')
  process.exit(1)
}
const constants = fs.readFileSync('src/shared/constants.ts', 'utf8')
if (/LICENSE_STORE_URL = 'https:\/\/example\.com\//.test(constants)) {
  console.error('Release gate: replace LICENSE_STORE_URL with the real product-site checkout URL before release.')
  process.exit(1)
}
if (/LICENSE_API_BASE = 'https:\/\/example\.com/.test(constants) || /LICENSE_PORTAL_URL = 'https:\/\/example\.com/.test(constants)) {
  console.error('Release gate: replace the placeholder license portal URLs before release.')
  process.exit(1)
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
if (String(pkg.homepage ?? '').includes('example.com')) {
  console.error('Release gate: replace the package.json homepage with the real product URL before release.')
  process.exit(1)
}
if (pkg.license !== 'SEE LICENSE IN LICENSE') {
  console.error('Release gate: package.json license must point at the proprietary LICENSE file.')
  process.exit(1)
}
console.log('Release gate passed.')
