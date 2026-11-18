#!/usr/bin/env node
/**
 * Compiles every appearance theme with Astryx and, in `--check` mode, verifies
 * the committed output is current (the release gate and every packaged build
 * run that).
 *
 * Usage:
 *   node scripts/theme-build.mjs            # write src/renderer/src/theme/built/
 *   node scripts/theme-build.mjs --check    # verify, write nothing
 *
 * One theme per source file is the Astryx build contract: `astryx theme build`
 * refuses `--out` with several files, and each source must import the icon
 * registry itself. Paths stay relative so the generated command header is
 * stable across machines.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { THEME_IDS } = await import(new URL('../src/shared/themes.ts', import.meta.url).href)

const check = process.argv.includes('--check')
const themeDir = 'src/renderer/src/theme/themes'
const builtDir = 'src/renderer/src/theme/built'
const absoluteBuiltDir = path.join(root, builtDir)
const cli = path.join(root, 'node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs')

if (!check) fs.mkdirSync(absoluteBuiltDir, { recursive: true })

let failures = 0

for (const id of THEME_IDS) {
  const source = path.posix.join(themeDir, `${id}.ts`)
  if (!fs.existsSync(path.join(root, source))) {
    console.error(`[theme] missing source ${source}`)
    failures += 1
    continue
  }
  const output = path.posix.join(builtDir, `${id}.css`)
  const args = [cli, 'theme', 'build', source, '--out', output, ...(check ? ['--check'] : [])]
  try {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  } catch {
    failures += 1
  }
}

// A renamed or removed theme must not leave stale CSS/JS behind, or Vite would
// still ship it. The declaration files are optional because Astryx only emits
// them when the theme has something to declare.
const suffixes = ['.css', '.js', '.d.ts', '.variants.d.ts', '.css.d.ts']
if (fs.existsSync(absoluteBuiltDir)) {
  const expected = new Set(THEME_IDS.flatMap((id) => suffixes.map((suffix) => `${id}${suffix}`)))
  for (const file of fs.readdirSync(absoluteBuiltDir)) {
    if (expected.has(file)) continue
    const known = THEME_IDS.some((id) => file.startsWith(`${id}.`))
    if (known) continue
    console.error(`[theme] unexpected output ${path.posix.join(builtDir, file)}`)
    if (check) failures += 1
  }
}

if (failures) {
  console.error(`\n${failures} theme build(s) failed.`)
  process.exit(1)
}
console.log(check ? '\nAll theme outputs are up to date.' : '\nBuilt all theme outputs.')
