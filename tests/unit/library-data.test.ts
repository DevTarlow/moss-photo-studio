import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SCENES, SCENE_CATEGORIES } from '@shared/prompts/scenes'
import { ALL_TEMPLATES, TEMPLATE_GROUPS, QUICK_FIX, templateAsset, templateById } from '@shared/prompts/templates'
import { RECIPES, recipeById, CATEGORY_CHIPS, recipeShotTypes, recipeShotLabels, defaultDirectionFor } from '@shared/prompts/recipes'
import { SHOT_TYPES, shotDefinition, directionForPrompt } from '@shared/prompts/shots'
import { CREATE_PERSON_PROMPT, EXAMPLE_SCENES, STARTERS, exampleTextFor } from '@shared/starters'
import { BUNDLED_PEOPLE } from '@shared/people'
import { wrapScenePrompt, wrapModelPrompt, PROMPT_MAX } from '@shared/prompts/guards'
import { createDefaultPlan, makeShots, normalisePlan, enableFirstShots, firstShotsEnabled } from '@shared/plans'
import { nextCountedLabel, setImageLabel } from '@shared/labels'
import { shapeForImage, sizeForShape } from '@shared/shapes'
import { safeBaseName, uniqueFileName, numberedFileName } from '@shared/files'
import { usd, estimateCents, monthBounds, monthKey } from '@shared/cost'

const root = path.resolve(__dirname, '../..')

describe('scenes', () => {
  it('has eight unique scenes in four categories', () => {
    expect(SCENES).toHaveLength(8)
    expect(new Set(SCENES.map((scene) => scene.id)).size).toBe(8)
    for (const scene of SCENES) expect(SCENE_CATEGORIES).toContain(scene.category)
    expect(new Set(SCENES.map((scene) => scene.category))).toEqual(new Set(SCENE_CATEGORIES))
  })

  it('wraps under the prompt cap and has an asset', () => {
    for (const scene of SCENES) {
      expect(wrapScenePrompt(scene.prompt).length).toBeLessThanOrEqual(PROMPT_MAX)
      expect(fs.existsSync(path.join(root, 'resources', scene.tile))).toBe(true)
    }
  })
})

describe('the 32 change tiles', () => {
  it('has 32 unique tiles in six groups', () => {
    expect(ALL_TEMPLATES).toHaveLength(32)
    expect(TEMPLATE_GROUPS).toHaveLength(6)
    expect(new Set(ALL_TEMPLATES.map((template) => template.id)).size).toBe(32)
    for (const template of ALL_TEMPLATES) {
      expect(TEMPLATE_GROUPS.some((group) => group.id === template.group)).toBe(true)
      expect(['scene', 'model', 'edit']).toContain(template.kind)
      expect(template.prompt.trim().length).toBeGreaterThan(0)
    }
  })

  it('has an asset for every tile under its default person', () => {
    for (const template of ALL_TEMPLATES) {
      const asset = templateAsset(template, 'maya')
      expect(fs.existsSync(path.join(root, 'resources', asset))).toBe(true)
    }
  })

  it('keeps quick fix outside the 32', () => {
    expect(QUICK_FIX.id).toBe('quick-fix')
    expect(templateById(QUICK_FIX.id)).toBeUndefined()
  })

  it('keeps all model prompts able to fit under the cap', () => {
    for (const template of ALL_TEMPLATES.filter((entry) => entry.kind === 'model')) {
      expect(wrapModelPrompt(template.prompt).length).toBeLessThan(PROMPT_MAX)
    }
  })
})

