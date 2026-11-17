/**
 * The 33 unbranded preset scenes included with Moss. Each entry generates one
 * square scene photo on an empty surface; the lab writes a 1024x1024 image and
 * a 480x480 thumb.
 *
 * Most scenes are setting, light and props only. Keep them free of a hero
 * product, people, readable text and logos so the subject is never copied into
 * a generated image. The packaged sheet set is the one deliberate product-style
 * mock-up, with a blank label area for a seller logo.
 *
 * Ids, names and categories must stay in sync with src/shared/scene-presets.ts.
 */
const SCENE_RULES =
  'with an empty surface in the centre where a product would sit, no product in the frame, no people, no text, no logos, realistic interior photograph, square.'

export const SCENE_PACK = [
  {
    id: 'white-seamless',
    name: 'White seamless studio',
    category: 'Studio backdrops',
    prompt: `A straight-on front view of a seamless bright white studio backdrop, a flat even white surface filling the frame with no visible backdrop edge, roll, curve, seam or shadow, soft even studio lighting, no product in the frame, no people, no text, no logos, realistic studio photograph, square.`
  },
  {
    id: 'warm-grey-sweep',
    name: 'Warm grey studio',
    category: 'Studio backdrops',
    prompt: `A perfectly flat, evenly lit warm grey studio backdrop filling the entire frame, a uniform matte warm grey seamless paper surface with no floor line, no horizon, no backdrop edge, no roll, no curve, no gradient, no vignette, no shadow, no product in the frame, no people, no text, no logos, realistic studio photograph, square.`
  },
  {
    id: 'blush-paper',
    name: 'Blush paper backdrop',
    category: 'Studio backdrops',
    prompt: `A straight-on front view of a pale blush pink seamless paper backdrop, a flat even blush surface filling the frame with no visible backdrop edge, roll, curve, seam or shadow, soft even studio lighting, no product in the frame, no people, no text, no logos, realistic studio photograph, square.`
  },
  {
    id: 'charcoal-sweep',
    name: 'Charcoal studio',
    category: 'Studio backdrops',
    prompt: `A straight-on front view of a deep charcoal seamless studio backdrop, a flat even charcoal surface filling the frame with no visible backdrop edge, roll, curve, seam or shadow, soft even studio lighting, no product in the frame, no people, no text, no logos, realistic studio photograph, square.`
  },
  {
    id: 'stone-plinth',
    name: 'Stone plinth',
    category: 'Studio backdrops',
    prompt: `A smooth grey concrete plinth in a minimal studio with a pale gradient backdrop and directional side light, an empty top surface, ${SCENE_RULES}`
  },
  {
    id: 'oak-side-table',
    name: 'Oak side table',
    category: 'Lifestyle rooms',
    prompt: `A warm oak side table beside a linen armchair in a bright living room, with a small lamp, a book and a plant just out of focus behind, soft window light, ${SCENE_RULES}`
  },
  {
    id: 'packaged-sheet-set',
    name: 'Packaged sheet set',
    category: 'Lifestyle rooms',
    prompt: `A neatly folded cream sheet set inside a clear plastic zip case, with a large blank white label area on the front for a logo and no writing, resting on a pale wooden table in a bright simple bedroom, soft even daylight, no people, no text, no logos, realistic product photograph, square.`
  },
  {
    id: 'living-room-console',
    name: 'Living room console',
    category: 'Lifestyle rooms',
    prompt: `An oak console table against a warm plaster wall in a living room, with a ceramic vase of dried stems and a stack of books out of focus, soft afternoon light, ${SCENE_RULES}`
  },
  {
    id: 'cosy-shelf',
    name: 'Cosy shelf',
    category: 'Lifestyle rooms',
    prompt: `A wooden shelf in a cosy room with books, a small plant and a ceramic candle holder out of focus at the edges, warm lamplight, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'reading-corner',
    name: 'Reading corner',
    category: 'Lifestyle rooms',
    prompt: `A quiet reading corner with a linen armchair, a side table and a soft throw, warm window light, an empty side table surface, ${SCENE_RULES}`
  },
  {
    id: 'marble-counter',
    name: 'Marble counter',
    category: 'Kitchen and table',
    prompt: `A pale marble kitchen counter with a softly blurred kitchen behind, a folded linen towel and a small plant out of focus, soft daylight from a window, ${SCENE_RULES}`
  },
  {
    id: 'warm-kitchen-table',
    name: 'Warm kitchen table',
    category: 'Kitchen and table',
    prompt: `A warm oak kitchen table in soft morning light, with a linen napkin and a plain ceramic cup out of focus behind, an empty area in the centre, ${SCENE_RULES}`
  },
  {
    id: 'breakfast-bar',
    name: 'Breakfast bar',
    category: 'Kitchen and table',
    prompt: `A pale stone breakfast bar with two wooden stools behind and a bright window, an empty counter surface, ${SCENE_RULES}`
  },
  {
    id: 'pantry-shelf',
    name: 'Pantry shelf',
    category: 'Kitchen and table',
    prompt: `A wooden pantry shelf with plain unlabelled glass jars, woven baskets and a linen cloth, warm soft light, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'dining-table-runner',
    name: 'Dining table runner',
    category: 'Kitchen and table',
    prompt: `A dining table with a natural linen runner, pale ceramic plates out of focus at the edges and soft daylight, an empty centre on the runner, ${SCENE_RULES}`
  },
  {
    id: 'marble-vanity',
    name: 'Marble vanity',
    category: 'Bath and spa',
    prompt: `A pale marble bathroom vanity with folded white towels, a small green plant and a soft-focus mirror, bright daylight, an empty counter surface, ${SCENE_RULES}`
  },
  {
    id: 'tiled-bath-shelf',
    name: 'Tiled bath shelf',
    category: 'Bath and spa',
    prompt: `A white tiled bathroom shelf with a sprig of eucalyptus, a rolled towel and a small stone dish, soft daylight, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'wooden-bath-tray',
    name: 'Wooden bath tray',
    category: 'Bath and spa',
    prompt: `A teak bath tray across a white bathtub, with a lit candle and a folded towel out of focus, warm spa light, an empty space on the tray, ${SCENE_RULES}`
  },
  {
    id: 'stone-sink',
    name: 'Stone sink',
    category: 'Bath and spa',
    prompt: `A pale stone bathroom sink with a folded linen towel and a small plant, soft daylight, an empty rim, ${SCENE_RULES}`
  },
  {
    id: 'spa-towel-bench',
    name: 'Spa towel bench',
    category: 'Bath and spa',
    prompt: `A wooden bench in a spa-like bathroom with stacked white towels and eucalyptus, soft diffused light, an empty space on the bench, ${SCENE_RULES}`
  },
  {
    id: 'garden-table',
    name: 'Garden table',
    category: 'Outdoor spaces',
    prompt: `A weathered wooden garden table under trees with dappled sunlight, a small potted plant and a linen cloth out of focus, an empty tabletop, ${SCENE_RULES}`
  },
  {
    id: 'stone-patio',
    name: 'Stone patio',
    category: 'Outdoor spaces',
    prompt: `A pale stone patio with potted plants and a low table, warm late afternoon light, an empty tabletop, ${SCENE_RULES}`
  },
  {
    id: 'picnic-blanket',
    name: 'Picnic blanket',
    category: 'Outdoor spaces',
    prompt: `A checked linen picnic blanket on green grass with a woven basket out of focus at the edge, soft daylight, an empty centre on the blanket, ${SCENE_RULES}`
  },
  {
    id: 'greenhouse-shelf',
    name: 'Greenhouse shelf',
    category: 'Outdoor spaces',
    prompt: `A wooden shelf in a greenhouse with terracotta pots, small plants and soft glass-filtered light, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'sunlit-balcony',
    name: 'Sunlit balcony',
    category: 'Outdoor spaces',
    prompt: `A small city balcony with a bistro table, potted plants and morning sunlight, an empty tabletop, ${SCENE_RULES}`
  },
  {
    id: 'backyard-wall',
    name: 'Backyard wall',
    category: 'Outdoor spaces',
    prompt: `A side view of a pale rendered backyard wall with a clear empty area in the centre where a wall lamp would hang, no lamp and no product in the frame, climbing plants at the edges, warm afternoon sunlight, no people, no text, no logos, realistic exterior photograph, square.`
  },
  {
    id: 'garden-wall',
    name: 'Garden wall',
    category: 'Outdoor spaces',
    prompt: `A side portion of a natural stone garden wall with a clear empty area where a wall lamp would hang, no lamp and no product in the frame, soft greenery at the edges, soft daylight, no people, no text, no logos, realistic exterior photograph, square.`
  },
  {
    id: 'brick-wall-nook',
    name: 'Brick wall nook',
    category: 'Outdoor spaces',
    prompt: `A side view of a warm red brick backyard wall with a clear empty area where a hanging wall lamp would be mounted, no lamp and no product in the frame, a few potted plants at the base, warm evening light, no people, no text, no logos, realistic exterior photograph, square.`
  },
  {
    id: 'gift-wrapping-table',
    name: 'Gift wrapping table',
    category: 'Seasonal sets',
    prompt: `A wooden table set for gift wrapping with kraft paper, ribbon, tissue paper and an open plain gift box, warm soft light, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'festive-mantel',
    name: 'Festive mantel',
    category: 'Seasonal sets',
    prompt: `A rustic mantel decorated with evergreen garland, warm fairy lights and plain stockings in a cosy winter room, an empty space in the centre, ${SCENE_RULES}`
  },
  {
    id: 'autumn-table',
    name: 'Autumn table',
    category: 'Seasonal sets',
    prompt: `An autumn table with dried leaves, amber glass and a linen cloth, warm low light, an empty centre, ${SCENE_RULES}`
  },
  {
    id: 'spring-table',
    name: 'Spring table',
    category: 'Seasonal sets',
    prompt: `A spring table with fresh white and yellow flowers, pale linen and bright soft light, an empty centre, ${SCENE_RULES}`
  },
  {
    id: 'neutral-holiday-table',
    name: 'Neutral holiday table',
    category: 'Seasonal sets',
    prompt: `A neutral holiday gift table with kraft wrapping paper, cotton twine, blank gift tags and dried oranges, soft warm light, an empty centre, ${SCENE_RULES}`
  }
]
