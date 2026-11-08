# Moss Photo Studio

A local-first photo studio for people who sell things. Turn one product photo into a full listing set, change a photo you already have, or describe a new image. The library lives in a folder you own. Images, plans, products, people, and usage stay on the computer.

This is the sibling application to `../moss-toolbox`. It is an Electron desktop app built with React, TypeScript, Vite, and SQLite.

## What is in the app

- **App shell** with one rail: Studio (Library, Products, People, Usage), Tools (Set Creator, Image Editor, Image Generator), and Settings. The top-bar New menu launches the same three tools from any main screen. While Settings is open, its sections use the same rail.
- **Library** with sets, photos, and images, search, filters, sorting, grid and list views, project duplication, rename, hover-select multi-delete, an explicit Select mode, delete, and export. Projects show 20 per page with Previous/Next controls.
- **Set Creator** from 1 to 8 listing shots. Start from an upload, a saved Product, or any ready library image. Each shot can be switched off, renamed, described, assigned a person, or given a feature line. The plan saves automatically.
- **Connection icons** for Main shot, In use, Close-up, Size reference, Flat lay, Gift-ready, Feature callout, and On a person.
- **Image Editor** with 32 tiles in six groups, 12 bundled people plus your own, a free local adjust panel with arrow-key crop, resizable panels, version labels, branching, a filmstrip, compare, export, and copy. Start from a file, a Product, or a library image, and add another source later as a new version.
- **Image Generator** with 30 starters, including person ideas for holding, wearing, and using the item, one to four images, three shapes, and three formats. A product reference and a person reference can be sent together, so a person can hold a product. A new generator project appears in the Library only after its first image.
- **Local adjust** for crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, and vignette. It makes a new version and never resends the product to an image service.
- **Products** for saving a generated image, editor version, or set shot as a named, reusable product photo. Products and any library image can be chosen wherever a source photo is needed; the page has search, sort, counts, and 20 per page.
- **People** with 12 included synthetic reference people plus your own portraits, search, sort, counts, and rename or remove for your own. A person is reused as a reference in sets, the editor, and the generator.
- **Logo & Colors** with up to six colors, a logo, and corner badge position, size, and opacity. Colors steer backgrounds and props in sets and photo changes while their toggle is on; turning it off keeps the saved colors but adds none to a prompt. The badge is composited locally.
- **First run** opens in light mode with a Welcome screen and four setup steps: connect Meta, add the first product, make an optional first set, and a ready screen. The first photo is saved as a reusable Product; a set project is created only when the seller chooses to make images. All six recipe shots start selected, with 1, 3, or all presets. Opening Logo & Colors from setup leaves the setup resumable from the Library. The theme, logo, colors, density, and reduce-motion live in Settings.
- **Usage ledger** with the real returned-image cost, $0.01 per returned image, a monthly budget, and CSV export. Project spending and ledger rows show 20 per page.
- **License activation** with a 14 day offline grace window and a read-only library when the license ends.
- **Desktop packaging** for Linux AppImage and deb. Windows NSIS and macOS DMG configuration is present and unverified.

## Requirements

- Node.js 22 or newer, npm 10 or newer.
- Linux build host for Linux packages. Windows and macOS packages must be built on their own platforms.
- Network access for the first `npm install` so Electron and native packages can be downloaded.

## Run it

```bash
npm install
npm run dev
```

The `dev` and `start` scripts pass electron-vite's `--noSandbox`, which launches Electron without Chromium's sandbox. This avoids the startup failure when the repository lives on a filesystem that cannot provide a root-owned setuid `chrome-sandbox` helper, such as an NTFS mount with `nosuid`. It affects local development only; packaged builds keep the sandbox.

The dev app uses the same application data folder as an installed build, so `npm run dev` opens the same library. Point `MOSS_USER_DATA_DIR` at a scratch folder to keep development data separate:

```bash
MOSS_USER_DATA_DIR="$HOME/moss-dev-data" npm run dev
```

`MOSS_DEV_UNLOCK=1` skips the license check, and `MOSS_MUSE_FAKE=1` uses a local fake image client instead of Meta. With the fake client, nothing leaves the computer and a red **FAKE MODE** chip appears in Settings and Help, About:

```bash
MOSS_DEV_UNLOCK=1 MOSS_MUSE_FAKE=1 npm run dev
```

## Test it

```bash
npm test
npm run typecheck
npm run test:e2e
npm run audit:tokens
npm run lint
```

