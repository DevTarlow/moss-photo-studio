# Manual test and acceptance status

This is the record of what was run, what passed, and what the acceptance owner still needs to do on a clean machine. The labels match the brief: **A** is agent-verifiable, **O** needs a real key, invoice, physical desktop, or package install.

## Current automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 188 tests pass in 23 files |
| `npm run test:e2e` | 13 serial journey tests plus the focused specs pass, including axe on dialogs, the kit/listing flow, 510-project pagination, all-screen 1024 and 150% layout, and screenshot comparison |
| `npm run audit:tokens` | All foreground/background token pairs pass AA in light and dark |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | Pass |
| `npm run build:linux` | AppImage and deb produced |
| Packaged override test | A packaged release launched to Activation with `MOSS_DEV_UNLOCK=1`, `MOSS_MUSE_FAKE=1`, and `MOSS_E2E=1` set, proving the build gate ignores them. `fakeMode` was false |
| AppImage launch smoke | Extracted AppImage launched to Activation through Playwright with `APPIMAGE_EXTRACT_AND_RUN=1` |
| deb launch smoke | `.deb` was unpacked with `dpkg-deb -x` and its executable launched to Activation. The package metadata, desktop entry, icons, and control scripts were inspected |
| Screenshot baselines | 51 images in `tests/screenshots`, including the product hub. The 1440 by 900 light and dark images are compared with a maximum diff ratio of 0.01. The 1024 by 700 and 150% zoom images are captured fresh because Playwright can restore the Electron viewport under that helper |

### Commands used

```bash
npm run typecheck
npm test
npm run audit:tokens
npm run test:e2e
npm run build:linux
MOSS_UPDATE_SCREENS=1 npx playwright test tests/e2e/studio.spec.ts
```

The package build needed a workspace cache and an isolated HOME because the machine's shared HOME is read only:

```bash
HOME="$PWD/.home" \
ELECTRON_CACHE="$PWD/.cache/electron" \
ELECTRON_BUILDER_CACHE="$PWD/.cache/electron-builder" \
npm run build:linux
```

The deb is produced by `scripts/make-deb.mjs` because electron-builder's fpm call fails with EINVAL on this filesystem's ownership attributes. See `DECISIONS.md`.

## What the automated journey proved

