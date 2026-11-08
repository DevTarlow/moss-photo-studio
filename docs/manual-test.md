# Manual test and acceptance status

This is the record of what was run, what passed, and what the acceptance owner still needs to do on a clean machine. The labels match the brief: **A** is agent-verifiable, **O** needs a real key, invoice, physical desktop, or package install.

## Current automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 100 tests pass in 10 files |
| `npm run test:e2e` | 16 serial tests pass, including axe on dialogs, 510-project pagination, all-screen 1024 and 150% layout, and screenshot comparison |
| `npm run audit:tokens` | All foreground/background token pairs pass AA in light and dark |
| `npm run lint` | 0 errors, warnings for unused locals and preferences |
| `npm run build` | Pass |
| `npm run build:linux` | AppImage and deb produced |
| Packaged override test | A packaged release launched to Activation with `MOSS_DEV_UNLOCK=1`, `MOSS_MUSE_FAKE=1`, and `MOSS_E2E=1` set, proving the build gate ignores them. `fakeMode` was false |
| AppImage launch smoke | Extracted AppImage launched to Activation through Playwright with `APPIMAGE_EXTRACT_AND_RUN=1` |
| deb launch smoke | `.deb` was unpacked with `dpkg-deb -x` and its executable launched to Activation. The package metadata, desktop entry, icons, and control scripts were inspected |
| Screenshot baselines | 41 images in `tests/screenshots`. The 1440 by 900 light and dark images are compared with a maximum diff ratio of 0.01. The 1024 by 700 and 150% zoom images are captured fresh because Playwright can restore the Electron viewport under that helper |

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
- Onboarding: key step, optional theme, logo, and colors step (no sample preview; Settings keeps it), category choice, a first-set picker with 1/3/6 count presets and per-shot toggles, first-run confirmation, first paid set. The first paid set was started with Space on the focused primary button and finished through the first-run dialog with Tab and Enter.
- A five-shot set costs `$0.05`. The primary button says the price before the click. Five requests produced five images.
- A two-shot failure set showed the partial review, the failed cards, and `Try Again · $0.02`. The retry made exactly two requests. Total set requests were eight. Older ready images were preserved.
- Image Editor: Kitchen table tile, compare slider with pointer and keyboard, hold Space for the earlier version, local 1:1 crop, rotate, brightness, sharpen, apply locally free, version labels, and new version. Copy Image writes a PNG and Paste Image reads it back through the main-process clipboard.
- Set preview: the lightbox opens on a blurred glass scrim, closes when clicking outside the image, and still closes with the X.
- Create: four images, run cost, first result gets Newest, Edit opens the editor, Back to Create returns to the result. The empty state labels the four starting cards Examples, and the idea menu groups use darker bold titles.
- Set export: six named WebP files and a UTF-8 `set.txt`, no overwrite, format and quality controls. The toast names the folder and count and offers Open Folder.
- Usage: month total equals returned images times one cent, by-project rows, ledger, CSV totals sum to the displayed month spend, budget warning at `$10.00`, reset budget.
- People: 12 bundled people, user section, Maya's included card, descriptions, and the synthetic-people note.
- Settings: light and dark theme, persisted after restart, window bounds remembered, 1024 by 700 and 150% zoom coverage for every main screen, keyring warning visible when safeStorage is unavailable.
- Settings key: Test Connection, Replace, Test and Save, Remove with confirmation. The full key never appears in the page after saving.
- Offline: with both fake hosts down, generation shows the approved offline copy, no images, no cost. The library, local adjust, and export remain usable.
- Stray network: no renderer request left for an unexpected host. Only `moss-media://` and the local fake hosts appeared.
- License grace: with the stored validation moved back 13 days and the store down, the app opened the library with the grace banner. At 15 days it opened Activation, Browse My Library worked, and a project showed the read-only message.
- Setup card: after the key is removed, the library shows Finish setting up with one Add your Meta key step; the Make a first set row is gone.
- Axe: activation, onboarding, set plan, set review, image editor, adjusted photo, Create empty, Create results, Usage, People, Settings light, Library light, Library dark, Library at 1024, Library at 150% zoom, the first-run confirmation dialog, and the set export dialog were checked. No serious or critical violations remained after fixing the onboarding step group, progress bar names, and dialog animation timing in the check.
- Screenshot comparison passed on a second run with the live app.
- Large library: 510 created projects loaded 20 at a time. Previous and Next moved between pages, and search found the oldest project.
- Application menu: Export, Undo, Redo, Copy Image, zoom, and Toggle Panel enabled only in the correct editor states. Paste stayed available in the Library. The test read the native menu item state through Electron.

