# Release checklist

This is the owner-side checklist for a signed distribution. The code is ready to build, but the release gate intentionally refuses while the public identity is still a placeholder.

## Status: launch inputs deferred

As of **2026-11-12**, the owner is still working on revisions and has deferred these launch inputs:

- The website/landing page is not set up yet.
- Code signing and notarization will be arranged later.
- The product-site checkout URL, portal DNS, and real-purchase acceptance are later work.
- Downloads and a version check are live. The Linux AppImage now auto-downloads and installs on restart through GitHub Releases; Windows and macOS auto-install still wait for signing.

Do not replace the placeholders with invented values. The release gate stays in place until the real values exist. The app remains in development; normal builds, tests, and the fake-host E2E are unaffected.

## Owner inputs

These cannot be invented by the app:

1. **Product-site checkout URL** in `src/shared/constants.ts` (`LICENSE_STORE_URL`). It must be the real checkout page on the app's own site (Payment Link or Checkout Session), not `example.com`. The Buy a License link is hidden until it is real. The portal URLs (`LICENSE_API_BASE`, `LICENSE_PORTAL_URL`) point at `license.mossaistudio.com`.
2. **Product homepage** in `package.json` (`homepage`). This is the page a buyer should land on, for example `https://mossphotostudio.com`. The release gate checks it.
3. **Store product and license policy**: the exact price, renewal terms, refund terms, computer limit, and support address. The current machine limit is two computers, and support is `tarlow@mossaistudio.com`; confirm all of them before selling. The license portal source lives in the `moss-license-center` repository; its runbook covers Stripe, Email, Firebase, and the customer/admin flows.
4. **Windows signing certificate**: an Authenticode/EV certificate and its password. electron-builder reads `CSC_LINK` (path or base64) and `CSC_KEY_PASSWORD`.
5. **macOS Developer ID Application certificate**, plus notarization credentials. electron-builder reads `CSC_LINK`/`CSC_KEY_PASSWORD`; notarization reads `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` (or an Apple API key).
6. **Update decision**: the Linux AppImage uses `electron-updater` with GitHub Releases, background downloads, and install on restart. The deb and non-AppImage builds use the portal download page. Windows and macOS still need signing before auto-install can ship.
7. **Website/legal review**: `mossphotostudio.com` landing page, privacy policy that mentions Meta image generation, and the AI disclosure wording. `docs/privacy.md` is the source of truth for what leaves the computer.

## Update options

The Linux AppImage now uses **electron-updater** with GitHub Releases. The deb and Windows/macOS builds remain manual. These are the options considered:

| Option | What it gives us | Costs and constraints | Fit for Moss |
| --- | --- | --- | --- |
| **A. Manual downloads only** | A new version is a new installer on the website; the app does not check anything. | No update host or extra privacy surface. Buyers must notice and re-download. | Best default until the website and signing exist. |
| **B. Static feed + `electron-updater` (implemented for Linux AppImage)** | In-app check, background download, install on restart/quit, differential downloads, stable/beta channels. | Needs signed builds, an HTTPS feed (Cloudflare R2, S3, Bunny, or the website), `latest.yml`/`latest-mac.yml`/`latest-linux.yml`, and release discipline. Adds the update host to the privacy notes. | Best balance of control, cost, and local-first behavior once signing is ready. |
| **C. GitHub Releases** | Free hosting and simple CI publishing through the GitHub provider. | Public downloads and a GitHub dependency; private-repo tokens are awkward for an installed app. Less control over rollout and branding. | Workable for a public open build; not the best fit for a paid desktop product. |
| **D. Managed update service** | Dashboard, staged rollout, analytics, rollback. | Paid vendor, another account, and telemetry/privacy policy work. | Overkill for v1; revisit only if rollout volume justifies it. |
| **E. Version check only** | The app asks a small HTTPS endpoint for the latest version and opens the download page; no silent install. | Still needs a host and a small JSON format; does not remove the need to sign installers for trust. Lower code and signing complexity than B. | Implemented as the manual Settings, Updates check; the portal serves the release metadata and download page. |

