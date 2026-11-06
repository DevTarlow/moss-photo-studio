import type { ThemeSetting } from '@shared/types'

export function applyThemeToDocument(theme: ThemeSetting): void {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.dataset.theme = resolved
}
