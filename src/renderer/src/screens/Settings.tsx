import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  HardDriveDownload,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound
} from 'lucide-react'
import type { AutoUpdateState, Brand, LicenseState, UpdateCheckResult } from '@shared/types'
import { APP_NAME, APP_VERSION, LICENSE_API_HOST, LICENSE_PORTAL_URL, LICENSE_STORE_URL, STUDIO_URL, SUPPORT_EMAIL, isStoreUrlPlaceholder } from '@shared/constants'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { MuseKeyGuideDialog } from '../components/ui/MuseKeyGuideDialog'
import { BrandFields } from '../components/brand/BrandFields'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { formatDateTime, relativeTime, usd } from '../lib/format'
import { toast } from '../lib/toast'
import { markUrl } from '../lib/assets'
import { Skeleton } from '../components/ui/Skeleton'
import { Card, Collapsible, Heading, Icon, Stack, Text } from '@astryxdesign/core'
import { settingsSections } from '../lib/settingsSections'

function SettingsTitle({ title, line }: { title: string; line: string }): React.JSX.Element {
  return (
    <div className="mb-6">
      <Heading level={1}>{title}</Heading>
      <Text type="supporting" color="secondary" display="block" className="mt-1">{line}</Text>
    </div>
  )
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return <Card padding={5} className={className}>{children}</Card>
}

export function Settings(): React.JSX.Element {
  const params = useParams()
  const navigate = useNavigate()
  const section = params.section ?? 'studio'
  useEffect(() => {
    if (!settingsSections.some((item) => item.id === section)) {
      navigate('/settings/studio', { replace: true })
    }
  }, [navigate, section])
  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="mx-auto w-full max-w-[880px] px-8 py-7">
          {section === 'studio' && <StudioSection />}
          {section === 'brand' && <BrandSection />}
          {section === 'library' && <LibrarySection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'license' && <LicenseSection />}
          {section === 'updates' && <UpdatesSection />}
          {section === 'privacy' && <PrivacySection />}
          {section === 'about' && <AboutSection />}
          {!settingsSections.some((item) => item.id === section) && <StudioSection />}
        </div>
      </div>
    </AppFrame>
  )
}

