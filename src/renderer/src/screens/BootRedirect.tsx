import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { unwrap } from '../lib/ipc'
import { markUrl } from '../lib/assets'

const TWELVE_HOURS = 12 * 60 * 60 * 1000

export function BootRedirect(): React.JSX.Element {
  const navigate = useNavigate()
  const license = useAppStore((state) => state.license)
  const settings = useAppStore((state) => state.settings)
  const onboardingBypass = useAppStore((state) => state.onboardingBypass)
  const initialLicenseValid = useAppStore((state) => state.initialLicenseValid)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!settings || !license || ready) return
    let cancelled = false
    const decide = async (): Promise<void> => {
      if (license.status === 'unlicensed') {
        if (!initialLicenseValid) {
          navigate('/activation', { replace: true })
          return
        }
      }
      if (license.status === 'expired' && !initialLicenseValid) {
        navigate('/activation', { replace: true })
        return
      }
      if (!settings.onboardingDone && !settings.onboardingDismissed && !onboardingBypass && (license.status === 'licensed' || license.status === 'grace')) {
        navigate('/onboarding', { replace: true })
        return
      }
      if (settings.lastProjectId) {
        try {
          const recent = await unwrap(window.moss.projects.recent({ limit: 10 }))
          if (cancelled) return
          const last = recent.find((project) => project.id === settings.lastProjectId)
          if (last?.lastOpenedAt && Date.now() - last.lastOpenedAt < TWELVE_HOURS) {
            setReady(true)
            navigate(`/project/${last.id}`, { replace: true })
            return
          }
        } catch {
          // Fall through to the Library.
        }
      }
      setReady(true)
      navigate('/products', { replace: true })
    }
    void decide()
    return () => {
      cancelled = true
    }
  }, [initialLicenseValid, license, navigate, onboardingBypass, ready, settings])

  return (
    <div className="flex h-full items-center justify-center" style={{ background: 'var(--canvas)' }}>
      <div className="flex flex-col items-center gap-3">
        <img src={markUrl()} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        <p className="wordmark" style={{ color: 'var(--canvas-text)' }}>Opening the studio</p>
      </div>
    </div>
  )
}
