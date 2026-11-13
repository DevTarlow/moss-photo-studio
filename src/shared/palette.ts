function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`
}

function distance(a: number[], b: number[]): number {
  return Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))
}

/**
 * A small, deterministic palette from RGBA pixels. Transparent and near
 * white/black pixels are skipped so a product photo does not contribute its
 * backdrop; the rest is clustered with a fixed-seed k-means.
 */
export function paletteFromPixels(pixels: ArrayLike<number>, count = 6): string[] {
  const samples: number[][] = []
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if ((pixels[index + 3] ?? 0) < 128) continue
    const r = Number(pixels[index])
    const g = Number(pixels[index + 1])
    const b = Number(pixels[index + 2])
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (luma > 242 || luma < 12) continue
    samples.push([r, g, b])
  }
  if (!samples.length) return []
  const k = Math.min(count, samples.length)
  let centers = Array.from({ length: k }, (_, index) => samples[Math.floor((index * samples.length) / k)]!.slice())
  let counts = new Array(k).fill(0)
  for (let iteration = 0; iteration < 9; iteration += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0])
    counts = new Array(k).fill(0)
    for (const sample of samples) {
      let nearest = 0
      let best = Number.POSITIVE_INFINITY
      centers.forEach((center, index) => {
        const d = distance(sample, center)
        if (d < best) {
          best = d
          nearest = index
        }
      })
      const target = sums[nearest]!
      target[0] = (target[0] ?? 0) + sample[0]!
      target[1] = (target[1] ?? 0) + sample[1]!
      target[2] = (target[2] ?? 0) + sample[2]!
      counts[nearest] += 1
    }
    centers = centers.map((center, index) => {
      const total = counts[index] ?? 0
      if (!total) return center
      const sum = sums[index]!
      return [sum[0]! / total, sum[1]! / total, sum[2]! / total]
    })
  }
  const ranked = centers
    .map((center, index) => ({ center, count: counts[index] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const result: string[] = []
  for (const { center } of ranked) {
    if (result.some((existing) => distance(center, hexToRgb(existing)) < 26)) continue
    result.push(hex(center[0]!, center[1]!, center[2]!))
    if (result.length >= count) break
  }
  return result
}

function hexToRgb(value: string): number[] {
  return [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16))
}
