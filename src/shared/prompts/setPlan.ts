import type { PlanJson, PlanShot, ShotType } from '../types'
import { DEFAULT_PERSON_ID } from '../people'
import { composeSetPrompt } from './guards'
import { defaultDirectionFor, giftClauseFor } from './recipes'
import { directionForPrompt, shotDefinition } from './shots'

/** One image request's prompt and reference data, before paths are attached. */
export interface SetPromptSpec {
  shotId: string
  type: ShotType
  label: string
  /** What the seller typed, or the direction the studio stood in for. */
  userText: string
  prompt: string
  personId: string | null
  personLook: string | null
}

/**
 * The single source of truth for a set run's prompts. The job queue and the
 * real-Muse lab both call this, so what we test is what ships.
 */
export function planSetPrompts({
  plan,
  shots,
  palette = [],
  giftClause
}: {
  plan: PlanJson
  shots: readonly PlanShot[]
  palette?: string[]
  /** Lab-only override; the app passes none and gets the category clause. */
  giftClause?: string
}): SetPromptSpec[] {
  const resolvedGiftClause = giftClause ?? giftClauseFor(plan.category)
  return shots.map((shot) => {
    const base = shot.direction.trim() || defaultDirectionFor(plan.category, shot.type)
    const direction = directionForPrompt(shot.type, base, shot.featureText)
    return {
      shotId: shot.id,
      type: shot.type,
      label: shotDefinition(shot.type).label,
      userText: shot.direction.trim() || direction,
      prompt: composeSetPrompt({ type: shot.type, direction, palette, giftClause: resolvedGiftClause }),
      personId: shot.type === 'onmodel' ? shot.personId ?? DEFAULT_PERSON_ID : null,
      personLook: shot.type === 'onmodel' ? shot.personLook ?? null : null
    }
  })
}
