import { useEffect, useState } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { ChevronLeft, ChevronRight, Columns2, X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { useModalInert } from './useModalInert'

export interface MediaItem {
  id: string
  label: string
  caption?: string
  url: string | null
  thumbUrl?: string | null
}

/**
 * Read-only viewer for Set images and product sources. It carries the same
 * full-screen language as the studio lightbox but accepts the lighter
 * LibraryImage/Product shapes instead of a studio Image.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  items,
  index,
  onIndex,
  sourceUrl
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: MediaItem[]
  index: number
  onIndex: (index: number) => void
  sourceUrl?: string | null
}): React.JSX.Element {
  const item = items[index]
  const [compare, setCompare] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useModalInert(open)

  useEffect(() => {
    setLoaded(false)
  }, [item?.id])
  useEffect(() => {
    if (!open) setCompare(false)
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (event.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, index, onIndex, open])

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay lightbox-overlay" onClick={() => onOpenChange(false)} />
        <RadixDialog.Content
          className="fixed inset-0 z-[81] flex flex-col items-center justify-center p-8 text-[var(--canvas-text)]"
          style={{ pointerEvents: 'none' }}
          aria-describedby={undefined}
        >
          <RadixDialog.Title className="sr-only">Image preview</RadixDialog.Title>
          <div className="relative z-10 flex h-full w-full max-w-[1200px] flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="lightbox-control truncate text-[13px] font-semibold">{item?.label ?? 'Image'}</p>
                {item?.caption && <p className="lightbox-control truncate text-[11px] opacity-70">{item.caption}</p>}
              </div>
              <RadixDialog.Close asChild>
                <IconButton label="Close preview" showTooltip={false} className="lightbox-control pointer-events-auto">
                  <Icon icon={X} size="md" />
                </IconButton>
              </RadixDialog.Close>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {index > 0 && (
                <IconButton label="Previous image" className="lightbox-control pointer-events-auto absolute left-0 z-20" onClick={() => onIndex(index - 1)}>
                  <Icon icon={ChevronLeft} size="lg" />
                </IconButton>
              )}
              {compare && sourceUrl && item?.url ? (
                <div className="pointer-events-auto grid h-full w-full grid-cols-1 gap-4 md:grid-cols-2">
                  <figure className="flex min-h-0 flex-col items-center justify-center">
                    <img src={sourceUrl} alt="The source photo" className="max-h-[66vh] max-w-full rounded object-contain" />
                    <figcaption className="lightbox-control mt-2 text-[11px]">Source photo</figcaption>
                  </figure>
                  <figure className="flex min-h-0 flex-col items-center justify-center">
                    <img src={item.url} alt={item.label} className="max-h-[66vh] max-w-full rounded object-contain" />
                    <figcaption className="lightbox-control mt-2 text-[11px]">Set image</figcaption>
                  </figure>
                </div>
              ) : item?.url ? (
                <img
                  src={item.url}
                  alt={item.label}
                  className="lightbox-image pointer-events-auto"
                  onLoad={() => setLoaded(true)}
                  style={{ opacity: loaded ? 1 : 0, transition: 'opacity 180ms' }}
                />
              ) : (
                <p className="lightbox-control">This image is not available.</p>
              )}
              {index < items.length - 1 && (
                <IconButton label="Next image" className="lightbox-control pointer-events-auto absolute right-0 z-20" onClick={() => onIndex(index + 1)}>
                  <Icon icon={ChevronRight} size="lg" />
                </IconButton>
              )}
            </div>
            <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-center gap-2 pt-3">
              {sourceUrl && item?.url && (
                <Button variant={compare ? 'primary' : 'secondary'} size="sm" className="pointer-events-auto" onClick={() => setCompare((value) => !value)}>
                  <Icon icon={Columns2} size="sm" /> {compare ? 'Single View' : 'Compare with Source'}
                </Button>
              )}
              <span className="lightbox-control text-[11px]">{index + 1} of {items.length}</span>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
