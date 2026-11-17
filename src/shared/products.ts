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
 * Clean, unbranded product photos included with Moss as starting points: 100
 * products across 19 categories. The matching generation prompts live in
 * scripts/lab/product-pack.mjs; keep ids, names and categories in sync with it
 * (the unit test checks that). The images are
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
    id: 'perfume-bottle',
    name: 'Perfume bottle',
    category: 'Skincare and beauty',
    blurb: 'A blank faceted glass perfume bottle with a gold cap.'
  },
  {
    id: 'lip-balm-tube',
    name: 'Lip balm tube',
    category: 'Skincare and beauty',
    blurb: 'A plain white lip balm tube with no label.'
  },
  {
    id: 'body-butter-jar',
    name: 'Body butter jar',
    category: 'Skincare and beauty',
    blurb: 'A plain white cosmetic jar with a black lid.'
  },
  {
    id: 'hand-cream-tube',
    name: 'Hand cream tube',
    category: 'Skincare and beauty',
    blurb: 'A blank cream hand cream tube with a white cap.'
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
    id: 'pillar-candle',
    name: 'Pillar candle',
    category: 'Candles and home fragrance',
    blurb: 'A plain ivory pillar candle with an unlit wick.'
  },
  {
    id: 'votive-candle',
    name: 'Votive candle',
    category: 'Candles and home fragrance',
    blurb: 'A clear glass votive candle with cream wax.'
  },
  {
    id: 'wax-melt-bar',
    name: 'Wax melt bar',
    category: 'Candles and home fragrance',
    blurb: 'A blank wax melt snap bar in a clear clamshell.'
  },
  {
    id: 'reed-diffuser',
    name: 'Reed diffuser',
    category: 'Candles and home fragrance',
    blurb: 'A clear reed diffuser with natural rattan reeds.'
  },
  {
    id: 'room-spray',
    name: 'Room spray',
    category: 'Candles and home fragrance',
    blurb: 'A blank amber room spray bottle with a black atomiser.'
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
    id: 'ceramic-bowl',
    name: 'Stoneware bowl',
    category: 'Ceramics and pottery',
    blurb: 'A speckled stoneware bowl with a simple shape.'
  },
  {
    id: 'ceramic-plate',
    name: 'Ceramic plate',
    category: 'Ceramics and pottery',
    blurb: 'A plain cream ceramic plate with a smooth rim.'
  },
  {
    id: 'ceramic-pitcher',
    name: 'Stoneware pitcher',
    category: 'Ceramics and pottery',
    blurb: 'A speckled stoneware pitcher with a simple handle.'
  },
  {
    id: 'trinket-dish',
    name: 'Trinket dish',
    category: 'Ceramics and pottery',
    blurb: 'A small speckled ceramic dish with a shallow rim.'
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
    id: 'honey-jar',
    name: 'Honey jar',
    category: 'Food and drink',
    blurb: 'A clear honey jar with a cork stopper and blank label.'
  },
  {
    id: 'tea-tin',
    name: 'Tea tin',
    category: 'Food and drink',
    blurb: 'A matte cream tea tin with a plain lid.'
  },
  {
    id: 'olive-oil-bottle',
    name: 'Olive oil bottle',
    category: 'Food and drink',
    blurb: 'A dark green olive oil bottle with a blank label.'
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
    id: 'leather-wallet',
    name: 'Leather wallet',
    category: 'Bags and leather',
    blurb: 'A tan leather bifold wallet with no logo.'
  },
  {
    id: 'leather-card-holder',
    name: 'Leather card holder',
    category: 'Bags and leather',
    blurb: 'A black leather card holder with no embossing.'
  },
  {
    id: 'leather-backpack',
    name: 'Leather backpack',
    category: 'Bags and leather',
    blurb: 'A plain brown leather backpack with no logo.'
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
    id: 'pullover-hoodie',
    name: 'Pullover hoodie',
    category: 'Clothing and accessories',
    blurb: 'A plain cream pullover hoodie with no print.'
  },
  {
    id: 'crewneck-sweatshirt',
    name: 'Crewneck sweatshirt',
    category: 'Clothing and accessories',
    blurb: 'A plain sage green crewneck sweatshirt.'
  },
  {
    id: 'baseball-cap',
    name: 'Baseball cap',
    category: 'Clothing and accessories',
    blurb: 'A plain canvas baseball cap with no logo.'
  },
  {
    id: 'knit-beanie',
    name: 'Knit beanie',
    category: 'Clothing and accessories',
    blurb: 'A plain cream ribbed knit beanie.'
  },
  {
    id: 'wool-scarf',
    name: 'Wool scarf',
    category: 'Clothing and accessories',
    blurb: 'A soft grey wool scarf with a plain weave.'
  },
  {
    id: 'gold-necklace',
    name: 'Gold necklace',
    category: 'Jewelry',
    blurb: 'A fine gold chain necklace with a plain pendant.'
  },
  {
    id: 'gold-hoops',
    name: 'Gold hoop earrings',
    category: 'Jewelry',
    blurb: 'A pair of plain gold hoop earrings.'
  },
  {
    id: 'stud-earrings',
    name: 'Stud earrings',
    category: 'Jewelry',
    blurb: 'A pair of small plain gold stud earrings.'
  },
  {
    id: 'silver-ring',
    name: 'Silver ring',
    category: 'Jewelry',
    blurb: 'A plain polished silver band ring.'
  },
  {
    id: 'bead-bracelet',
    name: 'Bead bracelet',
    category: 'Jewelry',
    blurb: 'A simple bracelet of natural wooden beads.'
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
    id: 'woven-basket',
    name: 'Woven basket',
    category: 'Homeware and furniture',
    blurb: 'A natural woven seagrass basket with two handles.'
  },
  {
    id: 'oak-stool',
    name: 'Oak stool',
    category: 'Homeware and furniture',
    blurb: 'A plain solid oak stool with a rounded seat.'
  },
  {
    id: 'wall-clock',
    name: 'Wall clock',
    category: 'Homeware and furniture',
    blurb: 'A plain round wall clock with an oak rim.'
  },
  {
    id: 'oak-tray',
    name: 'Oak tray',
    category: 'Homeware and furniture',
    blurb: 'A plain rectangular oak tray with cut-out handles.'
  },
  {
    id: 'framed-print',
    name: 'Framed print',
    category: 'Prints and art',
    blurb: 'An oak-framed art print with a wide white mount.'
  },
  {
    id: 'art-poster',
    name: 'Abstract art print',
    category: 'Prints and art',
    blurb: 'An unframed abstract art print with soft neutral shapes.'
  },
  {
    id: 'canvas-print',
    name: 'Canvas print',
    category: 'Prints and art',
    blurb: 'A stretched canvas print with neutral abstract shapes.'
  },
  {
    id: 'line-art-print',
    name: 'Line art print',
    category: 'Prints and art',
    blurb: 'An unframed print with a minimal neutral line drawing.'
  },
  {
    id: 'botanical-print',
    name: 'Botanical print',
    category: 'Prints and art',
    blurb: 'An unframed print with a soft neutral botanical illustration.'
  },
  {
    id: 'brass-lamp',
    name: 'Brass table lamp',
    category: 'Vintage',
    blurb: 'A vintage brass table lamp with a cream shade.'
  },
  {
    id: 'vintage-teacup',
    name: 'Vintage teacup',
    category: 'Vintage',
    blurb: 'A vintage floral porcelain teacup and saucer.'
  },
  {
    id: 'vintage-camera',
    name: 'Vintage camera',
    category: 'Vintage',
    blurb: 'An unbranded vintage film camera with a silver lens ring.'
  },
  {
    id: 'brass-candlestick',
    name: 'Brass candlestick',
    category: 'Vintage',
    blurb: 'A vintage brass candlestick with a turned stem.'
  },
  {
    id: 'blank-notebook',
    name: 'Blank notebook',
    category: 'Stationery and paper',
    blurb: 'A plain sage green fabric-bound notebook.'
  },
  {
    id: 'hardcover-journal',
    name: 'Hardcover journal',
    category: 'Stationery and paper',
    blurb: 'A plain charcoal linen hardcover journal.'
  },
  {
    id: 'greeting-card',
    name: 'Greeting card',
    category: 'Stationery and paper',
    blurb: 'A plain folded cream greeting card with no writing.'
  },
  {
    id: 'sticker-sheet',
    name: 'Sticker sheet',
    category: 'Stationery and paper',
    blurb: 'A sheet of blank white die-cut stickers.'
  },
  {
    id: 'spiral-planner',
    name: 'Spiral planner',
    category: 'Stationery and paper',
    blurb: 'A plain undated spiral-bound planner with a cream cover.'
  },
  {
    id: 'kraft-bookmark',
    name: 'Kraft bookmark',
    category: 'Stationery and paper',
    blurb: 'A blank kraft bookmark with a cotton tassel.'
  },
  {
    id: 'linen-cushion',
    name: 'Linen cushion',
    category: 'Textiles and soft furnishings',
    blurb: 'A natural linen cushion with no print.'
  },
  {
    id: 'knit-throw',
    name: 'Knit throw',
    category: 'Textiles and soft furnishings',
    blurb: 'A folded cream chunky knit throw.'
  },
  {
    id: 'tea-towel',
    name: 'Tea towel',
    category: 'Textiles and soft furnishings',
    blurb: 'A folded cotton tea towel with a neutral stripe.'
  },
  {
    id: 'table-runner',
    name: 'Table runner',
    category: 'Textiles and soft furnishings',
    blurb: 'A folded natural linen table runner.'
  },
  {
    id: 'bath-towel',
    name: 'Bath towel',
    category: 'Textiles and soft furnishings',
    blurb: 'A folded white cotton bath towel.'
  },
  {
    id: 'packaged-sheet-set',
    name: 'Packaged sheet set',
    category: 'Textiles and soft furnishings',
    blurb: 'A folded sheet set in a clear case with a blank label.'
  },
  {
    id: 'ribbed-tumbler',
    name: 'Ribbed tumbler',
    category: 'Drinkware',
    blurb: 'A clear glass tumbler with a ribbed texture.'
  },
  {
    id: 'insulated-tumbler',
    name: 'Insulated tumbler',
    category: 'Drinkware',
    blurb: 'A matte cream insulated travel tumbler.'
  },
  {
    id: 'wine-glass',
    name: 'Wine glass',
    category: 'Drinkware',
    blurb: 'A clear glass wine glass with a simple stem.'
  },
  {
    id: 'enamel-mug',
    name: 'Enamel mug',
    category: 'Drinkware',
    blurb: 'A white enamel camping mug with a dark rim.'
  },
  {
    id: 'glass-carafe',
    name: 'Glass carafe',
    category: 'Drinkware',
    blurb: 'A clear glass water carafe with a narrow neck.'
  },
  {
    id: 'phone-case',
    name: 'Phone case',
    category: 'Tech accessories',
    blurb: 'A plain matte black phone case with no logo.'
  },
  {
    id: 'laptop-sleeve',
    name: 'Laptop sleeve',
    category: 'Tech accessories',
    blurb: 'A plain grey felt laptop sleeve with a zipper.'
  },
  {
    id: 'desk-mat',
    name: 'Desk mat',
    category: 'Tech accessories',
    blurb: 'A plain rectangular grey felt desk mat.'
  },
  {
    id: 'earbud-case',
    name: 'Earbud case',
    category: 'Tech accessories',
    blurb: 'A small plain cream silicone earbud case.'
  },
  {
    id: 'baby-onesie',
    name: 'Baby onesie',
    category: 'Kids and toys',
    blurb: 'A plain white cotton baby onesie.'
  },
  {
    id: 'baby-bib',
    name: 'Baby bib',
    category: 'Kids and toys',
    blurb: 'A plain cream muslin baby bib.'
  },
  {
    id: 'plush-bunny',
    name: 'Plush bunny',
    category: 'Kids and toys',
    blurb: 'A soft cream plush bunny with long ears.'
  },
  {
    id: 'wooden-stacking-toy',
    name: 'Wooden stacking toy',
    category: 'Kids and toys',
    blurb: 'A plain wooden stacking ring toy.'
  },
  {
    id: 'dog-collar',
    name: 'Dog collar',
    category: 'Pets',
    blurb: 'A plain tan leather dog collar with a metal buckle.'
  },
  {
    id: 'pet-bandana',
    name: 'Pet bandana',
    category: 'Pets',
    blurb: 'A plain neutral cotton pet bandana.'
  },
  {
    id: 'pet-bowl',
    name: 'Pet bowl',
    category: 'Pets',
    blurb: 'A plain cream ceramic pet bowl.'
  },
  {
    id: 'woven-pet-bed',
    name: 'Woven pet bed',
    category: 'Pets',
    blurb: 'A round woven seagrass pet bed.'
  },
  {
    id: 'kraft-gift-box',
    name: 'Kraft gift box',
    category: 'Packaging and gift',
    blurb: 'A blank kraft paper gift box with a lid.'
  },
  {
    id: 'mailer-box',
    name: 'Mailer box',
    category: 'Packaging and gift',
    blurb: 'A blank white corrugated mailer box.'
  },
  {
    id: 'kraft-gift-bag',
    name: 'Kraft gift bag',
    category: 'Packaging and gift',
    blurb: 'A blank kraft paper gift bag with handles.'
  },
  {
    id: 'twine-spool',
    name: 'Twine spool',
    category: 'Packaging and gift',
    blurb: 'A spool of natural cotton twine.'
  },
  {
    id: 'seed-packet',
    name: 'Seed packet',
    category: 'Garden and outdoor',
    blurb: 'A blank kraft paper seed packet.'
  },
  {
    id: 'garden-marker',
    name: 'Garden marker',
    category: 'Garden and outdoor',
    blurb: 'A plain wooden garden marker stake.'
  },
  {
    id: 'watering-can',
    name: 'Watering can',
    category: 'Garden and outdoor',
    blurb: 'A plain galvanised metal watering can.'
  },
  {
    id: 'plant-mister',
    name: 'Plant mister',
    category: 'Garden and outdoor',
    blurb: 'A blank amber glass plant mister.'
  },
  {
    id: 'yarn-skein',
    name: 'Yarn skein',
    category: 'Craft supplies',
    blurb: 'A single skein of cream cotton yarn.'
  },
  {
    id: 'embroidery-hoop',
    name: 'Embroidery hoop',
    category: 'Craft supplies',
    blurb: 'A wooden embroidery hoop with blank fabric.'
  },
  {
    id: 'ribbon-spool',
    name: 'Ribbon spool',
    category: 'Craft supplies',
    blurb: 'A spool of sage green satin ribbon.'
  },
  {
    id: 'bead-strand',
    name: 'Bead strand',
    category: 'Craft supplies',
    blurb: 'A strand of natural wooden beads.'
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
    notes: null,
    category: product.category,
    setId: null,
    setName: null
  }
}

export function bundledProductCards(): Product[] {
  return BUNDLED_PRODUCTS.map(bundledProductCard)
}
