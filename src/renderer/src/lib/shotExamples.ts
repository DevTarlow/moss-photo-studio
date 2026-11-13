import type { ShotType } from '@shared/types'
import { bundledUrl } from './assets'

/** One representative image per shot, shared by onboarding and the Set plan. */
export const SHOT_EXAMPLES: Record<ShotType, { src: string; sample?: string }> = {
  hero: { src: bundledUrl('tiles/examples/main.webp') },
  lifestyle: { src: bundledUrl('tiles/examples/lifestyle.webp') },
  detail: { src: bundledUrl('tiles/examples/jewelry.webp') },
  scale: { src: bundledUrl('tiles/examples/size-reference.webp') },
  flatlay: { src: bundledUrl('tiles/examples/flatlay.webp') },
  gift: { src: bundledUrl('tiles/examples/gift.webp') },
  feature: { src: bundledUrl('tiles/room-for-text.webp'), sample: 'Hand-glazed stoneware' },
  onmodel: { src: bundledUrl('tiles/examples/on-a-person.webp') }
}
