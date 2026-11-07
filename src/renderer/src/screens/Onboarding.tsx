import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Brand, JobState, ProjectDetail } from '@shared/types'
import { CATEGORY_CHIPS, recipeById } from '@shared/prompts/recipes'
import { shotDefinition } from '@shared/prompts/shots'
import { createDefaultPlan } from '@shared/plans'
import { estimateCents, usd } from '@shared/cost'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { fileToBytes } from '../lib/files'
import { markUrl } from '../lib/assets'
import { toast } from '../lib/toast'
import { warnIfSmallPhoto } from '../lib/photoWarnings'
import { applyThemeToDocument } from '../lib/theme'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Chip } from '../components/ui/Chip'
import { Dropzone } from '../components/ui/Dropzone'
import { Segmented } from '../components/ui/Segmented'
import { BrandFields } from '../components/brand/BrandFields'
import { FirstRunConfirm } from '../components/ui/FirstRunConfirm'
import { MuseKeyGuideDialog } from '../components/ui/MuseKeyGuideDialog'
import { Progress } from '../components/ui/Progress'
import { Spinner } from '../components/ui/Spinner'

const emptyBrand: Brand = {
  colors: [],
  logoUrl: null,
  badgeEnabled: false,
  badgeCorner: 'br',
  badgeScale: 'm',
  badgeOpacity: 100
}

