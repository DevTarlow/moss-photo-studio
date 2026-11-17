# Licenses and provenance

Moss Photo Studio is proprietary software from Moss Toolbox. Copyright (c) 2026 Moss Toolbox. All rights reserved. The source is published for inspection only; using the app requires a paid license under [docs/eula.md](docs/eula.md). See [LICENSE](LICENSE). You may not redistribute the source, a modified build, or the bundled reference imagery as your own. Third-party components keep the licenses below.

Third-party components keep their own licenses. The full text of each package's license is included in its npm package and, for the packaged application, in the application archive. The fonts and their OFL texts are also copied to `resources/licenses` and packaged with the app.

## Application and build stack

| Component | License | Source |
| --- | --- | --- |
| Electron | MIT | https://github.com/electron/electron |
| Chromium and Electron's Chromium notices | BSD-style and third-party notices | included as `LICENSE.electron.txt` and `LICENSES.chromium.html` in the packaged app |
| Node.js runtime inside Electron | MIT and third-party notices | https://nodejs.org |
| React and React DOM | MIT | https://github.com/facebook/react |
| React Router | MIT | https://github.com/remix-run/react-router |
| Zustand | MIT | https://github.com/pmndrs/zustand |
| Radix UI | MIT | https://github.com/radix-ui/primitives |
| Astryx (`@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@astryxdesign/cli`) | MIT | https://github.com/meta/astryx |
| lucide-react and Lucide icons | ISC | https://github.com/lucide-icons/lucide |
| clsx | MIT | https://github.com/lukeed/clsx |
| zod | MIT | https://github.com/colinhacks/zod |
| better-sqlite3 | MIT | https://github.com/WiseLibs/better-sqlite3 |
| SQLite | Public domain | https://sqlite.org/copyright.html |
| sharp | Apache-2.0 | https://github.com/lovell/sharp |
| libvips, bundled by sharp | LGPL-3.0-or-later | https://github.com/libvips/libvips |
| Tailwind CSS and the Vite plugin | MIT | https://github.com/tailwindlabs/tailwindcss |
| Vite | MIT | https://github.com/vitejs/vite |
| electron-vite | MIT | https://github.com/alex8088/electron-vite |
| electron-builder | MIT | https://github.com/electron-userland/electron-builder |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Vitest | MIT | https://github.com/vitest-dev/vitest |
| Playwright | Apache-2.0 | https://github.com/microsoft/playwright |
| axe-core | MPL-2.0 | https://github.com/dequelabs/axe-core |
| png2icons | MIT | https://github.com/idesis-gmbh/png2icons |
| png-to-ico | MIT | https://github.com/steambap/png-to-ico |

The exact versions are in `package-lock.json`. `npm run build` does not remove the license files that ship inside the native packages.

## Fonts

| Font | Files | License |
| --- | --- | --- |
| Inter | `resources/fonts/Inter-400.woff2`, `Inter-500.woff2`, `Inter-600.woff2`, `Inter-700.woff2` | SIL Open Font License 1.1, see `resources/licenses/OFL-Inter.txt` |
| Plus Jakarta Sans | `resources/fonts/PlusJakarta-600.woff2`, `PlusJakarta-700.woff2`, `PlusJakarta-800.woff2` | SIL Open Font License 1.1, see `resources/licenses/OFL-PlusJakartaSans.txt` |

Both families are self-hosted. The app has no font CDN request.

## Bundled imagery

| Asset | Provenance | License |
| --- | --- | --- |
| `resources/brand/mark.png`, `icon.png`, `512x512.png`, `icon-256.png`, `icon.icns`, `icon.ico` | The Moss mark and icon renditions generated from it for this app | © 2026 Moss Toolbox, supplied with the app |
| `resources/tiles/*.webp` (16 editor examples) | Reference renders made for the Moss Photo Studio interface | © 2026 Moss Toolbox, supplied with the app |
| `resources/tiles/scenes/*.webp` (8 scene examples) | Reference renders made for the Moss Photo Studio interface | © 2026 Moss Toolbox, supplied with the app |
| `resources/tiles/models/<person>/*.webp` (96 model references) | Synthetic people reference renders, one set per bundled person, made for the Moss Photo Studio interface. They are not photographs of real customers | © 2026 Moss Toolbox, supplied with the app |
| `resources/tiles/examples/*.webp` (8 empty state and starter examples) | Reference renders made for the Moss Photo Studio interface | © 2026 Moss Toolbox, supplied with the app |
| `resources/people/*.webp` and `*-portrait.webp` (12 people, 24 files) | Synthetic reference people made for the app. Names and one-line descriptions are fictional | © 2026 Moss Toolbox, supplied with the app |

The app's interface labels these as examples and synthetic. They are not sold as stock imagery and are not a license for a seller's own product photography.

## User content

Product photos, logos, person photos, prompts, edits, and generated images belong to the person using the app. The app claims no license over them. They are sent to Meta only when the seller asks for an image to be made, and to the license store only as described in `docs/privacy.md`.

## Trademarks

Meta, Muse, and Lemon Squeezy are trademarks of their respective owners. This app is not endorsed by them. The names are used only to describe the services the seller connects.
