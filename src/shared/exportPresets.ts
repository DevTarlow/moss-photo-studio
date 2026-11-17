export type ExportPreset = 'original' | 'square' | 'portrait'

export interface ExportPresetOption {
  id: ExportPreset
  label: string
  hint: string
  width: number | null
  height: number | null
}

/**
 * Practical batch presets for a Set. `original` keeps each source file at its
 * own size; the framed presets centre-crop to a common output so a Set can be
 * used as a storefront grid or a social collection.
 */
export const EXPORT_PRESETS: readonly ExportPresetOption[] = [
  {
    id: 'original',
    label: 'Original',
    hint: 'Full-size files in a folder',
    width: null,
    height: null
  },
  {
    id: 'square',
    label: 'Square 1:1',
    hint: '1600 × 1600 · storefront grid',
    width: 1600,
    height: 1600
  },
  {
    id: 'portrait',
    label: 'Portrait 4:5',
    hint: '1600 × 2000 · social and listings',
    width: 1600,
    height: 2000
  }
]

export function exportPresetById(id: ExportPreset | undefined): ExportPresetOption | undefined {
  return EXPORT_PRESETS.find((preset) => preset.id === id)
}