- Invalid activation key shows the approved "That key wasn't accepted" copy. A valid fake key activates. The key is not returned to the renderer.
- Onboarding: welcome, add an optional product, make it your own with a logo and colors, make an optional first set, ready. The Meta key is requested at the point of the first paid set (the key step remains in the setup rail as optional), with a first-set picker with 1/3/6 count presets and per-shot toggles, first-run confirmation, and the first paid set. The first photo is saved as a Product and no set project exists until Make. The first paid set was started with Space on the focused primary button and finished through the first-run dialog with Tab and Enter.
- Onboarding product-only path: Save product only creates one Product, no set, marks onboarding done, and reaches Ready; Finish Setup opens the saved product's hub, or Products when nothing was saved. This is covered by a focused E2E test.
- A five-shot set costs `$0.05`. The primary button says the price before the click. Five requests produced five images.
- The Set tool has a Plan/Review phase control, a plan preview board, a read-only review with an Edit Plan action, and no duplicate right inspector. Running hides the phase switch and keeps the plan read-only. The plan panel separator resizes with the mouse or arrow keys and persists its width.
- A two-shot failure set showed the partial review, the failed cards, and `Try Again · $0.02`. The retry made exactly two requests. Total set requests were eight. Older ready images were preserved.
- Image Editor: Kitchen table tile, a fitted canvas, a compare divider that can be dragged or moved with the slider and arrow keys, hold Space for the earlier version, local 1:1 crop, rotate, brightness, sharpen, apply locally free, version labels, and new version. The crop/rotate preview follows the exporter order; the crop box moves with arrow keys and resizes with Alt+arrow. The adjust-preview state is captured and axe-checked. Copy Image writes a PNG and Paste Image reads it back through the main-process clipboard.
- Set preview: the lightbox opens on a blurred glass scrim, closes when clicking outside the image, and still closes with the X.
- Create: four images, run cost, first result gets Newest, persistent Edit/Download/Save as Product/Save as Person/More actions, a result lightbox, Edit opens the editor, Back to Create returns to the result. The empty state shows eight starting cards under Examples with the line "Click a photo to load a starting description.", and the idea menu groups use darker bold titles. A failed run gets its own retry card.
- Set export: six named JPEG files (the export default) and a UTF-8 `set.txt`, no overwrite, format and quality controls. A pinned shot exports as the unsuffixed main file. The toast names the folder and count and offers Open Folder.
- Usage: month total equals returned images times one cent, by-project rows, ledger, CSV totals sum to the displayed month spend, budget warning at `$10.00`, reset budget. A low budget exposes Make Fewer Images; in Set it reduces the run to one shot and removes the warning when one fits.
- Products: saved products under Yours first, then 20 included unbranded starter products under Included; the header reads "20 included · N yours". Included cards have no rename/delete and open Use in a Set, Edit This Photo, and New Image from Reference. Create a Product opens the Image Generator with a blank dropper prompt and a Make a new product banner. A saved product keeps the existing rename, delete, search, sort, and pagination behavior.
- People: Yours first, then the 24 bundled people under Included; user cards carry the rename/remove actions, and the included cards show Maya and the other synthetic reference people. Every included person opens with the candid main photo and four square studio-look thumbnails (Studio front, Studio angle, Full length, Seated); clicking the main photo opens a larger preview, choosing a look updates the main photo, and "Use the original" restores it. Create a set from "Studio angle" and check the on-person control shows the look; create an image from "Full length" and check the person chip and the project keep it. User-added people have no look strip. Create a Person opens the Image Generator with a portrait prompt and a Make a new person banner; Save as Person on a generated result adds the image under Yours.
- Settings: light and dark theme, persisted after restart, window bounds remembered, 1024 by 700 and 150% zoom coverage for every main screen, keyring warning visible when safeStorage is unavailable. The system reduced-motion preference drives `data-motion`; overriding to full restores motion.
- Settings key: Test Connection, Replace, Test and Save, Remove with confirmation. The full key never appears in the page after saving.
- Offline: with both fake hosts down, generation shows the approved offline copy, no images, no cost. The library, local adjust, and export remain usable.
- Stray network: no renderer request left for an unexpected host. Only `moss-media://` and the local fake hosts appeared.
- License grace: with the stored validation moved back 13 days and the store down, the app opened the library with the grace banner. At 15 days it opened Activation, Browse My Library worked, and a project showed the read-only message.
- Setup prompt: while onboarding is incomplete, the Library shows a Finish setting up banner with Resume Setup; it no longer marks onboarding done when a key exists.
- Axe: activation, the new onboarding steps (welcome, key, product, set, ready), set plan, set review, image editor, adjust preview, adjusted photo, Create empty, Create results, Usage, People, People looks, Settings light, Library light, Library dark, Library at 1024, Library at 150% zoom, the first-run confirmation dialog (scoped to the dialog), and the set export dialog were checked. No serious or critical violations remained.
- Screenshot comparison passed on a second run with the live app.
- Large library: 510 created projects loaded 20 at a time. Previous and Next moved between pages, and search found the oldest project.
- Application menu: Export, Undo, Redo, Copy Image, zoom, and Toggle Panel enabled only in the correct editor states. Paste stayed available in the Library. The test read the native menu item state through Electron.
- Set exports use the stored result file, so the brand badge is present; the integration test distinguishes the result file from the pre-badge working copy by colour.
- A licence survives a store 5xx as offline/grace, an unreadable key is not treated as licensed, and the machine label contains no hostname.
- The database passes `quick_check`; a corrupt live file recovers from the latest `VACUUM INTO` snapshot; the pre-migration backup includes committed WAL frames.
- A backup restores into a new library and switches the restored database's library path; diagnostics contain no keys or images. The integration suite covers the round trip.
- A paid job reserves its budget so two concurrent jobs cannot pass the same check; a preflight disk check blocks a run with too little free space; a short Create can be topped up by its missing count.
- A source import is serialized per project, so two simultaneous first imports keep both originals.
- A product kit writes Etsy-sized JPEGs, the untouched original, `listing.csv`, `kit.json`, and the disclosure; the integration test checks dimensions and the pinned main image. The kit flow also runs in the E2E kit spec.
- The Listing Writer reads the product photo, plan directions, and Business profile, clamps titles/description/features/tags to Etsy, Shopify, or own-site caps, and saves versions. The E2E kit spec writes and edits a listing with the fake text provider.

