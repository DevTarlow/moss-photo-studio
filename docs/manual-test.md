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
- Welcome offers Set Up AI Images and, beside it, Start with a Photo · Free. The second action goes straight to Add your first product.
- Your setup distinguishes completed steps (green check) from skipped optional steps (neutral dash), including on Ready. A skipped Meta Key, Product, or Personalize step never shows a green check.
- Connect Meta: the step is not marked optional, because most of the app needs the key; Add key later still continues. Test and connect stays disabled until the key input has text unless a saved key already exists. A bad key shows a plain error; a saved key shows only its last four characters.
- Add product: a JPEG, PNG, or WebP saves as a Product. The filename is cleaned into a starting Product name, the name field is focused, and Enter or Continue saves the name. Replace photo sits under the thumbnail. A photo under 800 px is allowed with the small-photo warning.
- Skip product: the optional step continues to Make it your own.
- Make it your own: the preview shows the product saved in the previous step (or a sample when it was skipped). Expanding Add Logo and Colors keeps a compact Live preview sticky with colors, default look, and badge state. The Corner badge switch is disabled until a logo exists and says Upload a logo first. Logo, colors, badge, and default look save; skip also continues.
- Ready: Edit This Product starts a photo project from the saved product; Open a Photo opens the photo picker; View Product opens the product hub, or Open Studio opens Products when no product was saved. With no Meta key, Make an Image is labelled Meta Key Needed and opens the Connect Meta dialog instead of creating a project.
- Restart during setup: the app resumes a safe step and never traps the user on a removed step.

## Image Editor

- Start from a saved product, a library image, or a dropped file. The original is the first version.
- Change Photo is marked AI; Adjust Photo is marked Free.
- Change Photo offers an optional Studio prompt dropdown under the description with Clean studio background, Soft, natural light, True-to-life detail, and Remove clutter; choosing one replaces the description with that generic, studio-ready phrase, only one can be chosen at a time, and editing the description clears the choice. Quick Looks remain visible without clipped labels.
- Choose a Quick Look or write a change. The button shows the price before the run; the first paid run shows the first-run confirmation and then disappears on later runs.
- Person is optional on any change: the same picker as the generator shows portraits in a menu, the selected avatar opens a larger preview, a chosen person is sent with the change, and the X clears it again.
- The canvas toolbar floats over the stage on one row: zoom out, Fit, 100%, zoom in, a live readout, undo/redo for the current adjust preview, and an icon-only Compare toggle beside them. Compare is available whenever the selected version has a parent. Scrolling over the stage zooms under the pointer, the stage scrolls at 100% instead of clipping, and holding the middle mouse button drags the zoomed photo around it.
- The bottom filmstrip badges every saved version Original, Adjusted, or AI. AI edits, local adjustments, size labels, batch applies, and deletes all refresh it.
- Version panel: the selected version shows its status, description, details, and export format; Save as Product, Save as Person, Add to Set, Export Version, and Copy Image act on it; Delete Version appears only for versions other than the original, and New Version stays pinned at the bottom.
- Hold Space for the earlier version; compare with the toolbar toggle, slider, mouse divider, and keyboard.
- Adjust Photo: Free, 1:1, 4:5, and 16:9 crop presets with Reset crop; rotate left/right; flip H/V; Exposure, Contrast, Highlights, Shadows, Warmth, Saturation, Sharpness, and Vignette. Double-click any slider to reset it; Reset All clears the transform. Apply Adjustment is free and creates a version.
- Batch color applies only color controls and creates one version per ready image, capped at 50.
- The priced action and compact month budget stay pinned under the left inputs; the canvas footer carries Add Photo and Export instead.
- Export writes the chosen format to the chosen folder; the file opens.
- Copy Image and Paste Image work through the main process.

## Image Generator

