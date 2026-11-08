import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AdjustTransform } from '@shared/types'

type Handle = 'nw' | 'ne' | 'sw' | 'se'
type Crop = NonNullable<AdjustTransform['crop']>

const minSize = 0.06

export function CropOverlay({
  crop,
  onChange,
  onBegin
}: {
  crop: Crop
  onChange: (crop: Crop) => void
  onBegin: () => void
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)

  const start = (event: ReactPointerEvent, handle: Handle | 'move'): void => {
    event.preventDefault()
    onBegin()
    const parent = host.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const initial = { ...crop }
    const move = (moveEvent: globalThis.PointerEvent): void => {
      const dx = (moveEvent.clientX - startX) / rect.width
      const dy = (moveEvent.clientY - startY) / rect.height
      const next = { ...initial }
      if (handle === 'move') {
        next.x = Math.min(1 - initial.width, Math.max(0, initial.x + dx))
        next.y = Math.min(1 - initial.height, Math.max(0, initial.y + dy))
      } else {
        if (handle === 'nw' || handle === 'sw') {
          const right = initial.x + initial.width
          const left = Math.min(right - minSize, Math.max(0, initial.x + dx))
          next.x = left
          next.width = right - left
        }
        if (handle === 'ne' || handle === 'se') {
          next.width = Math.max(minSize, Math.min(1 - initial.x, initial.width + dx))
        }
        if (handle === 'nw' || handle === 'ne') {
          const bottom = initial.y + initial.height
          const top = Math.min(bottom - minSize, Math.max(0, initial.y + dy))
          next.y = top
          next.height = bottom - top
        }
        if (handle === 'sw' || handle === 'se') {
          next.height = Math.max(minSize, Math.min(1 - initial.y, initial.height + dy))
        }
      }
      onChange(next)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) onBegin()
    const step = event.shiftKey ? 0.05 : 0.01
    const next = { ...crop }
    if (event.altKey) {
      if (event.key === 'ArrowLeft') next.width = Math.max(minSize, crop.width - step)
      if (event.key === 'ArrowRight') next.width = Math.min(1 - crop.x, crop.width + step)
      if (event.key === 'ArrowUp') next.height = Math.max(minSize, crop.height - step)
      if (event.key === 'ArrowDown') next.height = Math.min(1 - crop.y, crop.height + step)
    } else {
      if (event.key === 'ArrowLeft') next.x = Math.max(0, crop.x - step)
      if (event.key === 'ArrowRight') next.x = Math.min(1 - crop.width, crop.x + step)
      if (event.key === 'ArrowUp') next.y = Math.max(0, crop.y - step)
      if (event.key === 'ArrowDown') next.y = Math.min(1 - crop.height, crop.y + step)
    }
    onChange(next)
  }

  const label = `Crop area, ${Math.round(crop.x * 100)}% from left, ${Math.round(crop.y * 100)}% from top, ${Math.round(crop.width * 100)}% wide, ${Math.round(crop.height * 100)}% tall.`

  return (
    <div className="absolute inset-0" ref={host}>
      <span id="crop-help" className="sr-only">Use arrow keys to move the crop. Hold Alt to resize; hold Shift for a bigger step.</span>
      <div
        className="crop-box absolute"
        role="group"
        tabIndex={0}
        aria-label={label}
        aria-describedby="crop-help"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, boxShadow: '0 0 0 9999px var(--crop-dim)', border: '1px solid var(--canvas-text)' }}
        onPointerDown={(event) => start(event, 'move')}
        onKeyDown={onKeyDown}
      >
        <span className="crop-grid-line" style={{ left: '33.33%', top: 0, bottom: 0, width: 1 }} />
        <span className="crop-grid-line" style={{ left: '66.66%', top: 0, bottom: 0, width: 1 }} />
        <span className="crop-grid-line" style={{ top: '33.33%', left: 0, right: 0, height: 1 }} />
        <span className="crop-grid-line" style={{ top: '66.66%', left: 0, right: 0, height: 1 }} />
        {(['nw', 'ne', 'sw', 'se'] as Handle[]).map((handle) => (
          <span
            key={handle}
            className="crop-handle"
            style={{
              left: handle.endsWith('w') ? -6 : 'calc(100% - 6px)',
              top: handle.startsWith('n') ? -6 : 'calc(100% - 6px)',
              cursor: `${handle}-resize`
            }}
            onPointerDown={(event) => start(event, handle)}
          />
        ))}
      </div>
    </div>
  )
}
