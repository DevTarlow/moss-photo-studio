# Licensing and the Moss License Portal

This document records the licensing decision, the contract between the desktop app and the
portal, and the rules the portal must keep. The portal source lives in the sibling `moss-license-center` repository; this document stays with the app-side contract.

## Decision

The app uses its own license portal at `https://license.mossaistudio.com` instead of Lemon
Squeezy.

- Checkout stays on each app's own site. Moss Photo Studio is sold on
  [mossphotostudio.com](https://mossphotostudio.com) through Stripe; future apps do the same on
  their own sites.
- The portal is the fulfillment backend, the admin dashboard, and the customer license account.
  It is not a storefront.
- A Stripe webhook is the only bridge between a purchase and a license. The product site does not
  call the portal.
- The owner registers each app in the admin dashboard: name, seats, prices, download links, and
  post-purchase instructions. Adding another app does not require a code deploy.
- The desktop app keeps its existing 14 day offline grace, encrypted local key, daily validation,
  and read-only library behavior. Only the `LicenseProvider` implementation and the host change.

Why not a vendor: the owner wants a branded customer portal, self-service machine resets, manual
issue/remove controls, and one backend for several apps. Lemon Squeezy, Polar, and Keygen remain
reasonable alternatives; the provider seam means the app does not depend on this portal
implementation existing forever.

## Flow

```text
1. Buyer pays on mossphotostudio.com (Stripe Checkout / Payment Link).
2. Stripe sends checkout.session.completed to the portal.
3. Portal maps the session to a registered app:
   metadata moss_app -> subscription metadata -> line-item price id -> product id.
4. Portal creates one license, one order, and one email outbox row in a transaction.
5. Brevo emails the key, the app's download/install instructions, and a manage link.
6. Buyer opens https://license.mossaistudio.com/account, signs in with the purchase email,
   and sees the license, machines, and reset control.
7. App activates against /api/v1/licenses/* with the key and a per-install label.
```

If mapping fails, the portal writes an `unmatchedPurchases` row and alerts the owner. It never
silently drops a paid purchase.

## Admin app registry

Each app is a Firestore `apps/{slug}` document. The admin UI can create, edit, pause, and archive
it.

Required fields:

- `name`, `slug`, `status`.
- `activationLimit` (default 2) and default `termDays` for one-time prices.
- At least one price: `{ priceId, mode: 'subscription' | 'one_time', termDays?, label }`.
  Price ids are unique across apps.
- `purchaseUrl`, `websiteUrl`, download links, support email, and post-purchase instructions.
- Optional Stripe product id.

The app detail shows an Integration panel with the webhook URL, the metadata pair
`moss_app: <slug>`, the price ids, and the test checklist. That is what gets copied into the
product site.

Existing licenses snapshot their seat limit and term at issue. Editing or archiving an app never
changes an existing license.

## Checkout contract for a product site

Two integrations are supported. See [checkout-integration.md](checkout-integration.md) for the
site-side details.

**Payment Link (simplest for a static Astro site).** Create the price in Stripe, register its id
in the portal app, and use the Payment Link as the site's checkout URL. The portal retrieves the
Checkout Session with its line items to map the price id. Metadata is optional.

**Server-created Checkout Session.** If a site later adds a small function, set:

```json
{
  "mode": "subscription",
  "line_items": [{ "price": "price_...", "quantity": 1 }],
  "metadata": { "moss_app": "moss-photo-studio" },
  "subscription_data": { "metadata": { "moss_app": "moss-photo-studio" } }
}
```

The price id must still be registered in the portal so renewal events map even if metadata is
missing.

Rules:

- One license-producing price per checkout.
- All product sites use the same Stripe account; the portal has one webhook endpoint.
- The site's success page does not show the key. The email is the delivery channel; the account
  page is the durable copy.
- The site may keep its own Stripe webhook for order records; Stripe allows multiple endpoints.

## App API

Base: `https://license.mossaistudio.com/api/v1`. JSON only, 8 KB body limit, zod validation.

| Endpoint | Request | Success | Explicit failure |
| --- | --- | --- | --- |
| `POST /licenses/activate` | `{ key, instance_name }` | `{ activated: true, instance: { id, name }, license: { status: "active", product, expiresAt } }` | 400 `invalid_key`, 409 `activation_limit`, 410 `license_expired` / `license_revoked`, 429 `rate_limited` |
| `POST /licenses/validate` | `{ key, instance_id }` | `{ valid: true, license: { status: "active", expiresAt } }` | 200 `{ valid: false, license: { status: "inactive" \| "expired" \| "revoked" } }` for explicit rejection; 429/5xx only for transient failures |
| `POST /licenses/deactivate` | `{ key, instance_id }` | `{ deactivated: true }` | 400/429; idempotent true when the activation is already gone |
| `GET /health` | — | `{ ok: true }` | — |

The Electron provider maps 400/404/410/422 to `license_invalid`, 409 to `license_limit`, and
408/425/429/5xx/network/timeout/401/403 to `license_offline`. A rate limit must never look like a
bad key.

### Keys

- Format: `MOSS-XXXX-XXXX-XXXX-XXXX-XXXX`, Crockford Base32, about 100 bits.
- The server uppercases and strips separators before lookup.
- The Firestore document id is `HMAC-SHA256(LICENSE_KEY_PEPPER, normalizedKey)`.
- The key is stored only as AES-256-GCM ciphertext (AAD = the document id); only the last four
  characters are kept in clear text.
- Keys are shown in full only in the purchase email, the owner's reveal action (audited), and a
  reissue action. Never in logs, URLs, list responses, or exports.

### Seats and reset

- `activationLimit` is per license (default 2). Each activation is a per-install label, not a
  hardware fingerprint.
- Activating the same label is idempotent. A new label over the limit returns 409.
- A revoked or expired license returns 410 and does not consume a seat.
- Customer reset clears every activation, is limited to one per 24 hours, sends a notice email,
  and is audited. Admin reset is unlimited.
- Deactivate removes one activation and is idempotent.
- Reset does not revoke the key. The old machine becomes read-only when its next validation sees
  no matching activation; the new machine activates with the same key.

### Subscription and expiry

- `validUntil` is the only expiry source. The app's 14 day offline grace is separate.
- `checkout.session.completed` sets `validUntil` from the subscription period end, or
  `now + termDays` for a one-time price.
- `invoice.paid` extends it. `customer.subscription.deleted` keeps access to `validUntil`.
  Past due keeps access to `validUntil`. Refund or dispute revokes immediately by default.
- Cancellation is handled in Stripe's billing portal, linked from the customer account.

## Security

- Firestore rules deny all client reads and writes. Every request goes through a function with the
  Admin SDK.
- Secrets live in Secret Manager: Stripe secret and webhook secret, key pepper, key encryption
  key, Brevo API key, admin allowlist. Only public Firebase web config is in the client bundle.
- Webhook signatures are verified against the raw body; `stripeEvents/{eventId}` makes replay a
  no-op. The event, order, license, and outbox write happen in one transaction.
- Admin routes check the allowlisted, verified email on the server. The UI guard is cosmetic.
- Rate limits: hashed-IP documents with TTL and per-license failed-attempt lockout.
- The portal never receives card data. Stripe hosts checkout and billing.
- Every admin mutation, customer reset, revocation, and reissue is written to `audit`.
- Backups: scheduled Firestore export. Secrets are backed up separately; losing the key
  encryption key means reissuing keys.

## Known limits

- A revoked key can keep working until the next validation, or for the 14 day offline grace on a
  disconnected machine.
- The app hardcodes "two computers" in several strings. Changing the default to one needs a copy
  release.
- The portal is a separate account system; the app stays account-free and only sends the key,
  instance id, and install label.
- All sites share one Stripe account. A separate Stripe account per site needs per-app webhook
  credentials and is not implemented.
- There is no silent auto-update. Downloads and a version check are the current scope; an
  `electron-updater` feed waits for signed builds.
