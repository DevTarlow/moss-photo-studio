# Moss Photo Studio

A local-first photo studio for people who sell things. Turn one product photo into a full listing set, change a photo you already have, or describe a new image. The library lives in a folder you own. Images, plans, products, people, and usage stay on the computer.

This is the sibling application to `../moss-toolbox`. It is an Electron desktop app built with React, TypeScript, Vite, and SQLite.

## What is in the app

- **App shell** with one rail: Studio (Products, All work, People, Usage), Tools (New Set, Image Editor, Image Generator), and Settings. Products is the home. The top-bar New menu launches the same three tools from any main screen. While Settings is open, its sections use the same rail.
- **Read the photo** on a product: one under-a-cent vision call proposes the product name, category, audience, and a few visible points; it fills only the blank details and records the text cost in Usage.
- **Business profile** in Settings with the shop name, what you sell, who buys it, how you write, standard answers, marketplaces, and a main platform. It is optional and feeds the Listing Writer next.
- **Products** as the home and hub. A product holds its source photo, the sets and edits linked to it, its listing copy (coming with the Listing Writer), and the export history. Open a product to make a set, change a photo, make a new image, link existing work, archive it, or restore it from the Archived section. Unfiled work is surfaced on the same page so older sets can be adopted.
- **All work** with sets, photos, and images, search, filters, sorting, grid and list views, project duplication, rename, hover-select multi-delete, an explicit Select mode, delete, and export. Projects show 20 per page with Previous/Next controls.
- **Set** from 1 to 8 listing shots. Start from an upload, a saved Product, or any ready library image. Every new set asks what you sell and builds that category's recipe. The plan panel can switch the recipe until the first image is made; each shot can be switched off, renamed, described, assigned a person, or given a feature line. The plan saves automatically. In review, a ready shot can make another version for one cent, and any ready version can be pinned as the main image that export uses.
- **Connection icons** for Main shot, In use, Close-up, Size reference, Flat lay, Gift-ready, Feature callout, and On a person.
- **Image Editor** with 32 tiles in six groups, 12 bundled people plus your own, a free local adjust panel with arrow-key crop, resizable panels, version labels, branching, a filmstrip, compare, export, and copy. Start from a file, a Product, or a library image, and add another source later as a new version.
- **Scene reference** in the Image Generator and the editor's Change panel: an optional ready image supplies the setting, light, and props. It is sent as a separate reference (`@Image2` or `@Image3`), never as the product, and the prompt tells the model not to copy its subject. Product, person, and scene can be sent together.
- **Image Generator** with 30 starters, including person ideas for holding, wearing, and using the item, one to four images, three shapes, and three formats. A product reference and a person reference can be sent together, so a person can hold a product. Eight example cards load an editable starting description — including a new person, someone wearing the product, a room scene and a jewelry close-up. With a product photo selected, a Use my product photo switch frames the scene around that product instead of the sample object. Generated images can be saved as a Product, a Person, or a set photo. A new generator project appears in All work only after its first image.
- **Local adjust** for crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, and vignette. It makes a new version and never resends the product to an image service.
- **Products** with 20 included unbranded starter products — bottles, jars, candles, ceramics, bags, clothing, jewelry, homeware and prints — plus your own saved photos. Included cards open into Use in a Set, Edit This Photo, or New Image from Reference without creating a saved product; Create a Product opens the Image Generator with a blank product prompt. Products and any library image can be chosen wherever a source photo is needed; the page has search, sort, counts, and 20 per page for your own.
- **People** with 24 included synthetic reference people — candid, friendly lifestyle shots across the 20s–70s age range — plus your own portraits, search, sort, counts, and rename or remove for your own. Every included person opens with four square studio-look thumbnails under the main photo, which opens a larger preview; the chosen look is used for the next set or image. Add a Person uploads a portrait; Create a Person opens the Image Generator with a portrait prompt, and any generated image can be saved as a Person. A person is reused as a reference in sets, the editor, and the generator.
- **Default look** in the brand fields: clean studio, warm home, quiet minimal, natural light, moody, or none. The setting/light clause is appended to every run so a set feels related; it never tells the model to change the product.
- **Logo & Colors** with up to six colors, a logo, and corner badge position, size, and opacity. The first three saved colors steer backgrounds and props in sets and photo changes while their toggle is on; select Use on any other saved color to swap it into those three. Turning the toggle off keeps the saved colors but adds none to a prompt. From a Photo samples a small palette from an image on this computer; the image is not uploaded or saved. The badge is composited locally.
- **First run** opens in light mode with a Welcome screen and four setup steps: add the first product, make the studio your own with a logo and colors, make an optional first set, and a ready screen that previews the images made in the optional first set. The Meta key is asked for at the point of the first paid set, not before the product; the optional Connect Meta step remains in the setup rail, and Settings has the key later. The first photo is saved as a reusable Product; a set project is created only when the seller chooses to make images. Finish Setup opens that product's hub, or Products when no product was saved. All six recipe shots start selected, with 1, 3, or all presets, and the first three are the strongest shots for the chosen category. The customization step can be skipped, and the same logo and colors remain in Settings. The theme, density, and reduce-motion live in Settings.
- **Listing Kit** from a product’s latest set: marketplace presets (Etsy, Shopify, Instagram feed, TikTok Shop, eBay, own site), platform-sized JPEGs, an untouched original when the shop needs it, an alt-text line per shot, the saved listing copy in `listing.md` when one exists for that shop, a `listing.csv` and `kit.json`, and an AI disclosure. Etsy defaults to 2000 px and a 1 MB guide; the kit is written locally and never uploaded.
- **Local photo check** on the set plan: a free, on-device read of darkness, flat contrast, softness, and small size, with plain guidance. It never calls Meta and never blocks a run.
- **Size label** in Local Adjust: enter width, height, and cm/in to create a new local version with a clean rounded size badge at the bottom. It is optional, free, and the product pixels stay untouched.
- **Batch color grade** from the Local Adjust panel: apply the current brightness, contrast, saturation, warmth, sharpen, and vignette to every ready image in the project as new local versions. Crop, rotate, and flips stay per image; no API call and no charge.
- **Source compare** in the set review: Compare with Source puts the untouched source photo beside the made image, so you can check the product before keeping a version.
- **Listing Writer** on the product hub: titles, description, features, and tags written from the product photo, the set plan, and the optional Business profile. Etsy, Shopify, and own-site caps are clamped, the copy is editable and saved in versions, and the panel shows the estimated text cost (under a cent).
- **Usage ledger** with image rows and text rows (listing copy, photo read), a separate text-cost line, CSV micros, and the budget limit. with the real returned-image cost, $0.01 per returned image, a monthly budget, and CSV export. Project rows follow the current project title, so a rename shows immediately; deleted projects read as Deleted project. Project spending and ledger rows show 20 per page.
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

