#!/usr/bin/env node
/**
 * Build the .deb from the electron-builder Linux unpacked tree.
 *
 * electron-builder's bundled fpm calls lchown on every staged file. The
 * project filesystem used for this build maps new files to nobody:nogroup and
 * refuses that chown (EINVAL), even though the package itself is fine. This
 * script produces the same Debian package with dpkg-deb and --root-owner-group.
 * electron-builder's deb target remains configured; on a normal filesystem it
 * works. See DECISIONS.md.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve('.')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const unpacked = path.join(root, 'release', 'linux-unpacked')
if (!fs.existsSync(unpacked)) {
  console.error('release/linux-unpacked is missing. Run electron-builder --linux first.')
  process.exit(1)
}
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
const version = pkg.version
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-deb-'))
fs.mkdirSync(path.join(stage, 'DEBIAN'), { recursive: true })
const appDir = path.join(stage, 'opt', 'Moss Photo Studio')
fs.cpSync(unpacked, appDir, { recursive: true, verbatimSymlinks: true })
fs.chmodSync(path.join(appDir, 'chrome-sandbox'), 0o4755)
fs.mkdirSync(path.join(stage, 'usr', 'share', 'applications'), { recursive: true })
fs.writeFileSync(
  path.join(stage, 'usr', 'share', 'applications', 'moss-photo-studio.desktop'),
  `[Desktop Entry]
Name=Moss Photo Studio
Comment=A photo studio for people who sell things
Exec="/opt/Moss Photo Studio/moss-photo-studio" %U
Terminal=false
Type=Application
Icon=moss-photo-studio
Categories=Graphics;Photography;
StartupWMClass=moss-photo-studio
`,
  { mode: 0o644 }
)
for (const size of [512, 1024]) {
  const iconFolder = path.join(stage, 'usr', 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps')
  fs.mkdirSync(iconFolder, { recursive: true })
  fs.copyFileSync(path.join(root, 'resources', 'brand', size === 512 ? '512x512.png' : 'icon.png'), path.join(iconFolder, 'moss-photo-studio.png'))
  fs.chmodSync(path.join(iconFolder, 'moss-photo-studio.png'), 0o644)
}
fs.mkdirSync(path.join(stage, 'usr', 'share', 'doc', 'moss-photo-studio'), { recursive: true })
fs.copyFileSync(path.join(root, 'LICENSES.md'), path.join(stage, 'usr', 'share', 'doc', 'moss-photo-studio', 'copyright'))

const installedKb = Number(
  execFileSync('du', ['-sk', appDir], { encoding: 'utf8' }).trim().split(/\s+/)[0]
)
const control = `Package: moss-photo-studio
Version: ${version}
Section: graphics
Priority: optional
Architecture: ${arch}
Maintainer: Moss Toolbox <support@mosstoolbox.com>
Installed-Size: ${installedKb}
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Homepage: ${pkg.homepage}
Description: A photo studio for people who sell things
 Turn one product photo into a full listing set, change a photo you already
 have, or describe a new image. The studio runs on this computer and keeps
 the library in a folder you own.
`
fs.writeFileSync(path.join(stage, 'DEBIAN', 'control'), control, { mode: 0o644 })
fs.chmodSync(path.join(stage, 'DEBIAN'), 0o755)
for (const name of fs.readdirSync(path.join(stage, 'DEBIAN'))) {
  fs.chmodSync(path.join(stage, 'DEBIAN', name), name === 'control' ? 0o644 : 0o755)
}
fs.writeFileSync(
  path.join(stage, 'DEBIAN', 'postinst'),
  `#!/bin/sh
set -e
if [ -f "/opt/Moss Photo Studio/chrome-sandbox" ]; then
  chmod 4755 "/opt/Moss Photo Studio/chrome-sandbox" || true
fi
exit 0
`,
  { mode: 0o755 }
)
fs.writeFileSync(
  path.join(stage, 'DEBIAN', 'postrm'),
  `#!/bin/sh
set -e
exit 0
`,
  { mode: 0o755 }
)
const output = path.join(root, 'release', `Moss Photo Studio-${version}-${arch}.deb`)
execFileSync('dpkg-deb', ['--root-owner-group', '--build', stage, output], { stdio: 'inherit' })
fs.rmSync(stage, { recursive: true, force: true })
console.log(`deb written: ${path.relative(root, output)}`)
