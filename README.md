# Moss Photo Studio

Moss Photo Studio is a local-first desktop photo studio for shops and resellers. Local product edits do not spend a Meta credit. Make an AI image from text, or change a photo you already have, with product, person, and scene references. Products, People, and Sets keep the reusable pieces together. And your library stays on your computer.

I built it for the part of shop work that eats an afternoon: getting a bottle, a candle, or a pair of earrings to look right. It is a full AI image generator and editor. The product, person, and Set tools are shaped by that work, but the editor and generator work for any image. Use the Image Editor on a photo you already have, or describe a new scene in the Image Generator. Both can use saved product and person references. And both keep every result as a version you can compare, export, or build on.

AI uses your own Meta key. A license key is required to use the app. Settings, Privacy lists what stays here and what goes to Meta or the license center. The separate license portal handles the buyer account, machine resets, and downloads.

## What you can do

### Edit a photo

The Image Editor has 32 Quick Looks in six groups, 24 bundled people, and an optional studio-prompt dropdown that replaces the description with a generic, ready-to-use phrase.

The local adjust panel covers Free, 1:1, 4:5, and 16:9 crop, rotate, flip, exposure, contrast, highlights, shadows, warmth, saturation, sharpness, and vignette. Double-click a slider to reset it.

A person is optional on any change. Pick one to keep the same face and body, or describe the change without one. Adjustments make a new version and stay on your computer. The version panel keeps each version's description, details, export format, and actions together.

A floating, single-row canvas toolbar handles zoom (Fit/100%), undo/redo, and before/after compare; scroll over the photo to zoom under the pointer, and hold the middle mouse button to drag a zoomed photo around the stage. The filmstrip labels every version Original, Adjusted, or AI. The priced action and month budget stay under the left inputs, and Add Photo and Export stay on the canvas footer.

Versions branch instead of overwrite. Compare them, move through the filmstrip, export the one you want, or start from a file, a product, or a library image and add another source later.

### Make a new image

The Image Generator has 30 starters and eight examples, filtered to All, White Backdrop, Lifestyle, On Model, or Flat Lay. Generate 1 to 4 images in three shapes and three formats.

A product reference and a person reference can go together, so a person can hold the product. An optional scene reference supplies the setting, light, and props without asking the model to copy its subject. You can browse scenes before choosing a product.

Attached Product, Person, and Scene references appear as removable chips, so the shot recipe stays visible. Output settings use proportional shape cards with storefront, social, and banner hints. A run of 2 to 4 images shows matching placeholder frames while it works.

The Details panel keeps the selected image's description, size, cost, and actions together with the output settings and past makes. At a smaller window, **Details** opens the same panel over the results.

Generated images can be saved to a Set, as a product, or as a person. A product photo can come from your saved products or from the 100 starter products. A generated project appears in All work after its first image.

### Products

Save a product photo as a Product, or start from one of the 100 clean, unbranded starter products across 19 categories. Starter products filter by category, page 20 at a time, and offer Use in Generator / Try in Editor. Saved products offer Generate Scene, Edit Photo, and View Projects. You can also add and name a product from the product picker while starting new work.

A product page keeps Products active in the sidebar, adds a Products back button and the product name in the window title, and renames inline. **Product notes** hold material, colour, style, or other details that should stay true. The notes stay on this computer and join the image prompt only when that product is selected.

### People

The app includes 24 bundled people, and you can add your own portraits. A person reference keeps a face and body consistent across an edit or a generated scene. You can leave the person out of any change. People are stored in the library with the rest of your work.

### Sets

A Set is a collection of images and product photos made for keeping related work together. Open any generated image, edited version, or saved product and choose **Add to Set**. Pick an existing Set or name a new one. An image or product photo belongs to one Set at a time, and removing it from the Set never deletes the image or its project.

The **Sets** page shows every image and product photo in one place. Open a Set and choose **Add to Set** to bring in a saved product or a ready image. Filter the Set to All, Products, or Generated & Edited, then click any card for a high-resolution preview with source comparison.

Remove from Set lives in the card's overflow menu with an undo toast. From any item, choose **Edit Photo** or **Make an Image with this Photo** to start a new project with that photo as the source. The imported source and the images made from it stay in the Set automatically, so the Set grows with the work. You can still move individual images or remove them later.

Sets also appear in **All work** under their own section. Choose the **Sets** filter to see only Sets. When a product belongs to a Set, its page shows the Set name and links back to it.

