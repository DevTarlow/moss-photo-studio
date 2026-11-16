import { Dialog } from './Dialog'
import { useUiStore } from '../../store/ui'
import { Button } from './Button'
import { useNavigate } from 'react-router-dom'
import { usd } from '@shared/cost'

export function GuideDialog(): React.JSX.Element {
  const open = useUiStore((state) => state.guideOpen)
  const setOpen = useUiStore((state) => state.setGuide)
  const navigate = useNavigate()
  const rows = [
    ['Image Editor', 'Open any photo, choose a look or write your own direction. The original stays first.'],
    ['Products', 'Save a product photo once, then reuse it in the editor or generator.'],
    ['Image Generator', 'Describe a picture. Add a product, person, or scene to keep it consistent.'],
    ['Sets', 'Add related images to a Set, start something new from any image in it, or export the whole Set.'],
    ['Find anything', 'Press Ctrl K. Drag a photo anywhere in the app to start.'],
    ['Know the cost', `The price is on the button. Meta charges ${usd(1)} for every image that comes back.`]
  ]
  return (
    <Dialog open={open} onOpenChange={setOpen} title="A short guide" width={520} footer={
      <Button variant="primary" onClick={() => { setOpen(false); navigate('/products') }}>Open Products</Button>
    }>
      <div className="space-y-3">
        {rows.map(([title, body]) => (
          <div key={title}>
            <p className="text-[12px] font-semibold">{title}</p>
            <p className="hint">{body}</p>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
