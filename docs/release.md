# Release checklist

This is the owner-side checklist for a signed distribution. The code is ready to build, but the release gate intentionally refuses while the public identity is still a placeholder.

## Owner inputs

These cannot be invented by the app:

1. **License checkout URL** in `src/shared/constants.ts` (`LICENSE_STORE_URL`). It must be the real Lemon Squeezy checkout/product URL, not `example.com`. The Buy a License link is hidden until it is real.
2. **Product homepage** in `package.json` (`homepage`). This is the page a buyer should land on, for example `https://mossphotostudio.com`. The release gate checks it.
3. **Store product and license policy**: the exact price, refund terms, computer limit, and support address. The current machine limit is two computers, and support is `support@mosstoolbox.com`; confirm both before selling.
4. **Windows signing certificate**: an Authenticode/EV certificate and its password. electron-builder reads `CSC_LINK` (path or base64) and `CSC_KEY_PASSWORD`.
5. **macOS Developer ID Application certificate**, plus notarization credentials. electron-builder reads `CSC_LINK`/`CSC_KEY_PASSWORD`; notarization reads `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` (or an Apple API key).
6. **Update decision**: the app has no auto-update channel today. If one is added, it needs a signed feed URL, a release host, and a staged rollout policy; do not ship an unsigned auto-updater.
7. **Website/legal review**: `mossphotostudio.com` landing page, privacy policy that mentions Meta (including SAM and text), and the Etsy/AI disclosure wording. `docs/privacy.md` is the source of truth for what leaves the computer.

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
- No batch editing, editor-side scene-reference slot, dimension overlay, upscaling, object eraser, or video. The Image Generator has a scene reference.
- HEIC is detected with a clear iPhone export message; it is not decoded.
- Marketplace presets are dated. Amazon is deliberately not offered. Verify the current Etsy/Shopify/TikTok/eBay requirements before making public claims.
- The clean shot handles one product on a clear background best. It is not a general background remover for transparent, reflective, or multi-item scenes.
