import { ExternalLink } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import { MUSE_KEY_ORIGIN } from '@shared/constants'
import { Button } from './Button'
import { Dialog } from './Dialog'

const STEPS = [
  {
    title: 'Open your Meta dashboard',
    body: 'Use the Open Meta Dashboard button below. It opens dev.meta.ai in your browser.'
  },
  {
    title: 'Sign in',
    body: 'Use the Meta account that will pay for image requests.'
  },
  {
    title: 'Open your API keys',
    body: 'In the Meta dashboard, open the API keys tab.'
  },
  {
    title: 'Create a key',
    body: 'Choose Create API key, give it a name like Moss Photo Studio, and create it.'
  },
  {
    title: 'Copy it now',
    body: 'The dashboard only shows the key once, so copy the whole thing before leaving the page.'
  },
  {
    title: 'Paste and test',
    body: 'Return here, paste the key into the Meta key field, and choose Test and Save.'
  }
] as const

export function MuseKeyGuideDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Get a Meta key"
      description="Moss uses your own Meta key to make images. Here is how to create one and bring it back."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Got it</Button>
          <Button variant="primary" onClick={() => void window.moss.app.openExternal({ url: MUSE_KEY_ORIGIN })}>
            Open Meta Dashboard <Icon icon={ExternalLink} size="sm" />
          </Button>
        </>
      }
    >
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium">{step.title}</p>
              <p className="hint mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-[10px] border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <p className="hint">If the dashboard asks for a payment method, add one there. Meta bills your Meta account directly for each image; the app shows the price before every image.</p>
        <p className="hint mt-1">The key is stored encrypted on this computer. Moss never sees your Meta password.</p>
      </div>
    </Dialog>
  )
}
