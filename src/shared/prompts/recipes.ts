import type { ShotType } from '../types'

export interface Recipe {
  id: string
  label: string
  shots: readonly ShotType[]
}

export const RECIPES: readonly Recipe[] = [
  { id: 'candles', label: 'Candles and home fragrance', shots: ['hero', 'lifestyle', 'detail', 'flatlay', 'gift', 'scale'] },
  { id: 'ceramics', label: 'Ceramics and pottery', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] },
  { id: 'jewelry', label: 'Jewelry', shots: ['hero', 'detail', 'lifestyle', 'scale', 'gift', 'flatlay'] },
  { id: 'clothing', label: 'Clothing and accessories', shots: ['hero', 'onmodel', 'detail', 'lifestyle', 'flatlay', 'gift'] },
  { id: 'bags', label: 'Bags and leather', shots: ['hero', 'detail', 'onmodel', 'lifestyle', 'scale', 'gift'] },
  { id: 'prints', label: 'Prints and art', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] },
  { id: 'skincare', label: 'Skincare and beauty', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] },
  { id: 'food', label: 'Food and drink', shots: ['hero', 'lifestyle', 'detail', 'flatlay', 'gift', 'scale'] },
  { id: 'homeware', label: 'Homeware and furniture', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] },
  { id: 'vintage', label: 'Vintage and resale', shots: ['hero', 'detail', 'scale', 'lifestyle', 'flatlay', 'gift'] },
  { id: 'other', label: 'Something else', shots: ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift'] }
]

export const DEFAULT_CATEGORY = 'other'
export const CATEGORY_CHIPS = RECIPES.map((recipe) => ({ id: recipe.id, label: recipe.label }))

export function recipeById(id: string | null | undefined): Recipe {
  return RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[RECIPES.length - 1]!
}

export function recipeShotTypes(category: string | null | undefined): ShotType[] {
  return [...recipeById(category).shots]
}
