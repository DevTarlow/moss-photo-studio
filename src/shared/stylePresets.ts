export interface StylePreset {
  id: string
  label: string
  clause: string
}

export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: 'none',
    label: 'No default look',
    clause: ''
  },
  {
    id: 'studio',
    label: 'Clean studio',
    clause: ' Keep the setting clean and studio-like, with soft, even light and only the props the shot needs.'
  },
  {
    id: 'warm_home',
    label: 'Warm home',
    clause: ' Keep the setting warm and lived-in, with soft daylight, natural textures, and a calm home atmosphere.'
  },
  {
    id: 'minimal',
    label: 'Quiet minimal',
    clause: ' Keep the setting quiet and minimal, with generous empty space, soft neutral tones, and very few props.'
  },
  {
    id: 'natural',
    label: 'Natural light',
    clause: ' Keep the setting natural and unstyled, with soft daylight from one side and honest, everyday materials.'
  },
  {
    id: 'dramatic',
    label: 'Moody',
    clause: ' Keep the setting moody and directional, with deeper shadows, a dark background, and one clear light source.'
  }
] as const

export function styleClause(id: string | null | undefined): string {
  return STYLE_PRESETS.find((preset) => preset.id === id)?.clause ?? ''
}
