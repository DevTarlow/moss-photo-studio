#!/usr/bin/env node
/**
 * Contrast audit for the design tokens, across every foreground/background
 * pair the app actually renders, for every appearance theme in its own mode.
 * Fails at WCAG AA: 4.5 for body text, 3 for large text and icons.
 *
 * The audit reads each compiled theme from `theme/built/<id>.js` (the exact
 * tokens that ship, inheritance already resolved) and the app's product tokens
 * in `tokens.css`. Any `var(--theme-token)` alias in that file must resolve in
 * the theme, so a renamed or removed theme token fails here instead of
 * silently rendering an inherited colour.
 *
 * Run `npm run theme:build` first: this audits the built output, not the
 * sources.
 */
import fs from 'node:fs'

const cssPath = new URL('../src/renderer/src/styles/tokens.css', import.meta.url)
const catalogPath = new URL('../src/shared/themes.ts', import.meta.url)
const builtPath = (id) => new URL(`../src/renderer/src/theme/built/${id}.js`, import.meta.url)

const { THEME_IDS, THEME_MODES } = await import(catalogPath.href)
const css = fs.readFileSync(cssPath, 'utf8')

/** Split `light-dark(a, b)` on its top-level comma; nested rgb()/rgba() stays intact. */
function splitLightDark(value) {
  const text = String(value).trim()
  if (!text.startsWith('light-dark(') || !text.endsWith(')')) return { light: text, dark: text }
  const inner = text.slice('light-dark('.length, -1)
  let depth = 0
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index]
    if (character === '(') depth += 1
    else if (character === ')') depth -= 1
    else if (character === ',' && depth === 0) {
      return { light: inner.slice(0, index).trim(), dark: inner.slice(index + 1).trim() }
    }
  }
  return { light: inner.trim(), dark: inner.trim() }
}

