import { describe, expect, it } from 'vitest'
import {
  PROMPT_MAX,
  REF_GUARD,
  EDIT_GUARD,
  GIFT_CLAUSE,
  wrapScenePrompt,
  wrapEditPrompt,
  wrapModelPrompt,
  appendWithinCap,
  paletteClause,
  composeChange,
  composeSetPrompt,
  composeCreatePrompt,
  SCENE_REF_GUARD
} from '@shared/prompts/guards'

describe('the preservation guards', () => {
  it('keeps the exact reference guard spelling', () => {
    expect(REF_GUARD).toBe(' Keep the product exactly as pictured in the reference.')
  })

  it('keeps the exact edit guard spelling', () => {
    expect(EDIT_GUARD).toBe(' Keep the product itself exactly the same - same shape, colours and details.')
  })

  it('wraps a scene character for character', () => {
    expect(wrapScenePrompt('a farmhouse kitchen table')).toBe(
      'Put the product from this image into this setting: "a farmhouse kitchen table". Keep the product itself exactly the same - same shape, colors, proportions, and any visible details. Only change the background and scene. Make it a realistic photo.'
    )
  })

  it('wraps an edit and trims only the change', () => {
    expect(wrapEditPrompt('  warm it up  ')).toBe(`warm it up${EDIT_GUARD}`)
  })

  it('wraps a model shot with both references and both guards', () => {
    expect(wrapModelPrompt(' Show them holding it. ')).toBe(
      'Use @Image1 as the product and @Image2 as the person. Show them holding it. Keep the product exactly as it is in @Image1 - same shape, colour, material, pattern and details. Keep the person exactly as they are in @Image2 - same face, hair, skin tone and body. Make it a realistic photograph.'
    )
  })

  it('drops an enhancement that does not fit and keeps the user text whole', () => {
    const base = 'x'.repeat(PROMPT_MAX)
    expect(appendWithinCap(base, ' tiny')).toBe(base)
    expect(appendWithinCap('a'.repeat(PROMPT_MAX - 5), '12345')).toBe(`${'a'.repeat(PROMPT_MAX - 5)}12345`)
  })

  it('keeps gift composition for an open box and visible product', () => {
    expect(GIFT_CLAUSE).toContain('sitting upright inside an open gift box')
    expect(GIFT_CLAUSE).toContain('must stay clearly visible')
    expect(GIFT_CLAUSE).toContain('clean and empty')
  })
})

describe('the created-image prompt', () => {
  it('keeps plain text unchanged without references', () => {
    expect(composeCreatePrompt({ text: ' A mug on a table ', hasProduct: false, hasPerson: false })).toBe('A mug on a table')
  })

  it('adds the product guard for a product reference', () => {
    expect(composeCreatePrompt({ text: 'A mug', hasProduct: true, hasPerson: false })).toBe(`A mug${REF_GUARD}`)
  })

  it('adds the person guard for a person reference', () => {
    expect(composeCreatePrompt({ text: 'A mug', hasProduct: false, hasPerson: true })).toContain('Keep the person exactly as pictured')
  })

  it('wraps both references with the model prompt', () => {
    expect(composeCreatePrompt({ text: ' holding it ', hasProduct: true, hasPerson: true })).toBe(wrapModelPrompt('holding it'))
  })

  it('orders product, person, and scene references explicitly', () => {
    const both = composeCreatePrompt({ text: 'On a windowsill', hasProduct: true, hasPerson: true, hasScene: true })
    expect(both).toContain('Use @Image1 as the product, @Image2 as the person, and @Image3 as the scene reference.')
    expect(both).toContain(SCENE_REF_GUARD)
    const sceneOnly = composeCreatePrompt({ text: 'On a windowsill', hasProduct: true, hasPerson: false, hasScene: true })
    expect(sceneOnly).toContain('Use @Image1 as the product and @Image2 as the scene reference.')
  })
})

describe('the palette clause', () => {
  it('uses up to three valid colors and never tints the product', () => {
    expect(paletteClause(['#112233', ' #ABCDEF ', 'bad', '#445566', '#778899'])).toBe(
      " For the setting and any props, this shop's colours are #112233, #ABCDEF, #445566. Keep the product's own colours exactly as they are."
    )
  })

  it('is empty without valid colors', () => {
    expect(paletteClause([])).toBe('')
    expect(paletteClause(['blue', '#12345'])).toBe('')
  })
})

