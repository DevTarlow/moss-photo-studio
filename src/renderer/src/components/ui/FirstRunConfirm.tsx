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
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Before your first run"
      description={`Meta charges your key ${perImage} for every image that comes back. This run makes ${imageCount} ${imageCount === 1 ? 'image' : 'images'}, about ${total}. Nothing is charged until you press ${runLabel.split(' · ')[0]}.`}
      width={460}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onGotIt}>
            Got it
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {runLabel}
          </Button>
        </>
      }
    >
      <p className="help-line">
        The price on the button is the price of this run. Images that do not come back are not counted in your spend.
      </p>
    </Dialog>
  )
}
