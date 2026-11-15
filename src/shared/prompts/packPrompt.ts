import type { PackJson, PackShot } from '../types'
import { PACK_DIRECTION_MAX, PACK_SHOT_MAX } from '../constants'
import { STYLE_PRESETS, styleClause } from '../stylePresets'
import { appendWithinCap, composeCreatePrompt, GIFT_CLAUSE, paletteClause, PROMPT_MAX } from './guards'
import { packTemplateById, type PackShotTemplate } from './packTemplates'
import { createPackFromPreset, DEFAULT_PACK_PRESET_ID, packPresetById } from './packPresets'

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function validStyle(value: unknown): string | null {
  return typeof value === 'string' && STYLE_PRESETS.some((preset) => preset.id === value) ? value : null
}

/**
 * Normalize a pack read from the database or renderer. Missing or malformed
 * fields fall back to a valid default; user words are clamped, never silently
 * used with a broken id.
 */
export function normalisePack(raw: unknown): PackJson {
  if (!raw || typeof raw !== 'object') return createPackFromPreset(DEFAULT_PACK_PRESET_ID)
  const value = raw as Partial<PackJson>
  const preset = packPresetById(String(value.presetId ?? ''))
  const presetId = preset?.id ?? (value.presetId === 'custom' ? 'custom' : DEFAULT_PACK_PRESET_ID)
  const fallback = createPackFromPreset(presetId)
  const sourceShots = Array.isArray(value.shots) ? value.shots : fallback.shots
  const seen = new Set<string>()
  const shots: PackShot[] = []
  for (const entry of sourceShots.slice(0, PACK_SHOT_MAX)) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as Partial<PackShot>
    const template = packTemplateById(String(candidate.templateId ?? ''))
    let id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim().slice(0, 120) : newId()
    while (seen.has(id)) id = newId()
    seen.add(id)
    shots.push({
      id,
      templateId: template?.id ?? 'custom',
      label: cleanText(candidate.label, 80) || template?.label || 'Custom shot',
      direction: cleanText(candidate.direction, PACK_DIRECTION_MAX) || template?.defaultDirection || '',
      enabled: candidate.enabled !== false,
      selectedImageId: typeof candidate.selectedImageId === 'string' && candidate.selectedImageId.trim()
        ? candidate.selectedImageId.trim().slice(0, 120)
        : null
    })
  }
  return {
    version: 1,
    presetId,
    stylePreset: validStyle(value.stylePreset),
    direction: cleanText(value.direction, PACK_DIRECTION_MAX),
    personId: typeof value.personId === 'string' && value.personId.trim() ? value.personId.trim().slice(0, 120) : null,
    personLook: typeof value.personLook === 'string' && value.personLook.trim() ? value.personLook.trim().slice(0, 80) : null,
    sceneImageId: typeof value.sceneImageId === 'string' && value.sceneImageId.trim() ? value.sceneImageId.trim().slice(0, 120) : null,
    shots
  }
}

export function enabledPackShots(pack: PackJson): PackShot[] {
  return pack.shots.filter((shot) => shot.enabled)
}

export function personRequiredShots(pack: PackJson): PackShot[] {
  return enabledPackShots(pack).filter((shot) => packTemplateById(shot.templateId)?.needsPerson === true)
}

export interface ComposePackPromptInput {
  shot: PackShot
  pack: PackJson
  hasProduct: boolean
  hasPerson: boolean
  hasScene: boolean
  /** The effective look: the pack override, or the brand default. */
  stylePreset: string | null
  palette: string[]
}

/**
 * The one source of truth for a pack request. The queue and the prompt
 * preview call this, so what the user sees is what Muse receives.
 */
export function composePackPrompt(input: ComposePackPromptInput): string {
  const template = packTemplateById(input.shot.templateId)
  let text = input.shot.direction.trim() || template?.defaultDirection || ''
  if (input.pack.direction.trim()) text = `${text} ${input.pack.direction.trim()}`.trim()
  if (template?.gift) text = appendWithinCap(text, GIFT_CLAUSE)
  let prompt = composeCreatePrompt({
    text,
    hasProduct: input.hasProduct,
    hasPerson: input.hasPerson,
    hasScene: input.hasScene
  })
  prompt = appendWithinCap(prompt, paletteClause(input.palette))
  prompt = appendWithinCap(prompt, styleClause(input.stylePreset))
  return prompt.trim()
}

export function promptFits(prompt: string): boolean {
  return prompt.length > 0 && prompt.length <= PROMPT_MAX
}

export function nextShotLabel(base: string, labels: readonly string[]): string {
  const clean = base.trim().slice(0, 80) || 'Shot'
  if (!labels.includes(clean)) return clean
  let count = 2
  while (labels.includes(`${clean} ${count}`)) count += 1
  return `${clean} ${count}`
}

export type { PackShotTemplate }