`npm test` runs the unit and integration suites against the fake Muse and Lemon Squeezy hosts. `npm run test:e2e` builds the app and runs the serial studio journey — activation with a fake key, onboarding, the library, set, editor, generator, usage, products, people, settings, dark theme, and the 1024 and 150% layouts — plus focused specs for onboarding, products, included products, people, and library selection. The journey runs axe checks and compares the screenshots under `tests/screenshots`. Set `MOSS_UPDATE_SCREENS=1` on the first run after an intentional visual change to write new baselines. The 1440 by 900 light and dark images are compared with a maximum diff ratio of 0.01. The 1024 by 700 images are captured fresh each run because Playwright's screenshot helper can restore the Electron viewport, and the 150% zoom images are capture-only.

The E2E suite uses `MOSS_E2E=1`, `MOSS_MUSE_BASE_URL`, and `MOSS_LICENSE_API_BASE` only in an unpackaged development build. `MOSS-E2E-VALID-KEY` is a fake key. No test sends a real key or reaches Meta or Lemon Squeezy.

## Calibrate the recipes

The prompt lab in `scripts/lab/` calls the real Meta Muse API with the app's own prompt builders and client. It is a developer tool, never part of `npm test` or CI, and every returned image costs $0.01.

```bash
# Put a key in .env first. The file is gitignored and never read by the app.
npm run lab -- plan --all                          # free prompt review
npm run lab -- set --category clothing --source shirt.jpg --yes
npm run lab -- people --yes                        # 24 bundled reference people, $0.24
npm run lab -- sweep --yes                         # 11 categories, 66 images, $0.66
```

Outputs (images, manifests, contact sheets, review notes) land in the gitignored `lab/` folder. See [docs/lab.md](docs/lab.md) for setup, the spend guard, and the review rubric, and [docs/category-recipes.md](docs/category-recipes.md) for the calibrated rosters and evidence.

## Build packages

```bash
npm run build:linux
```

The release scripts run the release gate automatically (`node scripts/release-gate.mjs --release`) and refuse to build while `LICENSE_STORE_URL` or the `package.json` homepage is still a placeholder. The files appear under `release/`:

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

**Settings, Storage** can make a backup folder that contains a consistent snapshot of the database and a copy of the library. The backup does not include the Muse key or the encrypted secret files; enter the key again after a restore, and re-activate the license if asked. Restoring copies the backup into a new empty folder, switches the app to it, and restarts; the current library is left in place until the restore is verified. **Create Diagnostics** writes app information, library counts, and local logs to a folder for support; it contains no keys, prompts, or images.

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

The renderer reaches the outside world only through named IPC methods. Every request payload is parsed by zod in the main process. Projects can be linked to a product (`projects.product_id`) and a pinned set version is stored on the plan shot. Only three main-to-renderer events are exposed: job progress, license state, and menu commands, plus the close-time plan flush request. External links open in the system browser and only for an allowlisted set of hosts.

The Muse client sends one request per set shot. Edits omit `n` and never send a moderation field. Generations include `n`. The client retries only a 429, at most three times, honours `Retry-After`, and shows **Waiting for Meta** while it waits. A 401, 402, 403, or 5xx is never retried. A timeout is recorded with unknown billing and the request is not aborted, because aborting does not undo a bill.

See [docs/release.md](docs/release.md) for the owner release checklist, [MILESTONES.md](MILESTONES.md) for the M0 through M7 delivery map, [docs/api-notes.md](docs/api-notes.md) for the provider assumptions, [docs/category-recipes.md](docs/category-recipes.md) for the category rosters and calibration evidence, [docs/lab.md](docs/lab.md) for the real-Muse prompt lab, [DECISIONS.md](DECISIONS.md) for judgement calls, and [docs/manual-test.md](docs/manual-test.md) for the acceptance checklist.

## Not included

- Cloud sync, accounts, or a hosted library.
- Batch crop/rotate and other batch edits, and overlays other than the size label, upscaling, object eraser, or video. Background cleanup is handled by the editor’s Background tiles; the product page no longer has a separate SAM Clean shot action.
- Auto-updates.
- Real Muse billing reconciliation.
- A production store URL, product homepage, or commercial code-signing certificate. See [docs/release.md](docs/release.md) for the owner checklist.

The store URL is a documented placeholder. `npm run release:gate` refuses a release build while `LICENSE_STORE_URL` points at `example.com` and `MOSS_RELEASE=1` is set. The Buy a License link stays hidden until an owner replaces the URL in `src/shared/constants.ts`.

## License

The application code and supplied reference imagery are supplied as part of Moss Toolbox. Third-party components and fonts keep their own licenses. See [LICENSES.md](LICENSES.md).
