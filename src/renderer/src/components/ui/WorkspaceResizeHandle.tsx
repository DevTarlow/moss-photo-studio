import { useCallback, useEffect, useState } from 'react'

const MIN_WIDTH = 260
const MAX_WIDTH = 420

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readWidth(key: string, fallback: number): number {
  try {
    const saved = Number(window.localStorage.getItem(key))
    return Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : fallback
  } catch {
    return fallback
  }
}

export function usePanelWidth(
  key: string,
  initial = 300,
  min = MIN_WIDTH,
  max = MAX_WIDTH,
  side: 'left' | 'right' = 'left'
): {
  width: number
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  reset: () => void
} {
  const [width, setWidth] = useState(() => readWidth(key, initial))

  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(width))
    } catch {
      // A read-only profile still gets resizable panels for this session.
    }
  }, [key, width])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    const move = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX
      setWidth(clamp(startWidth + (side === 'right' ? -delta : delta), min, max))
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [width, min, max, side])

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>): void => {
    const step = event.shiftKey ? 40 : 12
    const direction = side === 'right' ? -1 : 1
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWidth((current) => clamp(current - step * direction, min, max))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWidth((current) => clamp(current + step * direction, min, max))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setWidth(min)
    } else if (event.key === 'End') {
      event.preventDefault()
      setWidth(max)
    }
  }, [min, max, side])

  const reset = useCallback((): void => setWidth(initial), [initial])

  return { width, onPointerDown, onKeyDown, reset }
}

export function WorkspaceResizeHandle({
  label,
  width,
  side,
  min = MIN_WIDTH,
  max = MAX_WIDTH,
  onPointerDown,
  onKeyDown,
  onReset
}: {
  label: string
  width: number
  side: 'left' | 'right'
  min?: number
  max?: number
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  onReset: () => void
}): React.JSX.Element {
  return (
    <div
      className={`ws-resize ws-resize-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      title="Drag to resize. Double-click to reset."
    />
  )
}
