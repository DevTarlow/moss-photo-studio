import { useRef } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { CENTS_PER_IMAGE, estimateCents, usd } from '@shared/cost'

export function FirstRunConfirm({
  open,
  runLabel,
  imageCount,
  onConfirm,
  onGotIt,
  onOpenChange
}: {
  open: boolean
  runLabel: string
  imageCount: number
  onConfirm: () => void
  onGotIt: () => void
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const perImage = usd(CENTS_PER_IMAGE)
  const total = usd(estimateCents(imageCount))
  const confirmRef = useRef<HTMLButtonElement>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Before your first image"
      description={`Meta charges your account ${perImage} for every image that comes back. This makes ${imageCount} ${imageCount === 1 ? 'image' : 'images'}, about ${total}. Nothing is charged until you choose ${runLabel.split(' · ')[0]}.`}
      width={460}
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onGotIt}>
            Not Now
          </Button>
          <Button ref={confirmRef} type="button" variant="primary" onClick={onConfirm}>
            {runLabel}
          </Button>
        </>
      }
    >
      <p className="help-line">
        The price on the button is the price of this image. Images that do not come back are not counted in your spend.
      </p>
    </Dialog>
  )
}
