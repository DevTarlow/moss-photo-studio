import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { isSupportedImage } from '../../lib/files'
import { useToastStore } from '../../lib/toast'

export function Dropzone({
  onFiles,
  onClick,
  line,
  hint,
  compact = false,
  label = 'Choose a photo'
}: {
  onFiles: (files: File[]) => void
  onClick?: () => void
  line: string
  hint?: string
  compact?: boolean
  label?: string
}): React.JSX.Element {
  const [over, setOver] = useState(false)
  const push = useToastStore((state) => state.push)
  const input = useRef<HTMLInputElement>(null)
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    const files = [...event.dataTransfer.files]
    const images = files.filter(isSupportedImage)
    if (images.length !== files.length) {
      push({ tone: 'error', message: 'That file is not supported. Use a JPEG, PNG, or WebP photo.' })
    }
    if (images.length) onFiles(images)
  }
  return (
    <>
      <div
        className="dropzone"
        data-over={over}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOver(true)
        }}
        onDragLeave={(event) => { event.stopPropagation(); setOver(false) }}
        onDrop={handleDrop}
        onDragEnter={(event) => event.stopPropagation()}
        onClick={onClick ?? (() => input.current?.click())}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(event) => {
          if (onClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onClick()
          }
        }}
        style={compact ? { minHeight: 130, padding: 20 } : undefined}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <ImagePlus size={20} />
        </div>
        <p className="font-semibold">{line}</p>
        {hint && <p className="hint max-w-[380px]">{hint}</p>}
        {onClick && <span className="badge mt-1">{label}</span>}
      </div>
      {/* Keep the input out of the role="button" dropzone: interactive content
          nested inside an interactive control trips axe's nested-interactive. */}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])].filter(isSupportedImage)
          if (files.length) onFiles(files)
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}
