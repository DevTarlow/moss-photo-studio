import { useState } from 'react'
import { Crop, FlipHorizontal, FlipVertical, Loader2, Redo2, RotateCcw, RotateCw, Sparkles, Undo2 } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { AdjustTransform } from '@shared/types'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { IconButton } from '../../components/ui/IconButton'

const ASPECTS = [
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: 'free', label: 'Free', ratio: 'free' }
] as const

function Slider({
  label,
  value,
  onChange,
  onBegin,
  min = -100,
  max = 100
}: {
  label: string
  value: number
  onChange: (value: number) => void
  onBegin: () => void
  min?: number
  max?: number
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium" htmlFor={`slider-${label}`}>{label}</label>
        <button type="button" className="tabular text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => { onBegin(); onChange(0) }} aria-label={`Reset ${label}, ${value > 0 ? '+' : ''}${value}`}>
          {value > 0 ? '+' : ''}{value}
        </button>
      </div>
      <input
        id={`slider-${label}`}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        className="slider"
        aria-label={label}
        onPointerDown={onBegin}
        onDoubleClick={() => { onBegin(); onChange(0) }}
        onChange={(event) => onChange(Number(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === '[' || event.key === ']') {
            event.preventDefault()
            onBegin()
            onChange(Math.max(min, Math.min(max, value + (event.key === ']' ? 1 : -1))))
          } else if (event.key === '0') {
            event.preventDefault()
            onBegin()
            onChange(0)
          }
        }}
      />
    </div>
  )
}