## Coverage gaps in the automated artifact

- The 1440 by 900 matrix covers every main screen in light mode. Dark mode covers Activation, Onboarding, Library, Set review, Photo, Create, People, Usage, and Settings. Set plan and Set running are light only.
- Every main screen is captured at 1024 by 700 light. Every main screen also passes a 150% zoom layout and overflow assertion, including the panels as sheets where the viewport hides them.
- The screenshot matrix was added after the bulk of development. The baseline images reflect the final build states only for the visited journey states.
- Dialog states are covered by axe during their normal use but are not each captured as standalone screenshots.
- The library paginates 20 projects at a time and the journey proves a 510-project library renders 20 cards per page and moves between pages. A 2,000 image scroll frame-time profile and a 2,000-version single project were not run.

## Design system

- Astryx 0.7.11 is pinned and themed as Moss. The custom canvas, crop overlay, filmstrip, brand badge preview, and file-drop logic stay custom.
- The UI migration is phased: the shell, onboarding, and collections are Astryx-based; the editor canvases remain custom and now use the fitted workspace chrome.

### 3b. App shell and collections

- [x] **A** The rail has Products, All work, People, Usage, a Tools section with Set, Image Editor, and Image Generator, and Settings. Products is the home. The top-bar New menu launches the same three tools from every main screen. The Business settings section saves the shop profile the Listing Writer reads.
- [x] **A** All work has one New entry point, one key/setup banner area, a Select mode, Select all, Clear, Delete, and a sticky bulk bar. The hover checkbox still works.
- [x] **A** Products and People have search, sort, and result counts. The Settings storage section is named Storage.
- [x] **A** Settings uses the same SideNav as the rest of the app; the second settings aside is gone and the content is centered at 1440 and 1024.

## Acceptance checklist

Mark each line only after it is run on the target machine. `A` items should be reproducible with the test commands. `O` items cannot be reproduced without the real service or installer.

### 1. Artifacts

- [~] **A** Install the AppImage and deb. Both launch.
  - Done: both artifacts were built and their application binaries launched from the packaged AppImage and the unpacked deb. Release overrides were ignored.
  - Not done: system-wide installation with a desktop launcher. This host has no root package installation and the shared HOME is read only.
- [ ] **O** The window opens at 1440 by 900, scales cleanly at 150%, and can be resized to 1024 by 700.
  - Partly done: window bounds, 150% zoom, and 1024 by 700 are tested inside the Electron harness.

### 2. Key

- [x] **A half** A wrong key shows "That key wasn't accepted" and the right key activates this computer.
  - Fake store tested. A real store key was not available.
- [ ] **O** Meta accepts the key. A real image request succeeds.

### 3. Onboarding

- [x] **A** Under three minutes: paste a key, add a product, continue through Make it your own, choose a category, choose the images (all six start selected), make six images, see Setup complete. The first photo is saved as a Product; no set exists until Make.
  - The automated journey completes this in seconds with the fake image host. Human timing with a real key is still an O check.
- [x] **A** Onboarding has an optional Add product step with the same Skip for now action as the other optional steps, and Continue also works without a photo. The set step shows Add a product first with Skip for now; Ready says No product yet, has a Back button, and Finish Setup opens the saved product's hub, or Products when no product was saved. This is covered by a focused E2E test.
- [x] **A** Onboarding has an optional Make it your own step between the product and the set. Continue saves the logo and colors and goes to the set step; Skip for now does the same without saving. Settings → Logo & Colors keeps the same fields and preview.
- [ ] **O** On the first-set step, changing the count or switching a shot updates the price, and Save product only saves the Product, reaches Ready, and creates no set.

