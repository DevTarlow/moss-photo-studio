# Product-site checkout integration

This is the site-side contract for selling an app and getting a license issued by the Moss License
Portal. The portal is not the checkout. Each app sells on its own site.

The first app is **Moss Photo Studio** on `mossphotostudio.com`. The site lives in the sibling
`moss-photo-studio-site` project; this document is the patch to apply there.

## What the portal needs

Register the app in `https://license.mossaistudio.com/admin` first. From its Integration panel,
copy:

- the webhook URL: `https://license.mossaistudio.com/api/v1/stripe/webhook`
- the app metadata: `moss_app: moss-photo-studio`
- the Stripe price id(s), for example `price_...`
- the purchase URL you will put on the site

The portal uses the same Stripe account as the rest of the Moss sites. Do not use a different
Stripe account unless per-app webhook credentials are added first.

## Option A: Stripe Payment Link (recommended for the static Astro site)

1. In Stripe, create (or reuse) the product and the **yearly subscription price** for Moss Photo
   Studio.
2. Create a Payment Link for that price.
3. Set the Payment Link's after-payment behavior to redirect to a site thank-you page, for
   example `https://mossphotostudio.com/thanks/`.
4. Optional but useful: set the Payment Link metadata (and, for subscriptions,
   `subscription_data.metadata`) to `moss_app=moss-photo-studio` through the Stripe API. The
   portal also works from the price id alone.
5. Set the product site's public checkout URL in its build environment. For local builds, create
   `moss-photo-studio-site/.env`; in deployment, set the same variable in the host's build settings:

```bash
PUBLIC_CHECKOUT_URL=https://buy.stripe.com/...
PUBLIC_SITE_LIVE=false
```

The site reads `PUBLIC_CHECKOUT_URL` at build time in `src/data/site.ts` and exposes it as
`SITE.checkoutUrl`. Leave `PUBLIC_SITE_LIVE=false` until checkout, waitlist, and legal pages are
ready; the site stays noindex until it is true. The site's `.env.example` still says Lemon Squeezy
in one comment; use the Stripe Payment Link here.

6. The thank-you page should say, in plain words, that the license key is on its way to the
   Stripe checkout email, link to `https://license.mossaistudio.com/account`, and give the support
   address. It must not claim to show the key.
7. Register the same price id in the portal app. The portal retrieves the Checkout Session with
   its line items to map a Payment Link purchase when metadata is absent.

## Option B: server-created Checkout Session

If the site later adds a Firebase Function or another small server, create the session with:

```js
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: PRICE_ID, quantity: 1 }],
  metadata: { moss_app: 'moss-photo-studio' },
  subscription_data: { metadata: { moss_app: 'moss-photo-studio' } },
  success_url: 'https://mossphotostudio.com/thanks/?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://mossphotostudio.com/#pricing'
})
```

The price id must be registered in the portal anyway, so renewal and invoice events still map if
metadata is lost.

## Stripe webhook

The portal's webhook endpoint must be configured **once per Stripe account**, not once per site.
Subscribe at least to:

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

The product site may also have its own webhook endpoints for its own records. Stripe sends events
to every endpoint.

## Test checklist

Use Stripe test mode first and the portal's test checklist:

1. Register the app and price id in the portal.
2. Buy through the site's test Payment Link with a Stripe test card.
3. Confirm the portal created exactly one license, one order, and one email outbox row.
4. Confirm the email contains the key, the site's download/instructions, and the manage link.
5. Sign in at the portal with the purchase email; confirm the license is visible.
6. Activate on two test profiles; confirm the third is refused.
7. Reset from the account; confirm the old activation is gone and a new activation works.
8. Run a test-clock renewal and a cancellation; confirm the license end date follows.
9. Register a second app with a different price and repeat steps 2-5 to prove no code deploy is
   needed.
10. Buy with an unregistered price or missing app; confirm the purchase appears in the portal's
    Unmatched queue and the owner is alerted.

## Do not

- Do not put the key in the success URL or show it on the site from a session id.
- Do not create a second checkout flow inside the portal.
- Do not use a different Stripe account per site without adding per-app webhook configuration.
- Do not rely on `line_items` being present in the webhook event; the portal retrieves/expands
  them when it needs the price id.
