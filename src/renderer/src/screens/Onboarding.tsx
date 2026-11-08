import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Image as ImageIcon, Layers, Sparkles } from 'lucide-react'
import type { JobState, PlanJson, Product } from '@shared/types'
import { CATEGORY_CHIPS, recipeById } from '@shared/prompts/recipes'
import { createDefaultPlan } from '@shared/plans'
import { shapeForImage } from '@shared/shapes'
import { estimateCents, usd } from '@shared/cost'
import {
  Badge,
  Banner,
  Button,
  Card,
  FileInput,
  Grid,
  Heading,
  ProgressBar,
  Selector,
  Stack,
  Step,
  Stepper,
  Text,
  TextInput
} from '@astryxdesign/core'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { fileToBytes } from '../lib/files'
import { markUrl } from '../lib/assets'
import { toast } from '../lib/toast'
import { warnIfSmallPhoto } from '../lib/photoWarnings'
import { FirstSetPicker } from '../features/onboarding/FirstSetPicker'
import { FirstRunConfirm } from '../components/ui/FirstRunConfirm'
import { MuseKeyGuideDialog } from '../components/ui/MuseKeyGuideDialog'

const STEPS = [
  { label: 'Welcome', optional: false },
  { label: 'Connect Meta', optional: false },
  { label: 'Add product', optional: false },
  { label: 'Make a set', optional: true },
  { label: 'Ready', optional: false }
] as const

function normaliseStep(value: number): number {
  const saved = Math.max(0, Math.min(5, Math.floor(value)))
  if (saved <= 1) return saved
  if (saved >= 5) return 4
  return 2
}

function productNameFromFile(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim().slice(0, 80)
  return base || 'Product'
}

function ToolCard({
  icon,
  title,
  body
}: {
  icon: React.JSX.Element
  title: string
  body: string
}): React.JSX.Element {
  return (
    <Card padding={4} variant="muted">
      <Stack gap={2}>
        <span
          className="grid h-10 w-10 place-items-center rounded-full"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}
        >
          {icon}
        </span>
        <Text weight="bold">{title}</Text>
        <Text type="supporting" color="secondary">
          {body}
        </Text>
      </Stack>
    </Card>
  )
}

