export function bundledUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '')
  return `moss-media://bundled/${clean}`
}

export function libraryUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '')
  return `moss-media://library/${clean}`
}

/**
 * Keep an exported filename readable and safe. This is display-facing copy,
 * not a filesystem path: main joins it to a folder it selected.
 */
export function safeBaseName(input: string, fallback = 'image'): string {
  let name = String(input ?? '')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '')
    .replace(/[. ]+$/g, '')
    .trim()
  name = name.slice(0, 80).replace(/-+$/g, '')
  if (!name) name = fallback
  return name
}

/**
 * Turn a camera filename into a starting product name. Files such as
 * `PXL_20240101_123456.jpg` carry no useful words, so they fall back to a
 * friendly placeholder rather than reaching the product list raw.
 */
export function cleanProductName(fileName: string): string {
  const base = String(fileName ?? '').replace(/\.[^.]+$/, '')
  const spaced = base
    .replace(/[_]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const withoutCameraPrefix = spaced
    .replace(/\b(?:IMG|DSC|PXL|DCIM|MVIMG|Screenshot|Screen Shot)\b[\s._-]*\d.*$/i, '')
    .replace(/\b(?:copy|final|edited)\b\s*\(?\d*\)?$/i, '')
    .trim()
  const withoutTrailingNumber = withoutCameraPrefix.replace(/[\s._-]+\d{3,}$/g, '').trim()
  const candidate = withoutTrailingNumber || withoutCameraPrefix
  if (!/[A-Za-z]/.test(candidate)) return 'Product photo'
  return candidate.slice(0, 80).trim() || 'Product photo'
}

export function numberedFileName(index: number, fileLabel: string, extension: string): string {
  return `${String(index).padStart(2, '0')}-${fileLabel}.${extension}`
}

export function versionSuffix(label: string, baseLabel: string): string {
  if (label === baseLabel) return ''
  const suffix = label.slice(baseLabel.length).trim()
  const number = Number(suffix)
  return Number.isFinite(number) && number > 1 ? `-v${number}` : ''
}

export function uniqueFileName(base: string, extension: string, taken: Set<string>): string {
  const candidate = `${base}.${extension}`
  if (!taken.has(candidate)) {
    taken.add(candidate)
    return candidate
  }
  let n = 2
  while (taken.has(`${base}-${n}.${extension}`)) n += 1
  const next = `${base}-${n}.${extension}`
  taken.add(next)
  return next
}
