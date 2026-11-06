import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { LICENSE_STORE_URL, isStoreUrlPlaceholder } from '@shared/constants'
import { useAppStore } from '../store/app'
import { unwrap, messageOf, CallError } from '../lib/ipc'
import { markUrl } from '../lib/assets'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { toast } from '../lib/toast'

export function Activation(): React.JSX.Element {
  const license = useAppStore((state) => state.license)
  const applyLicense = useAppStore((state) => state.applyLicense)
  const onboardingBypass = useAppStore((state) => state.onboardingBypass)
  const settings = useAppStore((state) => state.settings)
  const setReadonlyBypass = useAppStore((state) => state.setReadonlyBypass)
  const navigate = useNavigate()
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasProjects, setHasProjects] = useState(false)
  const storeReady = !isStoreUrlPlaceholder(LICENSE_STORE_URL)

  useEffect(() => {
    void unwrap(window.moss.projects.list({ limit: 1 }))
      .then((result) => setHasProjects(result.total > 0))
      .catch(() => setHasProjects(false))
  }, [])

  useEffect(() => {
    if (license?.status === 'licensed' || license?.status === 'grace') {
      navigate(onboardingBypass ? '/library' : '/', { replace: true })
    }
  }, [license?.status, navigate, onboardingBypass])

  const activate = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Paste your license key first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await unwrap(window.moss.license.activate({ key: key.trim() }))
      applyLicense(next)
      toast.status('License activated.')
      navigate(settings?.onboardingDone ? '/library' : '/onboarding', { replace: true })
    } catch (caught) {
      const code = caught instanceof CallError ? caught.code : null
      if (code === 'license_limit') {
        setError('This key has used both of its computers. Deactivate it on the other computer in Settings, or contact support, then try again.')
      } else if (code === 'license_offline') {
        setError('Could not reach the license server. Connect to the internet and try again.')
      } else if (code === 'license_invalid') {
        setError("That key wasn't accepted. Check it and try again.")
      } else {
        setError(messageOf(caught))
      }
    } finally {
      setBusy(false)
    }
  }

  const expired = license?.status === 'expired'
  return (
    <div className="relative flex h-full flex-col overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]" style={{ background: 'radial-gradient(circle at 50% 0%, var(--accent-soft), transparent 55%)' }} />
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-[460px] p-8" style={{ width: 460 }}>
          <div className="flex items-center gap-3">
            <img src={markUrl()} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <p className="wordmark text-[20px]">Moss Photo Studio</p>
          </div>
          <h1 className="page-title mt-7">Activate Moss Photo Studio</h1>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Paste the license key from your receipt. It activates this computer.
          </p>
          {expired && (
            <div className="mt-4 rounded-[8px] border p-3 text-[12px]" style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
              {license.message ?? "It's been 14 days since the last check. Connect to the internet and press Activate to keep making images."}
            </div>
          )}
          <div className="mt-5">
            <Field
              label="License key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="Your license key"
              type={show ? 'text' : 'password'}
              disabled={busy}
              autoFocus
              error={error}
              className="font-mono"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void activate()
              }}
            />
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--text-faint)' }}
              onClick={() => setShow((value) => !value)}
            >
              {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? 'Hide key' : 'Show key'}
            </button>
          </div>
          <Button variant="primary" className="mt-5 w-full" disabled={busy} onClick={() => void activate()}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Activating...
              </>
            ) : (
              'Activate'
            )}
          </Button>
          <div className="mt-4 flex flex-col items-start gap-2">
            {storeReady ? (
              <button
                type="button"
                className="text-[12px]"
                style={{ color: 'var(--accent)' }}
                onClick={() => void window.moss.app.openExternal({ url: LICENSE_STORE_URL })}
              >
                Buy a license
              </button>
            ) : (
              <p className="hint">Ask the person who sold you this copy for a key.</p>
            )}
            {hasProjects && (
              <button
                type="button"
                className="text-[12px]"
                style={{ color: 'var(--accent)' }}
                onClick={() => {
                  setReadonlyBypass(true)
                  navigate('/library')
                }}
              >
                Browse My Library
              </button>
            )}
          </div>
          <p className="hint mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            Lost it? Check the email from the store. One key works on two computers.
          </p>
        </div>
      </main>
    </div>
  )
}