### 4. Key management

- [x] **A** Add a key, test it, reach the library, close and reopen the app. Replace the key and remove it. The full key never appears again.
  - Fake store tested through the UI and body-text check.
- [ ] **O** The same flow with a real key.

### 5. Real product set

- [ ] **O** One photo of a real product to a six shot set. Every shot clearly contains the same product, colors and label are intact, logos are not morphed.
- [ ] **O** Create a set from a saved Product, pick a category, then change it in the Set plan before making anything. The confirmation appears, the six shot cards change to the new recipe, and the category select is disabled after the first image with the "fixed after the first image" hint.
- [x] **A** The prompt lab's final sweep covers all 11 categories with the shipping recipes; see `docs/category-recipes.md`. Clothing used a real shirt photo; the other category sources were generated stand-ins.

### 6. One shot off

- [x] **A** Switch off one shot. The price drops from `$0.06` to `$0.05`. Five requests are made.
- [x] **A** The set image lightbox opens on a blurred glass scrim; clicking outside the image closes it, and the X still closes it.

### 7. Failure and retry

- [x] **A** Fail two shots with the fake host. The set review shows two failed cards with reasons. Try Again costs `$0.02`. Exactly two requests are made. The earlier images stay.

### 8. Product preservation

- [x] **A half** Create a new version from a long description. The original is still in the library and still selectable.
- [ ] **O** Visual check on a real product: label spelling, logo, color, and shape.

### 9. Compare

- [x] **A** The compare divider can be dragged; the slider and arrow keys move it too. Space holds the earlier version. The crop box can be focused and moved with arrow keys; Alt+arrow resizes it.

### 10. Local adjust

- [x] **A** Crop to 1:1, brighten, sharpen, and apply. A new version appears. No spend is recorded. The original remains.
  - Also covered by the local adjust integration test, which checks 400 by 480 output after rotate and crop.

### 11. Create

- [x] **A** Fill the describe box, choose four images, create. Four results appear with persistent Edit, Download, Save as Product, Save as Person, and More actions; the image opens a lightbox; Edit opens one; Back to Create returns.
- [x] **A** The empty state shows an Examples title with the line "Click a photo to load a starting description.", a person card, and eight starting cards; the Start from an idea menu has darker bold category titles.
- [x] **A** Open Image Generator and leave without making an image. No Images project appears and the All work count is unchanged. Make one image, and the project appears.
- [x] **A** With a product photo selected, click an example. The description is written for the product and the run sends it. Turn Use my product photo off: the example's own description loads, the run leaves the photo out, and the reference card says so. Editing the description returns to the normal reference rules.

### 12. Set export

- [x] **A** Export with every version. Six named files plus `set.txt` appear. No file is overwritten.

### 13. Persistence

- [x] **A** Resize the window, switch to dark, close and relaunch. Window size, theme, and library are restored.

### 14. Usage and cap

- [x] **A half** Usage totals equal the runs. CSV opens and its cost column sums to the displayed month spend. A `$10.00` budget writes the exact warning copy. Raise and reset work.
- [ ] **O** The real Meta invoice matches the month total.

### 15. Offline and key removal

- [x] **A** With the network fake hosts down, the app says "Working offline. License and Muse resume when you're connected." Generation fails with no image and no extra spend. Library, local adjust, and export still work.
  - The Muse key removal was also verified separately.

### 16. Grace window

- [x] **A** Use the injected clock or move the stored validation time. At 13 days offline the app opens in grace. At 15 days it is read-only. The library can still be browsed and local export still works.

### 17. Accessibility and layout

