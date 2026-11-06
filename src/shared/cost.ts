// Meta Model API price, checked 2026-11-05.
export const CENTS_PER_IMAGE = 1

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function estimateCents(images: number): number {
  return images * CENTS_PER_IMAGE
}

export function usdEstimate(images: number): string {
  return usd(estimateCents(images))
}

/** '2026-11' in the machine's local calendar. */
export function monthKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function monthBounds(month: string): { start: number; end: number } {
  const [yearRaw, monthRaw] = month.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('invalid_month')
  }
  const start = new Date(year, monthIndex, 1).getTime()
  const end = new Date(year, monthIndex + 1, 1).getTime()
  return { start, end }
}
