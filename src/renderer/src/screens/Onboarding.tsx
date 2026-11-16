import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import type { Brand, Product } from '@shared/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  FileInput,
  Heading,
  Icon,
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
import { markUrl, bundledUrl } from '../lib/assets'
import { toast } from '../lib/toast'
import { usd } from '@shared/cost'
import { warnIfSmallPhoto } from '../lib/photoWarnings'
import { BrandFields, BrandPreview } from '../components/brand/BrandFields'
import { Skeleton } from '../components/ui/Skeleton'
import { MuseKeyGuideDialog } from '../components/ui/MuseKeyGuideDialog'

const STEPS = [
  { label: 'Welcome', optional: false },
  { label: 'Meta Key', optional: true },
  { label: 'Product', optional: true },
  { label: 'Personalize', optional: true },
  { label: 'Ready', optional: false }
] as const

function normaliseStep(value: number): number {
  return Math.max(0, Math.min(4, Math.floor(value)))
}

function productNameFromFile(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim().slice(0, 80)
  return base || 'Product'
}


export function Onboarding(): React.JSX.Element {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const products = useAppStore((state) => state.products)
  const brand = useAppStore((state) => state.brand)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const refreshSecrets = useAppStore((state) => state.refreshSecrets)
  const refreshProducts = useAppStore((state) => state.refreshProducts)
  const refreshBrand = useAppStore((state) => state.refreshBrand)
  const setOnboardingBypass = useAppStore((state) => state.setOnboardingBypass)

  const [step, setStep] = useState(() => normaliseStep(settings?.onboardingStep ?? 0))
  const [product, setProduct] = useState<Product | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [savedProductId, setSavedProductId] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyGuideOpen, setKeyGuideOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [brandDraft, setBrandDraft] = useState<Brand | null>(brand)
  const [brandBusy, setBrandBusy] = useState(false)
  const [brandAdvanced, setBrandAdvanced] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (secrets) void refreshSecrets()
  }, [])

  useEffect(() => {
    setBrandDraft(brand)
  }, [brand])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [step])

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

  const skip = (): void => {
    setOnboardingBypass(true)
    void window.moss.settings
      .set({ key: 'onboardingDismissed', value: true })
      .then(() => refreshSettings())
      .catch(() => undefined)
    toast.status('You can finish setup from All Work or Products.')
    navigate('/products', { replace: true })
  }

  const addProduct = (next: Product): void => {
    setProduct(next)
    setSavedProductId(next.id)
    setPhotoError(null)
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

  const saveBrandAndContinue = async (): Promise<void> => {
    if (!brandDraft) {
      await goTo(4)
      return
    }
    setBrandBusy(true)
    try {
      await unwrap(window.moss.brand.update(brandDraft))
      await refreshBrand()
      await goTo(4)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBrandBusy(false)
    }
  }

  const completeSetup = async (after: () => Promise<void>): Promise<void> => {
    setFinishing(true)
    try {
      await unwrap(window.moss.settings.set({ key: 'onboardingDone', value: true }))
      await refreshSettings()
      await after()
    } catch {
      toast.error('The setup could not be saved.')
    } finally {
      setFinishing(false)
    }
  }

  const finish = async (): Promise<void> => {
    await completeSetup(async () => {
      navigate(product ? `/product/${product.id}` : '/products', { replace: true })
    })
  }

  const startEditing = async (): Promise<void> => {
    await completeSetup(async () => {
      if (product) {
        const created = await unwrap(window.moss.products.createProject({ productId: product.id, type: 'photo' }))
        navigate(`/project/${created.project.id}`, { replace: true })
        return
      }
      navigate('/library?new=photo', { replace: true })
    })
  }

  const startImage = async (): Promise<void> => {
    await completeSetup(async () => {
      if (product) {
        const created = await unwrap(window.moss.products.createProject({ productId: product.id, type: 'image' }))
        navigate(`/project/${created.project.id}`, { replace: true })
        return
      }
      const detail = await unwrap(window.moss.projects.create({ type: 'image', draft: true }))
      navigate(`/project/${detail.project.id}`, { replace: true })
    })
  }

  const hasKey = Boolean(secrets?.hasKey)
  const primaryLabel =
    step === 0
      ? 'Set Up AI Images'
      : step === 1
        ? hasKey && !keyValue.trim()
          ? 'Continue'
          : 'Test and connect'
        : step === 2
          ? 'Continue'
          : step === 3
            ? 'Continue'
            : product
              ? 'Edit This Product'
              : 'Open a Photo'

  const primaryDisabled =
    finishing ||
    brandBusy ||
    (step === 1 && keyBusy) ||
    (step === 2 && photoBusy)

  const onPrimary = (): void => {
    if (step === 0) void goTo(1)
    else if (step === 1) void saveKey()
    else if (step === 2) void goTo(3)
    else if (step === 3) void saveBrandAndContinue()
    else void startEditing()
  }

  const secondaryActions =
    step === 0 ? null : step === 1 ? (
      <Button label="Add key later" variant="ghost" onClick={() => void goTo(2)} />
    ) : step === 2 ? (
      <Button label="Skip for now" variant="ghost" isDisabled={photoBusy} onClick={() => void goTo(3)} />
    ) : step === 3 ? (
      <Button label="Skip for now" variant="ghost" isDisabled={brandBusy} onClick={() => void goTo(4)} />
    ) : (
      <>
        <Button label="Finish Setup" variant="ghost" isDisabled={finishing} onClick={() => void finish()} />
        <Button label="Make an Image" variant="secondary" isDisabled={finishing} onClick={() => void startImage()} />
      </>
    )

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-background-body)' }}>
      <header className="flex h-[64px] shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img src={markUrl()} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="wordmark">Moss Photo Studio</span>
          <Badge label="Setup" variant="neutral" />
        </div>
        <Button label="Skip for Now" variant="ghost" size="sm" onClick={skip} />
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-6 pb-24">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden xl:block">
              <Card padding={4} className="h-fit">
                <Stack gap={4}>
                  <Text type="label" color="secondary">Your setup</Text>
                  <Stepper activeStep={step} orientation="vertical" label="Setup steps">
                    {STEPS.map((entry, index) => (
                      <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} isDisabled={index > step} />
                    ))}
                  </Stepper>
                </Stack>
              </Card>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="xl:hidden">
                <Stepper
                  activeStep={step}
                  label="Setup steps"
                  horizontalOptions={{ minimumStepWidth: 170, collapsedVariant: 'withLabel' }}
                >
                  {STEPS.map((entry, index) => (
                    <Step key={entry.label} step={index} label={entry.label} isDisabled={index > step} />
                  ))}
                </Stepper>
              </div>

              <Card padding={6} elevation="low">
                <Stack gap={5}>
                  {step === 0 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">Welcome to</Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1} className="step-heading">
                          Your personal photo studio.
                        </Heading>
                        <Text type="body" color="secondary">
                          Edit a photo you already have, describe a new image and make it, or keep related images in a Set. Everything you make stays on this computer.
                        </Text>
                      </Stack>
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <Stack gap={3}>
                          <Stack direction="horizontal" gap={3} align="start">
                            <Badge label="1" variant="neutral" />
                            <Stack gap={0.5}>
                              <Text weight="bold">Add a product photo</Text>
                              <Text type="supporting" color="secondary">Start with a photo you already have.</Text>
                            </Stack>
                          </Stack>
                          <Stack direction="horizontal" gap={3} align="start">
                            <Badge label="2" variant="neutral" />
                            <Stack gap={0.5}>
                              <Text weight="bold">Choose a look or describe a change</Text>
                              <Text type="supporting" color="secondary">Free edits stay on this computer.</Text>
                            </Stack>
                          </Stack>
                          <Stack direction="horizontal" gap={3} align="start">
                            <Badge label="3" variant="neutral" />
                            <Stack gap={0.5}>
                              <Text weight="bold">Save, export, or add it to a Set</Text>
                              <Text type="supporting" color="secondary">Everything you make stays in your library.</Text>
                            </Stack>
                          </Stack>
                        </Stack>
                        <div className="hidden overflow-hidden rounded-[12px] border xl:block" style={{ borderColor: 'var(--color-border)', background: 'var(--color-background-surface)' }}>
                          <img src={bundledUrl('products/speckled-mug.webp')} alt="An example product photo" className="aspect-[4/3] w-full object-cover" />
                          <div className="p-3">
                            <Text weight="bold">A product photo is enough to start.</Text>
                            <Text type="supporting" color="secondary" display="block" className="mt-1">Edit it for free, or use it as the product in a new scene.</Text>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">Step 2 of 5 · optional</Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1} className="step-heading">
                          Connect Meta
                        </Heading>
                        <Text type="body" color="secondary">
                          Moss makes images with your Meta account. Meta charges you {usd(1)} for each image that comes back.
                        </Text>
                      </Stack>
                      <Banner
                        status={hasKey ? 'success' : 'info'}
                        title={hasKey ? `Meta connected ending ${secrets?.last4 ?? '••••'}` : 'What you need'}
                        description={
                          hasKey
                            ? 'The saved key is ready to use. Continue to add a product.'
                            : 'A Meta account, a payment method, and about two minutes. The key is stored on this computer.'
                        }
                        collapsible={false}
                      />
                      <TextInput
                        label="Meta key"
                        type={revealKey ? 'text' : 'password'}
                        value={keyValue}
                        onChange={setKeyValue}
                        onEnter={() => void saveKey()}
                        placeholder={hasKey ? `Saved key ending ${secrets?.last4 ?? '••••'}. Paste a new one to replace it.` : 'Paste the key from Meta'}
                        description="The key is stored on this computer."
                        status={keyError ? { type: 'error', message: keyError } : undefined}
                        width="100%"
                        hasAutoFocus
                      />
                      <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                        <Button label={revealKey ? 'Hide key' : 'Show key'} variant="ghost" size="sm" onClick={() => setRevealKey((value) => !value)} />
                        <Button label="Where do I get a key?" variant="ghost" size="sm" onClick={() => setKeyGuideOpen(true)} />
                      </Stack>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Stack gap={2}>
                        <Text type="label" color="secondary">Step 3 of 5 · optional</Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1} className="step-heading">
                          Add your first product
                        </Heading>
                        <Text type="body" color="secondary">
                          Add one photo now, or add a product later. It becomes a Product you can reuse in the editor or generator.
                        </Text>
                      </Stack>
                      {product ? (
                        <Card padding={4}>
                          <Stack direction="horizontal" gap={4} align="start" wrap="wrap">
                            <img src={product.imageUrl} alt="The product photo" className="h-36 w-44 rounded-lg object-contain" style={{ background: 'var(--color-background-muted)' }} />
                            <Stack gap={2} className="min-w-[180px] flex-1">
                              <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                                <Text weight="bold">{product.name}</Text>
                                <Badge label="Saved as a Product" variant="success" />
                              </Stack>
                              <Text type="supporting" color="secondary">
                                {product.width} × {product.height} · Rename it later on Products.
                              </Text>
                              <Button label="Choose another photo" variant="ghost" size="sm" onClick={() => { setProduct(null); setPhotoFile(null) }} />
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
                        <Text type="label" color="secondary">Step 4 of 5 · optional</Text>
                        <Heading ref={headingRef} tabIndex={-1} level={1} className="step-heading">
                          Make it your own
                        </Heading>
                        <Text type="body" color="secondary">
                          Add a logo and colors now, or change them later in Settings.
                        </Text>
                      </Stack>
                      <Stack gap={3}>
                        <Card padding={4}>
                          <Stack gap={3}>
                            {brandDraft ? <BrandPreview brand={brandDraft} /> : <Skeleton className="h-48" />}
                            <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                              <Badge label="Optional" variant="neutral" />
                              <Text type="supporting" color="secondary">Your logo, colors, and badge appear on images you make.</Text>
                            </Stack>
                            <Button
                              label={brandAdvanced ? 'Hide Brand Options' : 'Customize Brand'}
                              variant="secondary"
                              size="sm"
                              onClick={() => setBrandAdvanced((value) => !value)}
                            />
                          </Stack>
                        </Card>
                        {brandAdvanced && (brandDraft ? <BrandFields value={brandDraft} onChange={setBrandDraft} showPreview={false} /> : <Skeleton className="h-96" />)}
                      </Stack>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <Stack gap={2}>
                        <Stack direction="horizontal" gap={2} align="center">
                          <Text type="label" color="secondary">Step 5 of 5</Text>
                          <Badge label="Setup complete" variant="success" />
                        </Stack>
                        <Heading ref={headingRef} tabIndex={-1} level={1} className="step-heading">
                          You're ready to make photos.
                        </Heading>
                        <Text type="body" color="secondary">
                          Start with a photo you already have, or describe a new image. Everything stays in your local library.
                        </Text>
                      </Stack>
                      <Card padding={4}>
                        <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
                          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}>
                            <Icon icon={Check} size="md" />
                          </span>
                          <Stack gap={0.5} className="flex-1">
                            <Text weight="bold">
                              {hasKey ? 'Meta connected' : 'Meta key later'} · {product ? 'Product saved' : 'No product yet'}
                            </Text>
                            <Text type="supporting" color="secondary">
                              {product ? `${product.name} is ready to reuse.` : 'Add a product from Products whenever you are ready.'}
                            </Text>
                          </Stack>
                          <Badge label="Ready" variant="success" />
                        </Stack>
                      </Card>
                      <Card padding={4}>
                        <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
                          {product ? (
                            <img src={product.imageUrl} alt="" className="h-16 w-16 rounded-[8px] object-cover" style={{ background: 'var(--color-background-muted)' }} />
                          ) : (
                            <span className="grid h-16 w-16 place-items-center rounded-[8px]" style={{ background: 'var(--color-background-muted)', color: 'var(--color-text-accent)' }}>
                              <Icon icon={Check} size="md" />
                            </span>
                          )}
                          <Stack gap={0.5} className="min-w-[220px] flex-1">
                            <Text weight="bold">{product ? `Start with ${product.name}` : 'Start with a photo'}</Text>
                            <Text type="supporting" color="secondary">
                              {product
                                ? 'Edit it for free, or make a new image with it as the product.'
                                : 'Open a photo you already have, or describe a new image to make.'}
                            </Text>
                          </Stack>
                          {!hasKey && <Badge label="Meta key optional" variant="neutral" />}
                        </Stack>
                      </Card>
                    </>
                  )}
                </Stack>
              </Card>

              <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t px-1 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-background-body)' }}>
                {step > 0 && (
                  <Button label="Back" variant="ghost" size="sm" icon={<Icon icon={ArrowLeft} size="sm" />} isDisabled={brandBusy} onClick={() => void goTo(step - 1)} />
                )}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {secondaryActions}
                  <Button label={primaryLabel} variant="primary" isLoading={keyBusy || finishing || brandBusy} isDisabled={primaryDisabled} onClick={onPrimary} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MuseKeyGuideDialog open={keyGuideOpen} onOpenChange={setKeyGuideOpen} />
    </div>
  )
}
