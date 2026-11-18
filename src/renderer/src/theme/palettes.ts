import type { TokenName, TokenValue } from '@astryxdesign/core/theme'
import type { ThemeId } from '../../../shared/themes'

/**
 * The ten Moss palettes. Every value here is a colour the theme owns; the
 * mode-only values (status colours, overlays) live in `themeBase.ts`.
 *
 * `moss` and `moss-night` are byte-for-byte the light and dark palettes the app
 * shipped with, so switching the picker does not move the look people already
 * chose. The rest are earthy variations around the same paper, ink, and
 * vegetable-dye family.
 *
 * `npm run audit:tokens` is the gate: every foreground/background pair the app
 * renders must clear WCAG AA in the palette's own mode. Tune a value that
 * fails; do not drop the theme.
 */
export interface Palette {
  /** Page background. */
  body: string
  /** Card, popover and sheet surface. */
  surface: string
  /** Muted surface: skeletons, table headers, sunken rows. */
  muted: string
  /** The navigation rail, its own surface. */
  rail: string

  text: string
  textSecondary: string
  textDisabled: string

  border: string
  borderEmphasized: string

  /** Selection and links. */
  accent: string
  /** Selection tint for nav rows and chips. */
  accentMuted: string
  /** Selection tint the custom layer paints over a surface. */
  accentSoft: string
  onAccent: string

  /** The burnt/earth call to action. */
  primary: string
  primaryHover: string
  onPrimary: string

  /** The editor stage stays near-black in every theme. */
  canvas: string
  canvasText: string
  canvasMuted: string
}