- [x] **A half** No serious or critical axe findings on the visited screens in light and dark. Keyboard focus is visible. Every control is reachable. Every main screen passes at 1024 by 700 and at 150% zoom with no horizontal overflow. Resizable panels and keyboard crop are covered. System reduced motion is covered. A 200% text-only resize cannot be simulated through Electron's page-zoom API, so that remains a manual screen-reader/text-scaling check. The Set running and export dialog states are not separately captured at 150%.
  - A real screen-reader pass is still an O check.
- [ ] **O** Screen reader pass with NVDA and VoiceOver on the target machines.

### 18. Products and cross-tool sources

- [ ] **A** The Products page shows 20 included unbranded starter products and a Create a Product button. Opening an included product offers Use in a Set, Edit This Photo, and New Image from Reference; there is no Rename or Delete.
- [ ] **A** Start each included action from the Amber dropper bottle: the set shows the category chooser and the source label, the editor opens the photo, and the generator shows the product reference. No product is added under Yours.
- [ ] **A** Create a Product opens the Image Generator with the Make a new product banner and the blank dropper prompt; generate, choose Save as Product, and the new product appears under Yours.
- [ ] **A** Save a generated image, an editor version, and a set shot as Products. Each appears on the Products page under Yours after a restart; the Included section is unchanged.
- [ ] **A** From a saved Product, use Use in a Set, Edit This Photo, and New Image from Reference; then repeat from a ready library image. The chosen photo becomes the source or reference.
- [ ] **A** Replace a set's product photo from a Product and from a library image. Images already made stay.
- [ ] **A** Add a photo to an existing Image Editor from a Product and from a library image. It becomes a new version.
- [x] **A** Create a Person opens the Image Generator with the person prompt and banner; generate an image, choose Save as Person, name it, and the new person appears under Yours with a working preview.
- [ ] **A** Open an included person, choose each of the four studio looks, use the original again, and create a set and an image from a look. Both actions keep the look; a user-added person has no look strip.
- [ ] **A** In the Image Generator, choose a Product and a Person from People. The run makes one image and the person is holding the product.
- [ ] **A** The count control is fixed at one image while a reference is selected.
- [ ] **A** Delete a saved Product. The Yours section empties but the Included section remains, and projects and images made from it stay.
- [ ] **O** Real-key check: a saved Product plus a person reference produces a recognizable product and person.

### 19. Packaging

- [x] **A half** The AppImage and deb were built. The deb contains a desktop entry, icons, and postinst. Both application binaries launched.
- [ ] **O** Install both on a clean Ubuntu 22.04 and 24.04 machine, with no Node.js installed, and launch from the desktop.

## How to re-run the packaged checks

```bash
# Release gate, placeholders still present. This intentionally fails with MOSS_RELEASE=1.
MOSS_RELEASE=1 npm run release:gate

# Build both artifacts.
HOME="$PWD/.home" ELECTRON_CACHE="$PWD/.cache/electron" \
ELECTRON_BUILDER_CACHE="$PWD/.cache/electron-builder" npm run build:linux

# Inspect the deb metadata without installing it.
dpkg-deb -I "release/Moss Photo Studio-1.0.0-amd64.deb"

# Launch the AppImage contents with Playwright or a normal desktop session.
APPIMAGE_EXTRACT_AND_RUN=1 "./release/Moss Photo Studio-1.0.0-x86_64.AppImage"

# Install the deb on a disposable machine.
sudo dpkg -i "release/Moss Photo Studio-1.0.0-amd64.deb"
sudo apt-get -f install
```

On Ubuntu 24.04, install `libfuse2t64` if the AppImage asks for FUSE 2. On a sandboxed CI host, add `--no-sandbox` to the AppImage command.

## Before a real release

1. Replace `LICENSE_STORE_URL` in `src/shared/constants.ts` with the real store URL.
2. Run `npm run build:linux` (the release gate now passes `--release` automatically). The gate fails while the store URL or homepage is a placeholder.
3. Add a real code-signing identity for Windows and Apple notarization for macOS.
4. Run one real Muse generation and one real Lemon Squeezy activation.
5. Run the real-key, invoice, and product preservation O checks above.
6. Regenerate screenshots only if the design changed intentionally, using `MOSS_UPDATE_SCREENS=1`.
