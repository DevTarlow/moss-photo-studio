import { describe, expect, it } from 'vitest'
import { MARKETPLACES, isMarketplaceId, marketplaceById } from '@shared/marketplaces'

describe('marketplace delivery presets', () => {
  it('covers the selected shops with the expected formats and sizes', () => {
    expect(MARKETPLACES.map((marketplace) => marketplace.id)).toEqual([
      'etsy', 'shopify', 'instagram', 'tiktok', 'ebay', 'own'
    ])
    const etsy = marketplaceById('etsy')
    expect(etsy).toMatchObject({ width: 2000, height: 2000, format: 'jpeg', maxBytes: 1_000_000, includeOriginal: true })
    expect(marketplaceById('instagram')).toMatchObject({ width: 1080, height: 1350, fit: 'cover' })
    expect(isMarketplaceId('etsy')).toBe(true)
    expect(isMarketplaceId('amazon')).toBe(false)
    expect(marketplaceById('missing')).toBe(MARKETPLACES[0])
  })
})
