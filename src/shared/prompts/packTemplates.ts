/**
 * Universal shot roles for Image Packs. These are content goals, not
 * marketplace categories: every prompt is local and goes only to Muse Image.
 */
export interface PackShotTemplate {
  id: string
  label: string
  blurb: string
  defaultDirection: string
  fileLabel: string
  /** A representative bundled image for the empty shot card. */
  asset: string
  /** The shot expects a person reference. */
  needsPerson?: boolean
  /** Append the existing gift composition rule. */
  gift?: boolean
}

export const PACK_SHOT_TEMPLATES: readonly PackShotTemplate[] = [
  {
    id: 'hero',
    label: 'Hero',
    blurb: 'The clean, unambiguous main image.',
    defaultDirection:
      'a clean, well-lit hero image of the product filling most of the frame, photographed straight on with a simple uncluttered background, the whole product visible',
    fileLabel: 'hero',
    asset: 'tiles/examples/product.webp'
  },
  {
    id: 'alternate',
    label: 'Alternate angle',
    blurb: 'A second angle that shows the form.',
    defaultDirection:
      'a second view of the product from a three-quarter angle, showing its shape and side details clearly, with the same lighting and simple background as the hero image',
    fileLabel: 'alternate-angle',
    asset: 'tiles/examples/jewelry.webp'
  },
  {
    id: 'detail',
    label: 'Detail',
    blurb: 'Texture, finish, hardware, or a label.',
    defaultDirection:
      'a close-up detail of the product showing its material, texture and finish, with the most distinctive feature in sharp focus and a softly blurred background',
    fileLabel: 'detail',
    asset: 'tiles/product-close-up.webp'
  },
  {
    id: 'macro',
    label: 'Macro',
    blurb: 'A tighter, tactile close-up.',
    defaultDirection:
      'an extreme close-up macro photograph of the product surface, revealing texture and small details, soft directional light, shallow depth of field',
    fileLabel: 'macro',
    asset: 'tiles/product-close-up.webp'
  },
  {
    id: 'scale',
    label: 'Scale',
    blurb: 'Show how big it is.',
    defaultDirection:
      'the product beside a familiar everyday object for scale, both fully visible, neutral background, soft even light, the product still the clear subject',
    fileLabel: 'scale',
    asset: 'tiles/examples/lifestyle.webp'
  },
  {
    id: 'flat-lay',
    label: 'Flat lay',
    blurb: 'A styled view from above.',
    defaultDirection:
      'a flat lay photograph of the product from directly above on a simple textured surface, a few restrained props placed around it, soft even daylight',
    fileLabel: 'flat-lay',
    asset: 'tiles/examples/flatlay.webp'
  },
  {
    id: 'in-context',
    label: 'In context',
    blurb: 'The product in a real setting.',
    defaultDirection:
      'the product in a believable everyday setting that suits it, with the room softly out of focus behind it, natural light, the product still prominent and true to colour',
    fileLabel: 'in-context',
    asset: 'tiles/examples/home.webp'
  },
  {
    id: 'in-use',
    label: 'In use',
    blurb: 'The product being used or handled.',
    defaultDirection:
      'the product being used naturally, with the action and the product both clearly visible, a real setting around it, candid and unstaged, natural light',
    fileLabel: 'in-use',
    asset: 'tiles/examples/lifestyle.webp'
  },
  {
    id: 'on-person',
    label: 'On person',
    blurb: 'Shown with a person for scale or wear.',
    defaultDirection:
      'a real person wearing or holding the product, framed from the waist up, the product clearly visible and in focus, a plain soft backdrop and natural studio light',
    fileLabel: 'on-person',
    asset: 'tiles/examples/worn.webp',
    needsPerson: true
  },
  {
    id: 'motion',
    label: 'In motion',
    blurb: 'A natural movement or gesture.',
    defaultDirection:
      'a candid full-length photograph of the person moving naturally while using or wearing the product, the product clearly visible, soft studio light, a simple background',
    fileLabel: 'motion',
    asset: 'tiles/models/maya/in-motion.webp',
    needsPerson: true
  },
  {
    id: 'packaging',
    label: 'Packaging',
    blurb: 'How the product arrives.',
    defaultDirection:
      'the product beside or emerging from its plain packaging, wrapping and presentation materials visible, clean neutral surface, soft even light',
    fileLabel: 'packaging',
    asset: 'tiles/scenes/gift-ready.webp'
  },
  {
    id: 'gift',
    label: 'Gift-ready',
    blurb: 'The product presented as a gift.',
    defaultDirection:
      'the product arranged as a gift, with tissue paper and an open box around it, warm but restrained styling, soft daylight',
    fileLabel: 'gift',
    asset: 'tiles/examples/gift.webp',
    gift: true
  },
  {
    id: 'in-hand',
    label: 'In hand',
    blurb: 'A hand holds or uses the product.',
    defaultDirection:
      'a close view of a hand holding the product at chest height, the product sharp and fully visible, a soft neutral background, natural light',
    fileLabel: 'in-hand',
    asset: 'tiles/models/maya/held.webp',
    needsPerson: true
  },
  {
    id: 'group',
    label: 'Group',
    blurb: 'Show a family or collection together.',
    defaultDirection:
      'the product shown as part of a small coordinated group of related items, evenly arranged, the main product still clearly the focus, clean background and soft even light',
    fileLabel: 'group',
    asset: 'tiles/examples/product.webp'
  },
  {
    id: 'negative-space',
    label: 'Space for text',
    blurb: 'A composed image with room to add copy.',
    defaultDirection:
      'the product placed off-centre with generous clean space on one side for later text, minimal props, soft even light, the product fully visible',
    fileLabel: 'space-for-text',
    asset: 'tiles/room-for-text.webp'
  },
  {
    id: 'overhead',
    label: 'Overhead',
    blurb: 'A direct top-down arrangement.',
    defaultDirection:
      'a direct overhead photograph of the product on a simple surface, neatly arranged with a few restrained props, even natural light, everything in focus',
    fileLabel: 'overhead',
    asset: 'tiles/examples/flatlay.webp'
  },
  {
    id: 'custom',
    label: 'Custom shot',
    blurb: 'Write a shot that is not in the list.',
    defaultDirection: '',
    fileLabel: 'custom-shot',
    asset: 'tiles/examples/product.webp'
  }
] as const

export function packTemplateById(id: string): PackShotTemplate | undefined {
  return PACK_SHOT_TEMPLATES.find((template) => template.id === id)
}
