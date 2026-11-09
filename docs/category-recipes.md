# Category recipes

The recipe decides the six shots a set starts with. The first three are what the 3-image preset makes, so the order is part of the product: hero first, then the strongest two shots for that category.

Calibrated against the real Meta Muse API on 2026-11-09 with the owner's `shirt.jpg`. See [lab.md](lab.md) for the harness and `lab/` for the generated gallery.

## Final rosters

| Category | Six shots (first three in bold) | First-run trio |
| --- | --- | --- |
| Candles and home fragrance | **hero, lifestyle, detail**, flatlay, gift, scale | Product shot, real-home context, wax/label detail |
| Ceramics and pottery | **hero, lifestyle, detail**, scale, flatlay, gift | Product shot, room context, rim/handle/glaze |
| Jewelry | **hero, detail, lifestyle**, scale, gift, flatlay | Product shot, clasp/finish, worn on the body |
| Clothing and accessories | **hero, onmodel, detail**, lifestyle, flatlay, gift | Flat product shot, waist-up worn, fabric/buttons |
| Bags and leather | **hero, onmodel, detail**, lifestyle, scale, gift | Product shot, carried, handle/stitching/hardware |
| Prints and art | **hero, lifestyle, detail**, scale, flatlay, gift | Product shot, hung in a room, frame/print detail |
| Skincare and beauty | **hero, lifestyle, detail**, scale, flatlay, gift | Product shot, bathroom context, cap/label |
| Food and drink | **hero, lifestyle, detail**, flatlay, gift, scale | Product shot, kitchen/cafe context, packaging |
| Homeware and furniture | **hero, lifestyle, detail**, scale, flatlay, gift | Product shot, room context, material detail |
| Vintage and resale | **hero, detail, lifestyle**, scale, flatlay, gift | Product shot, condition/patina, in a period room |
| Something else | **hero, lifestyle, detail**, scale, flatlay, gift | Generic listing trio |

`feature` (text on image) is never in a recipe. It stays an optional shot the seller can add.

## Direction overrides

A category only overrides the shots where the generic direction was wrong. Everything else uses `src/shared/prompts/shots.ts`.

| Category | Overridden shots | Gift clause |
| --- | --- | --- |
| Candles | detail (wick/wax/label), flatlay (top-down, same jar, minimal props) | shared box clause |
| Ceramics | detail (rim/handle/glaze) | shared box clause |
| Jewelry | detail (clasp/setting/finish), lifestyle (worn at neckline/wrist/hand) | shared box clause |
| Clothing | hero (smoothed flat), onmodel (waist-up worn), detail (fabric/collar/buttons), lifestyle (hanger/draped, bedroom), flatlay (styled, from above), gift (folded/rolled in tissue) | folded or rolled in tissue, product visible |
| Bags | detail (handle/stitching/hardware), onmodel (over shoulder/crossbody) | shared box clause |
| Prints | detail (frame corner/mount/paper) | shared box clause |
| Skincare | detail (cap/label, **no invented text**) | shared box clause |
| Food | lifestyle (kitchen/cafe table), detail (packaging and food), scale (cup and saucer) | shared box clause |
| Homeware | gift (kraft paper and ribbon in a room, no box) | kraft paper, no box |
| Vintage | detail (patina/maker's mark/condition) | shared box clause |
| Something else | none | shared box clause |

The gift clause contains a leading space because it is appended directly to the direction.

## Evidence

Runs are local under `lab/runs/` (gitignored). The important ones:

- `2026-11-09-131829-set-clothing` — generic six-shot clothing baseline. Hero was wrinkled, lifestyle was a shirt on a garden table, and the gift used the generic upright-box clause.
- `2026-11-09-132033-set-clothing` — validated clothing directions. The shirt kept its pattern in every shot; the worn shot worked from a flat source photo; the folded gift box read correctly.
- `2026-11-09-132234-sweep` — first generic sweep across all 11 categories. It exposed: food lifestyle in a garden, homeware furniture inside a gift box, candle flat-lay replacing the candle, and a skincare close-up inventing label text.
- `2026-11-09-133952-sweep` — final sweep with the shipping recipes. Clothing, bags, vintage, candles, ceramics, jewelry, food, homeware, prints, skincare and other all produced usable six-shot sets.

Findings that changed a decision:

- **Jewelry and skincare do not need an `onmodel` shot.** Jewelry's `lifestyle` prompt already puts the piece on a neckline and produced the best worn image; adding a person reference would have removed a stronger shot.
- **Bags keep `scale` and gain `flatlay` only as an available add-on.** The bottle/notebook size reference worked; only the order changed so `onmodel` is second.
- **Vintage moves `lifestyle` into the first three.** The period-room shot is stronger for resale than the object-only size reference.
- **Candle flat lay needed a top-down composition.** A generic "flat lay with props" replaced the amber jar with a different candle; a top-down view of the same jar keeps the product.
- **Clothing's `lifestyle` needed a real-life setting that does not pretend to be worn.** The referenced person is only sent for `onmodel`, so the lifestyle shot shows the product hanging in a bedroom instead of inventing a second person.
- **Skincare needed the no-new-text instruction.** The model invented "HYDRATING SERUM" on a blank label; "keeping the label exactly as pictured" removed it.
- **Homeware needed a different gift composition.** Kraft paper and ribbon in a room is usable for furniture; an open gift box is not.

## Cost

| Run | Cost |
| --- | ---: |
| Canary (1 hero) | $0.01 |
| Clothing baseline (6) | $0.06 |
| Clothing candidate directions (6) | $0.06 |
| Source pack (10 stand-ins) | $0.10 |
| Generic sweep (11 × 6) | $0.66 |
| Targeted refinements (18 images) | $0.18 |
| Final shipping sweep (11 × 6) | $0.66 |
| **Total** | **$1.73** |

Cap was $3.00. Every run is in `lab/spend.json`.

## Limitations

- Only `shirt.jpg` is a real owner photo. The other category sources were generated stand-ins; the recipes still need a pass with real jewelry, skincare, food, furniture and artwork when those photos are available.
- One image per shot was judged. The model can vary between runs; the final sweep is a snapshot, not a guarantee.
- On-person shots use the bundled Maya reference by default. A seller's own person may behave differently.
- The app UI was checked end-to-end with the fake host. The real-Muse runs used the same shipping client and prompt specs but not the Electron UI.
- Generated demo images are of the owner's shirt. Confirm usage rights before publishing them.

## Re-running

```bash
# Free prompt review
npm run lab -- plan --all

# One category with the shipping recipe
npm run lab -- set --category clothing --source lab/sources/clothing.jpg --yes

# Full gallery (66 images, $0.66)
npm run lab -- sweep --yes
```

Replace `lab/sources/<category>.webp` with a real photo to re-check a category, then update the rosters above if the evidence warrants it.
