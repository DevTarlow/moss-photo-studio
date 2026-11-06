import type { PlanJson, PlanShot, ShotType } from './types'
import type { Format, Shape } from './shapes'
import { recipeShotTypes, recipeById } from './prompts/recipes'
import { shotDefinition } from './prompts/shots'
import { MAX_FEATURE_TEXT, MAX_SET_SHOTS } from './constants'

let shotCounter = 0

export function makeShotId(): string {
  shotCounter += 1
  return `shot-${Date.now().toString(36)}-${shotCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeShots(category: string): PlanShot[] {
  return recipeShotTypes(category).map((type) => ({
    id: makeShotId(),
    type,
    enabled: true,
    direction: '',
    personId: type === 'onmodel' ? 'maya' : null,
    label: shotDefinition(type).label
  }))
}

export function createDefaultPlan({
  category,
  productName,
  shape,
  format,
  now = Date.now()
}: {
  category: string
  productName: string
  shape: Shape
  format: Format
  now?: number
}): PlanJson {
  return {
    version: 1,
    category,
    productName,
    shape,
    format,
    createdAt: now,
    shots: makeShots(category)
  }
}

export function normalisePlan(plan: PlanJson): PlanJson {
  const seen = new Set<string>()
  const shots = plan.shots
    .filter((shot) => {
      if (seen.has(shot.id)) return false
      seen.add(shot.id)
      return true
    })
    .filter((shot) => {
      const valid: ShotType[] = [
        'hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift', 'feature', 'onmodel'
      ]
      return valid.includes(shot.type)
    })
    .slice(0, MAX_SET_SHOTS)
    .map((shot) => ({
      ...shot,
      direction: String(shot.direction ?? '').slice(0, 400),
      featureText: String(shot.featureText ?? '').slice(0, MAX_FEATURE_TEXT),
      personId: shot.type === 'onmodel' ? shot.personId : null,
      enabled: Boolean(shot.enabled)
    }))
  return {
    ...plan,
    category: recipeById(plan.category).id,
    shots
  }
}

export function enabledShots(plan: PlanJson): PlanShot[] {
  return plan.shots.filter((shot) => shot.enabled)
}

export function canRunPlan(plan: PlanJson): boolean {
  return plan.shots.some((shot) => shot.enabled)
}

export function availableShotTypes(plan: PlanJson): ShotType[] {
  const types: ShotType[] = ['hero', 'lifestyle', 'detail', 'scale', 'flatlay', 'gift', 'feature', 'onmodel']
  return types.filter((type) => !plan.shots.some((shot) => shot.type === type))
}

export function addShotToPlan(plan: PlanJson, type: ShotType): PlanJson {
  if (plan.shots.length >= MAX_SET_SHOTS) return plan
  if (plan.shots.some((shot) => shot.type === type)) return plan
  return {
    ...plan,
    shots: [
      ...plan.shots,
      {
        id: makeShotId(),
        type,
        enabled: true,
        direction: '',
        personId: type === 'onmodel' ? 'maya' : null,
        label: shotDefinition(type).label,
        ...(type === 'feature' ? { featureText: '' } : {})
      }
    ]
  }
}

export function removeShotFromPlan(plan: PlanJson, shotId: string): PlanJson {
  return { ...plan, shots: plan.shots.filter((shot) => shot.id !== shotId) }
}

export function setShotType(plan: PlanJson, shotId: string, type: ShotType): PlanJson {
  if (plan.shots.some((shot) => shot.id !== shotId && shot.type === type)) return plan
  return {
    ...plan,
    shots: plan.shots.map((shot) =>
      shot.id === shotId
        ? {
            ...shot,
            type,
            label: shotDefinition(type).label,
            direction: '',
            personId: type === 'onmodel' ? shot.personId ?? 'maya' : null,
            ...(type === 'feature' ? { featureText: shot.featureText ?? '' } : {})
          }
        : shot
    )
  }
}
