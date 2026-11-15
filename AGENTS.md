# AGENTS.md

Instructions for AI coding agents (and humans) working in **Moss Photo Studio**. Read this before editing. It covers the project layout, the expected development loop, commit/push rules, and the test-execution budget.

The short version: **implement → verify narrowly → commit when the task is done → stop. Push only when the owner explicitly says to push.**

## 1. What this repo is

A local-first Electron desktop app for editing product photos, generating new ones, and keeping related images in Sets. React 19, TypeScript (strict), electron-vite, SQLite (`better-sqlite3`), and `sharp`. Node 22+ and npm 10+.

```text
src/
  main/       Electron main: SQLite, files, sharp, Muse client, license, queue, secrets, menus
  preload/    Frozen named window.moss API
  renderer/   React screens. No Node, no filesystem, no keys
  shared/     Constants, types, IPC map, guards, prompts, costs
tests/
  unit/           Vitest unit tests
  integration/    Vitest integration tests (real loopback fake hosts)
  e2e/            Serial Playwright journey plus focused renderer specs
  screenshots/    Visual baselines (tracked)
scripts/          Build, packaging, asset, token-audit, and release-gate scripts
docs/             API notes, privacy, manual acceptance checklist
```

Before changing behavior, read [README.md](README.md) and [DECISIONS.md](DECISIONS.md). The architecture rules that matter:

- Renderer reaches the outside world only through named IPC. It gets no Node, filesystem, network keys, or raw paths.
- Main-process request payloads are parsed with zod. Keep the preload API deeply frozen.
- Tests never touch real Meta or the live license portal. Use the fake servers in `tests/fake-muse` and `tests/fake-license`.
- Never commit secrets, keys, `.env` files, or local user data. Never log a key.
- Do not add a dependency for something small that the existing stack already does.

### UI system: Astryx

