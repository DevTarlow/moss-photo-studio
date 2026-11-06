import type { ShotType } from '../types'

export interface ShotDefinition {
  type: ShotType
  label: string
  question: string
  defaultDirection: string
  fileLabel: string
}

export const SHOT_TYPES: readonly ShotDefinition[] = [
  {
    type: 'hero',
    label: 'Main shot',
    question: 'What is it, exactly?',
    defaultDirection: 'a clean, well-lit shot of the product filling the frame',
    fileLabel: 'main-shot'
  },
  {
    type: 'lifestyle',
    label: 'In use',
    question: 'What does it look like in real life?',
    defaultDirection: 'the product in a natural setting where it would actually be used',
    fileLabel: 'in-use'
  },
  {
    type: 'detail',
    label: 'Close-up',
    question: 'How well is it made?',
    defaultDirection: 'a close-up of the material, texture and finish',
    fileLabel: 'close-up'
  },
  {
    type: 'scale',
    label: 'Size reference',
    question: 'How big is it?',
    defaultDirection: 'the product beside a familiar object so its size reads at a glance',
    fileLabel: 'size-reference'
  },
  {
    type: 'flatlay',
    label: 'Flat lay',
    question: 'How does it look styled with its props?',
    defaultDirection: 'the product arranged from above with a few props that suit it, in a styled flat lay',
    fileLabel: 'flat-lay'
  },
  {
    type: 'gift',
    label: 'Gift-ready',
    question: 'Would this make a good present?',
    defaultDirection:
      'the product half-wrapped in tissue paper or sitting in an open gift box with tissue paper, with the product itself clearly visible',
    fileLabel: 'gift-ready'
  },
  {
    type: 'feature',
    label: 'Text on image',
    question: 'What does it do?',
    defaultDirection: 'the product with one short line of text naming its main feature',
    fileLabel: 'text-on-image'
  },
  {
    type: 'onmodel',
    label: 'On a person',
    question: 'What does it look like worn or held?',
    defaultDirection:
      'Show the person holding or wearing the product, with the product fully visible against a plain light studio backdrop.',
    fileLabel: 'on-a-person'
  }
]

const byType = new Map(SHOT_TYPES.map((shot) => [shot.type, shot]))

export function shotDefinition(type: ShotType): ShotDefinition {
  const found = byType.get(type)
  if (!found) throw new Error(`Unknown shot type: ${type}`)
  return found
}

export function isShotType(value: string): value is ShotType {
  return byType.has(value as ShotType)
}

/** The text used for a shot: the seller's direction, or the studio default. */
export function effectiveDirection(type: ShotType, direction: string): string {
  const trimmed = direction.trim()
  if (trimmed) return trimmed
  return shotDefinition(type).defaultDirection
}

export function directionForPrompt(type: ShotType, direction: string, featureText?: string): string {
  if (type === 'feature') {
    const text = featureText?.trim()
    if (text) return `the product with one short line of text reading "${text}"`
  }
  return effectiveDirection(type, direction)
}