export function Onboarding(): React.JSX.Element {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const brand = useAppStore((state) => state.brand)
  const secrets = useAppStore((state) => state.secrets)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const refreshBrand = useAppStore((state) => state.refreshBrand)
  const refreshSecrets = useAppStore((state) => state.refreshSecrets)
  const setTheme = useAppStore((state) => state.setTheme)
  const setOnboardingBypass = useAppStore((state) => state.setOnboardingBypass)
  const [step, setStep] = useState(() => Math.min(5, Math.max(0, settings?.onboardingStep ?? 0)))
  const [keyValue, setKeyValue] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyGuideOpen, setKeyGuideOpen] = useState(false)
  const [localBrand, setLocalBrand] = useState<Brand>(brand ?? emptyBrand)
  const [category, setCategory] = useState('other')
  const [photoProject, setPhotoProject] = useState<ProjectDetail | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [job, setJob] = useState<JobState | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (brand) setLocalBrand(brand)
  }, [brand])

  useEffect(() => {
    if (!settings) return
    if (secrets) void refreshSecrets()
    const savedStep = Math.min(5, Math.max(0, settings.onboardingStep))
    if (savedStep > step && step === 0) setStep(savedStep)
    // Resume only when the user had deliberately moved forward.
  }, [])

  useEffect(() => {
    if (!settings) return
    applyThemeToDocument(settings.theme)
  }, [settings])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  const goTo = async (next: number): Promise<void> => {
    setStep(next)
    setKeyError(null)
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingStep', value: next }))
      await refreshSettings()
    } catch {
      // The step still advances this session.
    }
  }

  const lookAround = (): void => {
    setOnboardingBypass(true)
    toast.status('You can finish this later in Settings.')
    navigate('/library', { replace: true })
  }

  const skip = (): void => {
    setOnboardingBypass(true)
    toast.status('You can finish this later in Settings.')
    navigate('/library', { replace: true })
  }

  const saveKey = async (): Promise<void> => {
    if (secrets?.hasKey && !keyValue.trim()) {
      setKeyBusy(true)
      try {
        const result = await unwrap(window.moss.secrets.testMuseKey({}))
        if (!result.ok) {
          setKeyError(result.code === 'invalid_key'
            ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
            : 'Could not reach Meta. Check your connection, or skip and add the key later.')
          return
        }
        await refreshSecrets()
        await goTo(2)
      } catch (caught) {
        setKeyError(messageOf(caught))
      } finally {
        setKeyBusy(false)
      }
      return
    }
    if (!keyValue.trim()) {
      setKeyError('Paste your key first.')
      return
    }
    setKeyBusy(true)
    setKeyError(null)
    try {
      const result = await unwrap(window.moss.secrets.testMuseKey({ key: keyValue.trim() }))
      if (!result.ok) {
        setKeyError(result.code === 'invalid_key'
          ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
          : 'Could not reach Meta. Check your connection, or skip and add the key later.')
        return
      }
      await unwrap(window.moss.secrets.setMuseKey({ key: keyValue.trim() }))
      await refreshSecrets()
      setKeyValue('')
      await goTo(2)
    } catch (caught) {
      setKeyError(messageOf(caught))
    } finally {
      setKeyBusy(false)
    }
  }

  const saveBrand = async (): Promise<void> => {
    try {
      await unwrap(window.moss.brand.update(localBrand))
      await refreshBrand()
      await goTo(3)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const loadProject = async (projectId: string): Promise<void> => {
    const detail = await unwrap(window.moss.projects.get({ id: projectId }))
    setPhotoProject(detail)
  }

  const afterImport = async (projectId: string): Promise<void> => {
    const project = await unwrap(window.moss.projects.get({ id: projectId }))
    if (!project.plan) {
      await unwrap(window.moss.plans.save({
        projectId,
        plan: createDefaultPlan({
          category,
          productName: project.project.name,
          shape: project.project.shape,
          format: project.project.format
        })
      }))
    }
    await loadProject(projectId)
  }

  const importFiles = async (files: File[]): Promise<void> => {
    const file = files[0]
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const result = await unwrap(window.moss.media.importBytes({
        kind: 'source',
        type: 'set',
        bytes: await fileToBytes(file),
        mime: file.type,
        name: file.name
      }))
      if (result?.projectId) { warnIfSmallPhoto(result); await afterImport(result.projectId) }
    } catch (caught) {
      setPhotoError(messageOf(caught))
    } finally {
      setPhotoBusy(false)
    }
  }

  const choosePhoto = async (): Promise<void> => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ kind: 'source', type: 'set' }))
      if (result?.projectId) { warnIfSmallPhoto(result); await afterImport(result.projectId) }
    } catch (caught) {
      setPhotoError(messageOf(caught))
    } finally {
      setPhotoBusy(false)
    }
  }

  const enabledShots = photoProject?.plan?.json.shots.filter((shot) => shot.enabled) ?? []
  const imageCount = enabledShots.length
  const runLabel = `Make ${imageCount} ${imageCount === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(imageCount))}`
  const running = job?.status === 'running'
  const sourceImage = photoProject?.images.find((image) => image.id === photoProject.project.sourceImageId)

  const beginRun = async (): Promise<void> => {
    if (!photoProject) return
    setRunError(null)
    try {
      const started = await unwrap(window.moss.jobs.startSet({ projectId: photoProject.project.id, mode: 'make' }))
      const initial = await unwrap(window.moss.jobs.state({ jobId: started.jobId }))
      setJob(initial)
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = window.setInterval(() => {
        void unwrap(window.moss.jobs.state({ jobId: started.jobId }))
          .then(async (state) => {
            setJob(state)
            if (state.status !== 'running') {
              if (pollRef.current) window.clearInterval(pollRef.current)
              pollRef.current = null
              if (state.status === 'done' && state.done > 0) {
                await loadProject(photoProject.project.id)
                await finishOnboarding()
              } else if (state.status === 'cancelled') {
                setRunError('That run was stopped.')
              } else {
                setRunError('No images came through. A refusal costs nothing. A timeout may still show on your Meta bill.')
              }
            }
          })
          .catch(() => {
            if (pollRef.current) window.clearInterval(pollRef.current)
            pollRef.current = null
            setRunError('The run could not be followed. Try again.')
          })
      }, 600)
    } catch (caught) {
      setRunError(messageOf(caught))
    }
  }

  const onMainRun = async (): Promise<void> => {
    if (!photoProject) return
    if (!secrets?.hasKey) {
      setRunError('Add your Muse key in Settings to make images.')
      return
    }
    if (!settings?.firstRunConfirmShown) {
      setConfirmOpen(true)
      return
    }
    await beginRun()
  }

  const confirmRun = async (): Promise<void> => {
    try {
      await unwrap(window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }))
      await refreshSettings()
    } catch {
      // The confirmation still counts this session.
    }
    setConfirmOpen(false)
    await beginRun()
  }

  const finishOnboarding = async (): Promise<void> => {
    setFinishing(true)
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingDone', value: true }))
      await unwrap(window.moss.settings.set({ key: 'onboardingStep', value: 5 }))
      await refreshSettings()
      setStep(5)
    } catch {
      toast.error('The setup could not be saved.')
    } finally {
      setFinishing(false)
    }
  }

  const justAddPhoto = async (): Promise<void> => {
    if (!photoProject) return
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingDone', value: true }))
      await refreshSettings()
      navigate(`/project/${photoProject.project.id}`)
    } catch {
      toast.error('The setup could not be saved.')
    }
  }

  const dots = [0, 1, 2, 3, 4, 5]
  const showNav = step > 0 && step < 5

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <header className="flex h-[64px] items-center px-8">
        <div className="flex items-center gap-2">
          <img src={markUrl()} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="wordmark">Moss Photo Studio</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-6 pb-10">
        {step === 0 && (
          <div className="my-auto">
            <p className="section-label">Welcome</p>
            <h1 className="display-xl mt-3">Your shop's photo studio.</h1>
            <p className="mt-4 text-[15px]" style={{ color: 'var(--text-muted)' }}>
              One photo in, a full set out. Change any photo. Make one from words.
            </p>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-faint)' }}>
              Everything stays on this computer. Your Muse key is the only connection.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void goTo(1)}>Set Up the Studio</Button>
              <Button variant="ghost" onClick={lookAround}>Look Around First</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="my-auto">
            <p className="section-label">Step 2 of 6</p>
            <h1 className="page-title mt-2 text-[24px]">Connect Meta Muse</h1>
            <p className="mt-3 max-w-[560px] text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Moss Photo Studio uses your own Meta key. Meta charges your account one cent for every image it makes. The app shows the price before every run.
            </p>
            <div className="mt-6 max-w-[440px]">
              <Field
                label="Muse key"
                type={revealKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder={secrets?.hasKey ? `Saved key ending ${secrets.last4 ?? '••••'}. Paste a new one to replace it.` : 'LLM|...'}
                error={keyError}
                autoFocus
              />
              <div className="mt-1 flex items-center justify-between">
                <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => setRevealKey((value) => !value)}>
                  {revealKey ? 'Hide key' : 'Show key'}
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--accent)' }} onClick={() => setKeyGuideOpen(true)}>
                  Where do I get a key? <ChevronRight size={12} />
                </button>
              </div>
              <Button variant="primary" className="mt-4" disabled={keyBusy} onClick={() => void saveKey()}>
                {keyBusy ? <Loader2 size={14} className="animate-spin" /> : null} Test and Save
              </Button>
              <p className="hint mt-3">The key is stored in your system keyring and never leaves this computer.</p>
              {secrets?.hasKey && <p className="hint mt-1">A key is already saved ending {secrets.last4 ?? '••••'}.</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-8">
            <p className="section-label">Step 3 of 6</p>
            <h1 className="page-title mt-2 text-[24px]">Make it yours</h1>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>Choose a theme, then add your logo and colors. Optional; you can change this in Settings later.</p>
            <div className="card mt-5 p-4">
              <p className="section-label">Appearance</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold">Theme</p>
                  <p className="hint">Light, dark, or follow the system.</p>
                </div>
                <Segmented
                  label="Theme"
                  value={settings?.theme ?? 'light'}
                  onChange={(value) => void setTheme(value).catch(() => toast.error('The theme could not be saved.'))}
                  options={[
                    { value: 'system' as const, label: 'System' },
                    { value: 'light' as const, label: 'Light' },
                    { value: 'dark' as const, label: 'Dark' }
                  ]}
                />
              </div>
            </div>
            <div className="mt-5">
              <BrandFields value={localBrand} onChange={setLocalBrand} maxColors={3} />
            </div>
            <div className="mt-7 flex items-center gap-3">
              <Button variant="primary" onClick={() => void saveBrand()}>Save and Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-8">
            <p className="section-label">Step 4 of 6</p>
            <h1 className="page-title mt-2 text-[24px]">What are you making first?</h1>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>This picks the recipe for your first set. You can change it later.</p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {CATEGORY_CHIPS.map((chip) => (
                <Chip key={chip.id} selected={category === chip.id} onClick={() => setCategory(chip.id)}>{chip.label}</Chip>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-3">
              <Button variant="primary" onClick={() => void goTo(4)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-8">
            <p className="section-label">Step 5 of 6</p>
            <h1 className="page-title mt-2 text-[24px]">Make your first set</h1>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Drop one photo of a product. The studio plans six images and tells you the cost before it starts.
            </p>
            {!secrets?.hasKey ? (
              <div className="card mt-6 p-5">
                <p className="font-semibold">Add your Muse key first</p>
                <p className="hint mt-1">The key is what Meta charges for the images. Nothing runs without it.</p>
                <Button variant="primary" className="mt-4" onClick={() => void goTo(1)}>Add Your Key</Button>
              </div>
            ) : !photoProject ? (
              <>
                <div className="mt-6">
                  <Dropzone
                    line={photoBusy ? 'Opening...' : 'One clear photo of the product. The better the light, the better the set.'}
                    hint="JPEG, PNG or WebP. Up to 40 MB."
                    onClick={() => void choosePhoto()}
                    onFiles={(files) => void importFiles(files)}
                    label="Choose a Photo"
                  />
                </div>
                {photoError && <p className="error-text mt-2" role="alert">{photoError}</p>}
                <p className="hint mt-3">Your recipe: {recipeById(category).label}. You can edit the plan before it runs.</p>
              </>
            ) : (
              <>
                <div className="mt-5 overflow-hidden rounded-[14px] border" style={{ borderColor: 'var(--border)', background: 'var(--canvas)' }}>
                  {sourceImage?.url && <img src={sourceImage.url} alt="The product photo" className="max-h-[300px] w-full object-contain" />}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {enabledShots.map((shot) => (
                    <span key={shot.id} className="badge">{shotDefinition(shot.type).label}</span>
                  ))}
                </div>
                <p className="mt-3 text-[13px] font-medium">
                  {imageCount} images. Meta charges {usd(estimateCents(imageCount))}.
                </p>
                {running && job ? (
                  <div className="card mt-4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold">Making {job.done + job.failed + 1 <= job.total ? job.done + job.failed + 1 : job.total} of {job.total}</p>
                      <p className="meta tabular">{usd(job.costCents)} so far</p>
                    </div>
                    <div className="mt-2"><Progress value={job.done + job.failed} max={job.total} label={`${job.done} of ${job.total} images made`} /></div>
                    <p className="meta mt-2" aria-live="polite">{job.currentLabel ? `Making ${job.currentLabel}.` : 'Working.'} {job.done} made, {job.failed} failed.</p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="primary" onClick={() => void onMainRun()}>{runLabel}</Button>
                    <Button variant="ghost" onClick={() => void justAddPhoto()}>Just Add the Photo</Button>
                  </div>
                )}
                {runError && <p className="error-text mt-2" role="alert">{runError}</p>}
                {finishing && <p className="hint mt-2 flex items-center gap-2"><Spinner /> Finishing setup.</p>}
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="my-auto">
            <p className="section-label">Done</p>
            <h1 className="display-xl mt-2">You're set up.</h1>
            <p className="mt-3 text-[14px]" style={{ color: 'var(--text-muted)' }}>Three things worth knowing.</p>
            <ol className="mt-5 space-y-3 text-[13px]">
              <li className="flex gap-3"><span className="font-semibold" style={{ color: 'var(--accent)' }}>1.</span> The cost is on the button before every run.</li>
              <li className="flex gap-3"><span className="font-semibold" style={{ color: 'var(--accent)' }}>2.</span> Drag a photo anywhere in the app to start.</li>
              <li className="flex gap-3"><span className="font-semibold" style={{ color: 'var(--accent)' }}>3.</span> Press Ctrl K, or Command K on a Mac, to jump anywhere.</li>
            </ol>
            <Button variant="primary" className="mt-8" onClick={() => navigate('/library', { replace: true })}>Open My Library</Button>
          </div>
        )}
      </main>
      <footer className="flex items-center justify-between px-8 pb-6">
        <div className="flex items-center gap-2" role="group" aria-label={`Step ${step + 1} of 6`}>
          {dots.map((dot) => (
            <span
              key={dot}
              className="rounded-full"
              style={{
                width: dot === step ? 8 : 6,
                height: dot === step ? 8 : 6,
                background: dot === step ? 'var(--primary)' : dot < step ? 'var(--accent)' : 'var(--border-strong)',
                opacity: dot === step ? 1 : dot < step ? 0.7 : 0.6
              }}
              aria-current={dot === step ? 'step' : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showNav && <Button variant="ghost" size="sm" onClick={() => void goTo(step - 1)}><ArrowLeft size={14} /> Back</Button>}
          {showNav && <Button variant="ghost" size="sm" onClick={skip}>Skip</Button>}
        </div>
      </footer>

      <MuseKeyGuideDialog open={keyGuideOpen} onOpenChange={setKeyGuideOpen} />

      <FirstRunConfirm
        open={confirmOpen}
        runLabel={runLabel}
        imageCount={imageCount}
        onOpenChange={setConfirmOpen}
        onGotIt={() => {
          setConfirmOpen(false)
          void window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }).then(() => refreshSettings()).catch(() => undefined)
        }}
        onConfirm={() => void confirmRun()}
      />
    </div>
  )
}
