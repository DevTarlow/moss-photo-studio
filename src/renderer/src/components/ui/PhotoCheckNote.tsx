import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { PhotoCheck } from '@shared/types'
import { unwrap } from '../../lib/ipc'

export function PhotoCheckNote({ imageId }: { imageId: string | null }): React.JSX.Element | null {
  const [check, setCheck] = useState<PhotoCheck | null>(null)
  useEffect(() => {
    let live = true
    setCheck(null)
    if (!imageId) return undefined
    void (async () => {
      try {
        const result = await unwrap(window.moss.media.inspect({ imageId }))
        if (live) setCheck(result)
      } catch {
        // The local check is optional; leave it out when it cannot run.
      }
    })()
    return () => {
      live = false
    }
  }, [imageId])
  if (!check || check.warnings.length === 0) return null
  return (
    <div className="mt-2 rounded-[8px] border p-2.5" style={{ borderColor: 'var(--border)' }}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold">
        <AlertTriangle size={13} /> Photo check
      </p>
      <ul className="mt-1 grid gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {check.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}
      </ul>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>Local check only, not a guarantee.</p>
    </div>
  )
}
