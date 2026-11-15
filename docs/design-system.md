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

## Icons

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

## Current status

- Foundation, theme, providers, and CSS layer order are in place.
- Colour has one owner: every semantic name in `tokens.css` aliases the theme, the mode block holds only elevation, and `npm run audit:tokens` reads `mossTheme` so a stale or missing token fails instead of rendering an inherited colour.
- Every icon renders through Astryx `Icon` (211 call sites); no direct lucide elements remain.
- The theme ships as static CSS: `npm run theme:build` regenerates `moss-theme.css` and the built module beside it, and release builds refuse to package a stale copy.
- The app shell's surfaces come from theme targets, so the rail, header, and top nav no longer depend on `.astryx-*` class selectors in `index.css`.
- Activation is the first surface fully off the homegrown primitives: Astryx `TextInput` and `Button` replace the local `Field` and `Button` there.
- Onboarding is redesigned with a Welcome screen and setup steps for the key, an optional product, an optional logo and colors, and Ready. Key-later and sticky actions are unchanged.
- The Astryx AppShell, TopNav, and SideNav now wrap the app; Library, Products, People, Usage, and Settings use Astryx controls and shared collection patterns.
- Photo has a fitted canvas, exporter-aligned rotate/crop preview, a draggable compare divider, and keyboard crop controls. Create results have persistent Edit, Download, Save as Product, and More actions plus a lightbox. Workspace panels can be resized and persist their widths. The custom canvas, crop overlay, filmstrip, and brand preview remain custom.
