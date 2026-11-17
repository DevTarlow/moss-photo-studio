# Moss Photo Studio

Moss Photo Studio is a desktop app for people who sell physical things. Edit a photo you already have, or describe a new image and make it. Everything you make stays in a library on your computer, and saved product photos stay together with the work made from them.

I built it for the part of selling that eats an afternoon: getting a bottle, a candle, or a pair of earrings to look right. The app handles the local edits, the image generation, and the reusable product references. You still decide what the product is and what the picture should say.

The desktop app has no account. A license key is required. Settings, Privacy explains exactly what stays on this computer and what goes to Meta or the license center. The separate license portal handles the buyer account, machine resets, and downloads.

## What it does

### Edit a photo

The Image Editor has 32 Quick Looks in six groups, 24 bundled people, one-click studio prompt chips, and a complete local adjust panel: Free/1:1/4:5/16:9 crop, rotate, flip, exposure, contrast, highlights, shadows, warmth, saturation, sharpness, and vignette. Double-click a slider to reset it. A person is optional on any change: pick one to keep the same face and body, or describe the change without one. The version panel keeps each version's description, details, export format, and actions together. Adjustments make a new version and stay on your computer.

A floating canvas toolbar handles zoom (Fit/100%), undo/redo, and before/after compare. The filmstrip labels every version Original, Adjusted, or AI. The priced action and month budget stay pinned under the left inputs, while the canvas footer keeps Add Photo and Export.

Versions branch instead of overwrite. You can compare them, move through the filmstrip, export the one you want, or start from a file, a product, or a library image and add another source later.

### Make a new image

The Image Generator has 30 starters and eight examples you can filter to All, White Backdrop, Lifestyle, On Model, or Flat Lay. Generate 1 to 4 images in three shapes and three formats. A product reference and a person reference can go together, so a person can hold the product. An optional scene reference supplies the setting, light, and props without asking the model to copy its subject. Scenes can be browsed before a product is chosen.

Attached Product, Person, and Scene references appear as removable visual chips so the whole shot recipe is visible at a glance. Output settings use proportional shape cards with storefront, social, and banner hints. Setting 2–4 images shows matching placeholder frames while the run is in progress.

The Details panel keeps the selected image's description, size, cost, and actions together, with the output settings and past makes. At a smaller window, **Details** opens the same panel over the results.

Generated images can be saved to a Set, as a product, or as a person. A product photo can come from your saved products or from the 20 starter products. A generated project appears in All work after its first image.

### Keep images in Sets

A Set is a simple collection of images, made for keeping related work together. Open any generated image, edited version, or saved product and choose **Add to Set**. Pick an existing Set or name a new one. An image or product photo belongs to one Set at a time, and removing it from the Set never deletes the image or its project.

The **Sets** page shows every image and product photo in one place. Open a Set and choose **Add to Set** to bring in a saved product or a ready image. Filter the Set to All, Products, or Generated & Edited, click any card for a high-resolution preview with source comparison, and find Remove from Set in the card's overflow menu with an undo toast. From any item there, choose **Edit Photo** or **Make an Image with this Photo** to start a new project with that photo as the source. The imported source and the images made from it stay in the Set automatically, so the Set grows with the work. You can still move individual images or remove them later.

Sets also appear in **All work** under their own section. Choose the **Sets** filter to see only Sets. When a product belongs to a Set, its page shows the Set name and links back to it.

**Export Set** offers Original (full-size files), Square 1:1 (1600 × 1600), or Portrait 4:5 (1600 × 2000) and writes the Set's ready images and product sources into one numbered folder. Sets are free organization: they do not change how the editor or generator works, and they are not tied to a marketplace.

### Keep products handy

Save a product photo as a Product, or start from one of the 20 clean, unbranded starter products. Starter products filter by category and offer Use in Generator / Try in Editor; saved products offer Generate Scene, Edit Photo, and View Projects. You can also add and name a product from the product picker while starting new work. A Product opens in the Image Editor or the Image Generator as a reusable reference, and can be added to a Set.

A product page keeps Products active in the sidebar, adds a Products back button and the product name in the window title, and renames inline. **Product notes** hold material, colour, style, or other details that should stay true; they stay on this computer and are added to image prompts only when that product is selected.

### Keep the costs visible

A returned image costs $0.01. The price is on the button before every run. A refusal costs nothing, and the app does not add a fee for any generations.

The Usage page tracks returned images with a paid AI / free adjustment breakdown, shows the current month and how much budget and how many images are left, and exports to a spreadsheet. Expand any row for request count, timing, and billing details. Adjust Photo and the local photo check are free.

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

Product notes are stored in the local library database. When you make an image with that product selected, the notes join the composed description sent to Meta; they are never sent otherwise.

The Meta key is stored in `secrets.bin`, encrypted with Electron's `safeStorage` when a system keyring is available. The fallback is AES-256-GCM with a local key protected by file mode `0600`. The license key is stored encrypted. No key is returned to the renderer, logged, or placed in a URL. Settings shows the last four characters only.

The app sends prompts and the images you choose to Meta when you run a paid image action. Adjust Photo and the local photo check stay on your computer. No telemetry is sent. The automatic update check goes to GitHub Releases and sends the app version, platform, architecture, and channel. It sends no key, email, or library data.

See [docs/privacy.md](docs/privacy.md).

## Project layout

```text
src/
  main/       Electron main process, SQLite, files, sharp, Meta client,
              license, queue, secrets, menus
  preload/    frozen named window.moss API
  renderer/   React screens, no Node, no filesystem access, no network keys
  shared/     constants, types, IPC map, guards, prompts, costs
```

The renderer reaches the outside world only through named IPC methods. The main process parses every request payload with zod. External links open in the system browser and only for an allowlisted set of hosts.

The app has no cloud sync or hosted library. Automatic updates are supported for the Linux AppImage; Windows and macOS packages still need signing and verification. Real Meta billing reconciliation is also open. [docs/release.md](docs/release.md) has the owner checklist.

More detail lives in [docs/licensing.md](docs/licensing.md), [docs/checkout-integration.md](docs/checkout-integration.md), [docs/api-notes.md](docs/api-notes.md), [DECISIONS.md](DECISIONS.md), and [MILESTONES.md](MILESTONES.md).

## License

The application code and supplied reference imagery are part of Moss Toolbox. Third-party components and fonts keep their own licenses. See [LICENSES.md](LICENSES.md).
