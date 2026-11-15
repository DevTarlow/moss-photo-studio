> Current scope note: the set plan, listing writer/kit, Business profile, and text-model paths described below were removed in the photo-studio refactor. Image Packs were then added as a universal, prompt-template workflow. This file remains as the historical delivery record.

# Milestones

The application work is complete across the M0 through M7 scope. The repository history was consolidated into four logical commits at the end of the run rather than one commit per milestone. This file maps the milestone deliverables to the code and the verification that covers them.

## M0: Foundation

Delivered:

- Electron, React 19, TypeScript strict, Vite, and electron-vite scaffold.
- Main, preload, renderer, and shared boundaries.
- Frozen named `window.moss` API and validated IPC contracts.
- `moss-media://` protocol, CSP, sandboxing, navigation guards, external-link allowlist.
- SQLite WAL database with migrations and backups.
- Settings, encrypted secrets, logging with rotation and redaction.
- Build, icon, asset, token-audit, and release-gate scripts.

Verified by:

- `npm run typecheck`
- `npm run build`
- `npm test` integration recovery tests
- packaged smoke launch

## M1: Library and import

Delivered:

- Photo, set, and image projects.
- Library grid and list, filters, sorting, search, month total, setup card, rename, duplicate, delete, and export.
- One-photo import through the main process.
- Original byte preservation, normalized working copy, thumbnails, EXIF stripping, 40 MB and 256 px guards.
- 200-project pagination and virtualization above 200 loaded projects.

Verified by:

- `tests/integration/media.test.ts`
- E2E import, library, delete, export, persistence, and large-library tests
- 510-project virtual list test mounting fewer than 80 cards

## M2: Sets and jobs

Delivered:

- 1 to 8 shot plans across the recipe categories.
- Per-shot directions, people, feature text, enablement, and ordering.
- Plan autosave and close-time flush.
- One request per shot, concurrency 2, cancel and stop-after behavior.
- Exact pricing before paid actions, budget guard, partial results, retry only failed shots, and cost ledger.
- Latest-attempt set review with older ready versions preserved.

Verified by:

- `tests/integration/jobs.test.ts`
- E2E five-shot set, failed retry, price checks, and budget
- prompt and labels unit tests

## M3: Image Editor and local adjust

Delivered:

- 32 tiles in six groups, quick fix, 12 bundled people, user people.
- Replace or keep user text.
- Version labels, parent and branch tree, compare, filmstrip, version list.
- Space-to-original, arrow navigation, delete version, copy, export.
- Local crop, rotate, flip, brightness, contrast, saturation, warmth, sharpen, vignette, undo and redo.
- Free local adjust as a new version with stored transform.
- Clipboard copy and paste through the main process.

Verified by:

- E2E editor, compare pointer and keyboard, crop, rotate, sharpen, free adjust, clipboard, and offline edit
- `tests/integration/adjust.test.ts`
- version label and recovery tests

## M4: Image Generator

Delivered:

- 24 starters across six groups.
- Optional current or uploaded product reference.
- One to four images, three shapes, three formats.
- Prompt guard composition and image-count request.
- Results grid, partial result copy, Download, Edit, Use as a Set's Photo, Delete, and Newest marker.
- Reference and format persistence on the project.
- Keyboard primary action and first-run confirmation.

Verified by:

- E2E four-image Create, result actions, editor return, and menu context
- prompt and template unit tests
- Muse client generation and partial response tests

## M5: People, brand, and settings

Delivered:

- 12 synthetic bundled people and custom people with normalized portraits.
- Person create, rename, remove, usage count, and picker.
- Up to six colors, logo, badge, badge corner, size, and opacity.
- Local badge compositing with no upscaling and cache-safe logo replacement.
- Settings Studio, Appearance, Library, License, Privacy, and About.
- Theme, density, reduced motion, library location move, logs, usage deletion, and install id.
- First-run and ongoing setup guidance.

Verified by:

- E2E People, Settings, dark theme, key management, brand consistency, and accessibility
- badge compositing unit test
- settings and secret removal tests

## M6: Usage, onboarding, and license

Delivered:

- Usage summary, by-project rollup, paginated ledger, CSV, budget, and unknown-billing display.
- Activation, grace, expiry, deactivation, 24-hour validation, and read-only library.
- Fake license and Muse hosts for tests.
- Onboarding key step, optional theme, logo, and colors step, category choice, six-image preview, first paid set, Got It confirmation, and skip behavior.
- Setup card completion rules.

Verified by:

- E2E activation, onboarding keyboard first run, usage totals and CSV reconciliation, budget, offline grace, expiry, and local export while read-only
- license state-machine unit tests
- license provider integration tests

## M7: Packaging, documentation, and release verification

Delivered:

- Linux AppImage and deb builds with desktop entry, icons, and sandbox postinstall.
- Windows NSIS and macOS DMG configuration. Native builds remain unverified.
- Release gate for the placeholder store URL.
- README, DECISIONS, LICENSES, privacy, API notes, manual acceptance, and this milestone map.
- 100 unit and integration tests, 13 serial E2E tests, 41 screenshots, axe sweep, token contrast audit, and clean lint.
- 510-project virtualization test and all-screen 1024/150 layout assertions.

Verified by:

- `npm test`
- `npm run test:e2e`
- `npm run audit:tokens`
- `npm run lint`
- `npm run build:linux`
- AppImage and deb launch smoke tests
