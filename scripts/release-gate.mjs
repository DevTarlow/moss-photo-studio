#!/usr/bin/env node
/**
 * Release-only gate. `MOSS_RELEASE=1 npm run release:gate` fails while the
 * store URL is still the documented placeholder. Normal development builds
 * are unaffected.
 */
import fs from 'node:fs'

if (process.env.MOSS_RELEASE !== '1') {
  console.log('Release gate skipped (set MOSS_RELEASE=1 for a release build).')
  process.exit(0)
}
const constants = fs.readFileSync('src/shared/constants.ts', 'utf8')
if (/LICENSE_STORE_URL = 'https:\/\/example\.com\//.test(constants)) {
  console.error('Release gate: replace LICENSE_STORE_URL with the real store URL before release.')
  process.exit(1)
}
console.log('Release gate passed.')
