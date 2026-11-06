#!/usr/bin/env node
/**
 * Contrast audit for the design tokens, across every foreground/background
 * pair the app actually renders. Fails at WCAG AA: 4.5 for body text, 3 for
 * large text and icons.
 */
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve('src/renderer/src/styles/tokens.css'), 'utf8')
function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`)
  const match = pattern.exec(css)
  if (!match) throw new Error(`Missing token block ${selector}`)
  return match[1]
}
function parseTokens(body) {
  const tokens = {}
  for (const line of body.split('\n')) {
    const match = /--([\w-]+)\s*:\s*([^;]+);/.exec(line)
    if (match) tokens[match[1]] = match[2].trim()
  }
  return tokens
}
const light = parseTokens(block(':root'))
const dark = { ...light, ...parseTokens(block("html[data-theme='dark']")) }

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
  ['accent', 'surface-2', 4.5, 'accent on surface 2'],
  ['focus', 'surface', 3, 'focus ring'],
  ['focus', 'bg', 3, 'focus ring on page'],
  ['warning', 'surface', 3, 'warning icons']
]

let failures = 0
for (const [themeName, tokens] of [['light', light], ['dark', dark]]) {
  for (const [fgToken, bgToken, minimum, label] of pairs) {
    const fg = tokens[fgToken]
    const bg = tokens[bgToken]
    if (!fg || !bg) {
      console.error(`${themeName}: missing ${fgToken} or ${bgToken}`)
      failures += 1
      continue
    }
    let effectiveBg = bg
    if (alpha(bg) < 1) {
      const base = tokens[bgToken === 'scrim' ? 'canvas' : 'surface']
      const composited = composite(bg, base)
      effectiveBg = `rgb(${composited[0]}, ${composited[1]}, ${composited[2]})`
    }
    const value = ratio(fg, effectiveBg)
    const pass = value >= minimum
    if (!pass) failures += 1
    console.log(`${pass ? 'PASS' : 'FAIL'} ${themeName.padEnd(5)} ${value.toFixed(2).padStart(5)} (need ${minimum}) ${fgToken} on ${bgToken} - ${label}`)
  }
}
if (failures) {
  console.error(`\n${failures} contrast pair(s) failed.`)
  process.exit(1)
}
console.log('\nAll token pairs pass AA.')
