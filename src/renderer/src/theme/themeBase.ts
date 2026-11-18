import { defineTheme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'

/**
 * The structure every Moss theme shares: type, motion, radii, elevation, the
 * semantic status colours, and the component overrides.
 *
 * Palettes (surfaces, ink, borders, selection, the primary action, the editor
 * canvas, the rail) live in `palettes.ts`; each theme in `themes/` extends this
 * base, points at its palette, and is compiled by `npm run theme:build`.
 *
 * Status colours stay here so warning and error read the same in every look.
 * They (and the overlays) keep their `light-dark()` tuples, so a fixed-mode
 * theme still gets the correct side through `<Theme mode>`.
 */
export const themeBase = defineTheme({
  name: 'moss-base',
  extends: neutralTheme,
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: 'Inter',
      fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    },
    heading: {
      family: 'Plus Jakarta Sans',
      fallbacks: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      weights: { 3: 'bold', 4: 'bold' }
    },
    code: {
      family: 'ui-monospace',
      fallbacks: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    }
  },
  motion: { fast: 120, medium: 240, slow: 400, ratio: 0.75 },
  localTokens: {
    '--moss-primary': ['#9A3412', '#B45309'],
    // Dark hover goes deeper, not brighter: white on #D97706 is 3.19:1, below AA.
    '--moss-primary-hover': ['#7C2D12', '#9A3412'],
    '--moss-primary-text': '#FFFFFF',
    '--moss-canvas': ['#20201C', '#0B0B09'],
    '--moss-canvas-text': '#FFFFFF',
    '--moss-canvas-muted': ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.80)'],
    '--moss-rail': ['#F2EDE4', '#0E110B'],
    '--moss-accent-soft': ['rgba(20,83,45,0.10)', 'rgba(134,199,154,0.14)']
  },
  tokens: {
    '--color-overlay': ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.55)'],
    '--color-overlay-hover': ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'],
    '--color-overlay-pressed': ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.10)'],
    '--color-shadow': ['rgba(20,18,14,0.28)', 'rgba(0,0,0,0.60)'],
    '--color-tint-hover': ['#000000', '#FFFFFF'],

    '--color-success': ['#14532D', '#86C79A'],
    '--color-error': ['#B91C1C', '#FCA5A5'],
    '--color-warning': ['#B45309', '#E0A458'],
    '--color-info': ['#3E6B8A', '#9CC7E8'],
    '--color-success-muted': ['rgba(20,83,45,0.10)', 'rgba(134,199,154,0.14)'],
    '--color-error-muted': ['rgba(185,28,28,0.10)', 'rgba(252,165,165,0.12)'],
    '--color-warning-muted': ['rgba(180,83,9,0.10)', 'rgba(224,164,88,0.14)'],
    '--color-info-muted': ['rgba(62,107,138,0.10)', 'rgba(156,199,232,0.16)'],
    '--color-text-success': ['#14532D', '#86C79A'],
    '--color-text-error': ['#B91C1C', '#FCA5A5'],
    '--color-text-warning': ['#8A4B08', '#E0A458'],
    '--color-text-info': ['#2F5A75', '#B8D9EF'],

    '--radius-inner': '6px',
    '--radius-element': '8px',
    '--radius-container': '12px',
    '--radius-page': '16px',

    '--shadow-low': '0 2px 4px rgba(20,18,14,0.06), 0 4px 12px -8px rgba(20,18,14,0.24)',
    '--shadow-med': '0 12px 32px -12px rgba(20,18,14,0.28)',
    '--shadow-high': '0 18px 44px -16px rgba(20,18,14,0.36)'
  },
  components: {
    button: {
      'variant:primary': {
        backgroundColor: 'var(--moss-primary)',
        color: 'var(--moss-primary-text)',
        ':hover': { backgroundColor: 'var(--moss-primary-hover)' }
      }
    },
    'side-nav-item': {
      selected: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-text-accent)'
      }
    },
    'app-shell-header': {
      base: { padding: '0', backgroundColor: 'var(--color-background-body)' }
    },
    'app-shell-sidenav': {
      // The rail is its own product surface, not the page background.
      base: { backgroundColor: 'var(--rail)' }
    },
    'top-nav': {
      base: { backgroundColor: 'transparent', borderWidth: '0' }
    },
    card: {
      base: {
        borderRadius: 'var(--radius-container)'
      }
    }
  }
})
