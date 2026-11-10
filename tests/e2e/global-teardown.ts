import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PREFIXES = [
  'moss-e2e-',
  'moss-people-e2e-',
  'moss-products-e2e-',
  'moss-included-products-e2e-',
  'moss-library-select-e2e-'
]

/**
 * The serial journey creates hundreds of projects, so its app data must never
 * outlive the run. Specs remove their own folders; this is the safety net for a
 * failed teardown or an interrupted spec.
 */
export default function globalTeardown(): void {
  for (const entry of fs.readdirSync(os.tmpdir())) {
    if (!PREFIXES.some((prefix) => entry.startsWith(prefix))) continue
    const target = path.join(os.tmpdir(), entry)
    try {
      if (fs.statSync(target).isDirectory()) fs.rmSync(target, { recursive: true, force: true })
    } catch {
      // A folder that vanished or cannot be read is already clean enough.
    }
  }
}
