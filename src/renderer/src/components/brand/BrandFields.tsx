import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Brand } from '@shared/types'
import { MAX_BRAND_COLORS, USED_BRAND_COLORS, toggleBrandColorUse } from '@shared/brandColors'
import { paletteFromPixels } from '@shared/palette'
import { STYLE_PRESETS } from '@shared/stylePresets'
import { exampleUrl } from '../../lib/assets'
import { Button } from '../ui/Button'
import { Dropzone } from '../ui/Dropzone'
import { Field } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { unwrap, messageOf } from '../../lib/ipc'
import { fileToBytes } from '../../lib/files'
import { toast } from '../../lib/toast'

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
  maxColors = MAX_BRAND_COLORS,
  showPreview = true
}: {
  value: Brand
  onChange: (brand: Brand) => void
  maxColors?: number
  showPreview?: boolean
}): React.JSX.Element {
  const [newColor, setNewColor] = useState(cssColor('--accent'))
  const [hex, setHex] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  const [paletteBusy, setPaletteBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const usedCount = Math.min(USED_BRAND_COLORS, maxColors)
  const canChooseUsed = value.colorsEnabled && value.colors.length > usedCount

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

  const useColorsFromPhoto = async (file: File): Promise<void> => {
    setPaletteBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 160 / Math.max(1, bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('no canvas')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const picked = paletteFromPixels(context.getImageData(0, 0, canvas.width, canvas.height).data, 6)
      const next = [...value.colors]
      for (const color of picked) {
        if (next.length >= maxColors) break
        if (!next.some((entry) => entry.toLowerCase() === color.toLowerCase())) next.push(color)
      }
      if (next.length === value.colors.length) {
        toast.error('No usable colors were found in that photo.')
        return
      }
      patch({ colors: next })
      toast.status(`Picked ${next.length - value.colors.length} colors from the photo.`)
    } catch {
      toast.error('That photo could not be read.')
    } finally {
      setPaletteBusy(false)
    }
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
    <div className={showPreview ? 'grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]' : 'grid gap-7'}>
      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="field-label">Colors <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
              <p className="hint mb-2">
                Up to {maxColors} saved.{' '}
                {value.colorsEnabled
                  ? `The first ${usedCount} steer backgrounds and props when the studio makes a set or changes a photo.${canChooseUsed ? ' Select Use or Used to change which three are used.' : ''}`
                  : 'Colors are off; they stay saved but are not added to a prompt.'}{' '}
                They never tint the product.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Use colors</span>
              <Switch checked={value.colorsEnabled} onCheckedChange={(checked) => patch({ colorsEnabled: checked })} label="Use brand colors" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {value.colors.map((color, index) => {
              const used = value.colorsEnabled && index < usedCount
              return (
                <span key={color} className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2" style={{ borderColor: 'var(--border)' }}>
                  <span className="color-dot" style={{ background: color }} aria-hidden />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{color}</span>
                  {canChooseUsed ? (
                    <button
                      type="button"
                      className="badge pill-sm"
                      data-tone={used ? 'success' : undefined}
                      aria-pressed={used}
                      aria-label={used ? `Stop using ${color}` : `Use ${color}`}
                      onClick={() => patch({ colors: toggleBrandColorUse(value.colors, index) })}
                    >
                      {used ? 'Used' : 'Use'}
                    </button>
                  ) : used ? (
                    <span className="badge pill-sm">Used</span>
                  ) : null}
                  <button type="button" className="icon-btn h-5 w-5" aria-label={`Remove ${color}`} onClick={() => patch({ colors: value.colors.filter((entry) => entry !== color) })}>
                    <Icon icon={Trash2} size="xsm" />
                  </button>
                </span>
              )
            })}
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
              <Icon icon={Plus} size="sm" /> Add Color
            </Button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Pick colors from a photo"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void useColorsFromPhoto(file)
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={paletteBusy || value.colors.length >= maxColors}
              onClick={() => photoInput.current?.click()}
            >
              {paletteBusy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={ImagePlus} size="sm" />} From a Photo
            </Button>
          </div>
          <p className="hint mt-1">From a Photo reads the image on this computer. It is not uploaded or saved.</p>
        </div>

        <div>
          <p className="field-label">Default look <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
          <p className="hint mb-2">A setting and light treatment added to every run, so a set feels related. It never changes the product.</p>
          <select
            className="field"
            aria-label="Default look"
            value={value.stylePreset ?? 'none'}
            onChange={(event) => patch({ stylePreset: event.target.value })}
          >
            {STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
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

      {showPreview && (
        <div className="space-y-2">
          <p className="section-label">Preview</p>
          <BrandPreview brand={value} />
          <p className="hint">A sample image with the badge exactly where a made image would show it.</p>
        </div>
      )}

    </div>
  )
}