describe('recipes', () => {
  it('maps every category to four to eight valid shots', () => {
    for (const recipe of RECIPES) {
      expect(recipe.shots.length).toBeGreaterThanOrEqual(4)
      expect(recipe.shots.length).toBeLessThanOrEqual(8)
      for (const type of recipe.shots) expect(SHOT_TYPES.some((shot) => shot.type === type)).toBe(true)
    }
    expect(RECIPES).toHaveLength(CATEGORY_CHIPS.length)
  })

  it('never includes feature and only puts on a person in clothing and bags', () => {
    for (const recipe of RECIPES) expect(recipe.shots).not.toContain('feature')
    const withPerson = RECIPES.filter((recipe) => recipe.shots.includes('onmodel')).map((recipe) => recipe.id)
    expect(withPerson.sort()).toEqual(['bags', 'clothing'])
  })

  it('falls back to other', () => {
    expect(recipeById('missing').id).toBe('other')
    expect(recipeShotTypes('clothing')).toContain('onmodel')
  })

  it('plans one default person for an onmodel shot', () => {
    const shots = makeShots('clothing')
    const personShot = shots.find((shot) => shot.type === 'onmodel')
    expect(personShot?.personId).toBe('maya')
  })

  it('keeps six distinct shots with the hero first', () => {
    for (const recipe of RECIPES) {
      expect(recipe.shots).toHaveLength(6)
      expect(new Set(recipe.shots).size).toBe(6)
      expect(recipe.shots[0]).toBe('hero')
      expect(recipeShotLabels(recipe.id)).toHaveLength(6)
    }
  })

  it('puts the strongest three shots first for the first run', () => {
    const firstThree: Record<string, string[]> = {
      candles: ['hero', 'lifestyle', 'detail'],
      ceramics: ['hero', 'lifestyle', 'detail'],
      jewelry: ['hero', 'detail', 'lifestyle'],
      clothing: ['hero', 'onmodel', 'detail'],
      bags: ['hero', 'onmodel', 'detail'],
      prints: ['hero', 'lifestyle', 'detail'],
      skincare: ['hero', 'lifestyle', 'detail'],
      food: ['hero', 'lifestyle', 'detail'],
      homeware: ['hero', 'lifestyle', 'detail'],
      vintage: ['hero', 'detail', 'lifestyle'],
      other: ['hero', 'lifestyle', 'detail']
    }
    for (const recipe of RECIPES) {
      expect(recipeShotTypes(recipe.id).slice(0, 3)).toEqual(firstThree[recipe.id])
    }
  })

  it('uses the category direction for new plans and empty saved directions', () => {
    const shots = makeShots('clothing')
    const hero = shots.find((shot) => shot.type === 'hero')!
    expect(hero.direction).toBe(defaultDirectionFor('clothing', 'hero'))
    expect(hero.direction).not.toBe(shotDefinition('hero').defaultDirection)
    expect(defaultDirectionFor('other', 'hero')).toBe(shotDefinition('hero').defaultDirection)

    const plan = createDefaultPlan({
      category: 'clothing',
      productName: 'Shirt',
      shape: 'portrait',
      format: 'webp'
    })
    plan.shots[0]!.direction = '  '
    expect(normalisePlan(plan).shots[0]!.direction).toBe(defaultDirectionFor('clothing', 'hero'))
  })

  it('keeps direction overrides on real recipe shots and inside the caps', () => {
    for (const recipe of RECIPES) {
      for (const [type, direction] of Object.entries(recipe.directions ?? {})) {
        expect(recipe.shots).toContain(type)
        expect(direction.length).toBeGreaterThan(0)
        expect(direction.length).toBeLessThanOrEqual(400)
      }
      if (recipe.giftClause) {
        expect(recipe.shots).toContain('gift')
        expect(recipe.giftClause.startsWith(' ')).toBe(true)
        expect(recipe.giftClause.length).toBeLessThan(300)
      }
    }
  })
})

describe('shot directions', () => {
  it('uses the studio default only when the direction is empty', () => {
    expect(directionForPrompt('hero', '  ')).toBe(shotDefinition('hero').defaultDirection)
    expect(directionForPrompt('hero', 'on a chair')).toBe('on a chair')
    expect(directionForPrompt('feature', '', 'Keeps tea hot')).toContain('Keeps tea hot')
  })

  it('starts every new shot with the studio direction filled in', () => {
    for (const shot of makeShots('other')) {
      expect(shot.direction).toBe(shotDefinition(shot.type).defaultDirection)
    }
  })

  it('fills an empty saved direction when a plan is loaded', () => {
    const plan = createDefaultPlan({
      category: 'other',
      productName: 'Mug',
      shape: 'square',
      format: 'webp'
    })
    plan.shots[0]!.direction = '   '
    expect(normalisePlan(plan).shots[0]!.direction).toBe(
      shotDefinition(plan.shots[0]!.type).defaultDirection
    )
  })
})

