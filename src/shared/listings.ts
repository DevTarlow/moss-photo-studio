export type ListingPlatform = 'etsy' | 'shopify' | 'own'

export interface ListingLimits {
  label: string
  platform: ListingPlatform
  titleMax: number
  titleOptions: number
  descriptionMax: number
  featureCount: number
  featureMax: number
  tagCount: number
  tagMax: number
  asOf: string
}

export interface ListingCopy {
  platform: ListingPlatform
  titles: string[]
  description: string
  features: string[]
  tags: string[]
  altTexts: string[]
  createdAt: number
  costMicros: number
}

export const LISTING_LIMITS_AS_OF = '2026-11-12'

export const LISTING_PLATFORMS: readonly ListingLimits[] = [
  {
    label: 'Etsy',
    platform: 'etsy',
    titleMax: 140,
    titleOptions: 3,
    descriptionMax: 1200,
    featureCount: 5,
    featureMax: 120,
    tagCount: 13,
    tagMax: 20,
    asOf: LISTING_LIMITS_AS_OF
  },
  {
    label: 'Shopify',
    platform: 'shopify',
    titleMax: 70,
    titleOptions: 3,
    descriptionMax: 1600,
    featureCount: 5,
    featureMax: 120,
    tagCount: 10,
    tagMax: 40,
    asOf: LISTING_LIMITS_AS_OF
  },
  {
    label: 'My own site',
    platform: 'own',
    titleMax: 90,
    titleOptions: 3,
    descriptionMax: 1200,
    featureCount: 5,
    featureMax: 120,
    tagCount: 0,
    tagMax: 0,
    asOf: LISTING_LIMITS_AS_OF
  }
] as const

export function limitsFor(platform: string): ListingLimits {
  return LISTING_PLATFORMS.find((entry) => entry.platform === platform) ?? LISTING_PLATFORMS[0]!
}

export function isListingPlatform(value: string): value is ListingPlatform {
  return LISTING_PLATFORMS.some((entry) => entry.platform === value)
}

function clampText(value: unknown, max: number): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

/** Clamp a model or edited answer to the platform's real field limits. */
export function clampListingCopy(input: {
  titles?: unknown
  description?: unknown
  features?: unknown
  tags?: unknown
  altTexts?: unknown
}, platform: string): Omit<ListingCopy, 'createdAt' | 'costMicros'> {
  const limits = limitsFor(platform)
  const titles = (Array.isArray(input.titles) ? input.titles : [])
    .map((value) => clampText(value, limits.titleMax))
    .filter(Boolean)
    .slice(0, limits.titleOptions)
  const description = String(input.description ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
    .slice(0, limits.descriptionMax)
  const features = (Array.isArray(input.features) ? input.features : [])
    .map((value) => clampText(value, limits.featureMax))
    .filter(Boolean)
    .slice(0, limits.featureCount)
  const tags = limits.tagCount
    ? [...new Set(
        (Array.isArray(input.tags) ? input.tags : [])
          .map((value) => clampText(value, limits.tagMax).replace(/^#/, '').trim())
          .filter(Boolean)
      )].slice(0, limits.tagCount)
    : []
  const altTexts = (Array.isArray(input.altTexts) ? input.altTexts : [])
    .map((value) => String(value ?? '').trim().slice(0, 250))
    .filter(Boolean)
  return {
    platform: limits.platform,
    titles,
    description,
    features,
    tags,
    altTexts
  }
}
