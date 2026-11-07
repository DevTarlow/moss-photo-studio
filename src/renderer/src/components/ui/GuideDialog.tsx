import { Dialog } from './Dialog'
import { useUiStore } from '../../store/ui'
import { Button } from './Button'
import { useNavigate } from 'react-router-dom'

export function GuideDialog(): React.JSX.Element {
  const open = useUiStore((state) => state.guideOpen)
  const setOpen = useUiStore((state) => state.setGuide)
  const navigate = useNavigate()
  const rows = [
    ['Set Creator', 'Drop one clear product photo. Choose what you sell. The studio plans six shots. Press Make.'],
    ['Image Editor', 'Open any photo, choose a tile or write your own direction. The original stays first.'],
    ['Image Generator', 'Describe a picture. Add a reference image to keep its subject exactly as it is.'],
    ['Find anything', 'Press Ctrl K. Drag a photo anywhere in the app to start.'],
    ['Know the cost', 'The price is on the button. Meta charges one cent for every image that comes back.']
  ]
  return (
    <Dialog open={open} onOpenChange={setOpen} title="A short guide" width={520} footer={
      <Button variant="primary" onClick={() => { setOpen(false); navigate('/library') }}>Open My Library</Button>
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
