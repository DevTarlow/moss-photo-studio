import { useEffect, useState } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { useToastStore } from '../../lib/toast'
import type { ToastItem } from '../../lib/toast'

function ToastRow({ item }: { item: ToastItem }): React.JSX.Element {
  const dismiss = useToastStore((state) => state.dismiss)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(() => dismiss(item.id), item.tone === 'error' ? 6000 : 3000)
    return () => window.clearTimeout(timer)
  }, [dismiss, item.id, item.tone, paused])
  return (
    <div
      className="toast"
      data-tone={item.tone}
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="mt-0.5" style={{ color: item.tone === 'error' ? 'var(--danger)' : 'var(--accent)' }} aria-hidden>
        {item.tone === 'error' ? <Icon icon={AlertCircle} size="sm" /> : <Icon icon={Check} size="sm" />}
      </span>
      <div className="min-w-0 flex-1">
        <p>{item.message}</p>
        {item.actionLabel && item.onAction && (
          <button
            type="button"
            className="mt-1 font-semibold"
            style={{ color: 'var(--accent)' }}
            onClick={() => {
              item.onAction?.()
              dismiss(item.id)
            }}
          >
            {item.actionLabel}
          </button>
        )}
      </div>
      {item.tone === 'error' && (
        <button type="button" className="icon-btn toast-close h-6 w-6" aria-label="Close message" onClick={() => dismiss(item.id)}>
          <Icon icon={X} size="sm" />
        </button>
      )}
    </div>
  )
}

export function ToastViewport(): React.JSX.Element {
  const items = useToastStore((state) => state.items)
  return (
    <div className="toast-viewport" aria-live="polite">
      {items.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
}
