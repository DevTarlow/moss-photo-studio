import type { ChangeKind } from './guards'
import { SCENES } from './scenes'

export type TemplateGroupId = 'scene' | 'model' | 'background' | 'lighting' | 'color' | 'finish'

export interface Template {
  id: string
  label: string
  group: TemplateGroupId
  kind: Exclude<ChangeKind, ''>
  prompt: string
  suits?: string
  asset: string
}

export interface TemplateGroup {
  id: TemplateGroupId
  title: string
  intro: string
  templates: Template[]
}

const sceneTemplates: Template[] = SCENES.map((scene) => ({
  id: scene.id,
  label: scene.label,
  group: 'scene',
  kind: 'scene',
  prompt: scene.prompt,
  suits: scene.blurb,
  asset: scene.tile
}))

const modelTemplates: Template[] = [
  {
    id: 'worn-waist',
    label: 'Worn, waist-up',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person wearing the product, photographed from the waist up against a plain warm-grey studio backdrop with soft, even light.',
    asset: 'tiles/models/maya/worn-waist.webp'
  },
  {
    id: 'worn-full',
    label: 'Worn, full length',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person wearing the product in a full-length portrait, head to toe, against a plain light studio backdrop with soft, even light.',
    asset: 'tiles/models/maya/worn-full.webp'
  },
  {
    id: 'held',
    label: 'Held',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person holding the product in one hand at chest height, or wearing a bag over one shoulder so it hangs at their side, turned so the product faces the camera and is fully visible, against a plain light studio backdrop.',
    asset: 'tiles/models/maya/held.webp'
  },
  {
    id: 'close-up',
    label: 'Close-up',
    group: 'model',
    kind: 'model',
    prompt:
      'Show a close-up of the person holding the product in their hand, with the product and its detail filling the frame, against a soft neutral background.',
    asset: 'tiles/models/maya/close-up.webp'
  },
  {
    id: 'in-use',
    label: 'In use',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person using the product in a bright room at home, in natural daylight, with the product clearly visible and in focus.',
    asset: 'tiles/models/maya/in-use.webp'
  },
  {
    id: 'from-behind',
    label: 'From behind',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person from behind, wearing the product, framed from the head to below the hips, against a plain light studio backdrop with soft, even light.',
    asset: 'tiles/models/maya/from-behind.webp'
  },
  {
    id: 'in-motion',
    label: 'In motion',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person walking towards the camera at an easy pace, wearing the product, in a bright, uncluttered space with natural daylight, with the product clearly visible.',
    asset: 'tiles/models/maya/in-motion.webp'
  },
  {
    id: 'sitting',
    label: 'Sitting',
    group: 'model',
    kind: 'model',
    prompt:
      'Show the person sitting on a simple stool in a bright room, wearing or holding the product, in soft natural daylight.',
    asset: 'tiles/models/maya/sitting.webp'
  }
]

const backgroundTemplates: Template[] = [
  {
    id: 'pure-white',
    label: 'Pure white',
    group: 'background',
    kind: 'edit',
    prompt: 'Remove any props and clutter, then put the product alone on a pure white seamless background with a soft, natural shadow.',
    asset: 'tiles/pure-white.webp'
  },
  {
    id: 'soft-colour',
    label: 'Soft color',
    group: 'background',
    kind: 'edit',
    prompt: 'Replace the background with a smooth, seamless backdrop in a soft colour that complements the product, with even studio lighting and no props.',
    asset: 'tiles/soft-colour.webp'
  },
  {
    id: 'blurred',
    label: 'Blurred',
    group: 'background',
    kind: 'edit',
    prompt: 'Blur the background into a soft, shallow depth of field so the product stands out, keeping the product itself sharp.',
    asset: 'tiles/blurred.webp'
  },
  {
    id: 'clean-up',
    label: 'Clean up',
    group: 'background',
    kind: 'edit',
    prompt: 'Remove any props and clutter from the background, leaving just the product, its surface and the existing light.',
    asset: 'tiles/clean-up.webp'
  }
]

