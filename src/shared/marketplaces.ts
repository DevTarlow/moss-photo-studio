export type MarketplaceId = 'etsy' | 'shopify' | 'instagram' | 'tiktok' | 'ebay' | 'own'

export interface MarketplacePreset {
  id: MarketplaceId
  label: string
  note: string
  width: number
  height: number
  fit: 'contain' | 'cover'
  format: 'jpeg' | 'png' | 'webp'
  quality: number
  maxBytes: number | null
  includeOriginal: boolean
  altTextMax: number
}

/**
 * The delivery presets the kit writes. They are deliberately separate from the
 * model request format: the image request keeps its own stored format, while
 * the kit is encoded for the shop that will receive it.
 *
 * Etsy's current guidance: JPG/GIF/PNG/SVG/HEIC, no transparent PNG, 2000px
 * recommended, and files over about 1 MB may fail. Checked 2026-11-12.
 */
export const MARKETPLACES: readonly MarketplacePreset[] = [
  {
    id: 'etsy',
    label: 'Etsy',
    note: '2000 px JPEG, no transparency, under about 1 MB, with the untouched original photo.',
    width: 2000,
    height: 2000,
    fit: 'contain',
    format: 'jpeg',
    quality: 92,
    maxBytes: 1_000_000,
    includeOriginal: true,
    altTextMax: 250
  },
  {
    id: 'shopify',
    label: 'Shopify',
    note: '2048 px square JPEG for the product gallery.',
    width: 2048,
    height: 2048,
    fit: 'contain',
    format: 'jpeg',
    quality: 92,
    maxBytes: 20 * 1024 * 1024,
    includeOriginal: false,
    altTextMax: 125
  },
  {
    id: 'instagram',
    label: 'Instagram feed',
    note: '1080 x 1350 portrait JPEG, cropped to fill the post.',
    width: 1080,
    height: 1350,
    fit: 'cover',
    format: 'jpeg',
    quality: 92,
    maxBytes: null,
    includeOriginal: false,
    altTextMax: 125
  },
  {
    id: 'tiktok',
    label: 'TikTok Shop',
    note: '1080 px square JPEG for the product card.',
    width: 1080,
    height: 1080,
    fit: 'contain',
    format: 'jpeg',
    quality: 92,
    maxBytes: null,
    includeOriginal: false,
    altTextMax: 125
  },
  {
    id: 'ebay',
    label: 'eBay',
    note: '1600 px square JPEG, the long-standing listing size.',
    width: 1600,
    height: 1600,
    fit: 'contain',
    format: 'jpeg',
    quality: 92,
    maxBytes: 12 * 1024 * 1024,
    includeOriginal: false,
    altTextMax: 125
  },
  {
    id: 'own',
    label: 'My own site',
    note: '2048 px square JPEG, easy to resize for a theme.',
    width: 2048,
    height: 2048,
    fit: 'contain',
    format: 'jpeg',
    quality: 92,
    maxBytes: null,
    includeOriginal: false,
    altTextMax: 125
  }
] as const

export const MARKETPLACES_AS_OF = '2026-11-12'

export function marketplaceById(id: string): MarketplacePreset {
  return MARKETPLACES.find((marketplace) => marketplace.id === id) ?? MARKETPLACES[0]!
}

export function isMarketplaceId(value: string): value is MarketplaceId {
  return MARKETPLACES.some((marketplace) => marketplace.id === value)
}