`npm test` runs the unit and integration suites against the fake Muse and Lemon Squeezy hosts. `npm run test:e2e` builds the app and runs the serial studio journey — activation with a fake key, onboarding, the library, set, editor, generator, usage, products, people, settings, dark theme, and the 1024 and 150% layouts — plus focused specs for onboarding, products, people, and library selection. The journey runs axe checks and compares the screenshots under `tests/screenshots`. Set `MOSS_UPDATE_SCREENS=1` on the first run after an intentional visual change to write new baselines. The 1440 by 900 light and dark images are compared with a maximum diff ratio of 0.01. The 1024 by 700 images are captured fresh each run because Playwright's screenshot helper can restore the Electron viewport, and the 150% zoom images are capture-only.

The E2E suite uses `MOSS_E2E=1`, `MOSS_MUSE_BASE_URL`, and `MOSS_LICENSE_API_BASE` only in an unpackaged development build. `MOSS-E2E-VALID-KEY` is a fake key. No test sends a real key or reaches Meta or Lemon Squeezy.

## Build packages

```bash
npm run build:linux
```

The files appear under `release/`:

- `Moss Photo Studio-1.0.0-x86_64.AppImage`
- `Moss Photo Studio-1.0.0-amd64.deb`

The deb also has the standard `/opt/Moss Photo Studio` layout, a desktop entry, hicolor icons, and a `postinst` that makes the Chromium sandbox helper setuid. The AppImage does not carry setuid permissions. On distributions that block unprivileged sandbox setup, run it with `--no-sandbox` or enable unprivileged user namespaces. Ubuntu 22.04 usually includes FUSE 2. Ubuntu 24.04 and newer need the `libfuse2t64` package to run an AppImage directly, or `--appimage-extract-and-run`.

Windows and macOS:

```bash
npm run build:win
npm run build:mac
```

Those targets are configured but were not built in this environment. They will need signing certificates for distribution. The app has no auto-update channel.

## Data and secrets

The default library is under the application data folder shown in **Settings, Storage**:

- Linux: usually `~/.config/Moss Photo Studio/library`
- Windows: `%APPDATA%\Moss Photo Studio\library`
- macOS: `~/Library/Application Support/Moss Photo Studio/library`

The SQLite database is in the application data folder. The library contains:

```text
library/
  brand/
  people/
  products/       saved product copies and thumbnails
  projects/<project-id>/
    source.<ext>    byte-for-byte imported source images
    working/        sharp-normalized copies used for requests and thumbnails
    images/         edited and generated images
    thumbs/         visible thumbnails
    exports/        exported images by timestamp
  ...
```

The Muse key is stored in `secrets.bin`, encrypted with Electron `safeStorage` when a system keyring is available. If no keyring is available, the app falls back to AES-256-GCM with a local key protected with file mode `0600`, and Settings shows a warning. The license key is stored encrypted in `license.json` and in the SQLite license row. No key is ever returned from the main process to the renderer, logged, or placed in a URL. Settings displays only the last four characters.

No telemetry is sent. See [docs/privacy.md](docs/privacy.md).

## Architecture

```text
src/
  main/          Electron main process, SQLite, files, sharp, Muse requests,
                 license, queue, secrets, menus, moss-media protocol
  preload/       deeply frozen named window.moss API
  renderer/      React screens, no Node, no filesystem access, no network keys
  shared/        constants, types, IPC map, guards, recipes, prompts, costs
```

The renderer reaches the outside world only through named IPC methods. Every request payload is parsed by zod in the main process. Only three main-to-renderer events are exposed: job progress, license state, and menu commands, plus the close-time plan flush request. External links open in the system browser and only for an allowlisted set of hosts.

The Muse client sends one request per set shot. Edits omit `n` and never send a moderation field. Generations include `n`. The client retries only a 429, at most three times, honours `Retry-After`, and shows **Waiting for Meta** while it waits. A 401, 402, 403, or 5xx is never retried. A timeout is recorded with unknown billing and the request is not aborted, because aborting does not undo a bill.

See [MILESTONES.md](MILESTONES.md) for the M0 through M7 delivery map, [docs/api-notes.md](docs/api-notes.md) for the provider assumptions, [DECISIONS.md](DECISIONS.md) for judgement calls, and [docs/manual-test.md](docs/manual-test.md) for the acceptance checklist.

## Not included

- Cloud sync, accounts, or a hosted library.
- Background removal, object eraser, upscaling, batch editing, or video.
- Auto-updates.
- Real Muse billing reconciliation.
- A production store URL or a commercial code-signing certificate.

The store URL is a documented placeholder. `npm run release:gate` refuses a release build while `LICENSE_STORE_URL` points at `example.com` and `MOSS_RELEASE=1` is set. The Buy a License link stays hidden until an owner replaces the URL in `src/shared/constants.ts`.

## License

The application code and supplied reference imagery are supplied as part of Moss Toolbox. Third-party components and fonts keep their own licenses. See [LICENSES.md](LICENSES.md).
