/** A shop may save a full palette, but only this many steer a prompt. */
export const MAX_BRAND_COLORS = 6

/** The first colors in the saved list are the ones the studio uses. */
export const USED_BRAND_COLORS = 3

/** The colors a set or photo change may mention. Order is the user's choice. */
export function usedBrandColors(colors: string[]): string[] {
  return colors.slice(0, USED_BRAND_COLORS)
}

export function isBrandColorUsed(index: number): boolean {
  return index >= 0 && index < USED_BRAND_COLORS
}

/**
 * Swap one saved color into or out of the used three without losing it.
 * The used colors stay at the front of the list, so the queue's
 * "first three" rule keeps working. Returns the input when the index is
 * out of range or the move would change nothing.
 */
export function toggleBrandColorUse(colors: string[], index: number): string[] {
  if (index < 0 || index >= colors.length) return colors
  const next = [...colors]
  const [color] = next.splice(index, 1)
  if (color === undefined) return colors
  const at = isBrandColorUsed(index)
    ? Math.min(USED_BRAND_COLORS, next.length)
    : Math.min(USED_BRAND_COLORS - 1, next.length)
  if (at === index) return colors
  next.splice(at, 0, color)
  return next
}
