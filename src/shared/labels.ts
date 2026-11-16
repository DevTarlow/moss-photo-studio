export type LabelWord = 'Scene' | 'Person' | 'Edit' | 'Image' | 'Adjusted' | 'Size'

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
  return `${word} ${countForWord(word, labels)}`
}

export function uploadLabel(labels: readonly string[]): string {
  return labels.includes('Original photo') ? 'Source photo' : 'Original photo'
}

export function asLabelWord(word: string): LabelWord | null {
  const valid: LabelWord[] = ['Scene', 'Person', 'Edit', 'Image', 'Adjusted', 'Size']
  return valid.includes(word as LabelWord) ? (word as LabelWord) : null
}
