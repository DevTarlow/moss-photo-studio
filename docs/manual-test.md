# Manual acceptance checklist

Run these on the Linux build before a release. Automated coverage is listed first; the manual passes cover real keys, real photos, billing, and OS behavior that the fake hosts cannot prove.

## Automated gates

| Gate | Command | Expected |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | No errors |
| Unit and integration | `npm test` | All pass; no real Meta or license host |
| Lint | `npm run lint` | No errors |
| Build | `npm run build` | Main, preload, renderer build |
| E2E | `npm run test:e2e` (or a test build plus focused Playwright runs) | Serial journey, focused specs, axe checks, screenshots |
| Token audit | `npm run audit:tokens` | No contrast failures |
| Release gate | `MOSS_RELEASE=1 npm run build:linux` | AppImage and deb under `release/` |

On this headless Linux host, run Playwright through Xvfb (`xvfb-run -a npx playwright test ...`). The 1024×700 and 150% snapshots are capture-only and are rewritten each run; inspect them before committing. The 1440×900 light and dark baselines compare with a 0.01 diff ratio.

## First run

- Launch with no license. Activation is the first screen; the theme follows the system and the app reports an unavailable keyring truthfully.
- Activate with a valid test key. Welcome shows “Your personal photo studio.” with a clean focus outline.
- Welcome only offers Set Up AI Images as the primary action; it never opens the photo dialog or leaves setup.
- Connect Meta: the Meta key is optional and can be added later. A bad key shows a plain error; a saved key shows only its last four characters.
- Add product: a JPEG, PNG, or WebP saves as a Product. A photo under 800 px is allowed with the small-photo warning.
- Skip product: the optional step continues to Make it your own.
- Make it your own: the preview asks for a logo until one is added; logo, colors, badge, and default look save; skip also continues.
- Ready: Edit This Product starts a photo project from the saved product; Open a Photo opens the photo picker. Finish Setup still exits to the product hub, or Products when no product was saved.
- Restart during setup: the app resumes a safe step and never traps the user on a removed step.

## Image Editor

- Start from a saved product, a library image, or a dropped file. The original is the first version.
- Choose a Quick Look or write a change. The button shows the price before the run; the first paid run shows the first-run confirmation and then disappears on later runs.
- Person is optional on any change: the same picker as the generator shows portraits in a menu, the selected avatar opens a larger preview, and a chosen person is sent with the change.
- Hold Space for the earlier version; compare with the slider, mouse divider, and keyboard.
- Adjust Photo: crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, vignette. Apply Adjustment is free and creates a version.
- Batch color applies only color controls and creates one version per ready image, capped at 50.
- Export writes the chosen format to the chosen folder; the file opens.
- Copy Image and Paste Image work through the main process.

## Image Generator

- Create a draft, describe the image, choose 1–4 images, shape, and format. The price is on the button.
- Add a product photo, a person, and a scene. A product can be added and named from the picker mid-flow. The scene supplies setting/light/props without its subject.
- A generated image can be saved as a Product or a Person. Save Product appears on the Products page after a refresh.
- Edit opens the result in the Image Editor. Download saves the image.
- A policy refusal, a timeout, a short count, and a 429 each show the approved copy and do not overbill in Usage.

## Products

- Products shows “20 included · N yours,” search, sort, and pagination.
- Starter Products open with Edit This Photo and Make an Image with This Product, without Rename or Delete.
- Generate Product Photo opens the Image Generator with the product prompt; Save as Product adds it under Your Products. Add Product Photo asks for a name before saving.
- A product hub shows the source photo, Add to Set, Make an Image with This Product, linked projects, Link Existing Projects, archive, and delete.
- **This build intentionally has no Listing Kit, listing copy, or Business profile.** Sets exist only as image organization; no rail item, menu item, or settings section should offer the retired tools.

## Sets

- Add any ready generated image, edited version, or saved product with Add to Set. Create a new Set from the same dialog. Open a Set and use Add to Set to bring in a product or image; Done closes the picker.
- Sets lists each Set with its cover and count. Set detail shows member images and product photos, an Add to Set action, and a contextual back route that returns to the Set. Removing one leaves the image or product in place.
- From a Set image or product source, Edit This Photo opens a new photo project and Make an Image with This Photo / This Product opens a new generator project. The imported source and all resulting images stay in the Set automatically.
- Export Set creates a unique folder with numbered ready images and product sources, with no manifest. Open Folder opens the remembered Set export folder.
- Delete a Set only removes the organization; images and projects remain.
- An existing v11 pack library upgrades to v12 with its ready images preserved as ordinary image projects; old pack plans, pending rows, and pack jobs are removed.

## All work

- The rail has All work, Products, Sets, People, Usage, Image Editor, Image Generator, and Settings.
- Filters are All, Edited, Generated, Products, and Sets. Sets also appear under All work in their own section. An empty library offers four cards: Add a Product Photo, Image Editor, Image Generator, and Sets.
- Drop a photo on All work to open it in the Image Editor. Sets are filled from image actions; there is no drag-to-Set behavior.
- Rename, duplicate, export, select, bulk delete, search, sort, pagination, and product sections work.
- A library over 500 projects paginates at 20 cards and keeps selection scoped to loaded cards.

## People

- People lists Your People first and 24 starter synthetic people.
- Starter people open with four studio looks; the original can be restored.
- Make an Image with This Person seeds the generator with the person and look.
- Add, rename, and remove a person. A generated image can be saved as a person.

## Usage

- The month card counts returned images at one cent each. There is no text-cost line. Every Image hides Duration by default; expanding a row shows Requested, Returned, Duration, and billing/error detail.
- CSV export opens with the documented columns; cost rows sum to the displayed month spend.
- Budget saves a monthly limit, shows the warning when a run would exceed it, and can be cleared.
- Old historical `set`, `listing`, `analyze`, and `cutout` rows remain in Every Image with their recorded cost.

## Settings

- Meta connection: Test Connection, Replace, Test and Save, and Remove with confirmation. The full key never appears after saving.
- Privacy: the trust cards distinguish local data, Meta requests, and license calls; Technical details holds host names and Install ID. About: Technical details holds Electron/Chromium/Node versions.
- Logo & Colors: colors, From a Photo, logo, badge corner/size/opacity, default look, preview.
- **There is no Business section.** `/settings/business` redirects to the Meta connection page.
- Storage: backup, restore, diagnostics, library path, and the backup status.
- Appearance: theme, density, reduced motion; preferences persist after restart.
- License, Updates, Privacy, and About work as before. About uses the Meta AI Studio link.

## License and offline behavior

- With 13 days since the last check and the portal down, the app shows Working offline and can still generate.
- After 14 days offline, the library is read-only; Browse My Library still opens it. Adjust Photo and export work.
- A valid key restores generation. Deactivation releases the machine.
- No key or prompt is shown in the interface, logs, or clipboard.

## Accessibility and layout

- Run axe on activation, onboarding, product hub, editor, adjust preview, generator results, usage, people, settings, and library. No serious or critical findings.
- Keyboard: Ctrl/Cmd+K palette, Ctrl/Cmd+1 Image Editor, Ctrl/Cmd+2 Image Generator, Ctrl/Cmd+F search, Ctrl/Cmd+E export, Ctrl/Cmd+Enter primary action, Ctrl/Cmd+B rail, Space original, arrows versions, brackets sliders, Escape close, ? shortcuts.
- Check 1440×900, 1024×700, and 150% zoom with no horizontal overflow.
- Check light and dark themes on every main screen.