## Coverage gaps in the automated artifact

- The 1440 by 900 matrix covers every main screen in light mode. Dark mode covers Activation, Onboarding, Library, Set review, Photo, Create, People, Usage, and Settings. Set plan and Set running are light only.
- Every main screen is captured at 1024 by 700 light. Every main screen also passes a 150% zoom layout and overflow assertion, including the panels as sheets where the viewport hides them.
- The screenshot matrix was added after the bulk of development. The baseline images reflect the final build states only for the visited journey states.
- Dialog states are covered by axe during their normal use but are not each captured as standalone screenshots.
- The library paginates 20 projects at a time and the journey proves a 510-project library renders 20 cards per page and moves between pages. A 2,000 image scroll frame-time profile and a 2,000-version single project were not run.

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

- [x] **A** Under three minutes: paste a key, optionally choose a theme and add a logo or colors, choose a category, choose the images (all six start selected), make six images, see Setup complete.
  - The automated journey completes this in seconds with the fake image host. Human timing with a real key is still an O check.
- [x] **A** The onboarding Logo & Colors step has no sample preview; Settings → Logo & Colors still shows it.
- [ ] **O** On the first-set step, changing the count or switching a shot updates the price, and Just Add the Photo opens the set without charging.

### 4. Key management

- [x] **A** Add a key, test it, reach the library, close and reopen the app. Replace the key and remove it. The full key never appears again.
  - Fake store tested through the UI and body-text check.
- [ ] **O** The same flow with a real key.

### 5. Real product set

- [ ] **O** One photo of a real product to a six shot set. Every shot clearly contains the same product, colors and label are intact, logos are not morphed.

### 6. One shot off

- [x] **A** Switch off one shot. The price drops from `$0.06` to `$0.05`. Five requests are made.
- [x] **A** The set image lightbox opens on a blurred glass scrim; clicking outside the image closes it, and the X still closes it.

### 7. Failure and retry

- [x] **A** Fail two shots with the fake host. The set review shows two failed cards with reasons. Try Again costs `$0.02`. Exactly two requests are made. The earlier images stay.

### 8. Product preservation

- [x] **A half** Create a new version from a long description. The original is still in the library and still selectable.
- [ ] **O** Visual check on a real product: label spelling, logo, color, and shape.

### 9. Compare

- [x] **A** Mouse and arrow keys move the compare handle. Space holds the earlier version.

### 10. Local adjust

- [x] **A** Crop to 1:1, brighten, sharpen, and apply. A new version appears. No spend is recorded. The original remains.
  - Also covered by the local adjust integration test, which checks 400 by 480 output after rotate and crop.

### 11. Create

- [x] **A** Fill the describe box, choose four images, create. Four results appear. Edit opens one. Back to Create returns.
- [x] **A** The empty state shows an Examples title, and the Start from an idea menu has darker bold category titles.

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

- [x] **A half** No serious or critical axe findings on the visited screens in light and dark. Keyboard focus is visible. Every control is reachable. Every main screen passes at 1024 by 700 and at 150% zoom with no horizontal overflow. The Set running and export dialog states are not separately captured at 150%.
  - A real screen-reader pass is still an O check.
- [ ] **O** Screen reader pass with NVDA and VoiceOver on the target machines.

### 18. Products and cross-tool sources

- [ ] **A** Save a generated image, an editor version, and a set shot as Products. Each appears on the Products page after a restart.
- [ ] **A** Start a New Set and a New Image Editor from a Product, then from a ready library image. The chosen photo becomes the project source.
- [ ] **A** Replace a set's product photo from a Product and from a library image. Images already made stay.
- [ ] **A** Add a photo to an existing Image Editor from a Product and from a library image. It becomes a new version.
- [ ] **A** In the Image Generator, choose a Product and a Person from People. The run makes one image and the person is holding the product.
- [ ] **A** The count control is fixed at one image while a reference is selected.
- [ ] **A** Delete a Product. The Products page empties, and projects and images made from it remain.
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
2. Set `MOSS_RELEASE=1 npm run release:gate`.
3. Add a real code-signing identity for Windows and Apple notarization for macOS.
4. Run one real Muse generation and one real Lemon Squeezy activation.
5. Run the real-key, invoice, and product preservation O checks above.
6. Regenerate screenshots only if the design changed intentionally, using `MOSS_UPDATE_SCREENS=1`.
