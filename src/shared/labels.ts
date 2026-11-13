import type { ShotType } from './types'
import { shotDefinition } from './prompts/shots'

export type LabelWord = 'Scene' | 'Model' | 'Edit' | 'Created' | 'Adjust' | 'Size'

type CountedWord = LabelWord

function countForWord(word: CountedWord, labels: readonly string[]): number {
  const expression = new RegExp(`^${word} (\\d+)$`)
  let highest = 0
  for (const label of labels) {
    const match = expression.exec(label)
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value > highest) highest = value
  }
  return highest + 1
}

export function nextCountedLabel(word: CountedWord, labels: readonly string[]): string {
  const count = countForWord(word, labels)
  return `${word} ${String(count).padStart(2, '0')}`
}

export function setImageLabel(type: ShotType, labels: readonly string[]): string {
  const base = shotDefinition(type).label
  const same = labels.filter((label) => label === base || label.startsWith(`${base} `))
  if (!same.length) return base
  let highest = 0
  for (const label of same) {
    if (label === base) {
      highest = Math.max(highest, 1)
      continue
    }
    const suffix = Number(label.slice(base.length + 1))
    if (Number.isFinite(suffix)) highest = Math.max(highest, suffix)
  }
  return `${base} ${highest + 1}`
}

export function uploadLabel(labels: readonly string[]): string {
  return labels.includes('Original photo') ? 'Source photo' : 'Original photo'
}

export function asLabelWord(word: string): LabelWord | null {
  const valid: LabelWord[] = ['Scene', 'Model', 'Edit', 'Created', 'Adjust']
  return valid.includes(word as LabelWord) ? (word as LabelWord) : null
}
