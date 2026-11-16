# Design system

Moss uses **[Astryx](https://github.com/meta/astryx)** as the generic UI foundation and keeps a small custom layer for the studio canvas and brand-specific visuals. This file is the working contract for the migration.

## Version and dependencies

- `@astryxdesign/core@0.7.11`
- `@astryxdesign/theme-neutral@0.7.11` (base for icons and theme inheritance)
- `@stylexjs/stylex@0.19.0` (peer requirement)
- `@astryxdesign/cli@0.7.11` (development only)

Astryx is beta. Pin exact versions and commit the lockfile; do not upgrade casually. Run `astryx upgrade` as a deliberate change with the full visual suite.

## Theme

`src/renderer/src/theme/mossTheme.ts` extends the neutral theme with the Moss palette, typography, radii, motion, and component overrides:

- **Surfaces:** warm paper `#FAF7F2` in light, near-black `#131610` in dark; surface cards are `#FFFFFF` / `#0C0E09`.
- **Selection / success / focus:** forest green `#14532D` / `#86C79A`.
- **Primary action:** burnt rust `#9A3412` / `#B45309`, via the local `--moss-primary` token and a `button` variant override.
- **Text:** `#1C1A17` / `#E9E4D6` primary; `#5C574E` / `#B9B3A2` secondary; disabled values are dark enough for AA.
- **Typography:** Inter body, Plus Jakarta Sans headings; base 14px, ratio 1.2.
- **Radii:** 6px inner, 8px element, 12px container, 16px page.
- **Motion:** fast 120ms, medium 240ms, slow 400ms; the Astryx theme honors reduced motion when the app setting follows the system.
- **Canvas:** local `--moss-canvas` / `--moss-canvas-text` tokens for the dark editor stage.

The theme is applied by `src/renderer/src/theme/MossThemeProvider.tsx`. It resolves the saved `theme` setting, including the OS preference for `system`, passes it to Astryx `Theme`, and wires `LinkProvider` to a small React Router adapter so Astryx links stay inside the hash router.

`src/renderer/src/styles/tokens.css` keeps the app's short names (`--bg`, `--text`, `--accent`) but holds no palette of its own: each semantic name is a `var(--color-…)` alias to a theme token, and the values the theme has no role for (the rail, the canvas, tints, media inks) use `light-dark()` pairs so one rule covers both modes. Elevation is the one exception that still needs an `html[data-theme='dark']` block, because `light-dark()` only accepts colours. Adding a literal palette value to that file means the theme is no longer the source of truth; add a theme token instead.

## Language and vocabulary

The interface should describe what changes in the user's picture, not how the model works. Keep the calm, first-person, full-sentence voice used throughout the app, and use Title Case for primary button labels (for example **Add Product Photo**) with sentence case for headings and fields.

| Use | Avoid | Notes |
|---|---|---|
| Meta key, Meta connection | Muse key, Meta Muse key, API key, LLM | The user owns a Meta account; keep Meta explicit where it affects billing or privacy. |
| Look | tile, template, style preset | The 32 image treatments are looks in the interface. |
| Description | prompt, words, studio words | The user writes a description of the picture they want. |
| Product photo, Person, Scene | product reference, person reference, scene reference | These are the pictures the user chooses, not model inputs. |
| History | runs | A run is an implementation detail. |
| Image 4, Adjusted 1, Scene 2, Person 1 | Created 04, Adjust 01, Model 01 | Version labels are user-facing. |
| Starter Products, Starter People | included | Starter content is a starting point, not a separate product tier. |
| All Work | Library (as a page name) | The page is All Work; the library is the folder on disk. |
| Add to Set | Save to Set | One action for images and products; an item belongs to one Set at a time. |
| Support report | diagnostics | Support reports are for people, not developers. |

Do not expose model/provider internals, API hosts, install IDs, or timing columns in primary UI. Put them behind a Details/advanced disclosure. Do not use “reference”, “tile”, “run”, or “ledger” as user-facing nouns.


Render every icon through Astryx `Icon`: pass the lucide component to the `icon` prop and pick a semantic size.

```tsx
import { Icon } from '@astryxdesign/core'
import { Search } from 'lucide-react'

<Icon icon={Search} size="sm" />
```

Do not render a lucide component directly (`<Search size={14} />`). Direct SVG bypasses the theme's icon size and colour roles and cannot fill `IconButton`/`Button` icon slots. The four sizes are the theme's (xsm 12, sm 16, md 20, lg 24); do not pass pixel sizes. `Icon` accepts standard SVG props (`strokeWidth`, `className`, `aria-hidden`), so `svg.lucide` styling and the `Property 'icon'` typing stay intact.

## CSS and providers

`src/renderer/src/styles/index.css` establishes the layer order and imports:

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '../theme/moss-theme.css';
@import 'tailwindcss/utilities.css' layer(utilities);
```

`@astryxdesign/theme-neutral/theme.css` is not imported. `mossTheme.ts` is the authoring source; `npm run theme:build` compiles it into `moss-theme.css` (static, scoped to `[data-astryx-theme="moss"]`) plus `moss.js`, `moss.d.ts`, and `moss.variants.d.ts`, which are committed. `MossThemeProvider` passes the built module to `Theme`, so `Theme` sees `__built` and skips runtime style injection. Edit the theme source, then rebuild: `npm run theme:check` fails when the committed output is stale, and every release build runs it first.

Do not add unlayered global element styles that set `color` or `font` on `button`, `input`, `textarea`, or `select`: they beat every Astryx layer and silently break component state styling. The previous global `color: inherit` rule was removed for this reason.

Shell chrome belongs to the theme, not to internal class names: the `app-shell-header`, `app-shell-sidenav`, and `top-nav` targets own their surface colours and padding. `index.css` keeps only what is the wrapper's job — the drag region, the nav's flex sizing, and `app-shell-main`'s `min-height`, which is not a theme target.

CSP is unchanged: all Astryx CSS, fonts, and icons are bundled; there are no remote assets. Local fonts are self-hosted under `resources/fonts`.

## Component map

| Moss primitive / surface | Astryx replacement | Notes |
|---|---|---|
| AppFrame, Rail, TopBar | AppShell, SideNav, TopNav | Keep the Electron drag region and platform padding in a wrapper. |
| Button, IconButton | Button, IconButton, ButtonGroup | Use `label`, `variant`, `isLoading`; no custom loading spinner at call sites. |
| Chip, pill filters | ToggleButton/ToggleButtonGroup, SegmentedControl | Static metadata uses Token/Badge, not a button. |
| Segmented | SegmentedControl/SegmentedControlItem | Radio-group semantics. |
| Field, TextareaCounter | TextInput, TextArea, Field, FormLayout | Use `status` for inline errors. |
| Native select, checkbox, range | Selector, CheckboxInput, Slider | No unlabeled native controls. |
| Dialog, Sheet | Dialog, AlertDialog, Drawer, BottomSheet | One modal stack; focus return. |
| DropdownMenu, MoreMenu | DropdownMenu/MoreMenu | Use one menu pattern. |
| Toast, Tooltip, Progress, Spinner, Skeleton | Toast/useToast, Tooltip/InfoTip, ProgressBar, Spinner, Skeleton | Use the primitive’s live-region/loading semantics. |
| EmptyState, ErrorState, Pagination | EmptyState, Banner/EmptyState, Pagination | Preserve the copy and 20/page behavior. |
| Card/panel/plan-card | Card, ClickableCard, SelectableCard, Section | Whole-card open target; nested actions stay independent. |
| Onboarding dots | Stepper/Step | Ordered-list semantics; optional steps show Optional. |
| File dropzone | FileInput | Use dropzone mode; keep the custom global drag overlay. |
| Photo/Create canvas | Custom | Keep the stage, compare, filmstrip, crop overlay, and zoom. Re-skin chrome with Astryx tokens. |
| Brand badge preview | Custom | Keep the sample preview and color compositing. |

## Migration rules

1. Fix the cascade/token layer before adding more Astryx CSS.
2. Keep the custom canvas, crop overlay, filmstrip, brand preview, and file-drop logic; do not rewrite them for the sake of consistency.
3. Migrate one surface at a time and run the relevant E2E/a11y/screenshot checks.
4. Replace class-based test selectors with roles, labels, or stable test IDs as each surface moves.
5. Keep the existing behavior contracts from `DECISIONS.md`: pricing, confirmations, 20/page pagination, delete copy, product saved-copy semantics, plan autosave, local adjust.
6. Update screenshot baselines intentionally after inspecting the result; do not chase incidental churn.
7. Add axe coverage for portals, dialogs, the command palette, dropzones, and reduced-motion states.
8. Before a release, build the theme statically and measure the renderer bundle and first paint.

## Workspace inspector pattern

The editor and the generator share one workspace grammar: the left column holds the inputs, the center holds the output, the right column is the inspector for the selected output, and the footer holds the priced action. The generator's inspector is not a dashboard: it follows the editor's version panel.

- **Panels:** `ws-left` and `ws-right` use `--surface` with a 1px `--border`; the center uses `--bg`. A `ws-right` inspector is always mounted at 1440 and wider, resizable (300px default, 260–360), and opens as a `Sheet` titled `Details` below 1440.
- **Sections:** `.section-label` (11px, 600, uppercase, `--text-faint`) names each block. Sections separate with `mt-4 border-t pt-4` and `--border`. Do not add nested cards inside the rail; the inspector is already a surface.
- **Copy:** result headings use 15px/600; `.meta` and `.hint` carry dates and costs; `.field-label` labels settings controls. The description uses the shared `DescriptionPreview` clamp and its `Show more` control.
- **Actions:** full-width secondary `Button size="sm"` rows with a 16px `Icon`; destructive actions are ghost with `--danger`. Keep the same order in both tools: use the output, then read its description/details, then delete.
- **Disclosure:** the output settings show a one-line summary at all times and open their controls on demand. The content stays in the DOM with `hidden` so `aria-controls` always resolves. History appears only when a completed make exists.
- **Constraints:** when a reference removes a choice (a product, person, or scene makes one image at a time), show the constraint as a sentence instead of disabled options. The summary leaves out the count for one image and still shows the frame and format.
- **Empty states:** one short explanation plus, before the first result, three tips that directly affect picture quality. No illustration dashboards, no counters.

### Result selection

The generator keeps the editor's selection model: the newest result is selected by default; opening another result selects it; a completed make returns selection to the newest. The selected card takes the same ring language as a selected library card (`--accent` border plus a `--accent-soft` tint). The inspector is a second, stable home for the selected image; it does not replace the persistent card actions.

## Current status

- Foundation, theme, providers, and CSS layer order are in place.
- Colour has one owner: every semantic name in `tokens.css` aliases the theme, the mode block holds only elevation, and `npm run audit:tokens` reads `mossTheme` so a stale or missing token fails instead of rendering an inherited colour. The audit also covers the selected-row tints and the danger badge used by the generator inspector.
- Every icon renders through Astryx `Icon`; no direct lucide elements remain.
- The theme ships as static CSS: `npm run theme:build` regenerates `moss-theme.css` and the built module beside it, and release builds refuse to package a stale copy.
- The app shell's surfaces come from theme targets, so the rail, header, and top nav no longer depend on `.astryx-*` class selectors in `index.css`.
- Activation is the first surface fully off the homegrown primitives: Astryx `TextInput` and `Button` replace the local `Field` and `Button` there.
- Sets use collection cards with a cover/count and a detail grid for images and product sources with explicit Edit Photo, New Image from Reference, and remove actions. SaveToSetDialog is a small dialog mounted once at the app root and opened from image actions. Onboarding is redesigned with a Welcome screen and setup steps for the key, an optional product, an optional logo and colors, and Ready. Key-later and sticky actions are unchanged.
- The Astryx AppShell, TopNav, and SideNav now wrap the app; Library, Products, People, Usage, and Settings use Astryx controls and shared collection patterns.
- Photo has a fitted canvas, exporter-aligned rotate/crop preview, a draggable compare divider, and keyboard crop controls. Create has a persistent Details inspector with the selected image's description/details/actions, the Output settings disclosure, and History; it becomes a Details sheet below 1440. Create results keep their persistent Edit, Download, Save as Product, and More actions plus a lightbox. The version and result panels share `DescriptionPreview`. Workspace panels can be resized and persist their widths. The custom canvas, crop overlay, filmstrip, and brand preview remain custom.
