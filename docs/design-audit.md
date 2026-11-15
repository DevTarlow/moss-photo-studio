> Historical note: this audit describes an earlier build. Sets, the Listing Kit, the Business profile, and text-model calls have since been removed. The current scope is photo editing, image generation, Products, People, Usage, licensing, and settings.

# Design audit (historical)

> This audit was the input to the Astryx redesign. Several findings are fixed in the current build; use [design-system.md](design-system.md) and the later entries in [DECISIONS.md](../DECISIONS.md) for the current rules. Keep this file as the record of what drove the redesign, not as a live defect list.

This audit covers the renderer UI/UX across first-run, collections, settings, and the three editor workspaces. It was done against the running app, the source, the tracked screenshots, and the E2E suite. The implementation plan is in the Astryx redesign work; this file records the findings that drove it.

## Verdict

The app has a coherent palette and several strong domain interactions, but it does not have a design system. The main problems are structural: duplicated creation and setup paths, inconsistent control geometry, a fragile CSS cascade, an onboarding flow that asks too much before the first product, and editor workspaces whose largest surface is less useful than their smallest panel.

The redesign keeps the Moss identity and the custom canvas, and adopts Astryx for generic UI. See [design-system.md](design-system.md) for the implementation rules.

## Foundations

- The renderer has roughly 90 hand-written component classes, 175 inline token styles, seven interactive control heights, ten type sizes, twelve icon sizes, and 27 ad-hoc card containers.
- Custom component CSS is unlayered, so it beats Tailwind utilities that are emitted inside `@layer utilities`. Requests such as `field h-8`, `dialog-content p-0`, and `page-title text-[24px]` silently do not apply. This is the highest-leverage defect and a prerequisite for Astryx adoption.
- `--canvas-btn-bg` and `--canvas-btn-bg-hover` are consumed but never defined, so the Create result actions render without a surface or hover state. `--radius-input/card/panel`, `--accent-hover`, and `--success` are dead tokens.
- The four Inter files are byte-identical variable-font files, as are the three Plus Jakarta files. The browser can use the variable axes, but the duplicate `@font-face` declarations are redundant and should eventually collapse to one range face per family.
- The dark surface hierarchy is inverted: `--surface` is darker than `--bg`, so cards recede instead of elevating. `color-scheme` is not set.

## Onboarding and first run

- Six dots and “Step N of 6” count the welcome and done screens as work. Only four screens ask for a decision.
- The key, a full Logo & Colors step, and a full category screen come before the first product. The brand step has no preview and asks for a save even when nothing changed.
- The first photo is imported as a set, so “Just Add the Photo” opens the Set tool. Products already exist; the first photo should be saved as a Product and a set should be created only on Make.
- Resume is skin-deep: the step persists, but category, the selected photo, and the plan draft do not. An active job is not reattached.
- `SetupCard` marked onboarding done as a side effect of a saved key, and “Finish later” was session-only. The replacement is a single resume Banner and a persisted `onboardingDismissed` setting.
- Focus falls to the document on step changes. Back/Skip stay enabled during a paid run. The first-run confirmation’s initial focus is the dismissive action, not the priced primary.
- Copy uses “Muse key,” “Meta key,” “API key,” and “License key” for two different secrets, and billing alternates between “makes,” “comes back,” and “about.”

## Collections

- Creation is duplicated in the rail Tools block, the Library New menu, the Library empty-state cards, and the command palette. The Library can show up to four key/license notices at once.
- Library selection is a hover-only checkbox. Selection is pruned on every page/filter/sort change, there is no select-all or Escape exit, and the bulk bar can scroll off screen.
- Products and People lack search, sort, counts, and list view. Their cards use three different geometries and menu placements.
- The Library header count becomes the filtered count, so “3 projects” replaces the full total with no “of N.” Filtered empty states conflate search and filter and trigger redundant loads.
- Usage is three screens stacked in one scroll column: a summary, by-project rows, a ledger, and a separate budget form with a duplicate control.
- Settings uses the app rail plus a second section nav, duplicates “Settings,” and leaves a 210px second nav at 1024. Logo & Colors has no dirty-state guard.

## Editor workspaces

