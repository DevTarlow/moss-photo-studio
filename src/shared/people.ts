export interface BundledPerson {
  id: string
  name: string
  ageBand: string
  blurb: string
}

export const BUNDLED_PEOPLE: readonly BundledPerson[] = [
  { id: 'maya', name: 'Maya', ageBand: '20s', blurb: 'A woman in her twenties with dark shoulder-length hair.' },
  { id: 'omar', name: 'Omar', ageBand: '20s', blurb: 'A man in his twenties with curly dark hair.' },
  { id: 'jordan', name: 'Jordan', ageBand: '30s', blurb: 'A man in his thirties with short hair and a light beard.' },
  { id: 'mei', name: 'Mei', ageBand: '30s', blurb: 'A woman in her thirties with long straight black hair.' },
  { id: 'alex', name: 'Alex', ageBand: '30s', blurb: 'A person in their thirties with short curly hair.' },
  { id: 'priya', name: 'Priya', ageBand: '40s', blurb: 'A woman in her forties with shoulder-length dark hair.' },
  { id: 'ravi', name: 'Ravi', ageBand: '40s', blurb: 'A man in his forties with salt-and-pepper hair and a short beard.' },
  { id: 'tom', name: 'Tom', ageBand: '50s', blurb: 'A man in his fifties with short gray hair.' },
  { id: 'sofia', name: 'Sofia', ageBand: '50s', blurb: 'A woman in her fifties with wavy dark hair and gray at the temples.' },
  { id: 'grace', name: 'Grace', ageBand: '60s', blurb: 'A woman in her sixties with natural silver-streaked hair.' },
  { id: 'kwame', name: 'Kwame', ageBand: '60s', blurb: 'A man in his sixties, bald with a short gray beard.' },
  { id: 'nina', name: 'Nina', ageBand: '70s', blurb: 'A woman in her seventies with short silver hair.' }
]

export const DEFAULT_PERSON_ID = 'maya'

export function bundledPersonById(id: string): BundledPerson | undefined {
  return BUNDLED_PEOPLE.find((person) => person.id === id)
}

export function isBundledPerson(id: string): boolean {
  return BUNDLED_PEOPLE.some((person) => person.id === id)
}

export function personPickerLabel(person: { name: string; ageBand: string | null }): string {
  return person.ageBand ? `${person.name} · ${person.ageBand}` : person.name
}
