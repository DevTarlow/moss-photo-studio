import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SCENES, SCENE_CATEGORIES } from '@shared/prompts/scenes'
import { ALL_TEMPLATES, TEMPLATE_GROUPS, QUICK_FIX, templateAsset, templateById } from '@shared/prompts/templates'
import { CREATE_PERSON_PROMPT, CREATE_PRODUCT_PROMPT, EXAMPLE_GROUPS, EXAMPLE_SCENES, PERSON_HOLDING_EXAMPLE, STARTERS, exampleTextFor } from '@shared/starters'
import { BUNDLED_PEOPLE, BUNDLED_PERSON_LOOKS } from '@shared/people'
import {
  BUNDLED_SCENE_CATEGORIES,
  BUNDLED_SCENE_PRESETS,
  BUNDLED_SCENE_SIZE,
  bundledSceneCards,
  isBundledScenePreset
} from '@shared/scene-presets'
import { BUNDLED_PRODUCT_SIZE, BUNDLED_PRODUCTS, bundledProductCards, isBundledProduct } from '@shared/products'
import { wrapScenePrompt, wrapModelPrompt, PROMPT_MAX } from '@shared/prompts/guards'
import { nextCountedLabel } from '@shared/labels'
import { shapeForImage, sizeForShape } from '@shared/shapes'
import { cleanProductName, safeBaseName, uniqueFileName, numberedFileName } from '@shared/files'
import { usd, estimateCents, monthBounds, monthKey } from '@shared/cost'
import { PRODUCT_PACK } from '../../scripts/lab/product-pack.mjs'
import { SCENE_PACK } from '../../scripts/lab/scene-pack.mjs'
import { PEOPLE_PACK } from '../../scripts/lab/people-pack.mjs'

const root = path.resolve(__dirname, '../..')

describe('product names from files', () => {
  it('keeps readable words and replaces camera filenames', () => {
    expect(cleanProductName('product.webp')).toBe('product')
    expect(cleanProductName('speckled-mug.jpg')).toBe('speckled mug')
    expect(cleanProductName('linen_tote_final.png')).toBe('linen tote')
    expect(cleanProductName('PXL_20240101_123456.jpg')).toBe('Product photo')
    expect(cleanProductName('IMG_4821.jpeg')).toBe('Product photo')
    expect(cleanProductName('  ')).toBe('Product photo')
  })

  it('keeps names inside the product limit', () => {
    expect(cleanProductName(`${'a'.repeat(120)}.jpg`).length).toBeLessThanOrEqual(80)
  })
})

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

  it('ships fifty adults across six age bands with stable ids, descriptions and assets', () => {
    expect(BUNDLED_PEOPLE).toHaveLength(50)
    expect(BUNDLED_PEOPLE[0]).toEqual({ id: 'maya', name: 'Maya', ageBand: '20s', blurb: 'A woman in her twenties with dark shoulder-length hair.' })
    expect(new Set(BUNDLED_PEOPLE.map((person) => person.id)).size).toBe(50)
    const bands = ['20s', '30s', '40s', '50s', '60s', '70s']
    for (const band of bands) {
      const count = BUNDLED_PEOPLE.filter((person) => person.ageBand === band).length
      expect(count, band).toBeGreaterThanOrEqual(8)
      expect(count, band).toBeLessThanOrEqual(9)
    }
    for (const person of BUNDLED_PEOPLE) {
      expect(person.name.length).toBeGreaterThan(0)
      expect(person.blurb.length).toBeGreaterThan(0)
      expect(bands).toContain(person.ageBand)
      expect(fs.existsSync(path.join(root, 'resources', 'people', `${person.id}.webp`))).toBe(true)
      expect(fs.existsSync(path.join(root, 'resources', 'people', `${person.id}-portrait.webp`))).toBe(true)
    }
  })

  it('keeps the lab people pack in sync with the catalog', () => {
    expect(PEOPLE_PACK).toHaveLength(BUNDLED_PEOPLE.length)
    expect(PEOPLE_PACK.map((entry) => entry.id)).toEqual(BUNDLED_PEOPLE.map((person) => person.id))
    const packById = new Map(PEOPLE_PACK.map((entry) => [entry.id, entry]))
    for (const person of BUNDLED_PEOPLE) {
      const entry = packById.get(person.id)
      expect(entry?.name).toBe(person.name)
      expect(entry?.ageBand).toBe(person.ageBand)
      expect(entry?.blurb).toBe(person.blurb)
      expect(entry?.prompt.length ?? 0).toBeGreaterThan(0)
      expect(entry?.prompt).toContain('head to toe')
    }
  })

  it('ships four distinct studio looks for every included person', () => {
    expect(BUNDLED_PERSON_LOOKS.map((look) => look.key)).toEqual(['front', 'angle', 'full', 'seated'])
    expect(new Set(BUNDLED_PERSON_LOOKS.map((look) => look.label)).size).toBe(4)
    for (const person of BUNDLED_PEOPLE) {
      for (const look of BUNDLED_PERSON_LOOKS) {
        const file = path.join(root, 'resources', 'people', `${person.id}-${look.key}.webp`)
        expect(fs.existsSync(file), `${person.id}-${look.key}.webp`).toBe(true)
      }
    }
  })
})

