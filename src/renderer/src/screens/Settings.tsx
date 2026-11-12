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
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound
} from 'lucide-react'
import type { Brand, LicenseState } from '@shared/types'
import { APP_NAME, LICENSE_STORE_URL, SUPPORT_EMAIL, isStoreUrlPlaceholder } from '@shared/constants'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { MuseKeyGuideDialog } from '../components/ui/MuseKeyGuideDialog'
import { BrandFields } from '../components/brand/BrandFields'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { usd, formatDateTime, relativeTime } from '../lib/format'
import { toast } from '../lib/toast'
import { markUrl } from '../lib/assets'
import { Skeleton } from '../components/ui/Skeleton'
import { Card, Heading, Text, TextArea, TextInput } from '@astryxdesign/core'
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
  const section = params.section ?? 'studio'
  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="mx-auto w-full max-w-[880px] px-8 py-7">
          {section === 'studio' && <StudioSection />}
          {section === 'brand' && <BrandSection />}
          {section === 'business' && <BusinessSection />}
          {section === 'library' && <LibrarySection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'license' && <LicenseSection />}
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
      toast.status('Muse key saved.')
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
      title: 'Remove the Muse key?',
      body: 'Paid runs stop until you add a key again. Your projects and images stay on this computer.',
      confirmLabel: 'Remove Key',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.secrets.clearMuseKey())
      await refreshSecrets()
      setEditing(true)
      toast.status('Muse key removed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  if (!secrets) return <Skeleton className="h-64" />
  const checked = secrets.validatedAt ? `Checked ${relativeTime(secrets.validatedAt)}` : 'Not checked yet'
  return (
    <div>
      <SettingsTitle title="API key" line="Your Muse key and how making an image is priced." />
      {secrets.backend === 'basic_text' && !backendDismissed && secrets.hasKey && (
        <div className="verify-banner mb-4 flex items-start gap-2" role="status">
          <AlertTriangle size={16} className="mt-0.5" style={{ color: 'var(--warning)' }} aria-hidden />
          <div className="flex-1">
            <p>Your system keyring isn't available. The key is stored with basic protection on this computer.</p>
            <button type="button" className="mt-1 font-semibold" onClick={() => setBackendDismissed(true)}>Dismiss</button>
          </div>
        </div>
      )}
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Muse key</p>
            {secrets.hasKey && !editing ? (
              <p className="font-mono text-[14px]">•••• •••• {secrets.last4 ?? '••••'}</p>
            ) : (
              <p className="meta">A key from Meta. The app never shows it again after saving.</p>
            )}
            <p className="meta mt-1 flex items-center gap-1"><Check size={13} style={{ color: secrets.hasKey ? 'var(--accent)' : 'var(--text-faint)' }} /> {checked}</p>
          </div>
          {secrets.hasKey && !editing && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void testSaved()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Test Connection
              </Button>
              <Button variant="ghost" onClick={() => { setEditing(true); setKey('') }}>Replace</Button>
              <Button variant="ghost" onClick={() => void remove()}>Remove</Button>
            </div>
          )}
        </div>
        {editing && (
          <div className="mt-5 max-w-[440px]">
            <Field
              label="Muse key"
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="LLM|..."
              autoFocus
              error={error}
              hint="Stored in your system keyring. It never reaches the interface again."
            />
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => setShow((value) => !value)}>
                {show ? 'Hide key' : 'Show key'}
              </button>
              {secrets.hasKey && <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => setEditing(false)}>Cancel</button>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void testAndSave()}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Test and Save
              </Button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px]"
                style={{ color: 'var(--accent)' }}
                onClick={() => setKeyGuideOpen(true)}
              >
                Where do I get a key? <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard className="mt-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} aria-hidden />
          <div>
            <p className="text-[12px] font-semibold">One cent an image</p>
            <p className="hint mt-1">
              Meta charges your key {usd(1)} for every image that comes back. The price is on the button before every run.
              A refusal costs nothing. The app does not add a fee.
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
          {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Changes
        </Button>
        <p className="hint">All fields are optional.</p>
      </div>
    </div>
  )
}