function StudioSection(): React.JSX.Element {
  const secrets = useAppStore((state) => state.secrets)
  const refreshSecrets = useAppStore((state) => state.refreshSecrets)
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backendDismissed, setBackendDismissed] = useState(false)
  const [keyGuideOpen, setKeyGuideOpen] = useState(false)

  useEffect(() => {
    void refreshSecrets()
  }, [refreshSecrets])

  useEffect(() => {
    if (secrets && !secrets.hasKey) setEditing(true)
  }, [secrets])

  const testAndSave = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Paste your key first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(window.moss.secrets.testMuseKey({ key: key.trim() }))
      if (!result.ok) {
        setError(result.code === 'invalid_key'
          ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
          : 'Could not reach Meta. Check your connection, or try again.')
        return
      }
      await unwrap(window.moss.secrets.setMuseKey({ key: key.trim() }))
      await refreshSecrets()
      setEditing(false)
      setKey('')
      toast.status('Meta key saved.')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const testSaved = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(window.moss.secrets.testMuseKey({}))
      if (!result.ok) {
        setError(result.code === 'invalid_key'
          ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
          : 'Could not reach Meta. Check your connection, or try again.')
        return
      }
      await refreshSecrets()
      toast.status('Connection checked.')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Remove the Meta key?',
      body: 'Images cannot be made until you add a key again. Your projects and images stay on this computer.',
      confirmLabel: 'Remove Key',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.secrets.clearMuseKey())
      await refreshSecrets()
      setEditing(true)
      toast.status('Meta key removed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  if (!secrets) return <Skeleton className="h-64" />
  const checked = secrets.validatedAt ? `Checked ${relativeTime(secrets.validatedAt)}` : 'Not checked yet'
  return (
    <div>
      <SettingsTitle title="Meta connection" line="Your Meta key and how making an image is priced." />
      {secrets.backend === 'basic_text' && !backendDismissed && secrets.hasKey && (
        <div className="verify-banner mb-4 flex items-start gap-2" role="status">
          <Icon icon={AlertTriangle} size="sm" className="mt-0.5" style={{ color: 'var(--warning)' }} aria-hidden />
          <div className="flex-1">
            <p>This computer can't use its secure key store. Your key is protected, but less strongly.</p>
            <button type="button" className="mt-1 font-semibold" onClick={() => setBackendDismissed(true)}>Dismiss</button>
          </div>
        </div>
      )}
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Meta key</p>
            {secrets.hasKey && !editing ? (
              <p className="font-mono text-[14px]">•••• •••• {secrets.last4 ?? '••••'}</p>
            ) : (
              <p className="meta">A key from Meta. The app never shows it again after saving.</p>
            )}
            <p className="meta mt-1 flex items-center gap-1"><Icon icon={Check} size="xsm" style={{ color: secrets.hasKey ? 'var(--accent)' : 'var(--text-faint)' }} /> {checked}</p>
          </div>
          {secrets.hasKey && !editing && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void testSaved()}>
                {busy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Test Connection
              </Button>
              <Button variant="ghost" onClick={() => { setEditing(true); setKey('') }}>Replace</Button>
              <Button variant="ghost" onClick={() => void remove()}>Remove</Button>
            </div>
          )}
        </div>
        {editing && (
          <div className="mt-5 max-w-[440px]">
            <Field
              label="Meta key"
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="Paste the key from Meta"
              autoFocus
              error={error}
              hint="The key is stored on this computer. It never reaches the interface again."
            />
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => setShow((value) => !value)}>
                {show ? 'Hide key' : 'Show key'}
              </button>
              {secrets.hasKey && <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => setEditing(false)}>Cancel</button>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void testAndSave()}>
                {busy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Test and Save
              </Button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px]"
                style={{ color: 'var(--accent)' }}
                onClick={() => setKeyGuideOpen(true)}
              >
                Where do I get a key? <Icon icon={ExternalLink} size="xsm" />
              </button>
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard className="mt-4">
        <div className="flex items-start gap-3">
          <Icon icon={ShieldCheck} size="md" style={{ color: 'var(--accent)' }} aria-hidden />
          <div>
            <p className="text-[12px] font-semibold">{usd(1)} an image</p>
            <p className="hint mt-1">
              Meta charges your key {usd(1)} for every image that comes back. The price is on the button before every image.
              A refusal costs nothing. Moss does not add a fee.
            </p>
          </div>
        </div>
      </SectionCard>
      <MuseKeyGuideDialog open={keyGuideOpen} onOpenChange={setKeyGuideOpen} />
    </div>
  )
}

function BrandSection(): React.JSX.Element {
  const brand = useAppStore((state) => state.brand)
  const refreshBrand = useAppStore((state) => state.refreshBrand)
  const [value, setValue] = useState<Brand | null>(brand)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setValue(brand)
  }, [brand])
  if (!value) return <Skeleton className="h-96" />
  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await unwrap(window.moss.brand.update(value))
      await refreshBrand()
      setValue(updated)
      toast.status('Logo and colors saved.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <SettingsTitle title="Logo & Colors" line="The logo, badge, and colors used when the studio makes images." />
      <BrandFields value={value} onChange={setValue} />
      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Save Changes
        </Button>
        <p className="hint">All fields are optional.</p>
      </div>
    </div>
  )
}