function blockOrNull(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`)
  const match = pattern.exec(css)
  return match ? match[1] : null
}

function block(selector) {
  const body = blockOrNull(selector)
  if (body === null) throw new Error(`Missing token block ${selector}`)
  return body
}

function parseTokens(body) {
  const tokens = {}
  for (const line of body.split('\n')) {
    const match = /(--[\w-]+)\s*:\s*([^;]+);/.exec(line)
    if (match) tokens[match[1]] = match[2].trim()
  }
  return tokens
}

const rootTokens = parseTokens(block(':root'))
// Mode overrides are optional: a token that uses light-dark() needs no block.
const overrides = parseTokens(blockOrNull("html[data-theme='dark']") ?? '')

const hexToRgb = (hex) => {
  const text = hex.trim()
  if (text.startsWith('#')) {
    const value = text.slice(1)
    if (value.length === 3) return value.split('').map((c) => parseInt(c + c, 16))
    return [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((c) => parseInt(c, 16))
  }
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\)/.exec(text)
  if (!match) throw new Error(`Cannot parse color ${text}`)
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])]
}
const composite = (fg, bg) => {
  const foreground = hexToRgb(fg)
  const background = hexToRgb(bg)
  const alpha = foreground[3] ?? 1
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
    1
  ]
}
const luminance = (rgb) => {
  const values = rgb.slice(0, 3).map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}
const ratio = (fg, bg) => {
  const foreground = alpha(fg) === 1 ? hexToRgb(fg) : composite(fg, bg)
  const background = hexToRgb(bg)
  const l1 = luminance(foreground)
  const l2 = luminance(background)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
const alpha = (color) => hexToRgb(color)[3] ?? 1

const pairs = [
  ['text', 'bg', 4.5, 'body on page'],
  ['text', 'surface', 4.5, 'body on surface'],
  ['text', 'surface-2', 4.5, 'body on surface 2'],
  ['text', 'rail', 4.5, 'body on rail'],
  ['text-muted', 'surface', 4.5, 'meta on surface'],
  ['text-muted', 'bg', 4.5, 'meta on page'],
  ['text-muted', 'surface-2', 4.5, 'meta on surface 2'],
  ['text-faint', 'surface', 4.5, 'faint label on surface'],
  ['text-faint', 'bg', 4.5, 'faint label on page'],
  ['text-faint', 'rail', 4.5, 'faint label on rail'],
  ['accent', 'surface', 4.5, 'links on surface'],
  ['accent', 'accent-soft', 4.5, 'active rail item'],
  ['on-primary', 'primary', 4.5, 'primary button'],
  ['on-primary', 'primary-hover', 4.5, 'primary hover'],
  ['danger', 'surface', 4.5, 'errors on surface'],
  ['danger', 'bg', 4.5, 'errors on page'],
  ['warning', 'surface', 4.5, 'warnings on surface'],
  ['success', 'surface', 4.5, 'success text on surface'],
  ['canvas-text', 'canvas', 4.5, 'canvas labels'],
  ['canvas-muted', 'canvas', 4.5, 'canvas meta'],
  ['canvas-text', 'scrim', 4.5, 'canvas text on scrim'],
  ['text', 'warning-soft', 4.5, 'banner text on warning tint'],
  ['text', 'danger-soft', 4.5, 'banner text on danger tint'],
  ['text', 'accent-soft', 4.5, 'selected history row'],
  ['text-muted', 'accent-soft', 4.5, 'selected history row meta'],
  ['danger', 'danger-soft', 4.5, 'failed history badge on danger tint'],
  ['accent', 'surface-2', 4.5, 'accent on surface 2'],
  ['focus', 'surface', 3, 'focus ring'],
  ['focus', 'bg', 3, 'focus ring on page'],
  ['warning', 'surface', 3, 'warning icons']
]

function themeTokensFor(theme) {
  const tokens = new Map()
  for (const source of [theme.tokens, theme.localTokens]) {
    for (const [name, value] of Object.entries(source ?? {})) tokens.set(name, splitLightDark(value))
  }
  return tokens
}

function resolve(raw, themeTokens, seen = new Set()) {
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw.trim())
  if (!alias) return splitLightDark(raw)
  const target = alias[1]
  if (seen.has(target)) throw new Error(`Circular token alias: ${[...seen, target].join(' -> ')}`)
  const local = rootTokens[target]
  if (local !== undefined) return resolve(local, themeTokens, new Set([...seen, target]))
  const resolved = themeTokens.get(target)
  if (!resolved) {
    throw new Error(`tokens.css aliases ${target}, which neither tokens.css nor the theme defines`)
  }
  return resolved
}

const hexColor = /^#[\da-fA-F]{3,8}$|^rgba?\(/
function validateColor(value, label) {
  if (!hexColor.test(value.trim())) throw new Error(`${label} is not a colour: ${value}`)
}

let failures = 0
for (const id of THEME_IDS) {
  const mode = THEME_MODES[id]
  const themeModule = await import(builtPath(id).href)
  const theme = Object.values(themeModule).find(
    (value) => value && typeof value === 'object' && value.__built === true && value.name === id
  )
  if (!theme) {
    console.error(`${id}: no compiled theme named "${id}" in built/${id}.js`)
    failures += 1
    continue
  }
  const themeTokens = themeTokensFor(theme)

  const light = {}
  const dark = {}
  for (const [name, raw] of Object.entries(rootTokens)) {
    const value = resolve(raw, themeTokens)
    light[name.slice(2)] = value.light
    dark[name.slice(2)] = value.dark
  }
  for (const [name, raw] of Object.entries(overrides)) {
    dark[name.slice(2)] = resolve(raw, themeTokens).dark
  }
  const tokens = mode === 'dark' ? dark : light

  let themeFailures = 0
  let pairFailures = 0
  for (const [fgToken, bgToken, minimum, label] of pairs) {
    const fg = tokens[fgToken]
    const bg = tokens[bgToken]
    if (!fg || !bg) {
      console.error(`${id} (${mode}): missing ${fgToken} or ${bgToken}`)
      pairFailures += 1
      continue
    }
    let effectiveBg = bg
    if (alpha(bg) < 1) {
      const base = tokens[bgToken === 'scrim' ? 'canvas' : 'surface']
      const composited = composite(bg, base)
      effectiveBg = `rgb(${composited[0]}, ${composited[1]}, ${composited[2]})`
    }
    const value = ratio(fg, effectiveBg)
    if (value < minimum) {
      pairFailures += 1
      console.error(
        `FAIL ${id.padEnd(10)} ${mode.padEnd(5)} ${value.toFixed(2).padStart(5)} (need ${minimum}) ${fgToken} on ${bgToken} - ${label}`
      )
    }
  }
  // A malformed value would silently skip a pair, so every reported token must
  // still parse as a colour.
  for (const name of ['text', 'bg', 'surface', 'rail', 'accent', 'primary', 'canvas']) {
    try {
      validateColor(tokens[name], `${id} ${name}`)
    } catch (error) {
      console.error(String(error))
      themeFailures += 1
    }
  }
  failures += pairFailures + themeFailures
  console.log(
    `${pairFailures || themeFailures ? 'FAIL' : 'PASS'} ${id.padEnd(10)} ${mode.padEnd(5)} ${pairs.length - pairFailures}/${pairs.length} pairs`
  )
}
if (failures) {
  console.error(`\n${failures} contrast pair(s) failed.`)
  process.exit(1)
}
console.log(`\nAll token pairs pass AA across ${THEME_IDS.length} themes.`)
