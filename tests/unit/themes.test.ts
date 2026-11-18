import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEME_LABELS,
  THEME_MODES,
  isThemeId,
  normalizeTheme
} from '@shared/themes'
import { PALETTES } from '../../src/renderer/src/theme/palettes'
import { THEMES } from '../../src/renderer/src/theme/themes'

/** The palette keys a theme must own; everything else comes from `themeBase`. */
const REQUIRED_PALETTE_KEYS = [
  'body',
  'surface',
  'muted',
  'rail',
  'text',
  'textSecondary',
  'textDisabled',
  'border',
  'borderEmphasized',
  'accent',
  'accentMuted',
  'accentSoft',
  'onAccent',
  'primary',
  'primaryHover',
  'onPrimary',
  'canvas',
  'canvasText',
  'canvasMuted'
] as const

describe('theme catalog', () => {
  it('offers ten unique themes, five light and five dark', () => {
    expect(THEME_IDS).toHaveLength(10)
    expect(new Set(THEME_IDS).size).toBe(10)
    const modes = THEME_IDS.map((id) => THEME_MODES[id])
    expect(modes.filter((mode) => mode === 'light')).toHaveLength(5)
    expect(modes.filter((mode) => mode === 'dark')).toHaveLength(5)
  })

  it('labels every theme with a unique name', () => {
    const labels = THEME_IDS.map((id) => THEME_LABELS[id])
    expect(labels.every((label) => label.trim().length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(THEME_IDS.length)
  })

  it('starts on the light Moss look', () => {
    expect(DEFAULT_THEME_ID).toBe('moss')
    expect(THEME_MODES[DEFAULT_THEME_ID]).toBe('light')
  })

  it('normalizes legacy and unknown stored values', () => {
    expect(normalizeTheme('light')).toBe('moss')
    expect(normalizeTheme('dark')).toBe('moss-night')
    expect(normalizeTheme('system')).toBe('moss')
    expect(normalizeTheme('clay')).toBe('clay')
    expect(normalizeTheme('sepia')).toBe(DEFAULT_THEME_ID)
    expect(normalizeTheme(null)).toBe(DEFAULT_THEME_ID)
    expect(isThemeId('basalt')).toBe(true)
    expect(isThemeId('system')).toBe(false)
  })
})

describe('theme palettes', () => {
  it('has exactly one palette per catalog entry', () => {
    expect(Object.keys(PALETTES).sort()).toEqual([...THEME_IDS].sort())
  })

  it('fills every palette value', () => {
    for (const id of THEME_IDS) {
      for (const key of REQUIRED_PALETTE_KEYS) {
        const value = PALETTES[id][key]
        expect(typeof value, `${id}.${key}`).toBe('string')
        expect(value.trim(), `${id}.${key}`).not.toBe('')
        expect(value, `${id}.${key}`).toMatch(/^(#[\da-fA-F]{3,8}|rgba?\()/)
      }
    }
  })

  it('keeps the default light and dark looks byte-identical to the old theme', () => {
    // Any drift means every light/dark screenshot baseline would move.
    expect(PALETTES.moss).toMatchObject({
      body: '#FAF7F2',
      rail: '#F2EDE4',
      text: '#1C1A17',
      accent: '#14532D',
      primary: '#9A3412',
      canvas: '#20201C'
    })
    expect(PALETTES['moss-night']).toMatchObject({
      body: '#131610',
      rail: '#0E110B',
      text: '#E9E4D6',
      accent: '#86C79A',
      primary: '#B45309',
      canvas: '#0B0B09'
    })
  })
})

describe('compiled themes', () => {
  it('ships one built theme per catalog entry', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort())
    for (const id of THEME_IDS) {
      expect(THEMES[id].name, id).toBe(id)
    }
  })
})
