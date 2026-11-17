import type { Shape } from '@shared/types'
import { SHAPE_PRESETS } from '@shared/shapes'

const HINTS: Record<Shape, string> = {
  square: '1:1 · Storefront',
  portrait: '2:3 · Social',
  landscape: '3:2 · Banner'
}

export function ShapePicker({
  value,
  onChange
}: {
  value: Shape
  onChange: (shape: Shape) => void
}): React.JSX.Element {
  return (
    <div className="shape-picker" role="radiogroup" aria-label="Shape">
      {SHAPE_PRESETS.map((preset) => {
        const selected = preset.id === value
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className="shape-option"
            data-selected={selected}
            onClick={() => onChange(preset.id)}
          >
            <span className="shape-icon-wrap" aria-hidden>
              <span className="shape-icon" style={{ aspectRatio: preset.ratio }} />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-[12px] font-semibold">{preset.label}</span>
              <span className="meta block whitespace-nowrap">{HINTS[preset.id]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
