import type { Product } from './types'
import { bundledUrl } from './files'

export interface BundledProduct {
  id: string
  name: string
  category: string
  blurb: string
}

/** The square size every included product photo is bundled at. */
export const BUNDLED_PRODUCT_SIZE = 1024

/**
 * Clean, unbranded product photos included with Moss as starting points. The
 * matching generation prompts live in scripts/lab/product-pack.mjs; keep ids,
 * names and categories in sync with it. The images are
 * resources/products/<id>.webp with a 480x480 <id>-thumb.webp.
 */
export const BUNDLED_PRODUCTS: readonly BundledProduct[] = [
  {
    id: 'dropper-bottle',
    name: 'Amber dropper bottle',
    category: 'Skincare and beauty',
    blurb: 'A blank amber glass dropper bottle with a black cap.'
  },
  {
    id: 'pump-bottle',
    name: 'Pump bottle',
    category: 'Skincare and beauty',
    blurb: 'A matte white pump bottle with no label.'
  },
  {
    id: 'frosted-jar',
    name: 'Frosted cosmetic jar',
    category: 'Skincare and beauty',
    blurb: 'A frosted glass jar with a bamboo lid.'
  },
  {
    id: 'soap-bar',
    name: 'Soap bar',
    category: 'Skincare and beauty',
    blurb: 'A natural soap bar with a plain kraft band.'
  },
  {
    id: 'candle-jar',
    name: 'Amber candle jar',
    category: 'Candles and home fragrance',
    blurb: 'An amber glass candle jar with cream soy wax.'
  },
  {
    id: 'candle-tin',
    name: 'Candle tin',
    category: 'Candles and home fragrance',
    blurb: 'A matte cream candle tin with no label.'
  },
  {
    id: 'speckled-mug',
    name: 'Speckled mug',
    category: 'Ceramics and pottery',
    blurb: 'A speckled off-white stoneware mug.'
  },
  {
    id: 'stoneware-vase',
    name: 'Stoneware vase',
    category: 'Ceramics and pottery',
    blurb: 'A speckled stoneware vase with a simple shape.'
  },
  {
    id: 'swing-bottle',
    name: 'Swing-top bottle',
    category: 'Food and drink',
    blurb: 'A clear glass bottle with a swing-top lid.'
  },
  {
    id: 'coffee-bag',
    name: 'Kraft coffee bag',
    category: 'Food and drink',
    blurb: 'A kraft coffee pouch with a blank label.'
  },
  {
    id: 'spice-jar',
    name: 'Spice jar',
    category: 'Food and drink',
    blurb: 'A clear spice jar with a blank kraft label.'
  },
  {
    id: 'canvas-tote',
    name: 'Canvas tote',
    category: 'Bags and leather',
    blurb: 'A natural canvas tote with no print.'
  },
  {
    id: 'leather-crossbody',
    name: 'Leather crossbody',
    category: 'Bags and leather',
    blurb: 'A tan leather crossbody bag with a plain strap.'
  },
  {
    id: 'white-tee',
    name: 'White t-shirt',
    category: 'Clothing and accessories',
    blurb: 'A plain white cotton t-shirt on a hanger.'
  },
  {
    id: 'knit-sweater',
    name: 'Knit sweater',
    category: 'Clothing and accessories',
    blurb: 'A folded cream cable-knit sweater.'
  },
  {
    id: 'gold-necklace',
    name: 'Gold necklace',
    category: 'Jewelry',
    blurb: 'A fine gold chain necklace with a plain pendant.'
  },
  {
    id: 'oak-board',
    name: 'Oak serving board',
    category: 'Homeware and furniture',
    blurb: 'A plain oak serving board with a handle.'
  },
  {
    id: 'ceramic-planter',
    name: 'Ceramic planter',
    category: 'Homeware and furniture',
    blurb: 'A plain terracotta planter with a simple rim.'
  },
  {
    id: 'framed-print',
    name: 'Framed print',
    category: 'Prints and art',
    blurb: 'An oak-framed art print with a wide white mount.'
  },
  {
    id: 'brass-lamp',
    name: 'Brass table lamp',
    category: 'Vintage',
    blurb: 'A vintage brass table lamp with a cream shade.'
  }
]

export function isBundledProduct(id: string): boolean {
  return BUNDLED_PRODUCTS.some((product) => product.id === id)
}

export function bundledProductById(id: string): BundledProduct | undefined {
  return BUNDLED_PRODUCTS.find((product) => product.id === id)
}

export function bundledProductCard(product: BundledProduct): Product {
  return {
    id: product.id,
    name: product.name,
    imageUrl: bundledUrl(`products/${product.id}.webp`),
    thumbUrl: bundledUrl(`products/${product.id}-thumb.webp`),
    width: BUNDLED_PRODUCT_SIZE,
    height: BUNDLED_PRODUCT_SIZE,
    createdAt: 0,
    updatedAt: 0,
    source: 'bundled',
    blurb: product.blurb,
    category: product.category
  }
}

export function bundledProductCards(): Product[] {
  return BUNDLED_PRODUCTS.map(bundledProductCard)
}