describe('bundled scene presets', () => {
  it('ships thirty product-free scenes across six categories', () => {
    expect(BUNDLED_SCENE_PRESETS).toHaveLength(30)
    expect(new Set(BUNDLED_SCENE_PRESETS.map((scene) => scene.id)).size).toBe(30)
    expect(BUNDLED_SCENE_SIZE).toBe(1024)
    expect(BUNDLED_SCENE_CATEGORIES).toHaveLength(6)
    for (const scene of BUNDLED_SCENE_PRESETS) {
      expect(scene.name.length).toBeGreaterThan(0)
      expect(scene.blurb.length).toBeGreaterThan(0)
      expect(BUNDLED_SCENE_CATEGORIES).toContain(scene.category)
      expect(isBundledScenePreset(scene.id)).toBe(true)
    }
    for (const category of BUNDLED_SCENE_CATEGORIES) {
      expect(BUNDLED_SCENE_PRESETS.filter((scene) => scene.category === category)).toHaveLength(5)
    }
    expect(isBundledScenePreset('not-a-bundled-scene')).toBe(false)
  })

  it('has full and thumb assets for every scene preset', () => {
    for (const scene of BUNDLED_SCENE_PRESETS) {
      expect(fs.existsSync(path.join(root, 'resources', 'scenes', `${scene.id}.webp`))).toBe(true)
      expect(fs.existsSync(path.join(root, 'resources', 'scenes', `${scene.id}-thumb.webp`))).toBe(true)
    }
  })

  it('keeps the lab scene pack in sync with the catalog', () => {
    expect(SCENE_PACK).toHaveLength(BUNDLED_SCENE_PRESETS.length)
    expect(SCENE_PACK.map((entry) => entry.id)).toEqual(BUNDLED_SCENE_PRESETS.map((scene) => scene.id))
    const packById = new Map(SCENE_PACK.map((entry) => [entry.id, entry]))
    for (const scene of BUNDLED_SCENE_PRESETS) {
      const entry = packById.get(scene.id)
      expect(entry?.name).toBe(scene.name)
      expect(entry?.category).toBe(scene.category)
      expect(entry?.prompt.length ?? 0).toBeGreaterThan(0)
      expect(entry?.prompt).toContain('no product in the frame')
    }
  })

  it('maps bundled scenes to resources without a saved row', () => {
    const cards = bundledSceneCards()
    expect(cards).toHaveLength(30)
    for (const card of cards) {
      expect(card.source).toBe('bundled')
      expect(card.width).toBe(1024)
      expect(card.height).toBe(1024)
      expect(card.blurb).toBeTruthy()
      expect(card.category).toBeTruthy()
      expect(card.imageUrl).toMatch(/^moss-media:\/\/bundled\/scenes\//)
      expect(card.thumbUrl).toMatch(/^moss-media:\/\/bundled\/scenes\//)
    }
  })
})

describe('image generator examples', () => {
  it('ships eight example scenes with unique keys, assets and short copy', () => {
    expect(EXAMPLE_SCENES).toHaveLength(8)
    expect(new Set(EXAMPLE_SCENES.map((scene) => scene.key)).size).toBe(8)
    expect(new Set(EXAMPLE_SCENES.map((scene) => scene.group))).toEqual(new Set(EXAMPLE_GROUPS))
    for (const scene of EXAMPLE_SCENES) {
      expect(scene.exampleText.length).toBeGreaterThan(0)
      expect(scene.exampleText.length).toBeLessThanOrEqual(240)
      expect(scene.productText.length).toBeGreaterThan(0)
      expect(scene.productText.length).toBeLessThanOrEqual(240)
      expect(fs.existsSync(path.join(root, 'resources', 'tiles', 'examples', `${scene.key}.webp`))).toBe(true)
    }
    expect(EXAMPLE_SCENES.find((scene) => scene.key === 'person')?.exampleText).toBe(PERSON_HOLDING_EXAMPLE)
    expect(PERSON_HOLDING_EXAMPLE).toContain('holding a ceramic cup')
    expect(PERSON_HOLDING_EXAMPLE.length).toBeLessThanOrEqual(240)
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
    expect(labels[0]).toBe('Edit 1')
    expect(labels[9]).toBe('Edit 10')
    expect(labels[99]).toBe('Edit 100')
    labels.splice(1, 1)
    expect(nextCountedLabel('Edit', labels)).toBe('Edit 101')
    expect(labels[1]).toBe('Edit 3')
  })

  it('labels other words without reusing numbers', () => {
    expect(nextCountedLabel('Scene', ['Scene 1', 'Scene 3'])).toBe('Scene 4')
    expect(nextCountedLabel('Image', [])).toBe('Image 1')
    expect(nextCountedLabel('Adjusted', [])).toBe('Adjusted 1')
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

describe('bundled products', () => {
  it('ships one hundred unique unbranded starter products across nineteen categories', () => {
    expect(BUNDLED_PRODUCTS).toHaveLength(100)
    expect(new Set(BUNDLED_PRODUCTS.map((product) => product.id)).size).toBe(100)
    expect(BUNDLED_PRODUCT_SIZE).toBe(1024)
    expect(BUNDLED_PRODUCTS.some((product) => product.name === 'Speckled mug')).toBe(true)
    const categories = Array.from(new Set(BUNDLED_PRODUCTS.map((product) => product.category)))
    expect(categories).toHaveLength(19)
    for (const product of BUNDLED_PRODUCTS) {
      expect(product.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(product.name.length).toBeGreaterThan(0)
      expect(product.category.length).toBeGreaterThan(0)
      expect(product.blurb.length).toBeGreaterThan(0)
      expect(isBundledProduct(product.id)).toBe(true)
    }
    for (const category of categories) {
      expect(BUNDLED_PRODUCTS.filter((product) => product.category === category).length).toBeGreaterThanOrEqual(4)
    }
    expect(isBundledProduct('not-a-bundled-product')).toBe(false)
    expect(CREATE_PRODUCT_PROMPT.length).toBeGreaterThan(0)
    expect(CREATE_PRODUCT_PROMPT.length).toBeLessThanOrEqual(PROMPT_MAX)
  })

  it('keeps the lab prompt pack in sync with the catalog', () => {
    expect(PRODUCT_PACK).toHaveLength(BUNDLED_PRODUCTS.length)
    expect(PRODUCT_PACK.map((entry) => entry.id)).toEqual(BUNDLED_PRODUCTS.map((product) => product.id))
    const packById = new Map(PRODUCT_PACK.map((entry) => [entry.id, entry]))
    for (const product of BUNDLED_PRODUCTS) {
      const entry = packById.get(product.id)
      expect(entry?.name).toBe(product.name)
      expect(entry?.category).toBe(product.category)
      expect(entry?.prompt.length ?? 0).toBeGreaterThan(0)
      expect(entry?.prompt).toContain('pure white seamless background')
    }
  })

  it('has full and thumb assets for every included product', () => {
    for (const product of BUNDLED_PRODUCTS) {
      expect(fs.existsSync(path.join(root, 'resources', 'products', `${product.id}.webp`))).toBe(true)
      expect(fs.existsSync(path.join(root, 'resources', 'products', `${product.id}-thumb.webp`))).toBe(true)
    }
  })

  it('maps bundled products to resources without a saved row', () => {
    const cards = bundledProductCards()
    expect(cards).toHaveLength(100)
    for (const card of cards) {
      expect(card.source).toBe('bundled')
      expect(card.width).toBe(1024)
      expect(card.height).toBe(1024)
      expect(card.blurb).toBeTruthy()
      expect(card.category).toBeTruthy()
      expect(card.imageUrl).toMatch(/^moss-media:\/\/bundled\/products\//)
      expect(card.thumbUrl).toMatch(/^moss-media:\/\/bundled\/products\//)
    }
  })
})
