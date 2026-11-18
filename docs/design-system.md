# Design system

Moss uses **[Astryx](https://github.com/meta/astryx)** as the generic UI foundation and keeps a small custom layer for the studio canvas and brand-specific visuals. This file is the working contract for the migration.

## Version and dependencies

- `@astryxdesign/core@0.7.11`
- `@astryxdesign/theme-neutral@0.7.11` (base for icons and theme inheritance)
- `@stylexjs/stylex@0.19.0` (peer requirement)
- `@astryxdesign/cli@0.7.11` (development only)

Astryx is beta. Pin exact versions and commit the lockfile; do not upgrade casually. Run `astryx upgrade` as a deliberate change with the full visual suite.

## Theme

Appearance offers **ten fixed themes**, five light and five dark. Every one is a compiled Astryx theme, so the palette stays the Astryx source of truth and each ships its own scoped CSS (`[data-astryx-theme="<id>"]`).

| id | Name | Mode | Feel |
|---|---|---|---|
| `moss` | Moss | Light | Warm paper, forest selection, rust action (the original light theme) |
| `sand` | Sand | Light | Sun-bleached paper, olive selection, ochre action |
| `clay` | Clay | Light | Terracotta paper, umber selection, kiln action |
| `lichen` | Lichen | Light | Pale sage paper, deep sage selection, burnt action |
| `stone` | Stone | Light | Limestone paper, slate-teal selection, sienna action |
| `moss-night` | Moss Night | Dark | Near-black green, lichen selection, amber action (the original dark theme) |
| `bark` | Bark | Dark | Espresso, warm wheat selection, copper action |
| `pine` | Pine | Dark | Deep pine, pale moss selection, copper action |
| `ember` | Ember | Dark | Soot, ember selection, rust action |
| `basalt` | Basalt | Dark | Blue-grey stone, pale teal selection, ochre action |

The catalog (ids, labels, modes, legacy mapping) is `src/shared/themes.ts`: no colours, imported by the main process (menu, window chrome), the renderer, and the build/audit scripts.

- `src/renderer/src/theme/themeBase.ts` extends the neutral theme with everything the themes share: typography, motion, radii, elevation, the semantic status colours, and the component overrides.
- `src/renderer/src/theme/palettes.ts` owns each theme's colours: page, surface, muted, rail, ink, borders, selection, the primary action, and the editor canvas. The `Moss` and `Moss Night` entries are byte-identical to the old light and dark theme, so the selected look does not move.
- `src/renderer/src/theme/themes/<id>.ts` is one built source per theme: `defineTheme({ name, extends: themeBase, icons: neutralTheme.icons, tokens, localTokens })`. The `neutralTheme` import must stay in that file — `astryx theme build` scrapes the icon registry from the theme source.
- `MossThemeProvider` reads the saved id, takes its mode from the catalog, and passes the compiled theme to Astryx `Theme`. That single prop pair decides the theme identity and `data-theme`; there is no system-follow and no runtime style injection.

- **Typography:** Inter body, Plus Jakarta Sans headings; base 14px, ratio 1.2.
- **Radii:** 6px inner, 8px element, 12px container, 16px page.
- **Motion:** fast 120ms, medium 240ms, slow 400ms; the app follows the OS Reduced Motion preference and has no in-app motion override.
- **Canvas:** local `--moss-canvas` / `--moss-canvas-text` tokens keep the editor stage near-black in every theme.

`src/renderer/src/styles/tokens.css` keeps the app's short names (`--bg`, `--text`, `--accent`) but holds no palette of its own: each semantic name is a `var(--color-…)` alias to a theme token, and the theme owns the rail (`--moss-rail`) and the selection tint (`--moss-accent-soft`). Only the values the theme has no role for (canvas hairlines, crop dim, media inks) stay literal as `light-dark()` pairs. Elevation is the one exception that still needs an `html[data-theme='dark']` block, because `light-dark()` only accepts colours. Adding a literal palette value to that file means the theme is no longer the source of truth; add a theme token instead.

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
@import '../theme/built/moss.css';
@import '../theme/built/sand.css';
/* …one import per theme, alphabetically/by catalog order… */
@import 'tailwindcss/utilities.css' layer(utilities);
```

`@astryxdesign/theme-neutral/theme.css` is not imported. `palettes.ts` and `themes/<id>.ts` are the authoring sources; `npm run theme:build` compiles each into `theme/built/<id>.css` (static, scoped to its own `[data-astryx-theme]`) plus `<id>.js`, `<id>.d.ts`, and `<id>.variants.d.ts`, which are committed. `MossThemeProvider` passes the built module to `Theme`, so `Theme` sees `__built` and skips runtime style injection. Edit the theme sources, then rebuild: `npm run theme:check` fails when any committed output is stale, and every release build runs it first. `scripts/theme-build.mjs` builds one theme per source file (Astryx refuses `--out` with several files) and reports orphaned output files from renamed themes.

Do not add unlayered global element styles that set `color` or `font` on `button`, `input`, `textarea`, or `select`: they beat every Astryx layer and silently break component state styling. The previous global `color: inherit` rule was removed for this reason.

Shell chrome belongs to the theme, not to internal class names: the `app-shell-header`, `app-shell-sidenav`, and `top-nav` targets own their surface colours and padding. `index.css` keeps only what is the wrapper's job — the drag region, the nav's flex sizing, and `app-shell-main`'s `min-height`, which is not a theme target.

CSP is unchanged: all Astryx CSS, fonts, and icons are bundled; there are no remote assets. Local fonts are self-hosted under `resources/fonts`.

## Component map

| Moss primitive / surface | Astryx replacement | Notes |
|---|---|---|
| AppFrame, Rail, TopBar | AppShell, SideNav, TopNav | Keep the Electron drag region and platform padding in a wrapper. |
| Button, IconButton | Button, IconButton, ButtonGroup | Use `label`, `variant`, `isLoading`; no custom loading spinner at call sites. |
| Chip, pill filters | ToggleButton/ToggleButtonGroup, SegmentedControl | Static metadata uses Token/Badge, not a button. |
| Appearance theme picker | `RadioList`/`RadioListItem` (`components/settings/ThemePicker`) | Single-choice radio semantics; each row's preview is a nested `Theme`, so the swatch uses real tokens. |
| Segmented | SegmentedControl/SegmentedControlItem | Radio-group semantics. |
| Field, TextareaCounter | TextInput, TextArea, Field, FormLayout | Use `status` for inline errors. |
| Native select, checkbox, range | Selector, CheckboxInput, Slider | No unlabeled native controls. |
| Dialog, Sheet | Dialog, AlertDialog, Drawer, BottomSheet | One modal stack; focus return. |
| DropdownMenu, MoreMenu | DropdownMenu/MoreMenu | Use one menu pattern. |
| Toast, Tooltip, Progress, Spinner, Skeleton | Toast/useToast, Tooltip/InfoTip, ProgressBar, Spinner, Skeleton | Use the primitive’s live-region/loading semantics. |
| EmptyState, ErrorState, Pagination | EmptyState, Banner/EmptyState, Pagination | Preserve the copy and 20/page behavior. |
| Card/panel/plan-card | Card, ClickableCard, SelectableCard, Section | Whole-card open target; nested actions stay independent. |
| Set image/product preview | `MediaLightbox` | Read-only viewer with previous/next and optional source comparison. Uses `useModalInert`. |
| Workspace priced action | `CommitFooter` | Pinned under the left inputs with the month budget. The canvas footer is for canvas and version actions only. |
| Generator shape choice | `ShapePicker` | Radio group with proportional outline icons and true output proportions. |
| Product notes | Astryx `TextArea` | Stored locally; appended to create and edit prompts only when that Product is selected. |
| Modal background | `useModalInert` | Shared `inert` + `aria-hidden` counter. Every portal modal (Dialog, Sheet, Lightbox, MediaLightbox) must use it. |
| Onboarding progress | Custom `SetupStepper` (`components/onboarding/SetupStepper`) | Ordered-list semantics. Completed and skipped must stay visually and semantically distinct; Astryx `Step` has no skipped state. |
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
7. Add axe coverage for portals, dialogs, the command palette, dropzones, and reduced-motion states. Every portal modal must call `useModalInert` so the app root is one inert, `aria-hidden` surface; nested modals share the counter.
8. Before a release, build the theme statically and measure the renderer bundle and first paint.

## Onboarding pattern

- The setup card is sticky on wide screens.
- `SetupStepper` reports four honest states: completed, skipped, current, and not started. The active step is `aria-current="step"`; completed and skipped states also reach assistive tech as text.
- Completion is derived from real state, not position: a Meta key exists, a product exists, and branding has a logo, colour, default look, or enabled badge. A step the seller skipped stays neutral.
- Step 4 keeps a compact live `BrandPreview` sticky while the brand fields are expanded, with saved colour dots, the default look, and the corner-badge state.
- Step 3 names the product inline with a cleaned filename or placeholder; `Replace photo` sits under the thumbnail.

## Workspace inspector pattern

The editor and the generator share one workspace grammar: the left column holds the inputs, the center holds the output, the right column is the inspector for the selected output, and the footer holds the priced action. The generator's inspector is not a dashboard: it follows the editor's version panel.

- **Panels:** `ws-left` and `ws-right` use `--surface` with a 1px `--border`; the center uses `--bg`. A `ws-right` inspector is always mounted at 1440 and wider, resizable (300px default, 260–360), and opens as a `Sheet` titled `Details` below 1440.
- **Sections:** `.section-label` (11px, 600, uppercase, `--text-faint`) names each block. Sections separate with `mt-4 border-t pt-4` and `--border`. Do not add nested cards inside the rail; the inspector is already a surface.
- **Copy:** result headings use 15px/600; `.meta` and `.hint` carry dates and costs; `.field-label` labels settings controls. The description uses the shared `DescriptionPreview` clamp and its `Show more` control.
- **Actions:** full-width secondary `Button size="sm"` rows with a 16px `Icon`; destructive actions are ghost with `--danger`. Keep the same order in both tools: use the output, then read its description/details, then delete.
- **Priced actions:** the paid commit button and the compact month budget live in a `CommitFooter` at the bottom of the left control column, under the inputs that drive them. The canvas footer carries version/canvas actions instead. The Ctrl/Cmd+Enter shortcut targets `[data-commit-action] .btn-primary`.
- **Disclosure:** the output settings show a one-line summary at all times and open their controls on demand. The content stays in the DOM with `hidden` so `aria-controls` always resolves. History appears only when a completed make exists.
- **Constraints:** when a reference removes a choice (a product, person, or scene makes one image at a time), show the constraint as a sentence instead of disabled options. The summary leaves out the count for one image and still shows the frame and format.
- **Empty states:** one short explanation plus, before the first result, a description recipe and a few tips that directly affect picture quality. No illustration dashboards, no counters.

### Canvas toolbar

The editor keeps one floating canvas toolbar for view actions: zoom out, `Fit`, `100%`, zoom in, the actual zoom readout, undo/redo for the adjust preview, and before/after compare. Compare is available whenever the selected version has a parent and is an icon toggle beside undo and redo. The toolbar stays on one row at every width and scrolls horizontally instead of wrapping or pushing the canvas. At 100% the zoom box reserves the scaled layout size so the stage can scroll. The wheel zooms under the pointer, and holding the middle button pans the stage while the photo overflows.

The filmstrip labels every saved version with a type badge: `Original`, `Adjusted`, or `AI`. The badge text is part of the card's accessible name; do not add a separate aria-label that omits it.

### Result selection

The generator keeps the editor's selection model: the newest result is selected by default; opening another result selects it; a completed make returns selection to the newest. The selected card takes the same ring language as a selected library card (`--accent` border plus a `--accent-soft` tint). The inspector is a second, stable home for the selected image; it does not replace the persistent card actions.

## Current status

- Foundation, theme, providers, and CSS layer order are in place.
- Colour has one owner: every semantic name in `tokens.css` aliases the theme, the mode block holds only elevation, and `npm run audit:tokens` reads the ten compiled themes so a stale or missing token fails instead of rendering an inherited colour. The audit runs every theme in its own mode and covers the selected-row tints and the danger badge used by the generator inspector.
- Every icon renders through Astryx `Icon`; no direct lucide elements remain.
- The themes ship as static CSS: `npm run theme:build` regenerates `theme/built/` and release builds refuse to package a stale copy.
- The app shell's surfaces come from theme targets, so the rail, header, and top nav no longer depend on `.astryx-*` class selectors in `index.css`.
- Activation is the first surface fully off the homegrown primitives: Astryx `TextInput` and `Button` replace the local `Field` and `Button` there.
- Sets use collection cards with a cover/count and a detail grid for images and product sources with explicit Edit Photo, New Image from Reference, and remove actions. Set detail filters source Products from finished work, opens a high-resolution `MediaLightbox` on a card image, moves removal into a card menu with an undo toast, and exports with Original, Square 1:1, and Portrait 4:5 presets. SaveToSetDialog is a small dialog mounted once at the app root and opened from image actions.
- Onboarding uses a Welcome screen and setup steps for the key, an optional product, an optional logo and colors, and Ready. It shows honest completed/skipped states, a local-first Welcome shortcut, inline product naming, a sticky live brand preview, and accurate View Product / Open Studio / Meta-key-needed actions.
- The Astryx AppShell, TopNav, and SideNav now wrap the app. The sidebar collapse toggle sits beside the wordmark in the header; Reset App is a development-only Privacy action, not a rail item. Library, Products, People, Usage, and Settings use Astryx controls and shared collection patterns.
- Product detail keeps Products selected in the rail, restores the `Products` back button, uses the product name in the window title, renames inline, stores Product notes locally and adds them to prompts only when that product is selected, and offers both free and paid paths from the empty project state.
- Library cards handle zero-image work as informative drafts with prompt snippets, product/person pills, inline renaming, and hover actions. Products adds starter category filters and card quick actions. People uses a dense casting grid with age chips and look guidance, and Usage separates paid images from free adjustments.
- Photo has a fitted canvas, exporter-aligned rotate/crop preview, a draggable compare divider, a floating zoom/undo/redo/compare toolbar, and keyboard crop controls. Adjust Photo now covers exposure, contrast, highlights, shadows, warmth, saturation, sharpness, vignette, crop presets, rotate, and flip; highlights and shadows use a real luminance tone pass in main and an approximate CSS preview. The filmstrip types every version.
- Create has removable Product/Person/Scene recipe chips, scene browsing before a product is chosen, grouped example filters, a proportional ShapePicker, multi-image placeholder frames, and a persistent Details inspector with the selected image's description/details/actions, Output settings, and History; it becomes a Details sheet below 1440. Create results keep their persistent Edit, Download, Save as Product, and More actions plus a lightbox. The version and result panels share `DescriptionPreview`. Workspace panels can be resized and persist their widths. The custom canvas, crop overlay, filmstrip, and brand preview remain custom.
