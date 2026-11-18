import { RadioList, RadioListItem } from '@astryxdesign/core'
import { Theme } from '@astryxdesign/core/theme'
import { THEME_IDS, THEME_LABELS, THEME_MODES } from '@shared/themes'
import type { ThemeId } from '@shared/themes'
import { THEMES } from '../../theme/themes'

/**
 * The appearance picker: one radio row per compiled theme, two columns so the
 * five light looks sit beside the five dark ones.
 *
 * Each row renders its preview inside its own nested Astryx `Theme`, so the
 * swatch uses the real tokens and no colour is repeated in this file. Radio
 * semantics come from `RadioList`; the preview is decorative and hidden from
 * assistive tech, leaving the theme name as the radio's name.
 */
export function ThemePicker({
  value,
  onChange
}: {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}): React.JSX.Element {
  return (
    <RadioList
      label="Theme"
      isLabelHidden
      // `styles/index.css` turns the radio group into a two-column grid; the
      // catalog order fills the light column first, then the dark one.
      controlClassName="theme-picker"
      value={value}
      onChange={(next) => {
        // RadioList speaks string values; the options are the theme ids.
        onChange(next as ThemeId)
      }}
    >
      {THEME_IDS.map((id) => (
        <RadioListItem
          key={id}
          value={id}
          label={THEME_LABELS[id]}
          description={THEME_MODES[id] === 'light' ? 'Light' : 'Dark'}
          startContent={
            <Theme theme={THEMES[id]} mode={THEME_MODES[id]}>
              <span className="theme-preview" aria-hidden="true">
                <span className="theme-preview-rail" />
                <span className="theme-preview-page">
                  <span className="theme-preview-card">
                    <span className="theme-preview-line" />
                    <span className="theme-preview-line theme-preview-line-short" />
                  </span>
                  <span className="theme-preview-actions">
                    <span className="theme-preview-accent" />
                    <span className="theme-preview-primary" />
                  </span>
                </span>
              </span>
            </Theme>
          }
        />
      ))}
    </RadioList>
  )
}
