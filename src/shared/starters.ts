export type StarterCategory =
  | 'Main listing image'
  | 'Etsy & handmade'
  | 'eBay & resale'
  | 'Home & lifestyle'
  | 'Food & drink'
  | 'Jewelry & accessories'
  | 'Gifts & seasonal'
  | 'Social posts'

export interface Starter {
  category: StarterCategory
  label: string
  text: string
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  'Main listing image',
  'Etsy & handmade',
  'eBay & resale',
  'Home & lifestyle',
  'Food & drink',
  'Jewelry & accessories',
  'Gifts & seasonal',
  'Social posts'
]

export const STARTERS: readonly Starter[] = [
  {
    category: 'Main listing image',
    label: 'Mug on pure white',
    text: 'A ceramic mug alone on a pure white background, centred and filling most of the frame, no props or text, soft even lighting, product photo.'
  },
  {
    category: 'Main listing image',
    label: 'Bottle on pure white',
    text: 'A glass bottle alone on a pure white background, centred and filling most of the frame, no props or text, soft even lighting, product photo.'
  },
  {
    category: 'Main listing image',
    label: 'Four items on white',
    text: 'A set of four small items evenly spaced on a pure white background, filling most of the frame, no props or text, soft even lighting, product photo.'
  },
  {
    category: 'Etsy & handmade',
    label: 'Candle on a bedside table',
    text: 'A scented candle on a wooden bedside table beside a book and dried flowers, warm evening light, cosy handmade style.'
  },
  {
    category: 'Etsy & handmade',
    label: 'Vase on linen',
    text: 'A small clay vase on a natural linen cloth, soft window light, a few dried stems beside it, handmade product photo.'
  },
  {
    category: 'Etsy & handmade',
    label: 'Scarf on a chair',
    text: 'A chunky knitted scarf draped over a wooden chair in a bright room, soft daylight, cosy handmade style.'
  },
  {
    category: 'eBay & resale',
    label: 'Jacket on a hanger',
    text: 'A denim jacket on a wooden hanger against a plain white wall, even lighting, the whole item in frame, honest product photo.'
  },
  {
    category: 'eBay & resale',
    label: 'Sneakers side by side',
    text: 'A pair of sneakers side by side on a plain grey floor, even lighting, both shoes fully in frame, product photo.'
  },
  {
    category: 'eBay & resale',
    label: 'Vintage radio on a table',
    text: 'A vintage portable radio on a plain wooden table, soft daylight, the whole item in frame, clear detail of its condition.'
  },
  {
    category: 'Home & lifestyle',
    label: 'Vase on a marble counter',
    text: 'A small clay vase on a pale marble counter beside a folded towel, soft window light, calm bathroom setting, editorial photo.'
  },
  {
    category: 'Home & lifestyle',
    label: 'Throw on a sofa',
    text: 'A folded wool throw on a linen sofa, soft afternoon light, a cup of tea on the side table, cosy home style.'
  },
  {
    category: 'Home & lifestyle',
    label: 'Jug on a kitchen table',
    text: 'A ceramic jug and a bowl on a warm wooden kitchen table, morning light, a linen napkin beside them, home style.'
  },
  {
    category: 'Food & drink',
    label: 'Coffee bag on a counter',
    text: 'A bag of coffee beans on a cafe counter beside a cup, warm morning light, shallow depth of field, product photo.'
  },
  {
    category: 'Food & drink',
    label: 'Cake slice on a plate',
    text: 'A slice of cake on a ceramic plate on a wooden table, soft daylight, a fork and a few crumbs beside it, food photo.'
  },
  {
    category: 'Food & drink',
    label: 'Bread on a board',
    text: 'A loaf of sourdough on a wooden board, a linen cloth beside it, warm window light, rustic food photo.'
  },
  {
    category: 'Jewelry & accessories',
    label: 'Necklace on dark velvet',
    text: 'A gold necklace on dark velvet, a single soft spotlight, a subtle shadow, close-up jewelry photo.'
  },
  {
    category: 'Jewelry & accessories',
    label: 'Wallet on a wood desk',
    text: 'A leather wallet on a dark wood desk, soft side light, a watch beside it, close-up product photo.'
  },
  {
    category: 'Jewelry & accessories',
    label: 'Watch on a stand',
    text: 'A wristwatch on a small watch stand, plain background, soft side light, close-up product photo.'
  },
  {
    category: 'Gifts & seasonal',
    label: 'Gift box with tissue paper',
    text: 'An open gift box lined with white tissue paper with a ceramic mug sitting inside, warm festive light, shallow depth of field, product photo.'
  },
  {
    category: 'Gifts & seasonal',
    label: 'Holiday table setting',
    text: 'A simple holiday table setting with a candle and a folded napkin, warm evening light, soft background, festive photo.'
  },
  {
    category: 'Gifts & seasonal',
    label: 'Advent calendar on a mantle',
    text: 'A wooden advent calendar on a fireplace mantle, warm string lights, cosy festive setting, product photo.'
  },
  {
    category: 'Social posts',
    label: 'Flat lay for a post',
    text: 'A flat lay of a ceramic mug on a plain pastel background with a few small props, soft daylight, empty space at the top for text, square photo.'
  },
  {
    category: 'Social posts',
    label: 'Wide banner with space',
    text: 'A wide banner with a ceramic mug on one side, softly lit background, empty space on the other side for text, clean product photo.'
  },
  {
    category: 'Social posts',
    label: 'Close-up of the detail',
    text: "A close-up of a ceramic mug's glaze and handle, soft directional light, plain background, detail photo."
  }
]

export function startersByCategory(): Array<{ category: StarterCategory; items: Starter[] }> {
  return STARTER_CATEGORIES.map((category) => ({
    category,
    items: STARTERS.filter((starter) => starter.category === category)
  }))
}
