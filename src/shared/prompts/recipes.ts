import type { ShotType } from '../types'
import { shotDefinition } from './shots'

export interface Recipe {
  id: string
  label: string
  shots: readonly ShotType[]
  /** Category-specific studio directions. They replace the global default. */
  directions?: Partial<Record<ShotType, string>>
  /** Replaces the global gift clause for this category's gift shot. */
  giftClause?: string
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'candles',
    label: 'Candles and home fragrance',
    shots: ['hero', 'lifestyle', 'detail', 'flatlay', 'gift', 'scale'],
    directions: {
      detail:
        "a close-up of the candle's wick, wax surface and label, showing the texture of the wax and the finish of the jar, soft directional light",
      flatlay:
        'a flat lay of the candle from directly above on a pale linen cloth, showing its own jar, wax and wick, with two small sprigs of dried lavender beside it, minimal props, soft daylight'
    }
  },
  {
    id: 'ceramics',
    label: 'Ceramics and pottery',
    shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'],
    directions: {
      detail:
        'a close-up of the rim, handle or lip, and glaze, showing the speckle and finish of the ceramic, soft directional light'
    }
  },
  {
    id: 'jewelry',
    label: 'Jewelry',
    shots: ['hero', 'detail', 'lifestyle', 'scale', 'gift', 'flatlay'],
    directions: {
      detail:
        "a close-up of the piece's clasp, setting, pendant and metal finish, with the piece in focus and a soft neutral background",
      lifestyle:
        'the piece worn on the body where it belongs - neckline, wrist, ear or hand - shown close with the piece in focus, on a soft neutral background'
    }
  },
  {
    id: 'clothing',
    label: 'Clothing and accessories',
    shots: ['hero', 'onmodel', 'detail', 'lifestyle', 'flatlay', 'gift'],
    directions: {
      hero:
        'a clean, well-lit product photo of the product laid flat and neatly smoothed on a pure white seamless background, front view, the whole item visible and centred, minimal creases',
      onmodel:
        "Show the person wearing the product in a waist-up portrait, framed from the waist to the top of the head, with the product's collar, buttons or details clearly visible, against a plain light grey studio backdrop with soft, even light.",
      detail:
        "a close-up of the product's fabric, stitching, seams and details such as a collar, buttons or hardware, with its pattern clearly visible, soft directional light",
      lifestyle:
        'the product hanging on a wooden hanger or draped over a chair against a warm sunlit bedroom wall, styled beside a straw hat and a linen bag, soft daylight, a calm real-life setting',
      flatlay:
        'a styled flat lay of the product on a warm wooden table with a straw hat, sunglasses and a folded linen cloth, shot from directly above, soft daylight',
      gift:
        'the product neatly folded or rolled inside an open kraft gift box lined with white tissue paper, the product and its details clearly visible, soft daylight, product photo'
    },
    giftClause:
      ' Show the item folded or rolled in tissue paper inside an open gift box - the item must stay clearly visible, not a finished wrapped parcel.'
  },
  {
    id: 'bags',
    label: 'Bags and leather',
    shots: ['hero', 'onmodel', 'detail', 'lifestyle', 'scale', 'gift'],
    directions: {
      detail:
        "a close-up of the bag's handle, stitching, hardware and leather grain, with the bag's shape still readable",
      onmodel:
        'Show the person carrying the bag over one shoulder or across the body, turned so the bag faces the camera and is fully visible, framed from the waist up, against a plain light grey studio backdrop with soft, even light.'
    }
  },
  {
    id: 'prints',
    label: 'Prints and art',
    shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'],
    directions: {
      detail:
        "a close-up of the frame corner, mount and paper texture, with the print's colours visible, soft directional light"
    }
  },
  {
    id: 'skincare',
    label: 'Skincare and beauty',
    shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'],
    directions: {
      detail:
        "a close-up of the product's cap, label and surface, keeping the label exactly as pictured with no new or changed text, with the texture visible, soft directional light"
    }
  },
  {
    id: 'food',
    label: 'Food and drink',
    shots: ['hero', 'lifestyle', 'detail', 'flatlay', 'gift', 'scale'],
    directions: {
      lifestyle:
        'the product on a warm kitchen counter or cafe table beside a cup and a small plate, in soft morning light, with a kitchen or cafe softly out of focus behind',
      detail:
        "a close-up of the product's packaging, label and texture, with the food or drink itself visible, soft directional light",
      scale:
        'the product on a table beside a standard coffee cup and saucer so its size reads at a glance, soft daylight'
    }
  },
  {
    id: 'homeware',
    label: 'Homeware and furniture',
    shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'],
    directions: {
      gift:
        'the product wrapped in kraft paper with a wide ribbon and a small tag, styled in a bright room beside a plant, ready to give, product photo'
    },
    giftClause: ' Show the product wrapped in kraft paper with a ribbon, styled in a bright room; do not place it inside a box.'
  },
  {
    id: 'vintage',
    label: 'Vintage and resale',
    shots: ['hero', 'detail', 'lifestyle', 'scale', 'flatlay', 'gift'],
    directions: {
      detail:
        "a close-up of the piece's patina, maker's mark, joins and wear, showing its condition honestly, soft directional light"
    }
  },
  { id: 'other', label: 'Something else', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] }
]

export const DEFAULT_CATEGORY = 'other'
export const CATEGORY_CHIPS = RECIPES.map((recipe) => ({ id: recipe.id, label: recipe.label }))

export function recipeById(id: string | null | undefined): Recipe {
  return RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[RECIPES.length - 1]!
}

export function recipeShotTypes(category: string | null | undefined): ShotType[] {
  return [...recipeById(category).shots]
}

export function recipeShotLabels(category: string | null | undefined): string[] {
  return recipeShotTypes(category).map((type) => shotDefinition(type).label)
}

/** The category's studio direction, or the shared default when it has none. */
export function defaultDirectionFor(category: string | null | undefined, type: ShotType): string {
  return recipeById(category).directions?.[type] ?? shotDefinition(type).defaultDirection
}

/** The category's gift composition clause, or undefined to use the shared one. */
export function giftClauseFor(category: string | null | undefined): string | undefined {
  return recipeById(category).giftClause
}