describe('first-set shot count', () => {
  function defaultPlan() {
    return createDefaultPlan({
      category: 'ceramics',
      productName: 'Mug',
      shape: 'square',
      format: 'webp'
    })
  }

  it('turns on exactly the first shots in recipe order', () => {
    const plan = defaultPlan()
    const next = enableFirstShots(plan, 3)
    expect(next.shots.map((shot) => shot.enabled)).toEqual([true, true, true, false, false, false])
    expect(next.shots.map((shot) => shot.id)).toEqual(plan.shots.map((shot) => shot.id))
    expect(next.shots.map((shot) => shot.direction)).toEqual(plan.shots.map((shot) => shot.direction))
    expect(firstShotsEnabled(next, 3)).toBe(true)
    expect(firstShotsEnabled(next, 6)).toBe(false)
  })

  it('clamps the count to the plan and can turn everything off', () => {
    const plan = defaultPlan()
    expect(enableFirstShots(plan, 99).shots.every((shot) => shot.enabled)).toBe(true)
    expect(enableFirstShots(plan, 0).shots.every((shot) => !shot.enabled)).toBe(true)
    expect(firstShotsEnabled(enableFirstShots(plan, plan.shots.length), plan.shots.length)).toBe(true)
  })

  it('does not treat a custom mix as a count preset', () => {
    const plan = defaultPlan()
    const custom = {
      ...plan,
      shots: plan.shots.map((shot, index) => ({ ...shot, enabled: index !== 1 }))
    }
    expect(firstShotsEnabled(custom, 6)).toBe(false)
    expect(firstShotsEnabled(custom, 5)).toBe(false)
  })
})

describe('starters and people', () => {
  it('ships 30 starters, each under 240 characters', () => {
    expect(STARTERS).toHaveLength(30)
    for (const starter of STARTERS) expect(starter.text.length).toBeLessThanOrEqual(240)
  })

  it('includes person ideas for holding, wearing, and using the item', () => {
    const personStarters = STARTERS.filter((starter) => starter.category === 'With a person')
    expect(personStarters.map((starter) => starter.label)).toEqual(
      expect.arrayContaining(['Holding it', 'Wearing it', 'Using it'])
    )
  })

  it('ships twenty-four adults with stable ids, descriptions and assets', () => {
    expect(BUNDLED_PEOPLE).toHaveLength(24)
    expect(BUNDLED_PEOPLE[0]).toEqual({ id: 'maya', name: 'Maya', ageBand: '20s', blurb: 'A woman in her twenties with dark shoulder-length hair.' })
    expect(new Set(BUNDLED_PEOPLE.map((person) => person.id)).size).toBe(24)
    for (const person of BUNDLED_PEOPLE) {
      expect(person.name.length).toBeGreaterThan(0)
      expect(person.blurb.length).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(root, 'resources', 'people', `${person.id}.webp`))).toBe(true)
      expect(fs.existsSync(path.join(root, 'resources', 'people', `${person.id}-portrait.webp`))).toBe(true)
    }
  })
})

