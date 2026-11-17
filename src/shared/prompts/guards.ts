export const PROMPT_MAX = 2000

export const REF_GUARD =
  ' Keep the product exactly as pictured in the reference.'

export const PERSON_REF_GUARD =
  ' Keep the person exactly as pictured in the reference - same face, hair, skin tone and body.'

export function sceneReferenceGuard(index: number): string {
  return ` Use @Image${index} as the scene reference. Use only its setting, light, and props; do not include its subject.`
}

export const SCENE_REF_GUARD =
  ' Use only the setting, lighting, and props from the scene reference; do not include any product or person from it.'

export const EDIT_GUARD =
  ' Keep the product itself exactly the same - same shape, colours and details.'

export function wrapScenePrompt(scene: string): string {
  return `Put the product from this image into this setting: "${scene}". Keep the product itself exactly the same - same shape, colors, proportions, and any visible details. Only change the background and scene. Make it a realistic photo.`
}

export function wrapEditPrompt(change: string): string {
  return `${change.trim()}${EDIT_GUARD}`
}

export function wrapModelPrompt(description: string): string {
  return `Use @Image1 as the product and @Image2 as the person. ${description.trim()} Keep the product exactly as it is in @Image1 - same shape, colour, material, pattern and details. Keep the person exactly as they are in @Image2 - same face, hair, skin tone and body. Make it a realistic photograph.`
}

export interface ComposeCreatePromptOptions {
  text: string
  hasProduct: boolean
  hasPerson: boolean
  hasScene?: boolean
}

/** The created image can send a product reference, a person reference, a scene reference, or all three. */
export function composeCreatePrompt({ text, hasProduct, hasPerson, hasScene = false }: ComposeCreatePromptOptions): string {
  const trimmed = text.trim()
  if (hasScene && hasProduct) {
    const refs = hasPerson
      ? 'Use @Image1 as the product, @Image2 as the person, and @Image3 as the scene reference.'
      : 'Use @Image1 as the product and @Image2 as the scene reference.'
    return `${refs} ${trimmed}${REF_GUARD}${hasPerson ? PERSON_REF_GUARD : ''}${SCENE_REF_GUARD}`
  }
  if (hasProduct && hasPerson) return wrapModelPrompt(trimmed)
  if (hasPerson) return `${trimmed}${PERSON_REF_GUARD}`
  if (hasProduct) return `${trimmed}${REF_GUARD}`
  return trimmed
}

/** The gift composition rule (see the brief §7.3). */
export const GIFT_CLAUSE =
  ' Show the product itself being wrapped in tissue paper, or sitting upright inside an open gift box with tissue paper around it - the product must stay clearly visible, not a finished wrapped present beside it. If the product is drinkware, show it clean and empty, with no drink inside it, ready to wrap.'

/** Append an enhancement only when the whole prompt still fits. */
export function appendWithinCap(base: string, addition: string): string {
  if (!addition) return base
  return base.length + addition.length <= PROMPT_MAX ? base + addition : base
}

/**
 * Seller-written product details (material, colour, style) are context for the
 * picture, not a replacement for the seller's description. Keep them short and
 * drop them silently when they would push the request over the cap.
 */
export function productNotesClause(notes: string | null | undefined): string {
  const clean = String(notes ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return ` Keep these product details in mind: ${clean.slice(0, 300)}.`
}

/**
 * Used for a set or an edit when saved colors exist. The clause may
 * steer backgrounds and props only; it must never tint the product.
 */
export function paletteClause(colors: string[]): string {
  const hexes = colors
    .map((c) => String(c || '').trim())
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
    .slice(0, 3)
  if (!hexes.length) return ''
  return (
    ` For the setting and any props, this shop's colours are ${hexes.join(', ')}.` +
    " Keep the product's own colours exactly as they are."
  )
}

export type ChangeKind = '' | 'scene' | 'edit' | 'model'

export interface ComposeChangeOptions {
  text: string
  kind: ChangeKind
  hasReference: boolean
  hasPerson?: boolean
  hasScene?: boolean
  isGiftShot?: boolean
  palette?: string[]
}

export function composeChange({
  text,
  kind,
  hasReference,
  hasPerson = false,
  hasScene = false,
  isGiftShot = false,
  palette = []
}: ComposeChangeOptions): string {
  let prompt = text.trim()
  if (!prompt) return ''
  if (kind === 'scene') prompt = wrapScenePrompt(prompt)
  else if (kind === 'edit') prompt = wrapEditPrompt(prompt)
  else if (kind === 'model') prompt = wrapModelPrompt(prompt)
  if (hasReference && kind !== 'model' && kind !== 'scene') prompt += REF_GUARD
  if (hasScene) prompt = appendWithinCap(prompt, sceneReferenceGuard(hasPerson ? 3 : 2))
  if (isGiftShot) prompt = appendWithinCap(prompt, GIFT_CLAUSE)
  prompt = appendWithinCap(prompt, paletteClause(palette))
  return prompt
}