The generic renderer UI is built on **[Astryx](https://github.com/meta/astryx)** — `@astryxdesign/core@0.7.11` + `@astryxdesign/theme-neutral@0.7.11` (`@stylexjs/stylex@0.19.0` peer; `@astryxdesign/cli` is dev-only). It is already installed; use it instead of adding another component library. Versions are pinned in `package.json`. Astryx is beta: do **not** upgrade it casually; treat an upgrade as a deliberate change that needs the full visual and a11y suite.

Read **[docs/design-system.md](docs/design-system.md)** before building or replacing UI; it holds the theme contract, CSS-layer rules, component map, and migration rules. Decision 70 in [DECISIONS.md](DECISIONS.md) is the short rationale.

- Import primitives from `@astryxdesign/core` (Button, IconButton, Text, Heading, Card, ClickableCard, Stack, Grid, Banner, Badge, TextInput, TextArea, Field, FileInput, Selector, SegmentedControl, ToggleButtonGroup, Dialog, AlertDialog, Drawer, BottomSheet, DropdownMenu, MoreMenu, Tooltip, ProgressBar, Spinner, Skeleton, EmptyState, Pagination, Stepper/Step, AppShell/TopNav/SideNav). Use the component map in the design-system doc when a Moss primitive has an Astryx replacement.
- Prefer Astryx props over custom CSS: `variant`, `size`, `padding`, `gap`, `display`, `status`, `label`, `isLoading`. Theme colors, type, radii, and motion come from `src/renderer/src/theme/mossTheme.ts` and `MossThemeProvider.tsx`; do not hardcode new colors or fonts.
- Some local UI components remain (`components/ui/Button`, `Dialog`, `Field`, `Sheet`, `Segmented`, `Switch`, custom Dropzone). Prefer the Astryx primitive for new UI and migrate one surface at a time when you touch it, keeping the existing behavior contracts (pricing, confirmations, pagination, saved copy).
- Keep the CSS layer order in `src/renderer/src/styles/index.css`. Never add unlayered global styles that set `color` or `font` on `button`, `input`, `textarea`, or `select`; they beat every Astryx layer.
- Astryx `Text` defaults to inline. Use `display="block"` when it needs its own line or a top margin.
- Accessibility is composition-level: the E2E journey runs axe. Do not nest interactive controls (for example, the custom dropzone keeps its file input outside the `role="button"` container), and check roles/labels after a migration.
- The custom canvas, crop overlay, filmstrip, brand badge preview, and file-drop logic stay custom. Do not rewrite them just for consistency.

## 2. Development loop

Follow this order. Do not skip the verification or the commit.

1. **Orient.** Run `git status --short --branch` and read the files you are about to change. Never edit from memory.
2. **Plan.** For anything multi-step, write a short todo list. Keep changes scoped to the task.
3. **Implement** in coherent slices. Keep the tree syntactically valid as you go.
4. **Verify** using the testing policy below. Prefer the smallest command that proves the change: targeted Vitest file, then `tsc`, then broader only when justified.
5. **Self-review the diff** with `git diff` before staging. Look for debug leftovers, `console.log`, stray TODOs, accidental generated files, and unrelated formatting.
6. **Commit** once the task is complete and the relevant checks pass. This is a standing instruction: commit autonomously at the end of a task; do not wait to be asked.
7. **Report and stop.** Summarize what changed, what you verified, and the commit hash. Then wait for the owner. **Do not push.**

### Definition of done

- The requested change is implemented and no debug code remains.
- The smallest relevant verification passed (or the reason it could not run is stated).
- Docs are updated when behavior, setup, or architecture changed. If the change affects anything README.md covers, update it in the same task under the README rule below.
- One logical commit exists for the task, with a message that matches the repo style.
- The working tree is clean except for intentionally untracked files.

### README.md

README.md is the public, user-facing guide to the current build, not a changelog. If a change alters what the README covers, including features, requirements, commands, licensing, privacy, updates, costs, platform support, links, or project layout, update it as part of the same logical commit.

Keep the existing user-first voice and structure. Weave the change into the relevant section instead of rewriting unrelated prose. Verify any link or command you touch. When in doubt, make the smallest edit that keeps the README true.

## 3. Commit rules

Commit messages follow Conventional Commits, matching the existing history:

```text
feat: virtualize large libraries and gate menus by context
fix: complete clipboard, export, and lifecycle boundaries
docs: record release, privacy, decisions, and manual verification
test: add unit, integration, visual, and desktop journey coverage
```

Rules:

- One logical change per commit. Do not mix refactors, features, and formatting.
- Subject line: `type: imperative summary`, roughly 72 characters, no trailing period. Types in use: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`.
- Optional body: why the change was made, user-visible behavior, and the verification commands that ran. Keep it short.
- Do not add attribution trailers (`Co-authored-by`, "Generated with ...") unless the owner asks.
- Review `git status --short` before staging. Stage explicitly (`git add path/to/file`) or use `git add -A` only after confirming the list. Never commit `node_modules/`, `out/`, `release/`, `test-results/`, `playwright-report/`, `tests/screenshots/diff/`, logs, or local runtime data.
- Never commit a failing or half-finished task just to have a commit. If the task is blocked, leave the tree clean and report.
- Do not rewrite published history (no force-push, rebase, or amend) unless the owner explicitly asks. If a pre-commit hook fails, fix the cause; do not use `--no-verify` without permission.

## 4. Push rules

- **Never push without an explicit instruction from the owner** (for example "push", "push it", "push to origin"). A completed task, a passing test run, or a previous push in the session is not permission.
- Committing autonomously is expected. Pushing is owner-triggered.
- When told to push: `git push` from `main`. If upstream is not set, `git push -u origin main`.
- Do not open pull requests, tag releases, or publish packages unless asked.
- Before pushing, confirm the branch and that the tree is clean: `git status --short --branch`.

## 5. Branch and remote

- Default branch: **`main`**.
- `origin` is GitHub: `https://github.com/DevTarlow/moss-photo-studio.git`.
- The former local Gitea remote is no longer used.
- First-time setup on a fresh clone:

  ```bash
  git remote add origin https://github.com/DevTarlow/moss-photo-studio.git
  git push -u origin main
  ```

- After upstream is set, the owner-triggered push is just `git push`.
- Work directly on `main` for this repo unless the owner asks for a branch. Do not create a branch or worktree unasked.

## 6. Commands

```bash
npm install                                   # once
MOSS_DEV_UNLOCK=1 MOSS_MUSE_FAKE=1 npm run dev  # dev app without a license or Muse key
npm run typecheck                             # tsc --noEmit, whole project
npm run lint                                  # eslint src tests
npx eslint src/main/file.ts                   # lint a single file
npx vitest run tests/unit/prompts.test.ts     # smallest test scope
npx vitest run tests/unit/prompts.test.ts -t "name of test"
npm test                                      # all unit + integration tests
npm run build:test                            # typecheck + test build for E2E
npx playwright test tests/e2e/studio.spec.ts -g "create makes four images"
npx playwright test tests/e2e/sets.spec.ts
npm run test:e2e                              # builds, then the serial journey + focused specs
MOSS_UPDATE_SCREENS=1 npx playwright test -g "..."  # rewrite baselines after an intentional visual change
npm run audit:tokens                          # color-token contrast audit
npm run lab -- edit --template kitchen-table --source photo.jpg --yes  # real Meta; needs .env key
npm run lab -- create --text "..." --yes      # real Meta; see docs/lab.md
npm run build                                 # typecheck + production build
npm run build:linux                           # AppImage + deb (release gate included)
```

Notes that save time:

- Vitest tests import source directly through aliases. They do **not** need a build. This is the fastest feedback loop.
- `npm run build` already runs `typecheck`; do not run both back to back.
- `npm run test:e2e` rebuilds the app every time and runs the serial journey plus the focused specs; only the journey captures screenshots. It is a cross-state/release check, not a default. Avoid it for a single behavior; build once with `npm run build:test`, then use `npx playwright test -g "<test title>"`. If the target state is only reachable after earlier serial steps, run the journey once after batching known fixes, not after every one-line change.
- The 1024×700 and 150% zoom screenshots are capture-only and are rewritten on every E2E run. After an E2E run, check `git status tests/screenshots`; commit only intentional visual changes and revert incidental churn.
- The E2E journey is stateful and serial (`workers: 1`). Do not parallelize it or run two specs against the same user-data directory.
- `MOSS_RELEASE=1` is required before the release gate does anything; normal builds skip it.
- The prompt lab is a manual developer tool, not a test. It reads `MOSS_LAB_MUSE_KEY` from the gitignored `.env`, spends real money, and writes to the gitignored `lab/` folder. Never add it to `npm test` or CI; see [docs/lab.md](docs/lab.md).

## 🛠️ Testing & Execution Policy [CRITICAL]

Testing is the final confirmation step, not the development loop. Every Electron launch costs seconds and every broad run costs minutes, so spend runs deliberately.

### 1. Test budget (hard limits)
- **One change, one verification pass.** Do not run the same scope twice unless the first run failed and you changed code.
- **Never run a bare `npx playwright test`, `npm test`, or `npm run test:e2e` for a copy, layout, single-screen, or single-component change.** These are release checks, not the default loop.
- **At most one focused E2E spec per change.** If two specs genuinely cover the change, run them in one command.
- **Full suite only when:** preparing a release, changing shared main-process, IPC, or schema behavior that has no focused coverage, or the owner explicitly asks.
- **No tests for docs-only edits.** README, AGENTS.md, and docs changes need a link/spelling check, not an app run.

### 2. Scope Isolation (WHAT to run)
- **Default to the smallest unit:** one matching Vitest file or one `-g "<test title>"` case.
- **Change-size ladder:**
  - Copy-only: `typecheck` when TS/TSX changed, plus lint on touched files. Do not run unit, integration, or E2E tests.
  - CSS or layout-only: same checks, then inspect the affected screen. Refresh only screenshots whose surface changed.
  - Isolated logic with unit coverage: run only the matching Vitest file or test.
  - Renderer behavior only visible in E2E: build once, then run the narrowest `-g "<test title>"` case or one focused spec file.
  - Cross-state or late serial-journey behavior: run one serial journey after batching fixes. Do not repeat it per one-line change.
- **Escalation:** widen to a directory or full suite only after a targeted test passes and the change touches shared utilities, global state, or a public interface. A green focused test is enough to stop otherwise.

### 3. Screenshot Baselines
- Refresh only the affected images. Do not regenerate the whole screenshot set for one surface change.
- When `MOSS_UPDATE_SCREENS=1` is unavoidable, run the narrowest serial journey **once**, inspect the changed images, and revert incidental captures before committing.
- A screenshot you have inspected and accepted is finished. Do not run another full pass just to re-compare it.
- Never commit unrelated screenshot churn caused by timestamps, toasts, or test-run order.

### 4. Error Recovery Loops (HOW to handle failure)
- If a test fails, read the exact assertion first, then apply a targeted fix and re-run **only** the failing case.
- **Serial E2E exception:** when the failing case cannot run without earlier serial steps, fix all known issues in one pass and re-run the journey once.
- **Hard stop:** after 3 consecutive failures with the same error, stop all commands and present the findings to the owner.

### 5. Output Summary Format
Keep terminal output minimal. On success, summarize scope and result:
`✅ [X] tests passed in [Y]s. Scope: [spec/test/file]`

## 7. Environment note (current Linux build host)

The workspace files are owned by another UID, so Git may report `dubious ownership` and the global git config may be read-only. Run Git with a per-command safe directory instead of changing global config:

```bash
git -c safe.directory="$PWD" status
```

Use the same `-c safe.directory="$PWD"` prefix for `log`, `diff`, `commit`, and `push` on this host.
