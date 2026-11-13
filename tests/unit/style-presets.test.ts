import { describe, expect, it } from 'vitest'
import { STYLE_PRESETS, styleClause } from '@shared/stylePresets'

describe('default looks', () => {
  it('adds nothing for none or an unknown value', () => {
    expect(styleClause('none')).toBe('')
    expect(styleClause('missing')).toBe('')
    expect(styleClause(null)).toBe('')
  })

  it('never tells the model to tint or alter the product', () => {
    for (const preset of STYLE_PRESETS) {
      expect(preset.clause.toLowerCase()).not.toContain('product')
    }
  })

  it('has a stable label for every preset', () => {
    expect(STYLE_PRESETS.map((preset) => preset.id)).toContain('warm_home')
    expect(STYLE_PRESETS.every((preset) => preset.label.length > 0)).toBe(true)
  })
})