function LibrarySection(): React.JSX.Element {
  const appInfo = useAppStore((state) => state.appInfo)
  const refreshAppInfo = useAppStore((state) => state.refreshAppInfo)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const settings = useAppStore((state) => state.settings)
  const confirm = useConfirm()
  const [stats, setStats] = useState<{ path: string; images: number; bytes: number } | null>(null)
  const [oldPath, setOldPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)

  const refreshStats = async (): Promise<void> => {
    try {
      setStats(await unwrap(window.moss.app.libraryStats()))
    } catch {
      setStats(null)
    }
  }
  useEffect(() => {
    void refreshStats()
  }, [])

  const copyPath = async (): Promise<void> => {
    try {
      await unwrap(window.moss.app.copyLibraryPath())
      toast.status('Library path copied.')
    } catch {
      toast.error('The path could not be copied.')
    }
  }

  const changeLocation = async (): Promise<void> => {
    const current = stats?.path ?? appInfo?.paths.library ?? ''
    const ok = await confirm({
      title: 'Change the library location?',
      body: 'The studio copies everything, checks it, then switches. The old folder stays where it is.',
      confirmLabel: 'Choose a Folder'
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await unwrap(window.moss.settings.changeLibrary())
      if (result.libraryPath !== current) {
        setOldPath(current)
        await refreshAppInfo()
        await refreshSettings()
        await refreshStats()
        toast.status('Library moved.')
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const backupNow = async (): Promise<void> => {
    setBackingUp(true)
    try {
      const result = await unwrap(window.moss.backup.create())
      if (result.created) {
        await refreshSettings()
        toast.status(`Backup saved in ${result.folderName ?? 'the folder you chose'}.`)
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBackingUp(false)
    }
  }

  const restore = async (): Promise<void> => {
    setRestoring(true)
    try {
      const result = await unwrap(window.moss.backup.restore())
      if (result.started) toast.status('Restoring the library. The app will restart.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setRestoring(false)
    }
  }

  const openBackup = async (): Promise<void> => {
    try {
      await unwrap(window.moss.backup.openLast())
    } catch {
      toast.error('There is no saved backup folder to open yet.')
    }
  }

  const diagnostics = async (): Promise<void> => {
    setDiagnosing(true)
    try {
      const result = await unwrap(window.moss.diagnostics.create())
      toast.status(`Support report saved in ${result.folderName}.`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setDiagnosing(false)
    }
  }

  return (
    <div>
      <SettingsTitle title="Storage" line="Everything the studio saves lives in one folder on this computer." />
      <SectionCard>
        <p className="field-label">Folder</p>
        <p className="break-all font-mono text-[12px]">{stats?.path ?? settings?.libraryPath ?? appInfo?.paths.library ?? 'Not set'}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] md:grid-cols-2">
          <p className="meta">{stats?.images ?? 0} {stats?.images === 1 ? 'image' : 'images'}</p>
          <p className="meta">{stats ? `${(stats.bytes / 1024 / 1024).toFixed(1)} MB` : 'Not set'}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void window.moss.app.openPath({ kind: 'library' })}>
            <Icon icon={FolderOpen} size="sm" /> Open Folder
          </Button>
          <Button variant="secondary" onClick={() => void copyPath()}>
            <Icon icon={Copy} size="sm" /> Copy Path
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void changeLocation()}>
            {busy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Change Location
          </Button>
        </div>
        {oldPath && (
          <p className="hint mt-3">
            The old folder is still at <span className="font-mono">{oldPath}</span>. A README there says it is safe to delete after you check the new one.
          </p>
        )}
      </SectionCard>
      <p className="hint mt-3">Changing the folder copies the whole library. Nothing is deleted from the old location.</p>
      <SectionCard className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="field-label">Backup</p>
            <p className="hint mt-1">A copy of the library and database in one folder. Your Meta key and secrets are not included.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={backingUp} onClick={() => void backupNow()}>
              {backingUp ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Archive} size="sm" />} Back Up Now
            </Button>
            <Button variant="secondary" disabled={restoring} onClick={() => void restore()}>
              {restoring ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={HardDriveDownload} size="sm" />} Restore
            </Button>
            <Button variant="ghost" disabled={!settings?.lastBackupAt} onClick={() => void openBackup()}>
              <Icon icon={FolderOpen} size="sm" /> Open Backup
            </Button>
          </div>
        </div>
        <p className="hint mt-3">
          {settings?.lastBackupAt ? `Last backup ${relativeTime(settings.lastBackupAt)}.` : 'No backup has been made yet.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="field-label">Support Report</p>
            <p className="hint mt-1">App information, library counts and local logs for support. No keys, prompts or images.</p>
          </div>
          <Button variant="secondary" disabled={diagnosing} onClick={() => void diagnostics()}>
            {diagnosing ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : <Icon icon={Stethoscope} size="sm" />} Create Support Report
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

function AppearanceSection(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const setTheme = useAppStore((state) => state.setTheme)
  if (!settings) return <Skeleton className="h-64" />
  const setSetting = async (key: 'density' | 'reduceMotion', value: unknown): Promise<void> => {
    try {
      await unwrap(window.moss.settings.set({ key, value }))
      await refreshSettings()
    } catch {
      toast.error('That setting could not be saved.')
    }
  }
  return (
    <div>
      <SettingsTitle title="Appearance" line="How the studio looks and moves." />
      <div className="space-y-4">
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="field-label mb-0">Theme</p>
              <p className="hint">The canvas stays near-black in both themes.</p>
            </div>
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(value) => void setTheme(value).catch(() => toast.error('The theme could not be saved.'))}
              options={[{ value: 'system' as const, label: 'System' }, { value: 'light' as const, label: 'Light' }, { value: 'dark' as const, label: 'Dark' }]}
            />
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="field-label mb-0">Density</p>
              <p className="hint">Compact tightens list rows. Photos keep their space.</p>
            </div>
            <Segmented
              label="Density"
              value={settings.density}
              onChange={(value) => void setSetting('density', value)}
              options={[{ value: 'comfortable' as const, label: 'Comfortable' }, { value: 'compact' as const, label: 'Compact' }]}
            />
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="field-label mb-0">Reduce motion</p>
              <p className="hint">Use the system preference, or choose for this app.</p>
            </div>
            <Segmented
              label="Reduce motion"
              value={settings.reduceMotion}
              onChange={(value) => void setSetting('reduceMotion', value)}
              options={[
                { value: 'system' as const, label: 'System' },
                { value: 'reduce' as const, label: 'Reduce' },
                { value: 'full' as const, label: 'Full' }
              ]}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function LicenseStatusChip({ license }: { license: LicenseState | null }): React.JSX.Element {
  if (!license) return <span className="badge">Unknown</span>
  if (license.status === 'licensed') return <span className="badge" data-tone="success"><Icon icon={Check} size="xsm" /> Licensed</span>
  if (license.status === 'grace') return <span className="badge" data-tone="warning"><Icon icon={AlertTriangle} size="xsm" /> Working Offline</span>
  if (license.status === 'expired') return <span className="badge" data-tone="danger">Expired</span>
  return <span className="badge" data-tone="warning">Not activated</span>
}

function LicenseSection(): React.JSX.Element {
  const license = useAppStore((state) => state.license)
  const appInfo = useAppStore((state) => state.appInfo)
  const applyLicense = useAppStore((state) => state.applyLicense)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  const checkNow = async (): Promise<void> => {
    setChecking(true)
    try {
      const next = await unwrap(window.moss.license.validate())
      applyLicense(next)
      if (next.status === 'licensed') toast.status('License checked.')
      else if (next.status === 'grace') toast.error('Could not reach the license server. Try again when you are online.')
      else if (next.status === 'expired') toast.error(next.message ?? 'The license needs attention.')
    } catch {
      toast.error('Could not reach the license server. Try again.')
    } finally {
      setChecking(false)
    }
  }
  const storeReady = !isStoreUrlPlaceholder(LICENSE_STORE_URL)

  const deactivate = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Remove the license from this computer?',
      body: "The library stays. You'll need the key to use the studio here again.",
      confirmLabel: 'Remove License',
      danger: true
    })
    if (!ok) return
    setBusy(true)
    try {
      const next = await unwrap(window.moss.license.deactivate())
      applyLicense(next)
      toast.status('This computer is deactivated.')
      navigate('/activation', { replace: true })
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <SettingsTitle title="License" line="Your Moss Photo Studio license, managed in the license center." />
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="field-label mb-1">Status</p>
            <div className="flex flex-wrap items-center gap-2">
              <LicenseStatusChip license={license} />
              {license?.source === 'dev' && <span className="badge" data-tone="warning">DEV</span>}
              {appInfo?.devUnlock && <span className="badge" data-tone="danger">DEV UNLOCK</span>}
            </div>
          </div>
          {license && (license.status === 'expired' || license.status === 'unlicensed' || license.status === 'offline_unlicensed') && (
            <Button variant="primary" onClick={() => navigate('/activation')}>Open Activation</Button>
          )}
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="section-label">License Key</dt>
            <dd className="mt-1 font-mono text-[12px]">{license?.keyLast4 ? `•••• ${license.keyLast4}` : 'Not activated'}</dd>
          </div>
          <div>
            <dt className="section-label">This Computer</dt>
            <dd className="mt-1 break-all text-[12px]">{license?.machineLabel ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="section-label">Last Checked</dt>
            <dd className="mt-1 text-[12px]">{license?.lastValidatedAt ? formatDateTime(license.lastValidatedAt) : 'Never'}</dd>
          </div>
          <div>
            <dt className="section-label">Offline Until</dt>
            <dd className="mt-1 text-[12px]">{license?.offlineUntil ? formatDateTime(license.offlineUntil) : 'Not set'}</dd>
          </div>
        </dl>
        {license?.message && <p className="hint mt-4">{license.message}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" disabled={checking || !license || license.source === 'dev'} onClick={() => void checkNow()}>
            {checking ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Check Now
          </Button>
          <Button variant="secondary" disabled={busy || !license || license.source === 'dev'} onClick={() => void deactivate()}>
            <Icon icon={UserRound} size="sm" /> Remove License from This Computer
          </Button>
          <button type="button" className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--accent)' }} onClick={() => void window.moss.app.openExternal({ url: LICENSE_PORTAL_URL })}>
            Manage license <Icon icon={ExternalLink} size="xsm" />
          </button>
          {storeReady ? (
            <button type="button" className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--accent)' }} onClick={() => void window.moss.app.openExternal({ url: LICENSE_STORE_URL })}>
              Buy a license <Icon icon={ExternalLink} size="xsm" />
            </button>
          ) : (
            <p className="hint">Ask the person who sold you this copy for a key.</p>
          )}
        </div>
      </SectionCard>
      <p className="hint mt-3">One key works on two computers. Deactivate this machine before activating a third.</p>
    </div>
  )
}

function PrivacySection(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const appInfo = useAppStore((state) => state.appInfo)
  const confirm = useConfirm()
  const [resetting, setResetting] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  useEffect(() => {
    void unwrap(window.moss.settings.get({ key: 'deviceId' }))
      .then((result) => setDeviceId(String(result.value ?? '')))
      .catch(() => setDeviceId(''))
  }, [])
  const deleteUsage = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete all usage history?',
      body: 'The history and the monthly totals are cleared. Images on this computer are not touched.',
      confirmLabel: 'Delete History',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.usage.deleteAll())
      toast.status('Usage history deleted.')
    } catch {
      toast.error('Usage history could not be deleted.')
    }
  }
  const resetApp = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Reset Moss Photo Studio?',
      body: 'This deletes all local app data, settings, license, and saved keys, then closes the app. It cannot be undone.',
      confirmLabel: 'Reset and Close',
      danger: true
    })
    if (!ok) return
    setResetting(true)
    const result = await window.moss.app.reset().catch(() => null)
    if (!result?.ok) {
      setResetting(false)
      toast.error('The app could not be reset.')
    }
  }
  const deleteLogs = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete the logs?',
      body: 'The app keeps local logs for troubleshooting. They never contain prompts, keys, or images.',
      confirmLabel: 'Delete Logs',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.app.deleteLogs())
      toast.status('Logs deleted.')
    } catch {
      toast.error('Logs could not be deleted.')
    }
  }
  return (
    <div>
      <SettingsTitle title="Privacy" line="Your work stays here. Only a paid image request and a license check contact anyone else." />
      <SectionCard>
        <Text weight="bold" display="block">Stays on this computer</Text>
        <Text type="supporting" color="secondary" display="block" className="mt-1">
          Your photos, projects, Sets, Products, descriptions, local adjustments, exports, and usage history live in the library folder. Moss has no account, cloud sync, telemetry, analytics, or crash reporting.
        </Text>
      </SectionCard>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SectionCard>
          <Text weight="bold" display="block">Goes to Meta only for a paid image</Text>
          <Text type="supporting" color="secondary" display="block" className="mt-1">
            Meta receives the description, the photos you chose, the requested shape and format, and a random install ID. It never receives your name, email, license key, file names, or library path.
          </Text>
          <p className="hint mt-2">If a request times out, Meta may still bill for an image that did not come back. That charge can appear on your Meta bill and not in Usage.</p>
        </SectionCard>
        <SectionCard>
          <Text weight="bold" display="block">Goes to the license center only for licensing</Text>
          <Text type="supporting" color="secondary" display="block" className="mt-1">
            When you activate, validate, or remove a license, the license center receives the key and this computer's label. It never receives your photos or descriptions.
          </Text>
        </SectionCard>
      </div>
      <SectionCard className="mt-4">
        <Collapsible defaultIsOpen={false} trigger={<Text weight="bold">Technical details</Text>}>
          <Stack gap={3} className="pt-3">
            <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[12px] font-semibold">api.meta.ai</p>
              <p className="hint mt-1">Receives the description and the working image for a request, plus a random install ID. It never receives your name, email, license key, file names, or library path.</p>
            </div>
            <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[12px] font-semibold">{LICENSE_API_HOST}</p>
              <p className="hint mt-1">Receives your license key and machine label when you activate, validate, or deactivate. The key leaves the app only for those three license calls.</p>
            </div>
            <div>
              <p className="field-label">Install ID</p>
              <p className="font-mono text-[11px]">{deviceId || 'Not set'}</p>
              <p className="hint mt-1">A random ID created on first launch. It is not you. It helps Meta handle repeated requests.</p>
            </div>
          </Stack>
        </Collapsible>
      </SectionCard>
      <SectionCard className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="field-label">Privacy controls</p>
            <p className="hint mt-1">Usage history and local logs can be deleted here. Your images and projects stay.</p>
          </div>
          <Button variant="secondary" onClick={() => void window.moss.app.openPath({ kind: 'logs' })}>
            <Icon icon={FolderOpen} size="sm" /> Open Log Folder
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={() => void deleteUsage()}>
            <Icon icon={Trash2} size="sm" /> Delete All Usage History
          </Button>
          <Button variant="secondary" onClick={() => void deleteLogs()}>
            <Icon icon={Trash2} size="sm" /> Delete Logs
          </Button>
        </div>
      </SectionCard>
      {appInfo && !appInfo.isPackaged && (
        <SectionCard className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="field-label">Reset this app</p>
              <p className="hint mt-1">
                Deletes all local app data, settings, license, and saved keys on this computer, then closes Moss.
                This cannot be undone.
              </p>
            </div>
            <Button variant="secondary" disabled={resetting} onClick={() => void resetApp()}>
              <Icon icon={RotateCcw} size="sm" /> Reset App
            </Button>
          </div>
        </SectionCard>
      )}
      <p className="hint mt-3">Library folder: <span className="font-mono">{settings?.libraryPath ?? ''}</span></p>
    </div>
  )
}