- Create a draft, describe the image, choose 1–4 images, shape, and format. The price is on the button and the month budget stays with it under the left inputs.
- Attached Product, Person, and Scene references appear as removable visual chips in a Shot recipe row. Scene can be browsed before a product exists; the chip waits with a clear Add a product photo to use this scene prompt.
- Examples can be filtered to All, White Backdrop, Lifestyle, On Model, or Flat Lay. The page says when an example will use the selected product, and each example card carries a Your product badge in that state.
- Output settings use proportional Shape cards with 1:1 Storefront, 2:3 Social, and 3:2 Banner hints. Setting How many to 2–4 without a reference shows matching placeholder frames in THIS IMAGE.
- The Details panel is present before the first image and shows three short description tips; they disappear after the first result. Output settings (count, shape, format) live in the same panel; at 1024–1439 the Details button opens them as a sheet.
- Select a result by opening it: the inspector shows its label, description, size, cost, created time, Set link, and Edit, Download, Save as Product, Save as Person, Add to Set, and Delete. The newest result is selected by default.
- History lists completed makes with a friendly status. Choosing a row filters the results; Show all clears it; a make with no images shows an empty state instead of the examples.
- Add a product photo, a person, and a scene. A product can be added and named from the picker mid-flow. The scene supplies setting/light/props without its subject.
- A generated image can be saved as a Product or a Person. Save Product appears on the Products page after a refresh.
- Edit opens the result in the Image Editor. Download saves the image.
- A policy refusal, a timeout, a short count, and a 429 each show the approved copy and do not overbill in Usage.

## Products

- Products shows “101 starter products · N of yours,” search, sort, category pills, and pagination. The starter list pages 20 at a time; category pills filter Starter Products only.
- Starter Products open with Edit Photo and Make an Image with this Product, without Rename or Delete. Hovering a starter card offers Use in Generator and Try in Editor; hovering a saved product offers Generate Scene, Edit Photo, and View Projects.
- Generate Product Photo opens the Image Generator with the product prompt; Save as Product adds it under Your Products. Add Product Photo asks for a name before saving.
- A product hub keeps Products selected in the left navigation, shows a contextual Products back button, and puts the product name in the window title. It shows the source photo, Product notes, Add to Set, Make an Image with this Product, linked projects, Link Existing Projects, archive, and delete. Clicking the product title renames it in place; Enter saves, Escape cancels, and clicking away saves. Notes save locally and are added to later image prompts only when this product is selected. The empty project state offers Edit Photo (Free) and Make an Image.
- **This build intentionally has no Listing Kit, listing copy, or Business profile.** Sets exist only as image organization; no rail item, menu item, or settings section should offer the retired tools.

## Scenes

- Scenes shows “33 starter scenes · N of yours,” search, sort, category pills, and pagination. The starter scenes are filtered by six categories; Your Scenes pages separately.
- The four studio backdrops are straight-on with a soft floor-to-wall crease low in the frame, no visible paper roll or side edge, and no harsh shadows; the three Outdoor spaces wall facades have an empty space for a hanging lamp and no lamp in the frame.
- Add Scene Photo saves a photo with a name; user scenes can be renamed or deleted. Opening a scene shows the full image and Make an Image with this Scene, which opens the Image Generator with the scene chip ready for a product photo.
- Choose a Scene in the Image Editor or Image Generator opens a dialog with Presets, Your Scenes, and Projects. Presets and Your Scenes use the scene reference path; Projects keeps the existing ready-image scene reference. The setting and light are borrowed; the subject is never copied.
- The Scenes page and the scene picker are included in the axe pass.

## Sets

- Add any ready generated image, edited version, or saved product with Add to Set. Create a new Set from the same dialog. Open a Set and use Add to Set to bring in a product or image; Done closes the picker.
- Sets lists each Set with its cover and count. Set detail shows member images and product photos, an Add to Set action, and a contextual back route that returns to the Set.
- Set detail filters All, Products, and Generated & Edited so source references stay distinct from finished shots. Clicking any card image opens a high-resolution preview with previous/next and, for made images, Compare with Source.
- Remove from Set lives in each card's overflow menu, not the title line. Removing shows an undo toast and never deletes the image, product, or project.
- From a Set image or product source, Edit Photo opens a new photo project and Make an Image with this Photo or this Product opens a new generator project. The imported source and all resulting images stay in the Set automatically.
- Export Set opens a preset dialog: Original (full-size folder), Square 1:1 (1600 × 1600), or Portrait 4:5 (1600 × 2000). Each export creates a unique numbered folder with no manifest. Open Folder opens the remembered Set export folder.
- Delete a Set only removes the organization; images and projects remain.
- An existing v11 pack library upgrades to v12 with its ready images preserved as ordinary image projects; old pack plans, pending rows, and pack jobs are removed.

## All work

