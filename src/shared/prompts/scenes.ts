export type SceneCategory = 'Studio basics' | 'Home & lifestyle' | 'Premium studio' | 'Seasonal'

export interface Scene {
  id: string
  label: string
  blurb: string
  category: SceneCategory
  prompt: string
  tile: string
}

export const SCENE_CATEGORIES: readonly SceneCategory[] = [
  'Studio basics',
  'Home & lifestyle',
  'Premium studio',
  'Seasonal'
]

export const SCENES: readonly Scene[] = [
  {
    id: 'studio-white',
    label: 'Clean white studio',
    blurb: 'The safe studio photo. Works for anything.',
    category: 'Studio basics',
    prompt:
      'a seamless bright white studio background with soft, even lighting and a gentle shadow under the product',
    tile: 'tiles/scenes/studio-white.webp'
  },
  {
    id: 'soft-gradient',
    label: 'Soft color backdrop',
    blurb: 'A calm color behind the product, no props.',
    category: 'Studio basics',
    prompt:
      'a smooth seamless backdrop in a soft neutral colour that gently contrasts the product, with even studio lighting',
    tile: 'tiles/scenes/soft-gradient.webp'
  },
  {
    id: 'marble-counter',
    label: 'Marble counter',
    blurb: 'Bathroom, skincare and self-care products.',
    category: 'Home & lifestyle',
    prompt:
      'a pale marble counter with rolled white towels, a small green plant and a soft-focus bathroom behind, lit by daylight from a window',
    tile: 'tiles/scenes/marble-counter.webp'
  },
  {
    id: 'kitchen-table',
    label: 'Kitchen table',
    blurb: 'Food, drink, ceramics and homeware.',
    category: 'Home & lifestyle',
    prompt:
      'a warm wooden kitchen table in soft morning light, with a linen napkin and a cup just out of focus behind',
    tile: 'tiles/scenes/kitchen-table.webp'
  },
  {
    id: 'linen-sheets',
    label: 'Linen and soft fabric',
    blurb: 'Textiles, candles and cosy gifts.',
    category: 'Home & lifestyle',
    prompt:
      'rumpled natural linen fabric in soft neutral tones, gently lit from the side, with the product resting on it',
    tile: 'tiles/scenes/linen-sheets.webp'
  },
  {
    id: 'concrete-plinth',
    label: 'Concrete plinth',
    blurb: 'Minimal, modern, higher price points.',
    category: 'Premium studio',
    prompt:
      'a smooth grey concrete plinth in a minimal studio with a soft gradient backdrop and directional side light',
    tile: 'tiles/scenes/concrete-plinth.webp'
  },
  {
    id: 'dark-spotlight',
    label: 'Dark spotlight',
    blurb: 'Jewelry, glassware and premium packaging.',
    category: 'Premium studio',
    prompt:
      'a deep charcoal background lit by a single focused spotlight, with a soft shadow falling away behind the product',
    tile: 'tiles/scenes/dark-spotlight.webp'
  },
  {
    id: 'gift-ready',
    label: 'Gift-ready',
    blurb: 'Hampers, wrapping and celebration sets.',
    category: 'Seasonal',
    prompt:
      'the product sitting upright inside an open gift box lined with white tissue paper, clearly visible rather than a finished wrapped present beside it, and if the product is drinkware, clean and empty, ready to wrap',
    tile: 'tiles/scenes/gift-ready.webp'
  }
]

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((scene) => scene.id === id)
}