const lightingTemplates: Template[] = [
  {
    id: 'window-light',
    label: 'Window light',
    group: 'lighting',
    kind: 'edit',
    prompt: 'Relight the scene with soft, diffused window light coming from the left, with gentle natural shadows.',
    asset: 'tiles/window-light.webp'
  },
  {
    id: 'golden-hour',
    label: 'Golden hour',
    group: 'lighting',
    kind: 'edit',
    prompt: 'Relight the scene with warm golden-hour sunlight coming from the side, with long soft shadows and warm highlights.',
    asset: 'tiles/golden-hour.webp'
  },
  {
    id: 'bright-even',
    label: 'Bright and even',
    group: 'lighting',
    kind: 'edit',
    prompt: 'Make the image brighter and evenly lit, like a clean product photo, with soft shadows and natural colours.',
    asset: 'tiles/bright-even.webp'
  },
  {
    id: 'moody',
    label: 'Moody',
    group: 'lighting',
    kind: 'edit',
    prompt: 'Make the lighting darker and more dramatic, with one soft focused light and deep shadows.',
    asset: 'tiles/moody.webp'
  }
]

const colorTemplates: Template[] = [
  {
    id: 'warmer',
    label: 'Warmer',
    group: 'color',
    kind: 'edit',
    prompt: 'Warm the colours with golden, honeyed tones.',
    asset: 'tiles/warmer.webp'
  },
  {
    id: 'cooler',
    label: 'Cooler',
    group: 'color',
    kind: 'edit',
    prompt: 'Cool the colours to a crisp blue-grey tone.',
    asset: 'tiles/cooler.webp'
  },
  {
    id: 'more-vibrant',
    label: 'More vibrant',
    group: 'color',
    kind: 'edit',
    prompt: 'Make the colours more vibrant and saturated so the product stands out.',
    asset: 'tiles/more-vibrant.webp'
  },
  {
    id: 'film-look',
    label: 'Film look',
    group: 'color',
    kind: 'edit',
    prompt: 'Give the image a soft vintage film look with gentle grain and slightly faded colours.',
    asset: 'tiles/film-look.webp'
  }
]

const finishTemplates: Template[] = [
  {
    id: 'square-crop',
    label: 'Square crop',
    group: 'finish',
    kind: 'edit',
    prompt: 'Recompose this into a square 1:1 frame with the product larger and centred, filling most of the frame while staying fully visible.',
    asset: 'tiles/square-crop.webp'
  },
  {
    id: 'product-close-up',
    label: 'Product close-up',
    group: 'finish',
    kind: 'edit',
    prompt: 'Move in for a close-up of the product, filling the frame with its material, texture and detail.',
    asset: 'tiles/product-close-up.webp'
  },
  {
    id: 'room-for-text',
    label: 'Room for text',
    group: 'finish',
    kind: 'edit',
    prompt: 'Recompose so the product sits in the lower third and there is clean, uncluttered space above it for text.',
    asset: 'tiles/room-for-text.webp'
  },
  {
    id: 'soft-shadow',
    label: 'Soft shadow',
    group: 'finish',
    kind: 'edit',
    prompt: 'Add a soft, long shadow stretching from the product to one side, as if the light is coming from the other side, so it sits convincingly on the surface.',
    asset: 'tiles/soft-shadow.webp'
  }
]

export const TEMPLATE_GROUPS: readonly TemplateGroup[] = [
  { id: 'scene', title: 'Scene', intro: 'Put the product somewhere real.', templates: sceneTemplates },
  { id: 'model', title: 'On a person', intro: 'Show it worn, held, used or up close.', templates: modelTemplates },
  { id: 'background', title: 'Background', intro: 'Clean up what is behind the product.', templates: backgroundTemplates },
  { id: 'lighting', title: 'Lighting', intro: 'Change the light, not the product.', templates: lightingTemplates },
  { id: 'color', title: 'Color', intro: 'Warm it, cool it, give it a look.', templates: colorTemplates },
  { id: 'finish', title: 'Finish', intro: 'Frame it for the final use, or finish it off.', templates: finishTemplates }
]

export const ALL_TEMPLATES: readonly Template[] = TEMPLATE_GROUPS.flatMap((group) => group.templates)

export const QUICK_FIX = {
  id: 'quick-fix',
  label: 'Quick fix',
  description: 'Straighten, clean up the background, even the light.',
  prompt: 'Clean up the background, even the lighting, and straighten the framing.',
  kind: 'edit' as const
}

export function templateById(id: string): Template | undefined {
  return ALL_TEMPLATES.find((template) => template.id === id)
}

/** The chosen person's example when available, otherwise the group tile. */
export function templateAsset(template: Template, personId: string | null): string {
  if (template.group === 'model' && personId) {
    return `tiles/models/${personId}/${template.id}.webp`
  }
  return template.asset
}

export function templateWord(template: Template | undefined): 'Scene' | 'Person' | 'Edit' {
  if (template?.group === 'scene') return 'Scene'
  if (template?.group === 'model') return 'Person'
  return 'Edit'
}
