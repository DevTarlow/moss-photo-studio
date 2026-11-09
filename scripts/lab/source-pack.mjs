/**
 * Clean stand-in product photos for categories that have no owner photo yet.
 * One generation each. The final report must label these sources synthetic.
 */
export const SOURCE_PACK = [
  {
    category: 'candles',
    prompt:
      'A single amber glass scented candle with a plain kraft label on a pure white seamless background, centred, the whole jar visible, no lid, no props, no text other than the label, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'ceramics',
    prompt:
      'A handmade pale green ceramic mug with a visible glaze and handle, alone on a pure white seamless background, centred, the whole mug visible, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'jewelry',
    prompt:
      'A delicate gold chain necklace with one small round pendant, laid flat and fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic jewelry product photo, square.'
  },
  {
    category: 'bags',
    prompt:
      'A tan leather tote bag with two handles, standing upright and fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'prints',
    prompt:
      'A framed abstract art print with a thin oak frame and a wide white mount, standing upright and fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'skincare',
    prompt:
      'A white glass serum bottle with a black dropper cap and a simple blank label, standing upright and fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'food',
    prompt:
      'A matte kraft coffee bag with a simple blank label, standing upright and fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'homeware',
    prompt:
      'A small round oak side table with three legs, fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'vintage',
    prompt:
      'A vintage brass table lamp with a pleated cream fabric shade, fully visible on a pure white seamless background, centred, no props, no text, soft even studio light, realistic product photo, square.'
  },
  {
    category: 'other',
    prompt:
      'A simple natural stoneware vessel with a matte off-white glaze, alone on a pure white seamless background, centred, the whole object visible, no props, no text, soft even studio light, realistic product photo, square.'
  }
]

export const sourcePromptFor = (category) => SOURCE_PACK.find((entry) => entry.category === category) ?? null
