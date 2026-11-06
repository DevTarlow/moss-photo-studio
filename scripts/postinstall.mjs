#!/usr/bin/env node
// npm can install Electron without running its own installer when lifecycle
// scripts are restricted. Make sure the binary exists; nothing else runs here.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const electronDir = path.join(process.cwd(), 'node_modules', 'electron')
const versionFile = path.join(electronDir, 'dist', 'version')
if (!fs.existsSync(versionFile) && fs.existsSync(path.join(electronDir, 'install.js'))) {
  try {
    execFileSync(process.execPath, [path.join(electronDir, 'install.js')], {
      cwd: electronDir,
      stdio: 'inherit',
      env: { ...process.env, electron_config_cache: path.join(process.cwd(), '.cache', 'electron') }
    })
  } catch {
    console.warn('Electron binary was not downloaded. Run node node_modules/electron/install.js before starting the app.')
  }
}
