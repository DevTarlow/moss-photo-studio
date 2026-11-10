export interface BundledPerson {
  id: string
  name: string
  ageBand: string
  blurb: string
}

export interface BundledPersonLook {
  key: BundledPersonLookKey
  label: string
}

export type BundledPersonLookKey = 'front' | 'angle' | 'full' | 'seated'

/**
 * The alternate studio looks bundled with every included person. The matching
 * prompts live in scripts/lab/person-looks.mjs; the images are
 * resources/people/<id>-<key>.webp.
 */
export const BUNDLED_PERSON_LOOKS: readonly BundledPersonLook[] = [
  { key: 'front', label: 'Studio front' },
  { key: 'angle', label: 'Studio angle' },
  { key: 'full', label: 'Full length' },
  { key: 'seated', label: 'Seated' }
]

/**
 * The bundled reference people. The photos are synthetic, candid lifestyle
 * shots chosen to read friendly and relaxed in the People page and to work as
 * on-model references. The matching generation prompts live in
 * scripts/lab/people-pack.mjs; keep ids, names and age bands in sync with it.
 */
export const BUNDLED_PEOPLE: readonly BundledPerson[] = [
  { id: 'maya', name: 'Maya', ageBand: '20s', blurb: 'A woman in her twenties with dark shoulder-length hair.' },
  { id: 'omar', name: 'Omar', ageBand: '20s', blurb: 'A man in his twenties with curly dark hair.' },
  { id: 'aisha', name: 'Aisha', ageBand: '20s', blurb: 'A woman in her twenties with long braided hair.' },
  { id: 'luca', name: 'Luca', ageBand: '20s', blurb: 'A man in his twenties with light-brown wavy hair and round glasses.' },
  { id: 'jordan', name: 'Jordan', ageBand: '30s', blurb: 'A man in his thirties with short hair and a light beard.' },
  { id: 'mei', name: 'Mei', ageBand: '30s', blurb: 'A woman in her thirties with long straight black hair.' },
  { id: 'theo', name: 'Theo', ageBand: '30s', blurb: 'A man in his thirties with a short fade.' },
  { id: 'hana', name: 'Hana', ageBand: '30s', blurb: 'A woman in her thirties with a chin-length bob.' },
  { id: 'alex', name: 'Alex', ageBand: '30s', blurb: 'A person in their thirties with short curly hair.' },
  { id: 'priya', name: 'Priya', ageBand: '40s', blurb: 'A woman in her forties with shoulder-length dark hair.' },
  { id: 'marcus', name: 'Marcus', ageBand: '40s', blurb: 'A man in his forties, balding with a short beard.' },
  { id: 'elena', name: 'Elena', ageBand: '40s', blurb: 'A woman in her forties with curly dark hair.' },
  { id: 'ravi', name: 'Ravi', ageBand: '40s', blurb: 'A man in his forties with salt-and-pepper hair and a short beard.' },
  { id: 'tom', name: 'Tom', ageBand: '50s', blurb: 'A man in his fifties with short gray hair.' },
  { id: 'sofia', name: 'Sofia', ageBand: '50s', blurb: 'A woman in her fifties with wavy dark hair and gray at the temples.' },
  { id: 'sam', name: 'Sam', ageBand: '50s', blurb: 'A person in their fifties with short silver hair.' },
  { id: 'amara', name: 'Amara', ageBand: '50s', blurb: 'A woman in her fifties with a natural afro.' },
  { id: 'grace', name: 'Grace', ageBand: '60s', blurb: 'A woman in her sixties with natural silver-streaked hair.' },
  { id: 'victor', name: 'Victor', ageBand: '60s', blurb: 'A man in his sixties with gray hair and glasses.' },
  { id: 'rosa', name: 'Rosa', ageBand: '60s', blurb: 'A woman in her sixties with short curly gray hair.' },
  { id: 'kwame', name: 'Kwame', ageBand: '60s', blurb: 'A man in his sixties, bald with a short gray beard.' },
  { id: 'nina', name: 'Nina', ageBand: '70s', blurb: 'A woman in her seventies with short silver hair.' },
  { id: 'henry', name: 'Henry', ageBand: '70s', blurb: 'A man in his seventies with a white beard and a flat cap.' },
  { id: 'june', name: 'June', ageBand: '70s', blurb: 'A woman in her seventies with short silver curls.' }
]

export const DEFAULT_PERSON_ID = 'maya'

export function bundledPersonById(id: string): BundledPerson | undefined {
  return BUNDLED_PEOPLE.find((person) => person.id === id)
}

export function isBundledPerson(id: string): boolean {
  return BUNDLED_PEOPLE.some((person) => person.id === id)
}

export function isBundledLookKey(key: string | null | undefined): key is BundledPersonLookKey {
  return BUNDLED_PERSON_LOOKS.some((look) => look.key === key)
}

export function personPickerLabel(person: { name: string; ageBand: string | null }): string {
  return person.ageBand ? `${person.name} · ${person.ageBand}` : person.name
}
