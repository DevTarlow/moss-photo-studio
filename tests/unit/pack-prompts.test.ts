import { describe, expect, it } from 'vitest'
import { PACK_SHOT_MAX, PACK_DIRECTION_MAX } from '@shared/constants'
import { createPackFromPreset, createShotFromPreset, PACK_PRESETS, packPresetById } from '@shared/prompts/packPresets'
import { PACK_SHOT_TEMPLATES, packTemplateById } from '@shared/prompts/packTemplates'
import { composePackPrompt, normalisePack, nextShotLabel, promptFits } from '@shared/prompts/packPrompt'
import { PROMPT_MAX } from '@shared/prompts/guards'

describe('pack presets and templates', () => {
  it('has unique templates and valid preset compositions', () => {
    expect(new Set(PACK_SHOT_TEMPLATES.map((template) => template.id)).size).toBe(PACK_SHOT_TEMPLATES.length)
    for (const preset of PACK_PRESETS) {
      expect(preset.shots.length).toBeGreaterThanOrEqual(1)
      expect(preset.shots.length).toBeLessThanOrEqual(PACK_SHOT_MAX)
      for (const shot of preset.shots) {
        expect(packTemplateById(shot.templateId), `${preset.id}: ${shot.templateId}`).toBeTruthy()
      }
    }
  })

  it('never uses marketplace or listing language in the universal presets', () => {
    const text = [...PACK_SHOT_TEMPLATES.flatMap((template) => [template.label, template.blurb, template.defaultDirection]), ...PACK_PRESETS.flatMap((preset) => [preset.label, preset.blurb])].join(' ')
    expect(text).not.toMatch(/etsy|shopify|amazon|ebay|tiktok|marketplace|listing kit|listing copy/i)
  })

  it('builds a default pack with unique shot ids and valid defaults', () => {
    const pack = createPackFromPreset()
    expect(pack.presetId).toBe('studio-essentials')
    expect(pack.shots).toHaveLength(6)
    expect(new Set(pack.shots.map((shot) => shot.id)).size).toBe(6)
    expect(pack.shots.every((shot) => shot.enabled && shot.selectedImageId === null)).toBe(true)
    expect(packPresetById(pack.presetId)).toBeTruthy()
    const custom = createPackFromPreset('custom')
    expect(custom.shots).toHaveLength(1)
    expect(custom.shots[0]?.templateId).toBe('hero')
  })
})

describe('pack prompts', () => {
  const pack = createPackFromPreset('studio-essentials')
  const shot = pack.shots[0]!

  it('keeps the product guard, style and palette in a reference pack', () => {
    const prompt = composePackPrompt({
      shot,
      pack: { ...pack, direction: 'Warm, calm, consistent light.' },
      hasProduct: true,
      hasPerson: false,
      hasScene: false,
      stylePreset: 'studio',
      palette: ['#14532d', '#9a3412']
    })
    expect(prompt).toContain('Keep the product exactly as pictured')
    expect(prompt).toContain('Warm, calm, consistent light.')
    expect(prompt).toContain('Keep the setting clean and studio-like')
    expect(prompt).toContain('#14532d')
    expect(prompt).toContain('#9a3412')
    expect(prompt.length).toBeLessThanOrEqual(PROMPT_MAX)
  })

  it('does not add a product guard to a prompt-only pack', () => {
    const prompt = composePackPrompt({
      shot,
      pack,
      hasProduct: false,
      hasPerson: false,
      hasScene: false,
      stylePreset: 'natural',
      palette: []
    })
    expect(prompt).not.toContain('Keep the product exactly as pictured')
    expect(prompt).toContain('Keep the setting natural and unstyled')
    expect(promptFits(prompt)).toBe(true)
  })

  it('names the person reference for an on-person shot', () => {
    const onPersonPreset = createPackFromPreset('on-person')
    const onPersonShot = onPersonPreset.shots[0]!
    const prompt = composePackPrompt({
      shot: onPersonShot,
      pack: { ...onPersonPreset, personId: 'maya', personLook: 'front' },
      hasProduct: true,
      hasPerson: true,
      hasScene: false,
      stylePreset: 'studio',
      palette: []
    })
    expect(prompt).toContain('@Image1 as the product')
    expect(prompt).toContain('@Image2 as the person')
    expect(prompt).toContain('Keep the person exactly as they are')
  })

  it('appends the gift composition rule only to gift templates', () => {
    const giftPack = createPackFromPreset('packaging-gift')
    const giftShot = giftPack.shots.find((entry) => entry.templateId === 'gift')!
    const prompt = composePackPrompt({
      shot: giftShot,
      pack: giftPack,
      hasProduct: true,
      hasPerson: false,
      hasScene: false,
      stylePreset: null,
      palette: []
    })
    expect(prompt).toContain('open gift box')
    const hero = composePackPrompt({
      shot: giftPack.shots[0]!,
      pack: giftPack,
      hasProduct: true,
      hasPerson: false,
      hasScene: false,
      stylePreset: null,
      palette: []
    })
    expect(hero).not.toContain('open gift box')
  })

  it('labels versions without reusing a shot label', () => {
    expect(nextShotLabel('Hero', [])).toBe('Hero')
    expect(nextShotLabel('Hero', ['Hero'])).toBe('Hero 2')
    expect(nextShotLabel('Hero', ['Hero', 'Hero 2'])).toBe('Hero 3')
    expect(nextShotLabel('Hero', ['Hero', 'Hero 3'])).toBe('Hero 2')
  })
})

describe('pack normalization', () => {
  it('clamps malformed shot lists and fills missing defaults', () => {
    const pack = normalisePack({
      presetId: 'not-a-preset',
      stylePreset: 'not-a-style',
      direction: 'x'.repeat(PACK_DIRECTION_MAX + 20),
      shots: Array.from({ length: PACK_SHOT_MAX + 4 }, (_, index) => ({
        id: index === 0 ? 'same' : index === 1 ? 'same' : `shot-${index}`,
        templateId: index === 0 ? 'hero' : 'not-a-template',
        label: '',
        direction: 'y'.repeat(500),
        enabled: true,
        selectedImageId: null
      }))
    })
    expect(pack.presetId).toBe('studio-essentials')
    expect(pack.stylePreset).toBeNull()
    expect(pack.direction).toHaveLength(PACK_DIRECTION_MAX)
    expect(pack.shots).toHaveLength(PACK_SHOT_MAX)
    expect(new Set(pack.shots.map((shot) => shot.id)).size).toBe(PACK_SHOT_MAX)
    expect(pack.shots[0]?.label).toBe('Hero')
    expect(pack.shots[1]?.templateId).toBe('custom')
    expect(pack.shots[1]?.direction).toHaveLength(PACK_DIRECTION_MAX)
  })

  it('can create an explicit custom shot', () => {
    const shot = createShotFromPreset({ templateId: 'custom', direction: 'A flat lay on a dark table.' })
    expect(shot.templateId).toBe('custom')
    expect(shot.direction).toBe('A flat lay on a dark table.')
    expect(shot.enabled).toBe(true)
  })
})
