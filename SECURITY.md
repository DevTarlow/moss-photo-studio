# Security policy

## Supported versions

Security fixes go to the current release on the `main` branch. Older builds may
not receive a fix. The app version is shown in Settings, About.

## Reporting a vulnerability

Email **tarlow@mossaistudio.com** with:

- the affected version and platform;
- a short description and the impact;
- steps to reproduce, or a proof of concept;
- whether the issue affects the desktop app, the license center, or both.

Do not open a public issue for a vulnerability, and do not include a license
key, a Meta key, a Stripe secret, a customer email, or customer images. If a key
may have leaked, say so without pasting the key; we will help rotate it.

We aim to acknowledge a report within three business days, agree on a fix and
disclosure window, and credit the reporter if they want credit.

## Scope

In scope:

- the desktop app: Electron main and preload, IPC boundary, local files,
  library database, license storage, update checks;
- the license center: license API, customer account, admin routes, Stripe
  webhook, Firestore rules and indexes;
- release artifacts and build scripts.

Out of scope:

- Meta's image service and Stripe's hosted pages;
- issues that require an already-modified build or a rooted device, without a
  realistic impact on a buyer;
- denial of service from a local user against their own install;
- social engineering.

## Secrets

This repository must never contain a real license key, Meta key, Stripe key,
Firebase service account, or `.env` file. `.env` is ignored; `.env.example` is
the only tracked environment file. If you find a secret in the repository or
its history, report it by email rather than opening an issue.

## License enforcement

The app's license check is a client-side boundary. A person with the source and
a build toolchain can remove it. Reports about that are expected and are handled
by the license terms, not by treating them as a vulnerability. Reports about a
bypass that works against the **distributed** build, a key for another app, a
copied install that reuses a seat, or a release build that accepts test
overrides are in scope.
