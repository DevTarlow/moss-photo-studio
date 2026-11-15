# Moss Photo Studio

Moss Photo Studio is a desktop app for people who sell physical things. Start with one product photo, then make a set of listing images, edit a photo you already have, or describe a new scene. Everything you make stays in a library on your computer. All work filters your sets, edits, and images, and can show your saved products too.

I built it for the part of selling that eats an afternoon: getting a bottle, a candle, or a pair of earrings to look right on a listing page. The app handles the set plan, the local edits, the image generation, and the listing kit. But you still decide what the product is and what the shot should say.

The desktop app has no account. A license key is required. The separate license portal handles the buyer account, machine resets, and downloads.

## What it does

### Make a set

Choose a product photo, a saved product, or a ready library image. Pick a category and the app builds that category's shot recipe. A set holds 1 to 8 shots. And you can switch the recipe until the first image is made, turn individual shots off, rename them, write a description, assign a person, or add a feature line.

The plan saves as you work. In review, a ready shot can make another version for one cent, and any ready version can be pinned as the main image for export.

### Edit a photo

The Image Editor has 32 looks in six groups, 12 bundled people, and a local adjust panel for crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, and vignette. Adjustments make a new version and stay on your computer.

Versions branch instead of overwrite. You can compare them, move through the filmstrip, export the one you want, or start from a file, a product, or a library image and add another source later.

### Make a new image

The Image Generator has 30 starters, including person ideas for holding, wearing, and using an item. Generate 1 to 4 images in three shapes and three formats. A product reference and a person reference can go together, so a person can hold the product. An optional scene reference supplies the setting, light, and props without asking the model to copy its subject.

Generated images can be saved as a product, a person, or a set photo. A generated project appears in All work after its first image.

### Write and pack the listing

The Listing Writer writes titles, descriptions, features, and tags from the product photo, the set plan, and the optional business profile. Etsy, Shopify, and own-site limits are applied to the copy, and every version is editable and saved.

The Listing Kit is its own tool in the rail. Start from a product, a finished set in All work, or one ready image. It builds a local package with marketplace presets for Etsy, Shopify, Instagram, TikTok Shop, eBay, and your own site, platform-sized JPEGs, an untouched original, an alt-text line per image, a `listing.md` when listing copy exists, a `listing.csv`, a `kit.json`, and an AI disclosure. The kit is written to a folder you choose and is never uploaded. When the work is not under a saved product yet, the kit offers to save it as one so the listing copy can be written.

### Keep the costs visible

A product photo read costs under a cent.

A returned image costs $0.01.

Listing copy has its own text cost line. The Usage ledger tracks images and text, shows the current month, supports a budget limit, and exports to CSV.

## Get a license

A license costs $79 per year and covers two computers.

Download the current Linux build from [GitHub Releases](https://github.com/DevTarlow/moss-photo-studio/releases). Install it, then activate with the key. Windows and macOS builds are not published yet.

1. Buy at [mossphotostudio.com](https://mossphotostudio.com).
2. Then the key arrives by email after checkout.
3. Open **Settings, License** in the app and paste the key.
4. Manage machines and licenses at [license.mossaistudio.com/account](https://license.mossaistudio.com/account).

The app works offline for 14 days after a successful check. If the license ends, the library becomes read-only.

Your files are not deleted.

The app source is public. The license portal and its Stripe configuration are private.

## Run from source

You need Node.js 22.12 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

The dev app uses the same application data folder as an installed build. To keep development data separate:

```bash
MOSS_USER_DATA_DIR="$HOME/moss-dev-data" npm run dev
```

To skip the license check and use a local fake image client instead of Meta:

```bash
MOSS_DEV_UNLOCK=1 MOSS_MUSE_FAKE=1 npm run dev
```

Nothing leaves the computer in fake mode, and a red FAKE MODE chip appears in Settings and the About window.

## Tests and builds

```bash
npm run typecheck
npm test
npm run lint
npm run build:linux
```

`npm test` runs the unit and integration suites against fake Meta and license hosts. The E2E journey builds the app and runs the serial studio flow with axe checks and screenshot comparisons. See [docs/manual-test.md](docs/manual-test.md) for the acceptance checklist.

`npm run build:linux` produces an AppImage and a deb under `release/`. Windows and macOS builds are configured but have not been verified in this environment. They need signing certificates before public distribution.

The Linux AppImage checks [GitHub Releases](https://github.com/DevTarlow/moss-photo-studio/releases) when it starts and every four hours. A newer build downloads in the background, a banner links to Settings, Updates, and it installs when you choose Restart to Update. The deb and other builds use the portal download page and install by hand. There is no forced restart.

## Data and privacy

The library lives under the application data folder shown in **Settings, Storage**. Settings can create a backup that includes a consistent database snapshot and a copy of the library. The backup does not include the Meta key or the encrypted secret files.

The Meta key is stored in `secrets.bin`, encrypted with Electron's `safeStorage` when a system keyring is available. The fallback is AES-256-GCM with a local key protected by file mode `0600`. The license key is stored encrypted. No key is returned to the renderer, logged, or placed in a URL. Settings shows the last four characters only.

The app sends prompts and the images you choose to Meta when you run a paid image or text action. Local Adjust, the Listing Kit, and the local photo check stay on your computer. No telemetry is sent. The automatic update check goes to GitHub Releases and sends the app version, platform, architecture, and channel. It sends no key, email, or library data.

See [docs/privacy.md](docs/privacy.md).

## Project layout

```text
src/
  main/       Electron main process, SQLite, files, sharp, Meta client,
              license, queue, secrets, menus
  preload/    frozen named window.moss API
  renderer/   React screens, no Node, no filesystem access, no network keys
  shared/     constants, types, IPC map, guards, recipes, prompts, costs
```

The renderer reaches the outside world only through named IPC methods. The main process parses every request payload with zod. External links open in the system browser and only for an allowlisted set of hosts.

The app has no cloud sync or hosted library. Automatic updates are supported for the Linux AppImage; Windows and macOS packages still need signing and verification. Real Meta billing reconciliation is also open. [docs/release.md](docs/release.md) has the owner checklist.

More detail lives in [docs/licensing.md](docs/licensing.md), [docs/checkout-integration.md](docs/checkout-integration.md), [docs/api-notes.md](docs/api-notes.md), [docs/category-recipes.md](docs/category-recipes.md), [DECISIONS.md](DECISIONS.md), and [MILESTONES.md](MILESTONES.md).

## License

The application code and supplied reference imagery are part of Moss Toolbox. Third-party components and fonts keep their own licenses. See [LICENSES.md](LICENSES.md).
