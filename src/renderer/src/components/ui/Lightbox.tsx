import { useEffect, useState } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { ChevronLeft, ChevronRight, Columns2, Download, FolderPlus, Image as ImageIcon, Package, Star, Trash2, UserPlus, X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Image } from '@shared/types'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { useModalInert } from './useModalInert'

export function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndex,
  onDownload,
  onSetCover,
  onEdit,
  onSaveProduct,
  onSavePerson,
  onSaveToSet,
  onDelete,
  onPin,
  isPinned,
  source
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Image[]
  index: number
  onIndex: (index: number) => void
  onDownload?: (image: Image) => void
  onSetCover?: (image: Image) => void
  onEdit?: (image: Image) => void
  onSaveProduct?: (image: Image) => void
  onSavePerson?: (image: Image) => void
  onSaveToSet?: (image: Image) => void
  onDelete?: (image: Image) => void
  onPin?: (image: Image) => void
  isPinned?: (image: Image) => boolean
  source?: Image | null
}): React.JSX.Element {
  const image = images[index]
  useModalInert(open)
  const [loaded, setLoaded] = useState(false)
  const [compare, setCompare] = useState(false)
  useEffect(() => {
    setLoaded(false)
  }, [image?.id])
  useEffect(() => {
    if (!open) setCompare(false)
  }, [open])
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
        <RadixDialog.Overlay
          className="dialog-overlay lightbox-overlay"
          onClick={() => onOpenChange(false)}
        />
        <RadixDialog.Content
          className="fixed inset-0 z-[81] flex flex-col items-center justify-center p-8 text-[var(--canvas-text)]"
          style={{ pointerEvents: 'none' }}
          aria-describedby={undefined}
        >
          <RadixDialog.Title className="sr-only">Image preview</RadixDialog.Title>
          <div className="relative z-10 flex h-full w-full max-w-[1200px] flex-col">
            <div className="flex items-center justify-between">
              <p className="lightbox-control text-[12px]">{image?.label ?? 'Image'}</p>
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
              {compare && source?.url && image?.url ? (
                <div className="pointer-events-auto grid h-full w-full grid-cols-2 gap-4">
                  <figure className="flex min-h-0 flex-col items-center justify-center">
                    <img src={source.url} alt="The source photo" className="max-h-[66vh] max-w-full rounded object-contain" />
                    <figcaption className="lightbox-control mt-2 text-[11px]">Source photo</figcaption>
                  </figure>
                  <figure className="flex min-h-0 flex-col items-center justify-center">
                    <img src={image.url} alt={image.label} className="max-h-[66vh] max-w-full rounded object-contain" />
                    <figcaption className="lightbox-control mt-2 text-[11px]">Made image</figcaption>
                  </figure>
                </div>
              ) : image?.url && (
                <img
                  src={image.url}
                  alt={image.label}
                  className="lightbox-image pointer-events-auto"
                  onLoad={() => setLoaded(true)}
                  style={{ opacity: loaded ? 1 : 0, transition: 'opacity 180ms' }}
                />
              )}
              {index < images.length - 1 && (
                <IconButton label="Next image" className="lightbox-control pointer-events-auto absolute right-0 z-20" onClick={() => onIndex(index + 1)}>
                  <Icon icon={ChevronRight} size="lg" />
                </IconButton>
              )}
            </div>
            <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-center gap-2 pt-3">
              {source?.url && image?.url && (
                <Button variant={compare ? 'primary' : 'secondary'} size="sm" className="pointer-events-auto" onClick={() => setCompare((value) => !value)}>
                  <Icon icon={Columns2} size="sm" /> {compare ? 'Single View' : 'Compare with Source'}
                </Button>
              )}
              {onDownload && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onDownload(image)}>
                  <Icon icon={Download} size="sm" /> Download
                </Button>
              )}
              {onSetCover && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onSetCover(image)}>
                  <Icon icon={Star} size="sm" /> Set as Cover
                </Button>
              )}
              {onPin && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onPin(image)}>
                  {isPinned?.(image) ? 'Main Version' : 'Use as Main'}
                </Button>
              )}
              {onEdit && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onEdit(image)}>
                  <Icon icon={ImageIcon} size="sm" /> Open in Editor
                </Button>
              )}
              {onSaveProduct && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onSaveProduct(image)}>
                  <Icon icon={Package} size="sm" /> Save as Product
                </Button>
              )}
              {onSavePerson && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onSavePerson(image)}>
                  <Icon icon={UserPlus} size="sm" /> Save as Person
                </Button>
              )}
              {onSaveToSet && image && (
                <Button variant="secondary" size="sm" className="pointer-events-auto" onClick={() => onSaveToSet(image)}>
                  <Icon icon={FolderPlus} size="sm" /> Add to Set
                </Button>
              )}
              {onDelete && image && (
                <Button variant="ghost" size="sm" className="lightbox-control pointer-events-auto" onClick={() => onDelete(image)}>
                  <Icon icon={Trash2} size="sm" /> Delete
                </Button>
              )}
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
