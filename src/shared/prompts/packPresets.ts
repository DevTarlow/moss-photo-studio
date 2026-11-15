import type { PackJson, PackShot } from '../types'
import { PACK_DIRECTION_MAX, PACK_SHOT_MAX } from '../constants'
import { packTemplateById } from './packTemplates'

export interface PackPresetShot {
  templateId: string
  label?: string
  direction?: string
}

export interface PackPreset {
  id: string
  label: string
  blurb: string
  stylePreset: string | null
  shots: readonly PackPresetShot[]
}

export const DEFAULT_PACK_PRESET_ID = 'studio-essentials'

export const PACK_PRESETS: readonly PackPreset[] = [
  {
    id: 'studio-essentials',
    label: 'Studio essentials',
    blurb: 'A clean, consistent core set for any product.',
    stylePreset: 'studio',
    shots: [
      { templateId: 'hero' },
      { templateId: 'alternate' },
      { templateId: 'detail' },
      { templateId: 'scale' },
      { templateId: 'flat-lay' },
      { templateId: 'in-context' }
    ]
  },
  {
    id: 'lifestyle-story',
    label: 'Lifestyle story',
    blurb: 'Product, place, and the way it is used.',
    stylePreset: 'natural',
    shots: [
      { templateId: 'hero' },
      { templateId: 'in-context' },
      { templateId: 'in-use' },
      { templateId: 'detail' },
      { templateId: 'negative-space' },
      { templateId: 'group' }
    ]
  },
  {
    id: 'on-person',
    label: 'On person',
    blurb: 'Consistent looks on a person, from portrait to motion.',
    stylePreset: 'studio',
    shots: [
      {
        templateId: 'on-person',
        label: 'Portrait',
        direction:
          'a portrait of the person wearing or holding the product, framed from the chest up, the product clearly visible, plain soft studio backdrop, natural even light'
      },
      {
        templateId: 'on-person',
        label: 'Waist-up',
        direction:
          'a waist-up photograph of the person wearing or holding the product, facing the camera, the product in focus, plain soft studio backdrop, natural even light'
      },
      {
        templateId: 'on-person',
        label: 'Full length',
        direction:
          'a full-length photograph of the person wearing or holding the product, head to toe, the product clearly visible, plain soft studio backdrop, natural even light'
      },
      { templateId: 'motion' },
      { templateId: 'detail' },
      { templateId: 'in-context' }
    ]
  },
  {
    id: 'packaging-gift',
    label: 'Packaging & gift',
    blurb: 'How the product arrives and how it feels to receive.',
    stylePreset: 'warm_home',
    shots: [
      { templateId: 'hero' },
      { templateId: 'packaging' },
      { templateId: 'gift' },
      {
        templateId: 'in-hand',
        label: 'Hands on it',
        direction:
          'a close view of two hands holding the product and its wrapping, the product and packaging both visible, a warm neutral surface, soft daylight'
      },
      { templateId: 'detail' },
      { templateId: 'group' }
    ]
  },
  {
    id: 'editorial',
    label: 'Editorial',
    blurb: 'A more art-directed set with strong light and crops.',
    stylePreset: 'dramatic',
    shots: [
      { templateId: 'hero' },
      { templateId: 'macro' },
      { templateId: 'negative-space' },
      { templateId: 'detail' },
      { templateId: 'group' },
      { templateId: 'alternate' }
    ]
  },
  {
    id: 'food-serve',
    label: 'Food & serve',
    blurb: 'Appetite, texture, and the table around it.',
    stylePreset: 'natural',
    shots: [
      { templateId: 'hero' },
      {
        templateId: 'in-use',
        label: 'Served',
        direction:
          'the food or drink being served naturally, with the portion and texture clearly visible, warm table setting, soft daylight'
      },
      { templateId: 'detail' },
      { templateId: 'in-context' },
      { templateId: 'macro' },
      { templateId: 'overhead' }
    ]
  },
  {
    id: 'custom',
    label: 'Custom',
    blurb: 'Start from a single hero shot and build your own.',
    stylePreset: null,
    shots: [{ templateId: 'hero' }]
  }
] as const

export function packPresetById(id: string): PackPreset | undefined {
  return PACK_PRESETS.find((preset) => preset.id === id)
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function createShotFromPreset(entry: PackPresetShot): PackShot {
  const template = packTemplateById(entry.templateId)
  return {
    id: newId(),
    templateId: template?.id ?? 'custom',
    label: (entry.label ?? template?.label ?? 'Custom shot').slice(0, 80),
    direction: (entry.direction ?? template?.defaultDirection ?? '').slice(0, PACK_DIRECTION_MAX),
    enabled: true,
    selectedImageId: null
  }
}

export function createPackFromPreset(presetId = DEFAULT_PACK_PRESET_ID): PackJson {
  const preset = packPresetById(presetId) ?? packPresetById(DEFAULT_PACK_PRESET_ID)!
  return {
    version: 1,
    presetId: preset.id,
    stylePreset: preset.stylePreset,
    direction: '',
    personId: null,
    personLook: null,
    sceneImageId: null,
    shots: preset.shots.slice(0, PACK_SHOT_MAX).map(createShotFromPreset)
  }
}