**Export Set** offers Original (full-size files), Square 1:1 (1600 × 1600), or Portrait 4:5 (1600 × 2000). It writes the Set's ready images and product sources into one numbered folder. Sets do not spend a Meta credit. They do not change how the editor or generator works, and they are not tied to a marketplace.

### Keep the costs visible

A returned image costs $0.01.

The price is on the button before every run. A refusal costs nothing, and the app does not add a fee for any generations.

The Usage page tracks returned images with a paid AI / free adjustment breakdown. It shows the current month and how much budget and how many images are left, and exports to a spreadsheet. Expand any row for request count, timing, and billing details. Adjust Photo and the local photo check do not spend a Meta credit; they still need an active license.

## Local-first and private

The library lives under the application data folder shown in **Settings, Storage**.

Your photos live in one folder.

You can open, copy, or back it up. Settings can create a backup with a consistent database snapshot and a copy of the library. The backup does not include the Meta key or the encrypted secret files.

Product notes are stored in the local library database. When you make an image with that product selected, the notes join the description sent to Meta. They are never sent otherwise.

The Meta key is stored in `secrets.bin`, encrypted with Electron's `safeStorage` when a system keyring is available, or with an AES-256-GCM fallback protected by file mode `0600` when no keyring is available. The license key is stored encrypted. No key is returned to the renderer, logged, or placed in a URL. Settings shows the last four characters only.

The app sends prompts and the images you choose to Meta when you run a paid image action, while Adjust Photo and the local photo check stay on your computer. No telemetry is sent. The automatic update check goes to GitHub Releases and sends the app version, platform, architecture, and channel. It sends no key, email, or library data.

See [docs/privacy.md](docs/privacy.md).

## Get a license

A license costs $79 per year and covers two computers. The terms are in [docs/eula.md](docs/eula.md).

Download the current Linux build from [GitHub Releases](https://github.com/DevTarlow/moss-photo-studio/releases). Install it, then activate with the key. Windows and macOS builds are not published yet.

1. Buy at [mossphotostudio.com](https://mossphotostudio.com).
2. The key arrives by email after checkout.
3. Open **Settings, License** in the app and paste the key.
4. Manage machines and licenses at [license.mossaistudio.com/account](https://license.mossaistudio.com/account).

The app works offline for 14 days after a successful check. If the license ends, the studio becomes read-only: you can view, copy, delete, and export your work, but making images, importing photos, editing, and changing Sets, Products, or People need an active license.

Your files are not deleted.

The source is published so buyers can inspect what runs on their computer. It is proprietary software, not open source. See [LICENSE](LICENSE) and [docs/eula.md](docs/eula.md). A purchased key is required to use the app, and a source build is not a licensed copy. The license portal and its Stripe configuration are private.

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

For development and automated tests, the unpackaged dev app can skip the license check and use a local fake image client instead of Meta:

```bash
MOSS_DEV_UNLOCK=1 MOSS_MUSE_FAKE=1 npm run dev
```

This is a development tool, not a license grant, and it cannot be enabled in a packaged release. Nothing leaves the computer in fake mode, and a red FAKE MODE chip appears in Settings and the About window.

## Tests and builds

```bash
npm run typecheck
npm test
npm run lint
npm run build:linux
```

`npm test` runs the unit and integration suites against fake Meta and license hosts. The E2E journey builds the app and runs the serial studio flow with axe checks and screenshot comparisons. See [docs/manual-test.md](docs/manual-test.md) for the acceptance checklist.

`npm run build:linux` produces an AppImage and a deb under `release/`. Windows and macOS builds are configured but have not been verified in this environment. They need signing certificates before public distribution.

The Linux AppImage checks [GitHub Releases](https://github.com/DevTarlow/moss-photo-studio/releases) when it starts and every four hours. A newer build downloads in the background, a banner links to Settings, Updates, and it installs when you choose Restart to Update. The deb and other builds use the portal download page and install by hand.

There is no forced restart.

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

Moss Photo Studio is proprietary software from Moss AI Studio (mossaistudio.com), sold at mossphotostudio.com. Copyright (c) 2026 Moss AI Studio. All rights reserved. The source is published for inspection only; using the app requires a paid license under [docs/eula.md](docs/eula.md). See [LICENSE](LICENSE). Third-party components and fonts keep their own licenses; see [LICENSES.md](LICENSES.md).
