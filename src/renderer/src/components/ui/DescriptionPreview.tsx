import { useState } from 'react'
import { cn } from '../../lib/cn'

const PREVIEW_LENGTH = 200

/**
 * The description a version or generated image was made from.
 *
 * Both inspectors show the seller's own words, not the composed request, and
 * both clamp long copy to four lines. The shared component keeps the clamp,
 * the Show more control, and its accessible wiring identical in each panel.
 */
export function DescriptionPreview({
  text,
  id,
  previewLength = PREVIEW_LENGTH
}: {
  text: string
  id: string
  previewLength?: number
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > previewLength || text.split('\n').length > 4

  return (
    <>
      <p
        id={id}
        className={cn('mt-1 whitespace-pre-wrap text-[12px]', !expanded && isLong && 'version-description')}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          className="mt-1 text-[11px] font-medium"
          style={{ color: 'var(--accent)' }}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  )
}
