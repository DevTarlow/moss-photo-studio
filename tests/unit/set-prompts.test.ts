import { describe, expect, it } from 'vitest'
import { addShotToPlan, createDefaultPlan, removeShotFromPlan, setShotType } from '@shared/plans'
import { GIFT_CLAUSE, REF_GUARD } from '@shared/prompts/guards'
import { defaultDirectionFor } from '@shared/prompts/recipes'
import { planSetPrompts } from '@shared/prompts/setPlan'
import { shotDefinition } from '@shared/prompts/shots'
import type { PlanJson } from '@shared/types'

function planFor(category: string): PlanJson {
  return createDefaultPlan({
    category,
    productName: 'Test product',
    shape: 'square',
    format: 'webp'
  })
}

function shot(plan: PlanJson, type: string) {
  const found = plan.shots.find((entry) => entry.type === type)
  if (!found) throw new Error(`missing ${type}`)
  return found
}

describe('planSetPrompts', () => {
  it('uses the stored direction before the category or shared default', () => {
    const plan = planFor('clothing')
    shot(plan, 'hero').direction = 'a product on a grey table'
    const hero = planSetPrompts({ plan, shots: plan.shots }).find((entry) => entry.type === 'hero')!
    expect(hero.prompt).toBe(`a product on a grey table${REF_GUARD}`)
    expect(hero.userText).toBe('a product on a grey table')
  })

  it('falls back to the category direction when a saved direction is empty', () => {
    const plan = planFor('clothing')
    shot(plan, 'hero').direction = '   '
    const hero = planSetPrompts({ plan, shots: plan.shots }).find((entry) => entry.type === 'hero')!
    expect(hero.prompt.startsWith(defaultDirectionFor('clothing', 'hero'))).toBe(true)
    expect(hero.prompt).not.toContain(shotDefinition('hero').defaultDirection)
    expect(hero.userText).toBe(hero.prompt.replace(REF_GUARD, ''))
  })

  it('keeps the category direction in the stored plan when a shot is added or retyped', () => {
    const plan = planFor('clothing')
    const withoutGift = removeShotFromPlan(plan, shot(plan, 'gift').id)
    const added = addShotToPlan(withoutGift, 'gift')
    expect(added.shots.at(-1)?.direction).toBe(defaultDirectionFor('clothing', 'gift'))

    const flatlay = shot(withoutGift, 'flatlay')
    const retyped = setShotType(withoutGift, flatlay.id, 'gift')
    expect(retyped.shots.find((entry) => entry.id === flatlay.id)?.direction).toBe(
      defaultDirectionFor('clothing', 'gift')
    )
  })

  it('uses the clothing gift clause instead of the shared box clause', () => {
    const plan = planFor('clothing')
    const gift = planSetPrompts({ plan, shots: plan.shots }).find((entry) => entry.type === 'gift')!
    expect(gift.prompt).toContain('folded or rolled in tissue paper')
    expect(gift.prompt).not.toContain(GIFT_CLAUSE.trim())
  })

  it('uses the homeware wrapping clause and the shared clause elsewhere', () => {
    const homeware = planFor('homeware')
    const wrapped = planSetPrompts({ plan: homeware, shots: homeware.shots }).find(
      (entry) => entry.type === 'gift'
    )!
    expect(wrapped.prompt).toContain('wrapped in kraft paper')
    expect(wrapped.prompt).not.toContain('open gift box')

    const other = planFor('other')
    const boxed = planSetPrompts({ plan: other, shots: other.shots }).find((entry) => entry.type === 'gift')!
    expect(boxed.prompt).toContain(GIFT_CLAUSE.trim())
  })

  it('adds the palette to the shots that may use it', () => {
    const plan = planFor('clothing')
    const specs = planSetPrompts({ plan, shots: plan.shots, palette: ['#112233'] })
    expect(specs.find((entry) => entry.type === 'hero')!.prompt).toContain('#112233')
    expect(specs.find((entry) => entry.type === 'detail')!.prompt).not.toContain('#112233')
  })

  it('keeps both references for an on-person shot', () => {
    const plan = planFor('clothing')
    const onmodel = planSetPrompts({ plan, shots: plan.shots }).find((entry) => entry.type === 'onmodel')!
    expect(onmodel.personId).toBe('maya')
    expect(onmodel.personLook).toBeNull()
    expect(onmodel.prompt).toContain('@Image1 as the product')
    expect(onmodel.prompt).toContain('@Image2 as the person')
    expect(onmodel.prompt.startsWith('Use @Image1')).toBe(true)
  })

  it('carries the chosen person look only on an on-person shot', () => {
    const plan = planFor('clothing')
    shot(plan, 'onmodel').personLook = 'seated'
    shot(plan, 'hero').personLook = 'front'
    const specs = planSetPrompts({ plan, shots: plan.shots })
    expect(specs.find((entry) => entry.type === 'onmodel')!.personLook).toBe('seated')
    expect(specs.find((entry) => entry.type === 'hero')!.personLook).toBeNull()
  })

  it('keeps feature words in the prompt when a feature shot is added', () => {
    let plan = planFor('other')
    plan = addShotToPlan(plan, 'feature')
    const feature = shot(plan, 'feature')
    feature.featureText = 'Keeps tea hot'
    const spec = planSetPrompts({ plan, shots: plan.shots }).find((entry) => entry.type === 'feature')!
    expect(spec.prompt).toContain('Keeps tea hot')
  })

  it('accepts a lab-only gift clause override', () => {
    const plan = planFor('clothing')
    const gift = planSetPrompts({
      plan,
      shots: plan.shots,
      giftClause: ' A lab clause.'
    }).find((entry) => entry.type === 'gift')!
    expect(gift.prompt).toContain('A lab clause.')
  })
})