export function Onboarding(): React.JSX.Element {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const products = useAppStore((state) => state.products)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const refreshSecrets = useAppStore((state) => state.refreshSecrets)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const setOnboardingBypass = useAppStore((state) => state.setOnboardingBypass)

  const savedStep = normaliseStep(settings?.onboardingStep ?? 0)
  const [step, setStep] = useState(() => Math.min(2, savedStep))
  const [category, setCategory] = useState(() => {
    const saved = settings?.onboardingCategory ?? 'other'
    return CATEGORY_CHIPS.some((chip) => chip.id === saved) ? saved : 'other'
  })
  const [product, setProduct] = useState<Product | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [savedProductId, setSavedProductId] = useState('')
  const [planDraft, setPlanDraft] = useState<PlanJson | null>(null)
  const [setProjectId, setSetProjectId] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyGuideOpen, setKeyGuideOpen] = useState(false)
  const [job, setJob] = useState<JobState | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const pollRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (secrets) void refreshSecrets()
    // Key status is refreshed once when onboarding opens.
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [step])

  const goTo = async (next: number): Promise<void> => {
    setStep(next)
    setKeyError(null)
    setRunError(null)
    if (next === 3) ensurePlan()
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingStep', value: next }))
      await refreshSettings()
    } catch {
      // The step still advances this session.
    }
  }

  const skip = (): void => {
    setOnboardingBypass(true)
    void window.moss.settings
      .set({ key: 'onboardingDismissed', value: true })
      .then(() => refreshSettings())
      .catch(() => undefined)
    toast.status('You can finish setting up later from the Library.')
    navigate('/library', { replace: true })
  }

  const buildPlan = (categoryId: string): PlanJson | null => {
    if (!product) return null
    return createDefaultPlan({
      category: categoryId,
      productName: product.name,
      shape: shapeForImage(product.width, product.height),
      format: settings?.defaultFormat ?? 'webp'
    })
  }

  const ensurePlan = (categoryId = category): void => {
    if (!product) return
    setPlanDraft((current) => (current && current.category === categoryId ? current : buildPlan(categoryId)))
  }

  const changeCategory = (next: string): void => {
    setCategory(next)
    setPlanDraft(buildPlan(next))
    setRunError(null)
    void unwrap(window.moss.settings.set({ key: 'onboardingCategory', value: next }))
      .then(() => refreshSettings())
      .catch(() => undefined)
  }

  const addProduct = (next: Product): void => {
    setProduct(next)
    setSavedProductId(next.id)
    setSetProjectId(null)
    setPlanDraft(null)
    setPhotoError(null)
    setRunError(null)
    warnIfSmallPhoto(next)
    void refreshProducts().catch(() => undefined)
  }

  const importFile = async (file: File): Promise<void> => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const created = await unwrap(
        window.moss.products.createFromBytes({
          bytes: await fileToBytes(file),
          name: productNameFromFile(file.name)
        })
      )
      addProduct(created)
      setPhotoFile(file)
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
      const created = await unwrap(window.moss.dialogs.pickProduct())
      if (created) {
        addProduct(created)
        setPhotoFile(null)
      }
    } catch (caught) {
      setPhotoError(messageOf(caught))
    } finally {
      setPhotoBusy(false)
    }
  }

  const useSavedProduct = (id: string): void => {
    setSavedProductId(id)
    const found = products.find((entry) => entry.id === id)
    if (found) addProduct(found)
  }

  const saveKey = async (): Promise<void> => {
    if (secrets?.hasKey && !keyValue.trim()) {
      setKeyBusy(true)
      try {
        const result = await unwrap(window.moss.secrets.testMuseKey({}))
        if (!result.ok) {
          setKeyError(
            result.code === 'invalid_key'
              ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
              : 'Could not reach Meta. Check your connection, or add the key later.'
          )
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
        setKeyError(
          result.code === 'invalid_key'
            ? "Meta didn't accept that key. Copy it again from the Meta dashboard."
            : 'Could not reach Meta. Check your connection, or add the key later.'
        )
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

  const imageCount = planDraft?.shots.filter((shot) => shot.enabled).length ?? 0
  const running = job?.status === 'running'
  const hasKey = Boolean(secrets?.hasKey)
  const runLabel =
    imageCount === 0
      ? 'Choose at least one image'
      : `Make ${imageCount} ${imageCount === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(imageCount))}`

  const beginRun = async (): Promise<void> => {
    if (!product || !planDraft || imageCount === 0) return
    setRunError(null)
    setStarting(true)
    try {
      let projectId = setProjectId
      if (!projectId) {
        const detail = await unwrap(
          window.moss.products.createProject({ productId: product.id, type: 'set', name: product.name })
        )
        projectId = detail.project.id
        setSetProjectId(projectId)
      }
      await unwrap(window.moss.plans.save({ projectId, plan: planDraft }))
      const started = await unwrap(window.moss.jobs.startSet({ projectId, mode: 'make' }))
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
    } finally {
      setStarting(false)
    }
  }

  const onMainRun = async (): Promise<void> => {
    if (!product || !planDraft || imageCount === 0) return
    if (!hasKey) {
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
      await unwrap(window.moss.settings.set({ key: 'onboardingStep', value: 4 }))
      await refreshSettings()
      setStep(4)
    } catch {
      toast.error('The setup could not be saved.')
    } finally {
      setFinishing(false)
    }
  }

  const saveProductOnly = async (): Promise<void> => {
    if (!product) return
    setFinishing(true)
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingDone', value: true }))
      await unwrap(window.moss.settings.set({ key: 'onboardingStep', value: 4 }))
      await refreshSettings()
      toast.status('Product saved. Open it to make a set.')
      navigate('/products', { replace: true })
    } catch {
      toast.error('The setup could not be saved.')
    } finally {
      setFinishing(false)
    }
  }

  const primaryLabel =
    step === 0
      ? 'Set up the studio'
      : step === 1
        ? hasKey && !keyValue.trim()
          ? 'Continue'
          : 'Test and connect'
        : step === 2
          ? 'Continue'
          : step === 3
            ? hasKey
              ? runLabel
              : 'Add your Meta key'
            : 'Open Library'

  const primaryDisabled =
    finishing ||
    starting ||
    running ||
    (step === 1 && keyBusy) ||
    (step === 2 && (!product || photoBusy)) ||
    (step === 3 && hasKey && (!planDraft || imageCount === 0))

  const onPrimary = (): void => {
    if (step === 0) void goTo(1)
    else if (step === 1) void saveKey()
    else if (step === 2) void goTo(3)
    else if (step === 3) {
      if (!hasKey) void goTo(1)
      else void onMainRun()
    } else {
      navigate('/library', { replace: true })
    }
  }

  const secondaryActions =
    step === 0 ? (
      <Button label="Look around first" variant="ghost" onClick={skip} />
    ) : step === 1 ? (
      <Button label="Add key later" variant="ghost" onClick={() => void goTo(2)} />
    ) : step === 2 ? (
      product ? <Button label="Choose a different photo" variant="ghost" onClick={() => { setProduct(null); setPhotoFile(null); setPlanDraft(null); setSetProjectId(null) }} /> : null
    ) : step === 3 ? (
      <Button label="Save product only" variant="secondary" isDisabled={starting || finishing || running} onClick={() => void saveProductOnly()} />
    ) : (
      <Button label="Open Products" variant="secondary" onClick={() => navigate('/products', { replace: true })} />
    )

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-background-body)' }}>
      <header className="flex h-[64px] shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img src={markUrl()} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="wordmark">Moss Photo Studio</span>
          <Badge label="Setup" variant="neutral" />
        </div>
        <Button label="Finish later" variant="ghost" size="sm" onClick={skip} />
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-6 pb-24">
          <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="hidden xl:block">
              <Card padding={4} className="h-fit">
                <Stack gap={4}>
                  <Text type="label" color="secondary">
                    Your setup
                  </Text>
                  <Stepper
                    activeStep={step}
                    orientation="vertical"
                    label="Setup steps"
                  >
                    {STEPS.map((entry, index) => (
                      <Step
                        key={entry.label}
                        step={index}
                        label={entry.label}
                        isOptional={entry.optional}
                        isDisabled={index > step}
                      />
                    ))}
                  </Stepper>
                  <Stack gap={1}>
                    <Text type="supporting" color="secondary">
                      Optional
                    </Text>
                    <Text type="body" color="secondary">
                      Logo and colors live in Settings whenever you want them.
                    </Text>
                    <Button
                      label="Open Settings"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/settings/brand')}
                    />
                  </Stack>
                </Stack>
              </Card>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="xl:hidden">
                <Stepper
                  activeStep={step}
                  label="Setup steps"
                  horizontalOptions={{ minimumStepWidth: 96, collapsedVariant: 'withLabel' }}
                >
                  {STEPS.map((entry, index) => (
                    <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} isDisabled={index > step} />
                  ))}
                </Stepper>
              </div>

              <Card padding={6} elevation="low">
                <Stack gap={5}>
                  {step === 0 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">
                          Welcome
                        </Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1}>
                          Your shop's photo studio.
                        </Heading>
                        <Text type="body" color="secondary">
                          One photo in, a full set out. Change any photo. Make one from words.
                        </Text>
                      </Stack>
                      <Grid columns={{ minWidth: 180 }} gap={3}>
                        <ToolCard icon={<Layers size={20} />} title="Set Creator" body="One photo in, a full set out." />
                        <ToolCard icon={<ImageIcon size={20} />} title="Image Editor" body="Change a photo you already have." />
                        <ToolCard icon={<Sparkles size={20} />} title="Image Generator" body="Describe a picture and make it." />
                      </Grid>
                      <Text type="supporting" color="secondary">
                        Everything stays on this computer. Your Meta key is the only connection.
                      </Text>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">
                          Step 2 of 4
                        </Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1}>
                          Connect Meta Muse
                        </Heading>
                        <Text type="body" color="secondary">
                          Moss uses your own Meta key to make images. Meta charges your account one cent for each image that comes back.
                        </Text>
                      </Stack>
                      <Banner
                        status={hasKey ? 'success' : 'info'}
                        title={hasKey ? `Meta connected ending ${secrets?.last4 ?? '••••'}` : 'What you need'}
                        description={
                          hasKey
                            ? 'The saved key is ready to use. Continue to add your first product.'
                            : 'A Meta account, a payment method, and about two minutes. The key is stored on this computer.'
                        }
                        collapsible={false}
                      />
                      <TextInput
                        label="Muse key"
                        type={revealKey ? 'text' : 'password'}
                        value={keyValue}
                        onChange={setKeyValue}
                        onEnter={() => void saveKey()}
                        placeholder={hasKey ? `Saved key ending ${secrets?.last4 ?? '••••'}. Paste a new one to replace it.` : 'LLM|...'}
                        description="The key is stored in your system keyring and never leaves this computer."
                        status={keyError ? { type: 'error', message: keyError } : undefined}
                        width="100%"
                        hasAutoFocus
                      />
                      <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                        <Button
                          label={revealKey ? 'Hide key' : 'Show key'}
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevealKey((value) => !value)}
                        />
                        <Button
                          label="Where do I get a key?"
                          variant="ghost"
                          size="sm"
                          onClick={() => setKeyGuideOpen(true)}
                        />
                      </Stack>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">
                          Step 3 of 4
                        </Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1}>
                          Add your first product
                        </Heading>
                        <Text type="body" color="secondary">
                          One photo. It becomes a Product you can reuse in a set, the editor, or the generator.
                        </Text>
                      </Stack>
                      {product ? (
                        <Card padding={4}>
                          <Stack direction="horizontal" gap={4} align="start" wrap="wrap">
                            <img
                              src={product.imageUrl}
                              alt="The product photo"
                              className="h-36 w-44 rounded-lg object-contain"
                              style={{ background: 'var(--color-background-muted)' }}
                            />
                            <Stack gap={2} className="min-w-[180px] flex-1">
                              <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                                <Text weight="bold">{product.name}</Text>
                                <Badge label="Saved as a Product" variant="success" />
                              </Stack>
                              <Text type="supporting" color="secondary">
                                {product.width} × {product.height} · Rename it later on Products.
                              </Text>
                              <Button
                                label="Choose another photo"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setProduct(null)
                                  setPhotoFile(null)
                                  setPlanDraft(null)
                                  setSetProjectId(null)
                                }}
                              />
                            </Stack>
                          </Stack>
                        </Card>
                      ) : (
                        <Stack gap={4}>
                          <FileInput
                            label="Product photo"
                            mode="dropzone"
                            value={photoFile}
                            onChange={(next) => {
                              const picked = Array.isArray(next) ? next[0] ?? null : next
                              setPhotoFile(picked)
                            }}
                            changeAction={async (next) => {
                              const picked = Array.isArray(next) ? next[0] : next
                              if (picked) await importFile(picked)
                            }}
                            accept="image/jpeg,image/png,image/webp"
                            maxSize={40 * 1024 * 1024}
                            description="JPEG, PNG, or WebP. Up to 40 MB."
                            placeholder="Drop a product photo, or choose a file"
                            isLoading={photoBusy}
                            status={photoError ? { type: 'error', message: photoError } : undefined}
                            width="100%"
                          />
                          <Stack direction="horizontal" gap={2}>
                            <Button label="Choose a file instead" variant="secondary" size="sm" onClick={() => void choosePhoto()} />
                          </Stack>
                          {products.length > 0 && (
                            <Selector
                              label="Or use a saved product"
                              value={savedProductId || undefined}
                              onChange={useSavedProduct}
                              options={products.slice(0, 20).map((entry) => ({ value: entry.id, label: entry.name }))}
                              placeholder="Choose a saved product"
                              width="100%"
                            />
                          )}
                        </Stack>
                      )}
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">
                          Step 4 of 4 · optional
                        </Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1}>
                          Make your first set
                        </Heading>
                        <Text type="body" color="secondary">
                          Your product is saved. Choose the images to make now, or keep the photo as a Product and make the set later.
                        </Text>
                      </Stack>
                      {product ? (
                        <Card padding={4}>
                          <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
                            <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
                            <Stack gap={0.5} className="flex-1">
                              <Text weight="bold">{product.name}</Text>
                              <Text type="supporting" color="secondary">
                                Saved as a Product
                              </Text>
                            </Stack>
                            <Badge label={recipeById(category).label} variant="neutral" />
                          </Stack>
                        </Card>
                      ) : (
                        <Banner
                          status="warning"
                          title="Add a product first"
                          description="Your product photo becomes the source for every image in the set."
                          endContent={<Button label="Go back" variant="ghost" size="sm" onClick={() => void goTo(2)} />}
                          collapsible={false}
                        />
                      )}
                      <Selector
                        label="What do you sell?"
                        value={category}
                        onChange={changeCategory}
                        options={CATEGORY_CHIPS.map((chip) => ({ value: chip.id, label: chip.label }))}
                        description={`Your recipe: ${recipeById(category).label}. You can change every shot later in the set.`}
                        width="100%"
                      />
                      {!hasKey && (
                        <Banner
                          status="warning"
                          title="Add your Meta key to make images"
                          description="You can save the product now and add the key when you are ready to make a set."
                          endContent={<Button label="Add key" variant="ghost" size="sm" onClick={() => void goTo(1)} />}
                          collapsible={false}
                        />
                      )}
                      {planDraft && (
                        <FirstSetPicker
                          plan={planDraft}
                          disabled={running || finishing || starting}
                          saving={starting}
                          onChange={setPlanDraft}
                        />
                      )}
                      {running && job && (
                        <Card padding={4}>
                          <Stack gap={2}>
                            <Stack direction="horizontal" gap={2} align="center" justify="between">
                              <Text weight="bold">
                                Making {job.done + job.failed + 1 <= job.total ? job.done + job.failed + 1 : job.total} of {job.total}
                              </Text>
                              <Text type="supporting" color="secondary">
                                {usd(job.costCents)} so far
                              </Text>
                            </Stack>
                            <ProgressBar
                              value={job.done + job.failed}
                              max={job.total}
                              label={`${job.done} of ${job.total} images made`}
                              hasValueLabel
                            />
                            <Text type="supporting" color="secondary" aria-live="polite">
                              {job.currentLabel ? `Making ${job.currentLabel}.` : 'Working.'} {job.done} made, {job.failed} failed.
                            </Text>
                          </Stack>
                        </Card>
                      )}
                      {runError && (
                        <Text role="alert" style={{ color: 'var(--color-text-error)' }}>
                          {runError}
                        </Text>
                      )}
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <Stack gap={2}>
                        <Stack direction="horizontal" gap={2}>
                          <Badge label="Setup complete" variant="success" />
                        </Stack>
                        <Heading ref={headingRef} tabIndex={-1} level={1}>
                          You're set up.
                        </Heading>
                        <Text type="body" color="secondary">
                          Your product is saved and your studio is ready. Pick a tool to start.
                        </Text>
                      </Stack>
                      <Card padding={4}>
                        <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
                          <span
                            className="grid h-10 w-10 place-items-center rounded-full"
                            style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}
                          >
                            <Check size={20} />
                          </span>
                          <Stack gap={0.5} className="flex-1">
                            <Text weight="bold">
                              {hasKey ? 'Meta connected' : 'Meta key later'} · Product saved
                              {job?.done ? ` · ${job.done} images made` : ''}
                            </Text>
                            <Text type="supporting" color="secondary">
                              {product?.name ?? 'Your first product'} is ready to reuse.
                            </Text>
                          </Stack>
                          <Badge label="Ready" variant="success" />
                        </Stack>
                      </Card>
                      <Grid columns={{ minWidth: 180 }} gap={3}>
                        <ToolCard icon={<Layers size={20} />} title="Set Creator" body="Open your set or start another." />
                        <ToolCard icon={<ImageIcon size={20} />} title="Image Editor" body="Change a photo you already have." />
                        <ToolCard icon={<Sparkles size={20} />} title="Image Generator" body="Describe a picture and make it." />
                      </Grid>
                      <Button
                        label="Personalize in Settings"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/settings/brand')}
                      />
                    </>
                  )}
                </Stack>
              </Card>

              <div
                className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t px-1 py-3"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-background-body)' }}
              >
                {step > 0 && step < 4 && (
                  <Button
                    label="Back"
                    variant="ghost"
                    size="sm"
                    icon={<ArrowLeft size={14} />}
                    onClick={() => void goTo(step - 1)}
                  />
                )}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {secondaryActions}
                  <Button
                    label={primaryLabel}
                    variant="primary"
                    isLoading={starting || keyBusy || finishing}
                    isDisabled={primaryDisabled}
                    onClick={onPrimary}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MuseKeyGuideDialog open={keyGuideOpen} onOpenChange={setKeyGuideOpen} />

      <FirstRunConfirm
        open={confirmOpen}
        runLabel={runLabel}
        imageCount={imageCount}
        onOpenChange={setConfirmOpen}
        onGotIt={() => {
          setConfirmOpen(false)
          void window.moss.settings
            .set({ key: 'firstRunConfirmShown', value: true })
            .then(() => refreshSettings())
            .catch(() => undefined)
        }}
        onConfirm={() => void confirmRun()}
      />
    </div>
  )
}
