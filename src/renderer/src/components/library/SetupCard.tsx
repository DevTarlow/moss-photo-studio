import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Circle, X } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { unwrap } from '../../lib/ipc'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

export function SetupCard({ onNewSet }: { onNewSet: () => void }): React.JSX.Element | null {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [hasSet, setHasSet] = useState<boolean | null>(null)
  const [dismissedLocally, setDismissedLocally] = useState(false)

  useEffect(() => {
    void unwrap(window.moss.projects.list({ filter: 'sets', limit: 1 }))
      .then((result) => setHasSet(result.total > 0))
      .catch(() => setHasSet(false))
  }, [])

  useEffect(() => {
    if (!settings || !secrets || hasSet === null) return
    const allDone = secrets.hasKey && hasSet
    if (allDone && !settings.onboardingDone) {
      void window.moss.settings.set({ key: 'onboardingDone', value: true }).then(() => refreshSettings()).catch(() => undefined)
    }
  }, [hasSet, refreshSettings, secrets, settings])

  if (!settings || settings.setupDismissed || dismissedLocally) return null
  const keyDone = Boolean(secrets?.hasKey)
  const allDone = keyDone && hasSet
  if (allDone) return null
  const rows = [
    {
      done: keyDone,
      label: 'Add your Meta key',
      detail: 'Needed to make images.',
      action: 'Add Key',
      run: () => navigate('/settings/studio')
    },
    {
      done: Boolean(hasSet),
      label: 'Make a first set',
      detail: 'One photo in, a full set out.',
      action: 'New Set',
      run: onNewSet
    }
  ]
  return (
    <div className="card mb-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Finish setting up</h2>
          <p className="hint mt-0.5">Add your Meta key. Make a first set.</p>
          <p className="hint">Two short steps. You can stop after either.</p>
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
      <div className="mt-3 divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2">
            <span style={{ color: row.done ? 'var(--accent)' : 'var(--text-faint)' }} aria-hidden>
              {row.done ? <Check size={16} /> : <Circle size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium">{row.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{row.detail}</p>
            </div>
            {!row.done && (
              <Button size="sm" variant="secondary" onClick={row.run}>
                {row.action}
              </Button>
            )}
            <span className="sr-only">{row.done ? 'Done' : 'Not done'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
