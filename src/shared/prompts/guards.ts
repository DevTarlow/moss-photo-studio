export const PROMPT_MAX = 2000

export const REF_GUARD =
  ' Keep the product exactly as pictured in the reference.'

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

/** The gift composition rule (see the brief §7.3). */
export const GIFT_CLAUSE =
  ' Show the product itself being wrapped in tissue paper, or sitting upright inside an open gift box with tissue paper around it - the product must stay clearly visible, not a finished wrapped present beside it. If the product is drinkware, show it clean and empty, with no drink inside it, ready to wrap.'

/** Append an enhancement only when the whole prompt still fits. */
export function appendWithinCap(base: string, addition: string): string {
  if (!addition) return base
  return base.length + addition.length <= PROMPT_MAX ? base + addition : base
}

/**
 * Used for a set or an edit when the brand kit has colours. The clause may
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
  isGiftShot?: boolean
  palette?: string[]
}

export function composeChange({
  text,
  kind,
  hasReference,
  isGiftShot = false,
  palette = []
}: ComposeChangeOptions): string {
  let prompt = text.trim()
  if (!prompt) return ''
  if (kind === 'scene') prompt = wrapScenePrompt(prompt)
  else if (kind === 'edit') prompt = wrapEditPrompt(prompt)
  else if (kind === 'model') prompt = wrapModelPrompt(prompt)
  if (hasReference && kind !== 'model' && kind !== 'scene') prompt += REF_GUARD
  if (isGiftShot) prompt = appendWithinCap(prompt, GIFT_CLAUSE)
  prompt = appendWithinCap(prompt, paletteClause(palette))
  return prompt
}

export type ShotType =
  | 'hero'
  | 'lifestyle'
  | 'detail'
  | 'scale'
  | 'flatlay'
  | 'gift'
  | 'feature'
  | 'onmodel'

export const PALETTE_SHOTS = new Set<ShotType>(['hero', 'lifestyle', 'flatlay', 'gift', 'onmodel'])

export interface ComposeSetPromptOptions {
  type: ShotType
  direction: string
  palette?: string[]
}

export function composeSetPrompt({ type, direction, palette = [] }: ComposeSetPromptOptions): string {
  const text = direction.trim()
  if (!text) return ''
  if (type === 'onmodel') {
    return appendWithinCap(wrapModelPrompt(text), paletteClause(palette))
  }
  let prompt = text
  if (type === 'gift') prompt = appendWithinCap(prompt, GIFT_CLAUSE)
  prompt = appendWithinCap(prompt, REF_GUARD)
  if (PALETTE_SHOTS.has(type)) prompt = appendWithinCap(prompt, paletteClause(palette))
  return prompt
}

export function isGiftSceneId(id: string): boolean {
  return id === 'gift-ready'
}