- The rail has All work, Products, Sets, People, Usage, Image Editor, Image Generator, and Settings. The rail never shows Reset App; the sidebar collapse toggle sits beside the wordmark in the header with Collapse/Expand tooltips. Image Editor or Image Generator is highlighted while you are inside that tool.
- Filters are All, Edited, Generated, Products, and Sets. Sets also appear as a preview row in All, with View all Sets when there are more than four. An empty library offers four cards: Add a Product Photo, Image Editor, Image Generator, and Sets.
- A zero-image project reads as a draft card with its saved prompt snippet, linked Product/Person pills, and Continue draft. Hover quick actions offer Open, Duplicate, Add to Set, and Delete; Add to Set is disabled until an image exists.
- Project names rename inline from the card menu: type, Enter saves, Escape cancels, clicking away saves.
- Drop a photo on All work to open it in the Image Editor. Sets are filled from image actions; there is no drag-to-Set behavior.
- Duplicate, export, select, bulk delete, search, sort, pagination, and product sections work.
- A library over 500 projects paginates at 20 cards and keeps selection scoped to loaded cards.

## People

- People lists Your People first and the first 24 of 50 starter synthetic people, paged 24 at a time. The starter grid still stays above the fold at 1440 × 900. An empty Your People section is a single compact line, not a large empty card.
- Age chips All, 20s, and 30s+ filter the casting grid; Default, Name, and Most used sort it.
- Starter people open with four studio looks; the original can be restored. Clicking a look selects it, the active ring is visible, and the dialog explains how the chosen angle guides pose and framing.
- Make an Image with This Person seeds the generator with the person and look.
- Add, rename, and remove a person. A generated image can be saved as a person.

## Usage

- Images made shows the total plus a paid AI vs free adjustment breakdown. Monthly Limit shows the spend and a single remaining line ($ left and estimated AI images left) instead of repeating the progress label. Every Image hides Duration by default; expanding a row shows Requested, Returned, Duration, and billing/error detail.
- CSV export opens with the documented columns; cost rows sum to the displayed month spend.
- Budget saves a monthly limit, shows the warning when a run would exceed it, and can be cleared.
- Old historical `set`, `listing`, `analyze`, and `cutout` rows remain in Every Image with their recorded cost.

## Settings

- Meta connection: Test Connection, Replace, Test and Save, and Remove with confirmation. The full key never appears after saving.
- Privacy: the trust cards distinguish local data, Meta requests, and license calls; Technical details holds host names and Install ID. In an unpackaged build, Reset App opens a destructive confirmation and is not present in the rail. About: Technical details holds Electron/Chromium/Node versions.
- Logo & Colors: colors, From a Photo, logo, badge corner/size/opacity, default look, preview.
- **There is no Business section.** `/settings/business` redirects to the Meta connection page.
- Storage: backup, restore, library path, and the backup status.
- Appearance: theme and density; preferences persist after restart.
- License, Updates, Privacy, and About work as before. About uses the Meta AI Studio link.

## License and offline behavior

- With 13 days since the last check and the portal down, the app shows Working offline and can still generate.
- After 14 days offline, the library is read-only; Browse My Library still opens it. View, copy, delete, backup, and export work. Project creation, imports, local adjust, size labels, Sets/Products/People changes, and generation return "Reactivate to use the studio." and the Read-only banner is visible.
- A valid key restores generating and editing. Deactivation releases the machine.
- A key issued for another app in the license center is rejected. The app sends `app_slug` and shows the normal invalid-key message.
- Copy the app-data folder to a second computer (or change the machine id on a disposable VM). The copied license is not accepted; pasting the key on the second machine activates it and consumes a seat. A portal reset frees the seats, and the same machine re-activates with the same key.
- No key or prompt is shown in the interface, logs, or clipboard.
- Launch a packaged release with `MOSS_DEV_UNLOCK=1`, `MOSS_MUSE_FAKE=1`, `MOSS_E2E=1`, and `MOSS_LICENSE_API_BASE=http://127.0.0.1:1`. It still shows activation and ignores every override.

## Accessibility and layout

- Run axe on activation, onboarding, product hub, editor, adjust preview, generator results, usage, people, scenes, settings, library, Set detail, and open modal/lightbox surfaces. No serious or critical findings. While any modal is open, #root is inert and aria-hidden; closing the last modal restores it.
- Keyboard: Ctrl/Cmd+K palette, Ctrl/Cmd+1 Image Editor, Ctrl/Cmd+2 Image Generator, Ctrl/Cmd+F search, Ctrl/Cmd+E export, Ctrl/Cmd+Enter primary action, Ctrl/Cmd+B rail, Space original, arrows versions, brackets sliders, double-click sliders to reset, Escape close, ? shortcuts.
- Check 1440×900, 1024×700, 150% zoom, and 200% zoom with no horizontal overflow, including filtered product and example pills, the canvas toolbar, and left-column commit footers.
- Check light and dark themes on every main screen.