describe('image generator examples', () => {
  it('ships eight example scenes with unique keys, assets and short copy', () => {
    expect(EXAMPLE_SCENES).toHaveLength(8)
    expect(new Set(EXAMPLE_SCENES.map((scene) => scene.key)).size).toBe(8)
    for (const scene of EXAMPLE_SCENES) {
      expect(scene.exampleText.length).toBeGreaterThan(0)
      expect(scene.exampleText.length).toBeLessThanOrEqual(240)
      expect(scene.productText.length).toBeGreaterThan(0)
      expect(scene.productText.length).toBeLessThanOrEqual(240)
      expect(fs.existsSync(path.join(root, 'resources', 'tiles', 'examples', `${scene.key}.webp`))).toBe(true)
    }
    expect(EXAMPLE_SCENES.find((scene) => scene.key === 'person')?.exampleText).toBe(CREATE_PERSON_PROMPT)
    expect(CREATE_PERSON_PROMPT.length).toBeGreaterThan(0)
    expect(CREATE_PERSON_PROMPT.length).toBeLessThanOrEqual(240)
  })

  it('writes the product variant for any product, not the example object', () => {
    for (const scene of EXAMPLE_SCENES) {
      expect(scene.productText.toLowerCase()).toContain('product')
      expect(scene.productText.toLowerCase()).not.toMatch(/\b(mug|candle|bottle)\b/)
    }
  })

  it('selects the copy that matches whether a product reference is used', () => {
    for (const scene of EXAMPLE_SCENES) {
      expect(exampleTextFor(scene, true)).toBe(scene.productText)
      expect(exampleTextFor(scene, false)).toBe(scene.exampleText)
    }
  })
})

describe('labels', () => {
  it('numbers one hundred edits without gaps or renumbering', () => {
    const labels: string[] = []
    for (let index = 0; index < 100; index += 1) labels.push(nextCountedLabel('Edit', labels))
    expect(labels[0]).toBe('Edit 01')
    expect(labels[9]).toBe('Edit 10')
    expect(labels[99]).toBe('Edit 100')
    labels.splice(1, 1)
    expect(nextCountedLabel('Edit', labels)).toBe('Edit 101')
    expect(labels[1]).toBe('Edit 03')
  })

  it('labels set remakes and other words', () => {
    expect(setImageLabel('hero', [])).toBe('Main shot')
    expect(setImageLabel('hero', ['Main shot'])).toBe('Main shot 2')
    expect(setImageLabel('hero', ['Main shot', 'Main shot 2'])).toBe('Main shot 3')
    expect(nextCountedLabel('Scene', ['Scene 01', 'Scene 03'])).toBe('Scene 04')
    expect(nextCountedLabel('Created', [])).toBe('Created 01')
    expect(nextCountedLabel('Adjust', [])).toBe('Adjust 01')
  })
})

describe('shapes', () => {
  it('maps the three presets', () => {
    expect(sizeForShape('square')).toBe('1024x1024')
    expect(sizeForShape('portrait')).toBe('1024x1536')
    expect(sizeForShape('landscape')).toBe('1536x1024')
  })

  it('matches by log-space nearest ratio', () => {
    expect(shapeForImage(1000, 1000)).toBe('square')
    expect(shapeForImage(2000, 3000)).toBe('portrait')
    expect(shapeForImage(3000, 2000)).toBe('landscape')
    expect(shapeForImage(1200, 1500)).toBe('portrait')
    expect(shapeForImage(0, 0)).toBe('square')
  })
})

describe('cost and file naming', () => {
  it('renders dollars and cents from one constant', () => {
    expect(usd(0)).toBe('$0.00')
    expect(usd(1)).toBe('$0.01')
    expect(usd(6)).toBe('$0.06')
    expect(usd(124)).toBe('$1.24')
    expect(estimateCents(4)).toBe(4)
  })

  it('computes local month bounds and keys', () => {
    const bounds = monthBounds('2026-11')
    expect(new Date(bounds.start).getMonth()).toBe(10)
    expect(new Date(bounds.end).getMonth()).toBe(11)
    expect(monthKey(new Date(2026, 10, 5))).toBe('2026-11')
  })

  it('strips unsafe characters, collapses spaces and limits length', () => {
    expect(safeBaseName('  My / lovely: mug?.  ')).toBe('My-lovely-mug')
    expect(safeBaseName('')).toBe('image')
    expect(safeBaseName('x'.repeat(120)).length).toBe(80)
    expect(numberedFileName(1, 'main-shot', 'webp')).toBe('01-main-shot.webp')
  })

  it('adds collision suffixes rather than overwriting', () => {
    const taken = new Set<string>()
    expect(uniqueFileName('mug', 'webp', taken)).toBe('mug.webp')
    expect(uniqueFileName('mug', 'webp', taken)).toBe('mug-2.webp')
    expect(uniqueFileName('mug', 'webp', taken)).toBe('mug-3.webp')
  })
})
