# Moss Photo Studio

A local-first photo studio for people who sell things. Turn one product photo into a full listing set, change a photo you already have, or describe a new image. The library lives in a folder you own. Images, plans, people, and usage stay on the computer.

This is the sibling application to `../moss-toolbox`. It is an Electron desktop app built with React, TypeScript, Vite, and SQLite.

## What is in the app

- **Library** with sets, photos, and images, search, filters, sorting, grid and list views, project duplication, rename, delete, and export. Above 200 projects the grid and list mount only viewport rows.
- **Sets** from 1 to 8 listing shots. Each shot can be switched off, renamed, described, assigned a person, or given a feature line. The plan saves automatically.
- **Connection icons** for Main shot, In use, Close-up, Size reference, Flat lay, Gift-ready, Feature callout, and On a person.
- **Photo editor** with 32 tiles in six groups, 12 bundled people plus your own, a free local adjust panel, version labels, branching, a filmstrip, compare, export, and copy.
- **Create from words** with 24 starters, optional product references, one to four images, three shapes, and three formats.
- **Local adjust** for crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, and vignette. It makes a new version and never resends the product to an image service.
- **Logo & Colors** with up to six colors, a logo, a logo eyedropper, and corner badge position, size, and opacity. Colors steer backgrounds and props in sets and photo changes. The badge is composited locally.
- **Usage ledger** with the real returned-image cost, $0.01 per returned image, a monthly budget, and CSV export.
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

The dev app uses a separate development data set. Set `MOSS_DEV_UNLOCK=1` and `MOSS_MUSE_FAKE=1` to work without a license or a Muse key:

```bash
MOSS_DEV_UNLOCK=1 MOSS_MUSE_FAKE=1 npm run dev
```

`MOSS_MUSE_FAKE=1` uses a local fake image client. Nothing leaves the computer. A red **FAKE MODE** chip appears in Settings and Help, About.

## Test it

```bash
npm test
npm run test:e2e
npm run audit:tokens
npm run lint
```

`npm test` runs the unit and integration suites against the fake Muse and Lemon Squeezy hosts. `npm run test:e2e` builds the app, launches Electron with Playwright, activates with a fake key, walks the whole studio, runs axe checks, and compares the screenshots under `tests/screenshots`. Set `MOSS_UPDATE_SCREENS=1` on the first run after an intentional visual change to write new baselines. The 1440 by 900 light and dark images are compared with a maximum diff ratio of 0.01. The 1024 by 700 and 150% zoom images are captured fresh each run because Playwright's screenshot helper can restore the Electron viewport before taking them.

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

The default library is under the application data folder shown in **Settings, Library**:

- Linux: usually `~/.config/Moss Photo Studio/library`
- Windows: `%APPDATA%\Moss Photo Studio\library`
- macOS: `~/Library/Application Support/Moss Photo Studio/library`

The SQLite database is in the application data folder. The library contains:

```text
library/
  brand/
  people/
  projects/<project-id>/
    original/       byte-for-byte imported product photos
    working/        sharp-normalized copies used for requests and thumbnails
    images/         edited and generated images
    thumbs/         visible thumbnails
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

The renderer reaches the outside world only through named IPC methods. Every request payload is parsed by zod in the main process. Only three renderer-to-main events are exposed: job progress, license state, and menu commands, plus the close-time plan flush. External links open in the system browser and only for an allowlisted set of hosts.

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