function UpdatesSection(): React.JSX.Element {
  const appInfo = useAppStore((state) => state.appInfo)
  const [auto, setAuto] = useState<AutoUpdateState | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void unwrap(window.moss.updates.state())
      .then((state) => {
        if (active) setAuto(state)
      })
      .catch(() => undefined)
    const unsubscribe = window.moss.onUpdateState((state) => setAuto(state))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const checkAuto = async (): Promise<void> => {
    setError(null)
    try {
      setAuto(await unwrap(window.moss.updates.autoCheck()))
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  const install = async (): Promise<void> => {
    setError(null)
    try {
      const installed = await unwrap(window.moss.updates.install())
      if (!installed.ok) setError('The update is not ready to install yet.')
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  const checkManual = async (): Promise<void> => {
    setChecking(true)
    setError(null)
    setResult(null)
    try {
      setResult(await unwrap(window.moss.updates.check()))
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setChecking(false)
    }
  }

  const autoSupported = auto?.supported === true
  const autoBusy = auto?.status === 'checking' || auto?.status === 'downloading'

  return (
    <div>
      <SettingsTitle
        title="Updates"
        line={
          autoSupported
            ? 'Updates download in the background. You choose when to restart.'
            : 'Check for a newer build. This build uses the manual download path.'
        }
      />
      <SectionCard>
        <p className="text-[13px]">
          You are on version <span className="font-mono">{appInfo?.version ?? APP_VERSION}</span>.
        </p>

        {autoSupported ? (
          <>
            <p className="hint mt-2">
              Automatic updates are available in the Linux AppImage build. The app checks GitHub Releases and sends
              only its version, platform, and architecture. It sends no key, email, or library data.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={autoBusy} onClick={() => void checkAuto()}>
                {autoBusy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Check for Updates
              </Button>
              {auto?.status === 'ready' && (
                <Button variant="primary" onClick={() => void install()}>
                  Restart to Update
                </Button>
              )}
              {auto?.status === 'error' && (
                <Button variant="secondary" onClick={() => void window.moss.app.openExternal({ url: auto.downloadPageUrl })}>
                  Open Download Page <Icon icon={ExternalLink} size="sm" />
                </Button>
              )}
            </div>

            {auto?.status === 'idle' && <p className="hint mt-3">You are up to date.</p>}
            {auto?.status === 'checking' && <p className="hint mt-3">Checking for a newer build.</p>}
            {(auto?.status === 'available' || auto?.status === 'downloading') && (
              <div className="mt-4 rounded-[8px] border p-3 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                <p className="font-semibold">
                  Version {auto.version ?? 'newer build'} is downloading
                  {auto.progress !== null ? ` (${Math.round(auto.progress)}%)` : ''}.
                </p>
                <p className="hint mt-1">It will be ready to install when the download finishes.</p>
              </div>
            )}
            {auto?.status === 'ready' && (
              <div className="mt-4 rounded-[8px] border p-3 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                <p className="font-semibold">Version {auto.version} is ready.</p>
                <p className="hint mt-1">Restart when you are ready. Your library is not touched.</p>
              </div>
            )}
            {auto?.notes && <p className="hint mt-3 whitespace-pre-line">{auto.notes}</p>}
            {auto?.error && <p className="hint mt-3" style={{ color: 'var(--danger)' }}>{auto.error}</p>}
            {error && <p className="hint mt-3" style={{ color: 'var(--danger)' }}>{error}</p>}
          </>
        ) : (
          <>
            <p className="hint mt-2">
              Automatic install is available in the Linux AppImage build. This build uses the portal check below.
              Nothing installs on its own.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={checking} onClick={() => void checkManual()}>
                {checking ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Check for Updates
              </Button>
              {result && !result.available && <p className="hint">You are up to date.</p>}
              {result?.available && (
                <Button
                  variant="primary"
                  onClick={() => void window.moss.app.openExternal({ url: result.downloadPageUrl })}
                >
                  Open Download Page <Icon icon={ExternalLink} size="sm" />
                </Button>
              )}
            </div>
            {result?.available && (
              <div className="mt-4 rounded-[8px] border p-3 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                <p className="font-semibold">Version {result.version} is available{result.mandatory ? ' (required)' : ''}.</p>
                {result.notes && <p className="hint mt-1">{result.notes}</p>}
                <p className="hint mt-2">Installers are downloaded from the license center's Downloads page and installed by hand in this build.</p>
              </div>
            )}
            {error && <p className="hint mt-3" style={{ color: 'var(--danger)' }}>{error}</p>}
          </>
        )}
      </SectionCard>
    </div>
  )
}

function AboutSection(): React.JSX.Element {
  const appInfo = useAppStore((state) => state.appInfo)
  return (
    <div>
      <SettingsTitle title="About" line="The quiet studio for people who sell things." />
      <SectionCard>
        <div className="flex items-center gap-3">
          <img src={markUrl()} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <div>
            <p className="wordmark text-[17px]">{APP_NAME}</p>
            <p className="meta">Version {appInfo?.version ?? 'Not set'} · built {appInfo?.buildDate ? formatDateTime(Date.parse(appInfo.buildDate)) : 'Not set'}</p>
          </div>
          {appInfo?.fakeMode && <span className="badge" data-tone="danger">FAKE MODE</span>}
          {appInfo?.devUnlock && <span className="badge" data-tone="warning">DEV</span>}
        </div>
        <p className="hint mt-4">Your work stays in the library folder shown in Settings, Storage.</p>
        <div className="mt-4">
          <Collapsible defaultIsOpen={false} trigger={<Text weight="bold">Technical details</Text>}>
            <dl className="grid gap-3 pt-3 sm:grid-cols-3">
              <div><dt className="section-label">Electron</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.electron}</dd></div>
              <div><dt className="section-label">Chromium</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.chromium}</dd></div>
              <div><dt className="section-label">Node</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.node}</dd></div>
            </dl>
          </Collapsible>
        </div>
        <p className="hint mt-5">Update controls are in Settings, Updates.</p>
        <p className="hint mt-2">Support: <span className="font-mono">{SUPPORT_EMAIL}</span></p>
        <p className="meta mt-5">
          Copyright 2026{' '}
          <button
            type="button"
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
            onClick={() => void window.moss.app.openExternal({ url: STUDIO_URL })}
          >
            Moss AI Studio
          </button>
          . All rights reserved.
        </p>
      </SectionCard>
    </div>
  )
}
