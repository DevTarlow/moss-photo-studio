/**
 * The 24 bundled people. Each entry generates one full-body reference photo;
 * the lab crops a square portrait from it. Ids, names and age bands must stay
 * in sync with src/shared/people.ts.
 *
 * Style: candid, genuinely happy, full body, one person alone, simple setting.
 * Avoid busy backgrounds, other people, text and logos so the reference works
 * for on-model sets and generator runs.
 */
export const PEOPLE_PACK = [
  {
    id: 'maya',
    name: 'Maya',
    ageBand: '20s',
    blurb: 'A woman in her twenties with dark shoulder-length hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful woman in her twenties with fair skin and dark shoulder-length hair, wearing an oversized cream sweater, straight blue jeans and white sneakers, walking toward the camera and laughing in a bright minimal studio with a warm off-white backdrop, soft natural light, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'omar',
    name: 'Omar',
    ageBand: '20s',
    blurb: 'A man in his twenties with curly dark hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful young man in his twenties with olive skin and dark curly hair, wearing a light grey t-shirt, dark blue jeans and white sneakers, laughing with his hands in his pockets on a sunlit city sidewalk, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'aisha',
    name: 'Aisha',
    ageBand: '20s',
    blurb: 'A woman in her twenties with long braided hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black woman in her twenties with long braided hair, wearing a bright yellow top, blue jeans and white sneakers, laughing while walking in a green park, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'luca',
    name: 'Luca',
    ageBand: '20s',
    blurb: 'A man in his twenties with light-brown wavy hair and round glasses.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful young man in his twenties with light-brown wavy hair and round glasses, wearing a denim jacket, white t-shirt, dark jeans and sneakers, laughing while walking through a sunlit city street, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'jordan',
    name: 'Jordan',
    ageBand: '30s',
    blurb: 'A man in his thirties with short hair and a light beard.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black man in his thirties with short hair and a light beard, wearing a navy overshirt over a white tee, khaki trousers and brown boots, leaning against a brick wall in soft daylight and smiling, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'mei',
    name: 'Mei',
    ageBand: '30s',
    blurb: 'A woman in her thirties with long straight black hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful East Asian woman in her thirties with long straight black hair, wearing a denim jacket, white trousers and sandals, smiling in the doorway of a sunlit cafe, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'theo',
    name: 'Theo',
    ageBand: '30s',
    blurb: 'A man in his thirties with a short fade.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black man in his thirties with a short fade, wearing a cream knit sweater, dark trousers and boots, smiling while standing outside a cafe with a coffee cup, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'hana',
    name: 'Hana',
    ageBand: '30s',
    blurb: 'A woman in her thirties with a chin-length bob.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful East Asian woman in her thirties with a chin-length bob, wearing a denim shirt, black trousers and canvas shoes, smiling at a sunny farmers market, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'alex',
    name: 'Alex',
    ageBand: '30s',
    blurb: 'A person in their thirties with short curly hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful androgynous person in their thirties with short curly hair, wearing a mustard cardigan, dark jeans and canvas sneakers, laughing in a bright apartment with plants, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'priya',
    name: 'Priya',
    ageBand: '40s',
    blurb: 'A woman in her forties with shoulder-length dark hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful South Asian woman in her forties with shoulder-length dark hair, wearing a coral linen blouse, wide-leg cream trousers and flat sandals, smiling in a green garden, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'marcus',
    name: 'Marcus',
    ageBand: '40s',
    blurb: 'A man in his forties, balding with a short beard.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful white man in his forties with a balding head and a short beard, wearing an olive overshirt, grey trousers and work boots, laughing outside a woodworking studio, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'elena',
    name: 'Elena',
    ageBand: '40s',
    blurb: 'A woman in her forties with curly dark hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Latina woman in her forties with curly dark hair, wearing a white linen dress and sandals, smiling in a sunlit kitchen while holding a mug, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'ravi',
    name: 'Ravi',
    ageBand: '40s',
    blurb: 'A man in his forties with salt-and-pepper hair and a short beard.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful South Asian man in his forties with salt-and-pepper hair and a short beard, wearing a chambray shirt, olive chinos and brown shoes, laughing on a wooden porch, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'tom',
    name: 'Tom',
    ageBand: '50s',
    blurb: 'A man in his fifties with short gray hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful white man in his fifties with short gray hair, wearing a forest-green jacket, grey trousers and walking shoes, smiling on a park path with trees behind, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'sofia',
    name: 'Sofia',
    ageBand: '50s',
    blurb: 'A woman in her fifties with wavy dark hair and gray at the temples.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Latina woman in her fifties with wavy dark hair and gray at the temples, wearing a rust-colored midi dress and flat shoes, laughing in a sunlit kitchen, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'sam',
    name: 'Sam',
    ageBand: '50s',
    blurb: 'A person in their fifties with short silver hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful nonbinary person in their fifties with short silver hair, wearing a colorful striped shirt, black jeans and sneakers, grinning while standing beside a bicycle on a tree-lined path, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'amara',
    name: 'Amara',
    ageBand: '50s',
    blurb: 'A woman in her fifties with a natural afro.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black woman in her fifties with a natural afro, wearing a bold printed dress and flat sandals, laughing in a flower garden, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'grace',
    name: 'Grace',
    ageBand: '60s',
    blurb: 'A woman in her sixties with natural silver-streaked hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black woman in her sixties with natural silver-streaked hair, wearing a blue linen shirt, white trousers and sandals, smiling in a bright bookstore aisle, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'victor',
    name: 'Victor',
    ageBand: '60s',
    blurb: 'A man in his sixties with gray hair and glasses.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful East Asian man in his sixties with gray hair and glasses, wearing a beige jacket, dark trousers and walking shoes, smiling on a park path, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'rosa',
    name: 'Rosa',
    ageBand: '60s',
    blurb: 'A woman in her sixties with short curly gray hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Latina woman in her sixties with short curly gray hair, wearing a coral cardigan, white blouse, navy trousers and flat shoes, smiling in a bright kitchen with flowers on the table, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'kwame',
    name: 'Kwame',
    ageBand: '60s',
    blurb: 'A man in his sixties, bald with a short gray beard.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black man in his sixties, bald with a short gray beard, wearing a navy crewneck sweater, tan trousers and brown shoes, laughing on a city street, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'nina',
    name: 'Nina',
    ageBand: '70s',
    blurb: 'A woman in her seventies with short silver hair.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful white woman in her seventies with short silver hair, wearing a soft blue blouse, navy trousers and beige shoes, smiling in a garden with flowers behind, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'henry',
    name: 'Henry',
    ageBand: '70s',
    blurb: 'A man in his seventies with a white beard and a flat cap.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful white man in his seventies with a white beard and a flat cap, wearing a brown jacket, cream sweater, dark trousers and boots, laughing outside a wooden shed, soft daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  },
  {
    id: 'june',
    name: 'June',
    ageBand: '70s',
    blurb: 'A woman in her seventies with short silver curls.',
    prompt:
      'A candid full-body lifestyle photograph of a cheerful Black woman in her seventies with short silver curls, wearing a denim jacket, white t-shirt, dark trousers and sneakers, smiling on a sunny porch with a watering can, warm daylight, one person alone, head to toe in frame, vertical portrait, realistic skin texture, no text, no logos.'
  }
]
