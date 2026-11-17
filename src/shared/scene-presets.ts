import type { ScenePreset } from './types'
import { bundledUrl } from './files'

export interface BundledScenePreset {
  id: string
  name: string
  category: string
  blurb: string
}

/** The square size every included scene photo is bundled at. */
export const BUNDLED_SCENE_SIZE = 1024

export const BUNDLED_SCENE_CATEGORIES: readonly string[] = [
  'Studio backdrops',
  'Lifestyle rooms',
  'Kitchen and table',
  'Bath and spa',
  'Outdoor spaces',
  'Seasonal sets'
]

/**
 * Clean, product-free scene photos included with Moss as starting points: 30
 * settings across six categories. A scene supplies the setting, light and props
 * for another image; its subject is never copied. The matching generation
 * prompts live in scripts/lab/scene-pack.mjs; keep ids, names and categories in
 * sync with it (the unit test checks that). The images are
 * resources/scenes/<id>.webp with a 480x480 <id>-thumb.webp.
 */
export const BUNDLED_SCENE_PRESETS: readonly BundledScenePreset[] = [
  {
    id: 'white-seamless',
    name: 'White seamless studio',
    category: 'Studio backdrops',
    blurb: 'A bright white sweep for any product.'
  },
  {
    id: 'warm-grey-sweep',
    name: 'Warm grey studio',
    category: 'Studio backdrops',
    blurb: 'A soft warm-grey backdrop for neutral products.'
  },
  {
    id: 'blush-paper',
    name: 'Blush paper backdrop',
    category: 'Studio backdrops',
    blurb: 'Pale blush paper for beauty and gifts.'
  },
  {
    id: 'charcoal-sweep',
    name: 'Charcoal studio',
    category: 'Studio backdrops',
    blurb: 'Deep charcoal for jewelry, glassware and premium packaging.'
  },
  {
    id: 'stone-plinth',
    name: 'Stone plinth',
    category: 'Studio backdrops',
    blurb: 'A minimal plinth for a premium, modern shot.'
  },
  {
    id: 'oak-side-table',
    name: 'Oak side table',
    category: 'Lifestyle rooms',
    blurb: 'Warm wood, a lamp and soft window light for homeware and candles.'
  },
  {
    id: 'linen-bed',
    name: 'Linen bed',
    category: 'Lifestyle rooms',
    blurb: 'Rumpled linen and morning light for textiles and gifts.'
  },
  {
    id: 'living-room-console',
    name: 'Living room console',
    category: 'Lifestyle rooms',
    blurb: 'An oak console for ceramics, prints and home fragrance.'
  },
  {
    id: 'cosy-shelf',
    name: 'Cosy shelf',
    category: 'Lifestyle rooms',
    blurb: 'A warm shelf for candles, small ceramics and books.'
  },
  {
    id: 'reading-corner',
    name: 'Reading corner',
    category: 'Lifestyle rooms',
    blurb: 'A quiet chair and side table for slow-living products.'
  },
  {
    id: 'marble-counter',
    name: 'Marble counter',
    category: 'Kitchen and table',
    blurb: 'A pale marble counter for food, drink and skincare.'
  },
  {
    id: 'warm-kitchen-table',
    name: 'Warm kitchen table',
    category: 'Kitchen and table',
    blurb: 'Oak and morning light for ceramics, drinkware and preserves.'
  },
  {
    id: 'breakfast-bar',
    name: 'Breakfast bar',
    category: 'Kitchen and table',
    blurb: 'A bright stone counter for mugs, carafes and pantry goods.'
  },
  {
    id: 'pantry-shelf',
    name: 'Pantry shelf',
    category: 'Kitchen and table',
    blurb: 'Jars, baskets and warm light for food packaging.'
  },
  {
    id: 'dining-table-runner',
    name: 'Dining table runner',
    category: 'Kitchen and table',
    blurb: 'A linen runner for tableware, candles and serving pieces.'
  },
  {
    id: 'marble-vanity',
    name: 'Marble vanity',
    category: 'Bath and spa',
    blurb: 'Marble and folded towels for skincare and bath products.'
  },
  {
    id: 'tiled-bath-shelf',
    name: 'Tiled bath shelf',
    category: 'Bath and spa',
    blurb: 'White tile and eucalyptus for soaps, jars and candles.'
  },
  {
    id: 'wooden-bath-tray',
    name: 'Wooden bath tray',
    category: 'Bath and spa',
    blurb: 'A teak tray for bath salts, candles and small gifts.'
  },
  {
    id: 'stone-sink',
    name: 'Stone sink',
    category: 'Bath and spa',
    blurb: 'A pale stone basin for soap, lotion and spa gifts.'
  },
  {
    id: 'spa-towel-bench',
    name: 'Spa towel bench',
    category: 'Bath and spa',
    blurb: 'Stacked towels for self-care, candles and textiles.'
  },
  {
    id: 'garden-table',
    name: 'Garden table',
    category: 'Outdoor spaces',
    blurb: 'Dappled garden light for plants, outdoor candles and tableware.'
  },
  {
    id: 'stone-patio',
    name: 'Stone patio',
    category: 'Outdoor spaces',
    blurb: 'Warm stone and potted plants for outdoor living products.'
  },
  {
    id: 'picnic-blanket',
    name: 'Picnic blanket',
    category: 'Outdoor spaces',
    blurb: 'A checked blanket for baskets, food and summer gifts.'
  },
  {
    id: 'greenhouse-shelf',
    name: 'Greenhouse shelf',
    category: 'Outdoor spaces',
    blurb: 'Terracotta and filtered light for garden and plant products.'
  },
  {
    id: 'sunlit-balcony',
    name: 'Sunlit balcony',
    category: 'Outdoor spaces',
    blurb: 'A morning balcony for drinkware, plants and small homeware.'
  },
  {
    id: 'gift-wrapping-table',
    name: 'Gift wrapping table',
    category: 'Seasonal sets',
    blurb: 'Kraft paper, ribbon and an open box for packaging and gifts.'
  },
  {
    id: 'festive-mantel',
    name: 'Festive mantel',
    category: 'Seasonal sets',
    blurb: 'Evergreen and warm lights for winter gifts and candles.'
  },
  {
    id: 'autumn-table',
    name: 'Autumn table',
    category: 'Seasonal sets',
    blurb: 'Dried leaves and amber glass for autumn collections.'
  },
  {
    id: 'spring-table',
    name: 'Spring table',
    category: 'Seasonal sets',
    blurb: 'Fresh flowers and pale linen for spring products.'
  },
  {
    id: 'neutral-holiday-table',
    name: 'Neutral holiday table',
    category: 'Seasonal sets',
    blurb: 'Neutral wrap, twine and blank tags for holiday packaging.'
  }
]

export function isBundledScenePreset(id: string): boolean {
  return BUNDLED_SCENE_PRESETS.some((scene) => scene.id === id)
}

export function bundledScenePresetById(id: string): BundledScenePreset | undefined {
  return BUNDLED_SCENE_PRESETS.find((scene) => scene.id === id)
}

export function bundledSceneCard(scene: BundledScenePreset): ScenePreset {
  return {
    id: scene.id,
    name: scene.name,
    category: scene.category,
    blurb: scene.blurb,
    source: 'bundled',
    imageUrl: bundledUrl(`scenes/${scene.id}.webp`),
    thumbUrl: bundledUrl(`scenes/${scene.id}-thumb.webp`),
    width: BUNDLED_SCENE_SIZE,
    height: BUNDLED_SCENE_SIZE,
    createdAt: 0
  }
}

export function bundledSceneCards(): ScenePreset[] {
  return BUNDLED_SCENE_PRESETS.map(bundledSceneCard)
}
