import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Brand } from '@shared/types'
import { exampleUrl } from '../../lib/assets'
import { Button } from '../ui/Button'
import { Dropzone } from '../ui/Dropzone'
import { Field } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { unwrap, messageOf } from '../../lib/ipc'
import { fileToBytes } from '../../lib/files'
import { toast } from '../../lib/toast'

const MAX_COLORS = 6
const CORNERS = [
  { value: 'br', label: 'Bottom right' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'tr', label: 'Top right' },
  { value: 'tl', label: 'Top left' }
] as const

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function BrandPreview({ brand }: { brand: Brand }): React.JSX.Element {
  const size = brand.badgeScale === 's' ? '8%' : brand.badgeScale === 'l' ? '18%' : '12%'
  return (
    <div className="brand-preview">
      <img src={exampleUrl('product')} alt="" className="sample" />
      {brand.badgeEnabled && brand.logoUrl && (
        <img
          src={brand.logoUrl}
          alt=""
          className="brand-badge"
          data-corner={brand.badgeCorner}
          style={{ ['--badge-size' as string]: size, ['--badge-opacity' as string]: brand.badgeOpacity / 100 } as React.CSSProperties}
        />
      )}
    </div>
  )
}

export function BrandFields({
  value,
  onChange,
  maxColors = MAX_COLORS
}: {
  value: Brand
  onChange: (brand: Brand) => void
  maxColors?: number
}): React.JSX.Element {
  const [newColor, setNewColor] = useState(cssColor('--accent'))
  const [hex, setHex] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)

  const patch = (next: Partial<Brand>): void => onChange({ ...value, ...next })

  const addColorValue = (color: string): boolean => {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      toast.error('Enter a six-digit color, like a hex value.')
      return false
    }
    if (value.colors.length >= maxColors) {
      toast.error(`Up to ${maxColors} colors can be saved.`)
      return false
    }
    if (!value.colors.some((entry) => entry.toLowerCase() === color.toLowerCase())) {
      patch({ colors: [...value.colors, color] })
    }
    return true
  }

  const addColor = (): void => {
    if (addColorValue(hex.trim() || newColor)) setHex('')
  }

  const chooseLogo = async (): Promise<void> => {
    setLogoBusy(true)
    try {
      const brand = await unwrap(window.moss.brand.chooseLogo())
      if (brand) patch({ logoUrl: brand.logoUrl })
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setLogoBusy(false)
    }
  }

  const dropLogo = async (file: File): Promise<void> => {
    setLogoBusy(true)
    try {
      await unwrap(window.moss.brand.setLogo({ bytes: await fileToBytes(file), mime: file.type }))
      const brand = await unwrap(window.moss.brand.get())
      patch({ logoUrl: brand.logoUrl })
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setLogoBusy(false)
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <div>
          <p className="field-label">Colors <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
          <p className="hint mb-2">Up to {maxColors} saved. The first {Math.min(3, maxColors)} steer backgrounds and props when the studio makes a set or changes a photo. They never tint the product.</p>
          <div className="flex flex-wrap items-center gap-2">
            {value.colors.map((color, index) => (
              <span key={color} className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2" style={{ borderColor: 'var(--border)' }}>
                <span className="color-dot" style={{ background: color }} aria-hidden />
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{color}</span>
                {index < 3 && <span className="badge pill-sm">Used</span>}
                <button type="button" className="icon-btn h-5 w-5" aria-label={`Remove ${color}`} onClick={() => patch({ colors: value.colors.filter((entry) => entry !== color) })}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
            {value.colors.length === 0 && <p className="meta">No colors yet.</p>}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input
              type="color"
              aria-label="Pick a brand color"
              value={/^#[0-9a-fA-F]{6}$/.test(newColor) ? newColor : cssColor('--text')}
              onChange={(event) => {
                setNewColor(event.target.value)
                setHex(event.target.value)
              }}
              className="h-[34px] w-[42px] cursor-pointer rounded border p-0.5"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            />
            <div className="w-[120px]">
              <Field
                label="Hex"
                value={hex}
                onChange={(event) => setHex(event.target.value)}
                placeholder="RRGGBB"
                maxLength={7}
                className="font-mono"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={addColor} disabled={value.colors.length >= maxColors}>
              <Plus size={14} /> Add Color
            </Button>
          </div>
        </div>

        <div>
          <p className="field-label">Logo <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
          {value.logoUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--border)' }}>
              <img src={value.logoUrl} alt="Your logo" className="h-12 w-12 shrink-0 rounded object-contain" style={{ background: 'var(--surface-2)' }} />
              <p className="min-w-[150px] flex-1 text-[12px]">A logo is saved. The corner badge is free and applied after an image is made.</p>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="secondary" size="sm" onClick={() => void chooseLogo()}>Replace</Button>
                <Button variant="ghost" size="sm" onClick={() => void window.moss.brand.clearLogo().then(async () => {
                  const brand = await unwrap(window.moss.brand.get())
                  patch({ logoUrl: brand.logoUrl })
                })}>Remove</Button>
              </div>
            </div>
          ) : (
            <Dropzone
              compact
              line={logoBusy ? 'Reading logo...' : 'Drop your logo, or choose a file.'}
              hint="PNG, JPEG or WebP. Up to 5 MB. Transparency is encouraged."
              onClick={() => void chooseLogo()}
              onFiles={(files) => { const file = files[0]; if (file) void dropLogo(file) }}
              label="Choose Logo"
            />
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold">Corner badge</p>
              <p className="hint">Put your logo on every image the studio makes.</p>
            </div>
            <Switch checked={value.badgeEnabled} onCheckedChange={(checked) => patch({ badgeEnabled: checked })} label="Logo badge" />
          </div>
          {value.badgeEnabled && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="badge-corner">Corner</label>
                <select id="badge-corner" className="field" value={value.badgeCorner} onChange={(event) => patch({ badgeCorner: event.target.value as Brand['badgeCorner'] })}>
                  {CORNERS.map((corner) => <option key={corner.value} value={corner.value}>{corner.label}</option>)}
                </select>
              </div>
              <div>
                <p className="field-label">Size</p>
                <Segmented
                  label="Badge size"
                  value={value.badgeScale}
                  onChange={(next) => patch({ badgeScale: next })}
                  options={[{ value: 's' as const, label: 'S' }, { value: 'm' as const, label: 'M' }, { value: 'l' as const, label: 'L' }]}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="badge-opacity">Opacity {value.badgeOpacity}%</label>
                <input
                  id="badge-opacity"
                  type="range"
                  min={60}
                  max={100}
                  value={value.badgeOpacity}
                  onChange={(event) => patch({ badgeOpacity: Number(event.target.value) })}
                  className="slider"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="section-label">Preview</p>
        <BrandPreview brand={value} />
        <p className="hint">A sample image with the badge exactly where a made image would show it.</p>
      </div>

    </div>
  )
}
