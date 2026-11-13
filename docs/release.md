# Release checklist

This is the owner-side checklist for a signed distribution. The code is ready to build, but the release gate intentionally refuses while the public identity is still a placeholder.

## Status: launch inputs deferred

As of **2026-11-12**, the owner is still working on revisions and has deferred these launch inputs:

- The website/landing page is not set up yet.
- Code signing and notarization will be arranged later.
- The store URL, product homepage, and real-purchase acceptance are later work.
- Auto-updates are interesting, but the delivery model has not been chosen.

Do not replace the placeholders with invented values. The release gate stays in place until the real values exist. The app remains in development; normal builds, tests, and the fake-host E2E are unaffected.

## Owner inputs

These cannot be invented by the app:

1. **License checkout URL** in `src/shared/constants.ts` (`LICENSE_STORE_URL`). It must be the real Lemon Squeezy checkout/product URL, not `example.com`. The Buy a License link is hidden until it is real.
2. **Product homepage** in `package.json` (`homepage`). This is the page a buyer should land on, for example `https://mossphotostudio.com`. The release gate checks it.
3. **Store product and license policy**: the exact price, refund terms, computer limit, and support address. The current machine limit is two computers, and support is `support@mosstoolbox.com`; confirm both before selling.
4. **Windows signing certificate**: an Authenticode/EV certificate and its password. electron-builder reads `CSC_LINK` (path or base64) and `CSC_KEY_PASSWORD`.
5. **macOS Developer ID Application certificate**, plus notarization credentials. electron-builder reads `CSC_LINK`/`CSC_KEY_PASSWORD`; notarization reads `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` (or an Apple API key).
6. **Update decision**: the app has no auto-update channel today. If one is added, it needs a signed feed URL, a release host, and a staged rollout policy; do not ship an unsigned auto-updater.
7. **Website/legal review**: `mossphotostudio.com` landing page, privacy policy that mentions Meta (including SAM and text), and the Etsy/AI disclosure wording. `docs/privacy.md` is the source of truth for what leaves the computer.

## Auto-update options (decision deferred)

The app currently ships **no auto-updater**. That remains the honest state until an update feed, signing identity, and owner decision exist. These are the realistic options when we return to launch:

| Option | What it gives us | Costs and constraints | Fit for Moss |
| --- | --- | --- | --- |
| **A. Manual downloads only** | A new version is a new installer on the website; the app does not check anything. | No update host or extra privacy surface. Buyers must notice and re-download. | Best default until the website and signing exist. |
| **B. Static feed + `electron-updater` (recommended later)** | In-app check, background download, install on restart/quit, differential downloads, stable/beta channels. | Needs signed builds, an HTTPS feed (Cloudflare R2, S3, Bunny, or the website), `latest.yml`/`latest-mac.yml`/`latest-linux.yml`, and release discipline. Adds the update host to the privacy notes. | Best balance of control, cost, and local-first behavior once signing is ready. |
| **C. GitHub Releases** | Free hosting and simple CI publishing through the GitHub provider. | Public downloads and a GitHub dependency; private-repo tokens are awkward for an installed app. Less control over rollout and branding. | Workable for a public open build; not the best fit for a paid desktop product. |
| **D. Managed update service** | Dashboard, staged rollout, analytics, rollback. | Paid vendor, another account, and telemetry/privacy policy work. | Overkill for v1; revisit only if rollout volume justifies it. |
| **E. Version check only** | The app asks a small HTTPS endpoint for the latest version and opens the download page; no silent install. | Still needs a host and a small JSON format; does not remove the need to sign installers for trust. Lower code and signing complexity than B. | A good middle step if we want a gentle reminder before full auto-update. |

**Recommendation:** ship v1 with **manual downloads only**; when signing and the website are ready, use **B** with a generic static feed on object storage behind `updates.mossphotostudio.com` (or the website), starting with a stable channel. If the owner wants a smaller first step, use **E** and open the download page rather than installing silently.

If option B is chosen later, the implementation will need:

- `electron-updater` in the main process, a `publish` provider in `electron-builder.yml`, and update state exposed through named IPC (never renderer network).
- Windows NSIS signed with the Authenticode certificate; macOS Developer ID, hardened runtime, notarization, and both dmg/zip artifacts for the updater; Linux AppImage updater support (deb updates stay with the package manager/manual download).
- A feed layout such as `stable/latest.yml`, `stable/latest-mac.yml`, `stable/latest-linux.yml`, installers, and blockmaps. Keep the feed immutable per version, write the manifest last, and keep the previous version downloadable for rollback.
- A Settings toggle or documented check policy, a changelog surface, and a clear "install on next restart" flow. No forced restart and no silent downgrade.
- Privacy copy naming the update host and what it receives: app version, operating system, architecture, and the requested channel. No device identifier, library data, or usage history.
- CI secrets and a release owner for signing, publishing, channel promotion, and rollback.

No auto-update code is added until those are chosen; adding it now would create an unsigned, untestable update path.

## Build and verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:tokens
npm run test:e2e
MOSS_RELEASE=1 npm run release:gate
```

Then, after replacing the two public values:

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

The Linux script produces an AppImage and a deb under `release/`. Windows and macOS require the signing identities above and a host that can run those toolchains. The AppImage does not carry setuid permissions; document `--no-sandbox` or unprivileged user namespaces for distributions that block sandboxing.

## Real-account acceptance

- Create a fresh library with a **real Meta key** and make one three-shot or six-shot set. Confirm the exact amount on the Meta bill and in Usage; the app records one cent per returned image.
- Run **Read the photo**, **Clean shot**, and **Write listing** once with the real key. Confirm the text/cutout rows appear in Usage and the SAM request is billed separately.
- Buy a license through the real store. Activate on two computers, confirm the third is refused, deactivate one, and reactivate. Test an offline launch inside the 14-day grace period.
- Export an Etsy kit and inspect `listing.md`, `listing.csv`, `kit.json`, the JPEG dimensions, and the untouched original.
- Run the manual checklist in [manual-test.md](manual-test.md), including a packaged build launched with `MOSS_DEV_UNLOCK=1`, `MOSS_MUSE_FAKE=1`, and `MOSS_E2E=1` to prove the packaged gate ignores test overrides.

## Known v1 limits

- No cloud sync, accounts, hosted library, auto-updates, or real Meta billing reconciliation.
- Batch color grading and a local size-label overlay are included; batch crop/rotate and other batch edits are not. No upscaling, object eraser, or video. The Image Generator has a scene reference.
- HEIC is detected with a clear iPhone export message; it is not decoded.
- Marketplace presets are dated. Amazon is deliberately not offered. Verify the current Etsy/Shopify/TikTok/eBay requirements before making public claims.
- The clean shot handles one product on a clear background best. It is not a general background remover for transparent, reflective, or multi-item scenes.
