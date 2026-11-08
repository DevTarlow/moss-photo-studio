import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Circle, X } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

export function SetupCard(): React.JSX.Element | null {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [dismissedLocally, setDismissedLocally] = useState(false)

  useEffect(() => {
    if (!settings || !secrets) return
    if (secrets.hasKey && !settings.onboardingDone) {
      void window.moss.settings.set({ key: 'onboardingDone', value: true }).then(() => refreshSettings()).catch(() => undefined)
    }
  }, [refreshSettings, secrets, settings])

  if (!settings || settings.setupDismissed || dismissedLocally) return null
  if (secrets?.hasKey) return null
  return (
    <div className="card mb-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Finish setting up</h2>
          <p className="hint mt-0.5">Add your Meta key to make images.</p>
          <p className="hint">One short step. You can do it now or later.</p>
        </div>
        <IconButton
          label="Don't show this again"
          onClick={() => {
            setDismissedLocally(true)
            void window.moss.settings.set({ key: 'setupDismissed', value: true }).then(() => refreshSettings()).catch(() => undefined)
          }}
        >
          <X size={15} />
        </IconButton>
      </div>
      <div className="mt-3 flex items-center gap-3 py-2">
        <span style={{ color: 'var(--text-faint)' }} aria-hidden>
          <Circle size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium">Add your Meta key</p>
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Needed to make images.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('/settings/studio')}>
          Add Key
        </Button>
        <span className="sr-only">Not done</span>
      </div>
    </div>
  )
}