function BusinessSection(): React.JSX.Element {
  const brand = useAppStore((state) => state.brand)
  const refreshBrand = useAppStore((state) => state.refreshBrand)
  const [value, setValue] = useState({
    businessName: '',
    sells: '',
    audience: '',
    voice: '',
    policies: '',
    marketplaces: '',
    defaultPlatform: 'etsy'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!brand) return
    setValue({
      businessName: brand.businessName ?? '',
      sells: brand.sells ?? '',
      audience: brand.audience ?? '',
      voice: brand.voice ?? '',
      policies: brand.policies ?? '',
      marketplaces: (brand.marketplaces ?? []).join(', '),
      defaultPlatform: brand.defaultPlatform ?? 'etsy'
    })
  }, [brand])

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await unwrap(
        window.moss.brand.update({
          businessName: value.businessName.trim(),
          sells: value.sells.trim(),
          audience: value.audience.trim(),
          voice: value.voice.trim(),
          policies: value.policies.trim(),
          marketplaces: value.marketplaces
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .slice(0, 12),
          defaultPlatform: value.defaultPlatform
        })
      )
      await refreshBrand()
      toast.status('Business profile saved.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SettingsTitle title="Business" line="The details used when the studio writes for your shop." />
      <SectionCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Business name" value={value.businessName} onChange={(next) => setValue({ ...value, businessName: next })} width="100%" />
          <TextInput label="What you sell" value={value.sells} onChange={(next) => setValue({ ...value, sells: next })} placeholder="Hand-thrown ceramics" width="100%" />
        </div>
        <div className="mt-4">
          <TextInput label="Who buys it" value={value.audience} onChange={(next) => setValue({ ...value, audience: next })} placeholder="People setting up a calm home office" width="100%" />
        </div>
        <div className="mt-4">
          <TextArea label="How you write" value={value.voice} onChange={(next) => setValue({ ...value, voice: next })} rows={3} placeholder="Warm, specific, no hype. Short sentences." width="100%" />
        </div>
        <div className="mt-4">
          <TextArea label="Standard answers" value={value.policies} onChange={(next) => setValue({ ...value, policies: next })} rows={4} placeholder="Materials, sizes, shipping times, and returns you repeat in listings." width="100%" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextInput label="Where you sell" value={value.marketplaces} onChange={(next) => setValue({ ...value, marketplaces: next })} placeholder="Etsy, my own shop" width="100%" />
          <div>
            <label className="field-label" htmlFor="default-platform">Main platform</label>
            <select id="default-platform" className="field" value={value.defaultPlatform} onChange={(event) => setValue({ ...value, defaultPlatform: event.target.value })}>
              <option value="etsy">Etsy</option>
              <option value="shopify">Shopify</option>
              <option value="own">My own site or in person</option>
              <option value="other">Somewhere else</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="hint">Optional. The Listing Writer will use this instead of asking again.</p>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Profile
          </Button>
        </div>
      </SectionCard>
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
      toast.status(`Diagnostics saved in ${result.folderName}.`)
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
            <FolderOpen size={15} /> Open Folder
          </Button>
          <Button variant="secondary" onClick={() => void copyPath()}>
            <Copy size={15} /> Copy Path
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void changeLocation()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Change Location
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
            <p className="hint mt-1">A copy of the library and database in one folder. Your Muse key and secrets are not included.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={backingUp} onClick={() => void backupNow()}>
              {backingUp ? <Loader2 size={14} className="animate-spin" /> : <Archive size={15} />} Back Up Now
            </Button>
            <Button variant="secondary" disabled={restoring} onClick={() => void restore()}>
              {restoring ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={15} />} Restore
            </Button>
            <Button variant="ghost" disabled={!settings?.lastBackupAt} onClick={() => void openBackup()}>
              <FolderOpen size={15} /> Open Backup
            </Button>
          </div>
        </div>
        <p className="hint mt-3">
          {settings?.lastBackupAt ? `Last backup ${relativeTime(settings.lastBackupAt)}.` : 'No backup has been made yet.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="field-label">Diagnostics</p>
            <p className="hint mt-1">App information, library counts and local logs for support. No keys, prompts or images.</p>
          </div>
          <Button variant="secondary" disabled={diagnosing} onClick={() => void diagnostics()}>
            {diagnosing ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={15} />} Create Diagnostics
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
            <label className="sr-only" htmlFor="reduce-motion">Reduce motion</label>
            <select id="reduce-motion" className="field w-[180px]" value={settings.reduceMotion} onChange={(event) => void setSetting('reduceMotion', event.target.value)}>
              <option value="system">Use system setting</option>
              <option value="reduce">Reduce motion</option>
              <option value="full">Full motion</option>
            </select>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function LicenseStatusChip({ license }: { license: LicenseState | null }): React.JSX.Element {
  if (!license) return <span className="badge">Unknown</span>
  if (license.status === 'licensed') return <span className="badge" data-tone="success"><Check size={12} /> Licensed</span>
  if (license.status === 'grace') return <span className="badge" data-tone="warning"><AlertTriangle size={12} /> Offline grace</span>
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
      title: 'Deactivate this computer?',
      body: "The library stays. You'll need the key to use the studio here again.",
      confirmLabel: 'Deactivate This Machine',
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
      <SettingsTitle title="License" line="Your one-time license for Moss Photo Studio." />
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
            <dt className="section-label">Key</dt>
            <dd className="mt-1 font-mono text-[12px]">{license?.keyLast4 ? `•••• ${license.keyLast4}` : 'Not activated'}</dd>
          </div>
          <div>
            <dt className="section-label">Machine</dt>
            <dd className="mt-1 break-all text-[12px]">{license?.machineLabel ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="section-label">Last check</dt>
            <dd className="mt-1 text-[12px]">{license?.lastValidatedAt ? formatDateTime(license.lastValidatedAt) : 'Never'}</dd>
          </div>
          <div>
            <dt className="section-label">Offline until</dt>
            <dd className="mt-1 text-[12px]">{license?.offlineUntil ? formatDateTime(license.offlineUntil) : 'Not set'}</dd>
          </div>
        </dl>
        {license?.message && <p className="hint mt-4">{license.message}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" disabled={checking || !license || license.source === 'dev'} onClick={() => void checkNow()}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : null} Check Now
          </Button>
          <Button variant="secondary" disabled={busy || !license || license.source === 'dev'} onClick={() => void deactivate()}>
            <UserRound size={15} /> Deactivate This Machine
          </Button>
          {storeReady ? (
            <button type="button" className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--accent)' }} onClick={() => void window.moss.app.openExternal({ url: LICENSE_STORE_URL })}>
              Buy a license <ExternalLink size={12} />
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
  const confirm = useConfirm()
  const [deviceId, setDeviceId] = useState('')
  useEffect(() => {
    void unwrap(window.moss.settings.get({ key: 'deviceId' }))
      .then((result) => setDeviceId(String(result.value ?? '')))
      .catch(() => setDeviceId(''))
  }, [])
  const deleteUsage = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete all usage history?',
      body: 'The ledger and the monthly totals are cleared. Images on this computer are not touched.',
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
      <SettingsTitle title="Privacy" line="What leaves this computer, and what never does." />
      <SectionCard>
        <p className="text-[13px]">
          Your photos and projects live on this computer. Two hosts receive anything: Meta gets the words and the image for a run, and the license store checks your key. Nothing else leaves.
        </p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[12px] font-semibold">api.meta.ai</p>
            <p className="hint mt-1">Receives the direction and the working image for a run, plus a random install ID. It never receives your name, email, license key, file names, or library path.</p>
          </div>
          <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[12px] font-semibold">api.lemonsqueezy.com</p>
            <p className="hint mt-1">Receives your license key and machine label when you activate, validate, or deactivate. The key leaves the app only for those three license calls.</p>
          </div>
        </div>
        <p className="hint mt-4">There is no telemetry, analytics, crash reporting, or cloud sync.</p>
        <p className="hint mt-1">The app cannot see a request Meta billed but never answered. If Meta made an image after a timeout, it may appear on your Meta bill and not in this ledger.</p>
      </SectionCard>
      <SectionCard className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="field-label">Install ID</p>
            <p className="font-mono text-[11px]">{deviceId || 'Not set'}</p>
            <p className="hint mt-1">A random ID created on first launch. It is not you. It helps Meta handle repeated requests.</p>
          </div>
          <Button variant="secondary" onClick={() => void window.moss.app.openPath({ kind: 'logs' })}>
            <FolderOpen size={15} /> Open Log Folder
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" onClick={() => void deleteUsage()}>
            <Trash2 size={15} /> Delete All Usage History
          </Button>
          <Button variant="secondary" onClick={() => void deleteLogs()}>
            <Trash2 size={15} /> Delete Logs
          </Button>
        </div>
      </SectionCard>
      <p className="hint mt-3">Library folder: <span className="font-mono">{settings?.libraryPath ?? ''}</span></p>
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
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div><dt className="section-label">Electron</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.electron}</dd></div>
          <div><dt className="section-label">Chromium</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.chromium}</dd></div>
          <div><dt className="section-label">Node</dt><dd className="mt-1 text-[12px] tabular">{appInfo?.releases.node}</dd></div>
        </dl>
        <p className="hint mt-5">Updates are manual in this version.</p>
        <p className="hint mt-2">Support: <span className="font-mono">{SUPPORT_EMAIL}</span></p>
        <p className="meta mt-5">Copyright 2026 Moss Toolbox. All rights reserved.</p>
      </SectionCard>
    </div>
  )
}
