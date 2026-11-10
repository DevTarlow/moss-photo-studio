/**
 * Four alternate studio looks for every bundled person. Each is an edit of the
 * person's bundled reference so the face, hair, skin tone and build stay the
 * same; only the pose and framing change.
 *
 * The style is deliberately plain: a light grey seamless studio and soft even
 * light fit every Moss set category and keep the reference about the person,
 * not the room. Keys and labels must stay in sync with src/shared/people.ts.
 */
const STUDIO =
  'A studio portrait photograph of the same person as in the reference image, wearing simple neutral clothing, against a plain light grey seamless studio backdrop, soft even studio lighting, one person alone, realistic skin texture, no props, no text, no logos.'

export const PERSON_LOOKS_PACK = [
  {
    key: 'front',
    label: 'Studio front',
    prompt: `${STUDIO} Facing the camera directly with a warm relaxed smile, standing with their arms relaxed, framed from the waist up, with the top of the head and the shoulders fully in frame.`
  },
  {
    key: 'angle',
    label: 'Studio angle',
    prompt: `${STUDIO} Turned three-quarters towards the left of the camera, shoulders angled, looking at the camera with a relaxed smile, framed from the waist up, with the top of the head and the shoulders fully in frame.`
  },
  {
    key: 'full',
    label: 'Full length',
    prompt: `${STUDIO} Standing relaxed with their arms at their sides, photographed full length from head to toe, with the whole body and both feet in frame, wearing simple neutral clothing and plain shoes.`
  },
  {
    key: 'seated',
    label: 'Seated',
    prompt: `${STUDIO} Sitting upright on a simple wooden stool, hands relaxed in their lap, with a warm relaxed smile, framed from the knees to the top of the head.`
  }
]

export const personLookByKey = (key) => PERSON_LOOKS_PACK.find((look) => look.key === key) ?? null