- The Set tool puts the plan in a 320px sidebar and shows a static copy of the same photo on the largest surface. A second right panel duplicates the plan status. In review, the left panel stays fully editable.
- Photo’s canvas clips the subject (`maxWidth: none` inside an overflow-hidden stage). Crop and rotate previews disagree with the exported transform. The compare divider looks draggable but is not, and labels collide.
- Create result cards have no click target or persistent actions; the five action buttons only appear on hover and wrap over the image at 1024.
- Budget warnings contain dead actions in Set and Photo. Month spend is fetched but never displayed. “Make Fewer Images” is a no-op.
- Panels are fixed-width and cannot be resized. Sheets can remain open after the viewport grows. The 1280 breakpoint shrinks the canvas when the window widens.
- Keyboard guidance overstates what works: Ctrl+Enter queries `.ws-bottom .btn-primary`, which is absent when a budget warning replaces it; Ctrl+E is advertised where export is unavailable.

## Accessibility

- Focus is not moved to the new heading on step or route changes; `document.title` never changes.
- Lightbox + confirm stacking leaves the lightbox’s key handlers active. The menu keyboard highlight is 1.15:1, the project-name focus border 1.55:1, and the light-theme lightbox focus ring 1.79–2.30:1.
- The switch track and thumb are 1.65:1. The warning badge is 4.44:1 at 11px. The token audit does not test these state pairs.
- Toasts are nested live regions and auto-dismiss without pause on focus. The command palette is a combobox/listbox hybrid whose options are real buttons. Crop is pointer-only.
- `reduceMotion: 'system'` writes `data-motion="system"`, but the CSS only reduces motion for `data-motion="reduce"`; the OS preference is not honored by default.
- Axe currently filters to serious/critical only, and several dialogs, the palette, the dropzone, and save-product flows are not in the axe matrix.

## Highest-impact fixes

1. Fix the CSS cascade and token pipeline; add real control, type, icon, and overlay scales.
2. Rebuild onboarding around four actionable steps, a real Stepper, product-first behavior, and a sticky action bar.
3. Make selection explicit and persistent; unify the collection card/toolbar patterns; add “Showing X of Y.”
4. Make the Set tool a real mode; remove the duplicate right panel; give the canvas priority at 1024–1439.
5. Fix the Photo canvas fit, crop/rotate alignment, and compare interactions.
6. Make Create result actions persistent; give failed runs their own state.
7. Consolidate license/key warnings into one Banner and one vocabulary.
8. Replace custom Dialog/Toast/Sheet/menus with Astryx primitives and fix focus return, modal stacking, and announcements.
9. Make shortcuts truthful and generate the sheet from the real command registry.
10. Expand a11y coverage to portals, focus states, reduced motion, and 200% text resize.

## Constraints a redesign must preserve

- License activation and the route guards; Browse My Library on the expired screen.
- `firstRunConfirmShown` and the shared first-run confirmation across Set, Photo, and Create.
- The key guide’s six steps and external Meta dashboard action; keys never return to the renderer.
- 20 items per page and the existing Previous/Next, search, filter, sort, and delete copy.
- Products remain saved copies, not references; deleting one never deletes projects or images.
- Set plan autosave and close-time flush; newest attempt decides a shot’s review status; “Make More” only fills missing shots; older export versions are kept.
- Local adjust stays local and free; “Reset All” returns to the stored transform.
- The lightbox scrim and click-away close; the priced primary in the editor footer.
- No horizontal overflow at 1024×700 or 150% zoom; no serious/critical axe findings.
- Tracked screenshot baselines are updated intentionally, not as incidental churn.

## Current screen inventory

| Area | Main surfaces |
|---|---|
| First run | Activation, Onboarding (welcome, key, optional product, optional brand, optional set, ready), key guide, first-run confirmation |
| Collections | Library (grid/list, search, filters, sort, selection), Products, People, Usage |
| Settings | API key, Logo & Colors, Storage, Appearance, License, Privacy, About |
| Workspaces | Set (plan, review, running), Image Editor (change, local adjust, versions, compare), Image Generator (prompt, examples, results, runs) |
| Shared | App shell, dialogs, sheets, toasts, command palette, shortcuts, lightbox, empty/loading/error states |