export const PALETTES: Record<ThemeId, Palette> = {
  moss: {
    body: '#FAF7F2',
    surface: '#FFFFFF',
    muted: '#F4EFE6',
    rail: '#F2EDE4',
    text: '#1C1A17',
    textSecondary: '#5C574E',
    textDisabled: '#6E675B',
    border: '#E4DCCF',
    borderEmphasized: '#D3C8B6',
    accent: '#14532D',
    accentMuted: '#DCEFE2',
    accentSoft: 'rgba(20,83,45,0.10)',
    onAccent: '#FFFFFF',
    primary: '#9A3412',
    primaryHover: '#7C2D12',
    onPrimary: '#FFFFFF',
    canvas: '#20201C',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  sand: {
    body: '#F7F1E2',
    surface: '#FFFCF4',
    muted: '#F0E7D2',
    rail: '#F1E8D3',
    text: '#211C11',
    textSecondary: '#5F5741',
    textDisabled: '#6E6550',
    border: '#E3D8BD',
    borderEmphasized: '#D2C4A4',
    accent: '#4F5B2A',
    accentMuted: '#E4E8D2',
    accentSoft: 'rgba(79,91,42,0.12)',
    onAccent: '#FFFFFF',
    primary: '#8A4A12',
    primaryHover: '#6E3A0D',
    onPrimary: '#FFFFFF',
    canvas: '#211C14',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  clay: {
    body: '#F8EFE9',
    surface: '#FFFBF8',
    muted: '#F2E4DA',
    rail: '#F2E4DA',
    text: '#241814',
    textSecondary: '#63483D',
    textDisabled: '#756055',
    border: '#E7D3C6',
    borderEmphasized: '#D8BEAE',
    accent: '#6B3A22',
    accentMuted: '#EDDACF',
    accentSoft: 'rgba(107,58,34,0.12)',
    onAccent: '#FFFFFF',
    primary: '#A33A12',
    primaryHover: '#85300E',
    onPrimary: '#FFFFFF',
    canvas: '#211712',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  lichen: {
    body: '#F1F4ED',
    surface: '#FBFDF9',
    muted: '#E7EDE1',
    rail: '#E7EDE1',
    text: '#1B2119',
    textSecondary: '#55604F',
    textDisabled: '#5C6854',
    border: '#D6E0CF',
    borderEmphasized: '#C3D0BA',
    accent: '#3F5A3C',
    accentMuted: '#DCE8D7',
    accentSoft: 'rgba(63,90,60,0.12)',
    onAccent: '#FFFFFF',
    primary: '#7A3E1D',
    primaryHover: '#633116',
    onPrimary: '#FFFFFF',
    canvas: '#1A2118',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  stone: {
    body: '#F2F2EF',
    surface: '#FCFCFA',
    muted: '#E9E9E4',
    rail: '#E9E9E4',
    text: '#1C1E1D',
    textSecondary: '#555C5B',
    textDisabled: '#596462',
    border: '#DCDDDA',
    borderEmphasized: '#C9CBC7',
    accent: '#44585F',
    accentMuted: '#DCE4E6',
    accentSoft: 'rgba(68,88,95,0.12)',
    onAccent: '#FFFFFF',
    primary: '#8A3F1F',
    primaryHover: '#713218',
    onPrimary: '#FFFFFF',
    canvas: '#191C1D',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  'moss-night': {
    body: '#131610',
    surface: '#0C0E09',
    muted: '#1A2016',
    rail: '#0E110B',
    text: '#E9E4D6',
    textSecondary: '#B9B3A2',
    textDisabled: '#8F8A7C',
    border: 'rgba(200,190,160,0.18)',
    borderEmphasized: 'rgba(200,190,160,0.30)',
    accent: '#86C79A',
    accentMuted: '#1E3A26',
    accentSoft: 'rgba(134,199,154,0.14)',
    onAccent: '#0C0E09',
    primary: '#B45309',
    primaryHover: '#9A3412',
    onPrimary: '#FFFFFF',
    canvas: '#0B0B09',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  bark: {
    body: '#17120E',
    surface: '#100C09',
    muted: '#211A14',
    rail: '#120E0A',
    text: '#EDE4D6',
    textSecondary: '#C2B39F',
    textDisabled: '#948674',
    border: 'rgba(214,196,168,0.20)',
    borderEmphasized: 'rgba(214,196,168,0.32)',
    accent: '#C9A87C',
    accentMuted: '#33261B',
    accentSoft: 'rgba(201,168,124,0.14)',
    onAccent: '#17120E',
    primary: '#A8571F',
    primaryHover: '#8A4415',
    onPrimary: '#FFFFFF',
    canvas: '#0B0907',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  pine: {
    body: '#0F1A14',
    surface: '#0A120E',
    muted: '#16251C',
    rail: '#0B140F',
    text: '#DDE8DC',
    textSecondary: '#AFC0AE',
    textDisabled: '#84958A',
    border: 'rgba(180,205,185,0.18)',
    borderEmphasized: 'rgba(180,205,185,0.30)',
    accent: '#8FBF9A',
    accentMuted: '#1C3324',
    accentSoft: 'rgba(143,191,154,0.14)',
    onAccent: '#0F1A14',
    primary: '#8E5522',
    primaryHover: '#74451A',
    onPrimary: '#FFFFFF',
    canvas: '#080F0B',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  ember: {
    body: '#1B1512',
    surface: '#14100E',
    muted: '#251C17',
    rail: '#171110',
    text: '#EFE3D8',
    textSecondary: '#C6B4A6',
    textDisabled: '#97877C',
    border: 'rgba(230,205,185,0.18)',
    borderEmphasized: 'rgba(230,205,185,0.30)',
    accent: '#E0A458',
    accentMuted: '#3A2A1C',
    accentSoft: 'rgba(224,164,88,0.14)',
    onAccent: '#1B1512',
    primary: '#A8431A',
    primaryHover: '#8A3614',
    onPrimary: '#FFFFFF',
    canvas: '#0C0908',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  },
  basalt: {
    body: '#151A1C',
    surface: '#101416',
    muted: '#1D2427',
    rail: '#111619',
    text: '#E3E8E8',
    textSecondary: '#AEB9BA',
    textDisabled: '#889496',
    border: 'rgba(196,215,218,0.18)',
    borderEmphasized: 'rgba(196,215,218,0.30)',
    accent: '#8FB4B0',
    accentMuted: '#1F3230',
    accentSoft: 'rgba(143,180,176,0.14)',
    onAccent: '#151A1C',
    primary: '#9C5F2A',
    primaryHover: '#7F4B1F',
    onPrimary: '#FFFFFF',
    canvas: '#090D0E',
    canvasText: '#FFFFFF',
    canvasMuted: 'rgba(255,255,255,0.80)'
  }
}

type TokenOverrides = Partial<Record<TokenName, TokenValue>>

/** The theme overrides one palette needs, split into Astryx and theme-local tokens. */
export function palette(id: ThemeId): {
  tokens: TokenOverrides
  localTokens: Record<string, TokenValue>
} {
  const value = PALETTES[id]
  return {
    tokens: {
      '--color-background-body': value.body,
      '--color-background-surface': value.surface,
      '--color-background-card': value.surface,
      '--color-background-popover': value.surface,
      '--color-background-muted': value.muted,
      '--color-skeleton': value.muted,
      '--color-accent': value.accent,
      '--color-accent-muted': value.accentMuted,
      '--color-text-accent': value.accent,
      '--color-icon-accent': value.accent,
      '--color-on-accent': value.onAccent,
      '--color-text-primary': value.text,
      '--color-text-secondary': value.textSecondary,
      '--color-text-disabled': value.textDisabled,
      '--color-icon-primary': value.text,
      '--color-icon-secondary': value.textSecondary,
      '--color-icon-disabled': value.textDisabled,
      '--color-border': value.border,
      '--color-border-emphasized': value.borderEmphasized
    },
    localTokens: {
      '--moss-primary': value.primary,
      '--moss-primary-hover': value.primaryHover,
      '--moss-primary-text': value.onPrimary,
      '--moss-canvas': value.canvas,
      '--moss-canvas-text': value.canvasText,
      '--moss-canvas-muted': value.canvasMuted,
      '--moss-rail': value.rail,
      '--moss-accent-soft': value.accentSoft
    }
  }
}