export function AdjustPanel({
  transform,
  width,
  height,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChange,
  onChangeWithHistory,
  onBegin,
  onResetAll,
  batchCount,
  batchBusy,
  onApplyBatch,
  labelBusy,
  onAddSizeLabel
}: {
  transform: AdjustTransform
  width: number | null
  height: number | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onChange: (next: AdjustTransform) => void
  onChangeWithHistory: (next: AdjustTransform) => void
  onBegin: () => void
  onResetAll: () => void
  batchCount: number
  batchBusy: boolean
  onApplyBatch: () => void
  labelBusy: boolean
  onAddSizeLabel: (width: number, height: number, unit: 'cm' | 'in') => void
}): React.JSX.Element {
  const [sizeWidth, setSizeWidth] = useState('')
  const [sizeHeight, setSizeHeight] = useState('')
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'in'>('cm')
  const currentAspect = (() => {
    if (!transform.crop || !width || !height) return 'original'
    const ratio = (transform.crop.width * width) / (transform.crop.height * height)
    const found = ASPECTS.find((aspect) => typeof aspect.ratio === 'number' && Math.abs(aspect.ratio - ratio) < 0.02)
    return found?.id ?? 'free'
  })()

  const setAspect = (ratio: number | null | 'free'): void => {
    if (!width || !height) return
    if (!ratio) {
      const next = { ...transform }
      delete next.crop
      onChangeWithHistory(next)
      return
    }
    if (ratio === 'free') {
      onChangeWithHistory({
        ...transform,
        crop: transform.crop ?? { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }
      })
      return
    }
    const imageRatio = width / height
    let cropWidth = 1
    let cropHeight = 1
    if (imageRatio > ratio) cropWidth = ratio / imageRatio
    else cropHeight = imageRatio / ratio
    onChangeWithHistory({
      ...transform,
      crop: {
        x: (1 - cropWidth) / 2,
        y: (1 - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
      }
    })
  }

  const patch = (next: Partial<AdjustTransform>): AdjustTransform => ({ ...transform, ...next })

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Local adjust</p>
        <div className="flex items-center gap-1">
          <IconButton label="Undo" disabled={!canUndo} onClick={onUndo}><Icon icon={Undo2} size="sm" /></IconButton>
          <IconButton label="Redo" disabled={!canRedo} onClick={onRedo}><Icon icon={Redo2} size="sm" /></IconButton>
        </div>
      </div>
      <p className="hint mt-1">Free. Done on this computer. The original stays untouched.</p>

      <section className="mt-5">
        <div className="flex items-center gap-2">
          <Icon icon={Crop} size="sm" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-[12px] font-semibold">Crop</h3>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ASPECTS.map((aspect) => (
            <Chip key={aspect.id} selected={currentAspect === aspect.id} onClick={() => setAspect(aspect.ratio)}>{aspect.label}</Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>Drag the corners to crop. Use the arrow keys for fine control.</p>
      </section>

      <section className="mt-5">
        <h3 className="text-[12px] font-semibold">Rotate and flip</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onChangeWithHistory({ ...transform, rotate: (((transform.rotate ?? 0) + 270) % 360) as AdjustTransform['rotate'] })}>
            <Icon icon={RotateCcw} size="sm" /> Left
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onChangeWithHistory({ ...transform, rotate: (((transform.rotate ?? 0) + 90) % 360) as AdjustTransform['rotate'] })}>
            <Icon icon={RotateCw} size="sm" /> Right
          </Button>
          <IconButton label="Flip horizontal" active={transform.flipH} onClick={() => onChangeWithHistory(patch({ flipH: !transform.flipH }))}>
            <Icon icon={FlipHorizontal} size="sm" />
          </IconButton>
          <IconButton label="Flip vertical" active={transform.flipV} onClick={() => onChangeWithHistory(patch({ flipV: !transform.flipV }))}>
            <Icon icon={FlipVertical} size="sm" />
          </IconButton>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <h3 className="text-[12px] font-semibold">Light and color</h3>
        <Slider label="Brightness" value={transform.brightness ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ brightness: value }))} />
        <Slider label="Contrast" value={transform.contrast ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ contrast: value }))} />
        <Slider label="Saturation" value={transform.saturation ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ saturation: value }))} />
        <Slider label="Warmth" value={transform.warmth ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ warmth: value }))} />
        <Slider label="Sharpen" min={0} max={100} value={transform.sharpen ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ sharpen: value }))} />
        <Slider label="Vignette" min={0} max={100} value={transform.vignette ?? 0} onBegin={onBegin} onChange={(value) => onChange(patch({ vignette: value }))} />
      </section>

      {batchCount > 1 && (
        <div className="mt-5 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[12px] font-semibold">Apply these adjustments to every version</p>
          <p className="hint mt-1">Creates a new local version of each of the {batchCount} ready images. Crop, rotate, and flips stay on this image.</p>
          <Button variant="secondary" size="sm" className="mt-2" disabled={batchBusy} onClick={onApplyBatch}>
            {batchBusy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Sparkles} size="sm" />} Apply to {batchCount} Images
          </Button>
        </div>
      )}

      <section className="mt-5 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-[12px] font-semibold">Size label</h3>
        <p className="hint mt-1">Add a clean size badge as a new local version. The product stays untouched.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <input
            className="field"
            inputMode="decimal"
            aria-label="Width"
            placeholder="Width"
            value={sizeWidth}
            onChange={(event) => setSizeWidth(event.target.value)}
          />
          <input
            className="field"
            inputMode="decimal"
            aria-label="Height"
            placeholder="Height"
            value={sizeHeight}
            onChange={(event) => setSizeHeight(event.target.value)}
          />
          <select className="field" aria-label="Size unit" value={sizeUnit} onChange={(event) => setSizeUnit(event.target.value as 'cm' | 'in')}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={labelBusy || !(Number(sizeWidth) > 0) || !(Number(sizeHeight) > 0)}
          onClick={() => onAddSizeLabel(Number(sizeWidth), Number(sizeHeight), sizeUnit)}
        >
          {labelBusy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Add Size Label
        </Button>
      </section>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onResetAll}>Reset All</Button>
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Apply creates a new version.</p>
      </div>
    </div>
  )
}