describe('composeChange', () => {
  it('wraps a scene and does not add the reference guard', () => {
    const result = composeChange({ text: 'a marble counter', kind: 'scene', hasReference: true })
    expect(result).toBe(wrapScenePrompt('a marble counter'))
    expect(result).not.toContain(REF_GUARD)
  })

  it('wraps an edit, then adds the reference guard once', () => {
    expect(composeChange({ text: 'warmer', kind: 'edit', hasReference: true })).toBe(
      `${wrapEditPrompt('warmer')}${REF_GUARD}`
    )
  })

  it('wraps a model shot without a repeated reference guard', () => {
    const result = composeChange({ text: 'Hold it', kind: 'model', hasReference: true })
    expect(result).toBe(wrapModelPrompt('Hold it'))
    expect(result).not.toContain(REF_GUARD)
  })

  it('returns empty when the user typed nothing', () => {
    expect(composeChange({ text: '   ', kind: 'edit', hasReference: true })).toBe('')
  })

  it('adds the gift clause after the wrapper and then the palette', () => {
    const result = composeChange({
      text: 'a gift table',
      kind: 'edit',
      hasReference: true,
      isGiftShot: true,
      palette: ['#112233']
    })
    expect(result.startsWith(`${wrapEditPrompt('a gift table')}${REF_GUARD}`)).toBe(true)
    expect(result.indexOf(GIFT_CLAUSE)).toBeGreaterThan(result.indexOf(REF_GUARD))
    expect(result.endsWith(paletteClause(['#112233']))).toBe(true)
  })

  it('drops gift and palette before it would truncate user words', () => {
    const text = 'y'.repeat(PROMPT_MAX - 2)
    const withGift = composeChange({ text, kind: 'edit', hasReference: true, isGiftShot: true, palette: ['#112233'] })
    expect(withGift).not.toContain(GIFT_CLAUSE)
    expect(withGift).not.toContain('this shop')
    // The mandatory guards are still present; PROMPT_MAX is the total sent length.
    expect(withGift.length).toBeGreaterThan(PROMPT_MAX)
  })
})

describe('composeSetPrompt', () => {
  it('orders direction, gift clause, reference guard, palette', () => {
    const result = composeSetPrompt({
      type: 'gift',
      direction: 'a tissue paper scene',
      palette: ['#112233']
    })
    expect(result.indexOf('a tissue paper scene')).toBe(0)
    expect(result.indexOf(GIFT_CLAUSE)).toBeGreaterThan(0)
    expect(result.indexOf(REF_GUARD)).toBeGreaterThan(result.indexOf(GIFT_CLAUSE))
    expect(result.indexOf('this shop')).toBeGreaterThan(result.indexOf(REF_GUARD))
  })

  it('uses the model wrapper for on a person and no reference guard', () => {
    const result = composeSetPrompt({ type: 'onmodel', direction: 'Hold the mug', palette: ['#112233'] })
    expect(result).toBe(appendWithinCap(wrapModelPrompt('Hold the mug'), paletteClause(['#112233'])))
    expect(result).not.toContain(REF_GUARD)
  })

  it('never adds a palette to detail, scale or feature', () => {
    for (const type of ['detail', 'scale', 'feature'] as const) {
      expect(composeSetPrompt({ type, direction: 'a direction', palette: ['#112233'] })).not.toContain('this shop')
    }
  })

  it('adds the reference guard even if the palette cannot fit', () => {
    const long = 'z'.repeat(PROMPT_MAX - REF_GUARD.length)
    const result = composeSetPrompt({ type: 'hero', direction: long, palette: ['#112233'] })
    expect(result.endsWith(REF_GUARD)).toBe(true)
    expect(result).not.toContain('this shop')
  })

  it('returns empty for an empty direction', () => {
    expect(composeSetPrompt({ type: 'hero', direction: '   ' })).toBe('')
  })

  it('passes at exactly 2000 and drops only the palette past it', () => {
    const room = PROMPT_MAX - REF_GUARD.length
    expect(composeSetPrompt({ type: 'hero', direction: 'a'.repeat(room) }).length).toBe(PROMPT_MAX)
    const direction = 'a'.repeat(room - 10)
    const withPalette = composeSetPrompt({ type: 'hero', direction, palette: ['#112233'] })
    expect(withPalette.endsWith(REF_GUARD)).toBe(true)
    expect(withPalette).not.toContain('this shop')
  })
})