**Implemented:** option **B** for the Linux AppImage, using GitHub Releases as the feed. Option **E** remains the fallback for the deb and for any build where automatic updates are unavailable. Windows and macOS stay on **E** until they are signed and verified.

The remaining platform work for option B:

- `electron-updater` in the main process, a `publish` provider in `electron-builder.yml`, and update state exposed through named IPC (never renderer network).
- Windows NSIS signed with the Authenticode certificate; macOS Developer ID, hardened runtime, notarization, and both dmg/zip artifacts for the updater; Linux AppImage updater support (deb updates stay with the package manager/manual download).
- A feed layout such as `stable/latest.yml`, `stable/latest-mac.yml`, `stable/latest-linux.yml`, installers, and blockmaps. Keep the feed immutable per version, write the manifest last, and keep the previous version downloadable for rollback.
- A Settings toggle or documented check policy, a changelog surface, and a clear "install on next restart" flow. No forced restart and no silent downgrade.
- Privacy copy naming the update host and what it receives: app version, operating system, architecture, and the requested channel. No device identifier, library data, or usage history.
- CI secrets and a release owner for signing, publishing, channel promotion, and rollback.

The Linux AppImage path is implemented. The deb still updates through the package manager or a manual download; Windows and macOS remain manual until their signing identities exist.

## Build and verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:tokens
npm run test:e2e
npm run portal:test
npm --prefix portal run check
npm --prefix portal run build
MOSS_RELEASE=1 npm run release:gate
```

Then, after replacing the two public values:

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

The Linux script produces an AppImage and a deb under `release/`. Windows and macOS require the signing identities above and a host that can run those toolchains. The AppImage does not carry setuid permissions; document `--no-sandbox` or unprivileged user namespaces for distributions that block sandboxing.

## Automatic update release

The Linux AppImage reads `latest-linux.yml` from the latest GitHub Release.

1. Bump `package.json` and `APP_VERSION`.
2. Run `npm run build:linux`.
3. Create a draft GitHub Release with the AppImage, deb, and `release/latest-linux.yml`.
4. Upload `latest-linux.yml` after the AppImage so the feed never points at a missing file.
5. Publish the draft.
6. Add the same version to the portal release records for the manual download page.

The installed AppImage checks on launch and every four hours, downloads in the background, and shows a banner that links to **Settings, Updates**. When ready, it shows **Restart to Update**. It does not force a restart.

## Real-account acceptance

- Create a fresh library with a **real Meta key** and make one image in the Image Generator. Confirm the exact amount on the Meta bill and in Usage; the app records one cent per returned image.
- Run one Image Editor change and one local adjust. Confirm the editor version and the free adjust appear correctly.
- Buy through the real product-site Stripe checkout. Confirm the key email, the portal account, activation on two computers, the third refusal, a portal reset, and re-activation. Test an offline launch inside the 14-day grace period.
- Make a six-shot Image Pack from a real product. Confirm the price, per-shot progress, one selected version per shot, and the exported folder with `pack.json`. Confirm no marketplace or text-model request is made.
- Export an image and open it; confirm the format, dimensions, and filename.
- Run the manual checklist in [manual-test.md](manual-test.md), including a packaged build launched with `MOSS_DEV_UNLOCK=1`, `MOSS_MUSE_FAKE=1`, and `MOSS_E2E=1` to prove the packaged gate ignores test overrides.

## Known v1 limits

- No cloud sync or hosted library. Automatic updates are Linux AppImage only; the deb and Windows/macOS builds remain manual. There is no real Meta billing reconciliation. The license center is a separate web account; the desktop app stays account-free.
- Batch color grading and a local size-label overlay are included; batch crop/rotate and other batch edits are not. No upscaling, object eraser, or video. The Image Generator has a scene reference.
- HEIC is detected with a clear iPhone export message; it is not decoded.
