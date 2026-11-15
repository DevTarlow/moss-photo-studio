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
- Connect Meta: the Meta Muse key is optional and can be added later. A bad key shows a plain error; a saved key shows only its last four characters.
- Add product: a JPEG, PNG, or WebP saves as a Product. A photo under 800 px is allowed with the small-photo warning.
- Skip product: the optional step continues to Make it your own.
- Make it your own: logo, colors, badge, and default look save; skip also continues.
- Ready: Finish Setup opens the saved product hub, or Products when no product was saved.
- Restart during setup: the app resumes a safe step and never traps the user on a removed step.

## Image Editor

- Start from a saved product, a library image, or a dropped file. The original is the first version.
- Choose a tile or write a change. The button shows the price before the run; the first paid run shows the first-run confirmation and then disappears on later runs.
- Hold Space for the earlier version; compare with the slider, mouse divider, and keyboard.
- Local Adjust: crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, vignette. Apply Locally is free and creates a version.
- Batch color applies only color controls and creates one version per ready image, capped at 50.
- Export writes the chosen format to the chosen folder; the file opens.
- Copy Image and Paste Image work through the main process.

## Image Generator

- Create a draft, describe the image, choose 1–4 images, shape, and format. The price is on the button.
- Add a product reference, a person, and a scene reference. References make one image at a time. The scene supplies setting/light/props without its subject.
- A generated image can be saved as a Product or a Person. Save Product appears on the Products page after a refresh.
- Edit opens the result in the Image Editor. Download saves the image.
- A policy refusal, a timeout, a short count, and a 429 each show the approved copy and do not overbill in Usage.

## Image Packs

- Start a pack from a Product, a library image, or the New menu with no source. The workspace shows Pack setup and a six-shot Studio Essentials plan.
- Change the preset, pack brief, look, shape, format, person/look, and scene. Every shot's prompt preview must match the shared brief and show the product/person/scene guards exactly as the queue will send them.
- Add, remove, reorder, disable, and rename shots. A pack holds up to eight shots. A prompt-only pack has no source guard; an On Person shot requires a person.
- Make missing shots; confirm the exact price on the first paid run. Successful shots stay when another fails. Retry missing shots and choose a version per shot.
- Edit a pack image in the Image Editor; its edited and adjusted versions stay attached to the same shot.
- Export Pack writes a self-contained folder with one selected/latest image per enabled shot, `pack.json`, and `README.txt`. No marketplace resizing, listing files, or alt-text files are written.
- Library Packs filter, product work counts, duplicate/delete, dark mode, 1024×700, 150% zoom, and axe checks pass.
- A reference pack calls image edits; a prompt-only pack calls image generations. There must be no text/chat/SAM request.

## Products

- Products shows “20 included · N yours,” search, sort, and pagination.
- Included products open with Edit This Photo and New Image from Reference, without Rename or Delete.
- Create a Product opens the Image Generator with the product prompt; Save as Product adds it under Yours.
- A product hub shows the source photo, category, linked work, Link existing work, archive, and delete.
- **This build intentionally has no sets, Listing Kit, listing copy, or Business profile.** No rail item, menu item, route, or settings section should offer them.

## All work

- The rail has All work, Products, People, Usage, Image Editor, Image Generator, and Settings.
- Filters are All, Edited, Generated, and Products. There is no Sets filter.
- Drop a photo on All work to open it in the Image Editor. There is no shift-to-set behavior.
- Rename, duplicate, export, select, bulk delete, search, sort, pagination, and product sections work.
- A library over 500 projects paginates at 20 cards and keeps selection scoped to loaded cards.

## People

- People lists Yours first and 24 included synthetic people.
- Included people open with four studio looks; the original can be restored.
- Create an Image seeds the generator with the person and look. There is no Create a Set action.
- Add, rename, and remove a person. A generated image can be saved as a person.

## Usage

- The month card counts returned images at one cent each. There is no text-cost line.
- CSV export opens with the documented columns; cost rows sum to the displayed month spend.
- Budget saves a monthly limit, shows the warning when a run would exceed it, and can be cleared.
- Old historical `set`, `listing`, `analyze`, and `cutout` rows remain in the ledger with their recorded cost.

## Settings

- Meta API key: Test Connection, Replace, Test and Save, and Remove with confirmation. The full key never appears after saving.
- Logo & Colors: colors, From a Photo, logo, badge corner/size/opacity, default look, preview.
- **There is no Business section.** `/settings/business` redirects to the API key page.
- Storage: backup, restore, diagnostics, library path, and the backup status.
- Appearance: theme, density, reduced motion; preferences persist after restart.
- License, Updates, Privacy, and About work as before. About uses the Meta AI Studio link.

## License and offline behavior

- With 13 days since the last check and the portal down, the app shows Working offline and can still generate.
- After 14 days offline, the library is read-only; Browse My Library still opens it. Local Adjust and export work.
- A valid key restores generation. Deactivation releases the machine.
- No key or prompt is shown in the interface, logs, or clipboard.

## Accessibility and layout

- Run axe on activation, onboarding, product hub, editor, adjust preview, generator results, usage, people, settings, and library. No serious or critical findings.
- Keyboard: Ctrl/Cmd+K palette, Ctrl/Cmd+1 Image Editor, Ctrl/Cmd+2 Image Generator, Ctrl/Cmd+F search, Ctrl/Cmd+E export, Ctrl/Cmd+Enter primary action, Ctrl/Cmd+B rail, Space original, arrows versions, brackets sliders, Escape close, ? shortcuts.
- Check 1440×900, 1024×700, and 150% zoom with no horizontal overflow.
- Check light and dark themes on every main screen.
