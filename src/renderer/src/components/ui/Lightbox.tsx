import { useEffect, useState } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Star, Trash2, X } from 'lucide-react'
import type { Image } from '@shared/types'
import { Button } from './Button'
import { IconButton } from './IconButton'

export function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndex,
  onDownload,
  onSetCover,
  onEdit,
  onDelete
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Image[]
  index: number
  onIndex: (index: number) => void
  onDownload: (image: Image) => void
  onSetCover?: (image: Image) => void
  onEdit?: (image: Image) => void
  onDelete?: (image: Image) => void
}): React.JSX.Element {
  const image = images[index]
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
  }, [image?.id])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (event.key === 'ArrowRight' && index < images.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, index, onIndex, open])
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content className="fixed inset-0 z-[81] flex flex-col items-center justify-center p-8 text-[var(--canvas-text)]" aria-describedby={undefined}>
          <RadixDialog.Title className="sr-only">Image preview</RadixDialog.Title>
          <div className="absolute inset-0" style={{ background: 'var(--canvas)' }} aria-hidden />
          <div className="relative z-10 flex h-full w-full max-w-[1200px] flex-col">
            <div className="flex items-center justify-between">
              <p className="canvas-meta text-[12px]">{image?.label ?? 'Image'}</p>
              <RadixDialog.Close asChild>
                <IconButton label="Close preview" className="text-[var(--canvas-text)]">
                  <X size={18} />
                </IconButton>
              </RadixDialog.Close>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {index > 0 && (
                <IconButton label="Previous image" className="absolute left-0 z-20 text-[var(--canvas-text)]" onClick={() => onIndex(index - 1)}>
                  <ChevronLeft size={24} />
                </IconButton>
              )}
              {image?.url && (
                <img
                  src={image.url}
                  alt={image.label}
                  className="lightbox-image"
                  onLoad={() => setLoaded(true)}
                  style={{ opacity: loaded ? 1 : 0, transition: 'opacity 180ms' }}
                />
              )}
              {index < images.length - 1 && (
                <IconButton label="Next image" className="absolute right-0 z-20 text-[var(--canvas-text)]" onClick={() => onIndex(index + 1)}>
                  <ChevronRight size={24} />
                </IconButton>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
              {onDownload && image && (
                <Button variant="secondary" size="sm" onClick={() => onDownload(image)}>
                  <Download size={15} /> Download
                </Button>
              )}
              {onSetCover && image && (
                <Button variant="secondary" size="sm" onClick={() => onSetCover(image)}>
                  <Star size={15} /> Set as Cover
                </Button>
              )}
              {onEdit && image && (
                <Button variant="secondary" size="sm" onClick={() => onEdit(image)}>
                  <ImageIcon size={15} /> Open in Editor
                </Button>
              )}
              {onDelete && image && (
                <Button variant="ghost" size="sm" className="text-[var(--canvas-text)]" onClick={() => onDelete(image)}>
                  <Trash2 size={15} /> Delete
                </Button>
              )}
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
