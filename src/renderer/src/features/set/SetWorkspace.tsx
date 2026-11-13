import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, PanelLeft, Sparkles } from 'lucide-react'
import type { Image, JobItemState, JobState, PlanJson, PlanShot, Project } from '@shared/types'
import { MAX_SET_SHOTS } from '@shared/constants'
import { CATEGORY_CHIPS, recipeById } from '@shared/prompts/recipes'
import { shotDefinition } from '@shared/prompts/shots'
import { createDefaultPlan, addShotToPlan, makeShots } from '@shared/plans'
import { estimateCents, usd } from '@shared/cost'
import { errorMessage, billingUncertain } from '@shared/errors'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'
import { useJobsStore } from '../../store/jobs'
import { useViewportTier } from '../../lib/viewport'
import { onCommand } from '../../lib/commands'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Progress } from '../../components/ui/Progress'
import { Sheet } from '../../components/ui/Sheet'
import { FirstRunConfirm } from '../../components/ui/FirstRunConfirm'
import { BudgetWarning } from '../../components/ui/BudgetWarning'
import { Lightbox } from '../../components/ui/Lightbox'
import { PlanPanel } from './PlanPanel'
import { SourcePickerDialog } from '../../components/sources/SourcePickerDialog'
import { SHOT_EXAMPLES } from '../../lib/shotExamples'
import type { SourceChoice } from '../../components/sources/SourcePickerDialog'
import { SaveProductDialog } from '../../components/products/SaveProductDialog'
import { SetExportDialog } from './SetExportDialog'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { showExportToast } from '../../lib/exportFeedback'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { elapsedLabel } from '../../lib/format'
import { currentMonth } from '../../store/library'
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core'
import { usePanelWidth, WorkspaceResizeHandle } from '../../components/ui/WorkspaceResizeHandle'

type Phase = 'plan' | 'review'
interface PendingRun {
  mode: 'make' | 'remake'
  shotIds: string[]
  count: number
  label: string
  retry: boolean
}

function latestReady(images: Image[], shotId: string): Image | null {
  return images
    .filter((image) => image.status === 'ready' && image.shotId === shotId)
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    .at(-1) ?? null
}

function latestAttempt(images: Image[], shotId: string): Image | null {
  return images
    .filter((image) => image.shotId === shotId && (image.status === 'ready' || image.status === 'failed'))
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
    .at(-1) ?? null
}

function chosenReady(images: Image[], shot: PlanShot): Image | null {
  if (shot.selectedImageId) {
    const pinned = images.find(
      (image) => image.id === shot.selectedImageId && image.status === 'ready' && image.shotId === shot.id
    )
    if (pinned) return pinned
  }
  return latestReady(images, shot.id)
}

function latestReadyAll(images: Image[], plan: PlanJson): Image[] {
  return plan.shots
    .filter((shot) => shot.enabled)
    .map((shot) => chosenReady(images, shot))
    .filter((image): image is Image => Boolean(image))
}

function jobItemFor(job: JobState, shot: PlanShot): JobItemState | undefined {
  return job.items.find((item) => item.key === shot.id)
}

export function SetWorkspace({ preferredPersonId, preferredPersonLook }: { preferredPersonId?: string | null; preferredPersonLook?: string | null }): React.JSX.Element {
  const project = useWorkspaceStore((state) => state.project) as Project
  const images = useWorkspaceStore((state) => state.images)
  const plan = useWorkspaceStore((state) => state.planDraft)
  const setPlanDraft = useWorkspaceStore((state) => state.setPlanDraft)
  const savePlan = useWorkspaceStore((state) => state.savePlan)
  const refresh = useWorkspaceStore((state) => state.refresh)
  const refreshImages = useWorkspaceStore((state) => state.refreshImages)
  const activeStoredJob = useWorkspaceStore((state) => state.activeJob)
  const usageCents = useWorkspaceStore((state) => state.usageCents)
  const people = useAppStore((state) => state.people)
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const jobs = useJobsStore((state) => state.jobs)
  const upsert = useJobsStore((state) => state.upsert)
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const confirm = useConfirm()
  const tier = useViewportTier()
  const leftHidden = tier === 'tiny'
  const canResizeLeft = tier === 'wide' || tier === 'medium'
  const [leftSheet, setLeftSheet] = useState(false)
  const leftPanelWidth = usePanelWidth('moss.workspace.set.left', 300)
  useEffect(() => {
    if (!leftHidden) setLeftSheet(false)
  }, [leftHidden])
  const [phase, setPhase] = useState<Phase>('plan')
  const [runLimit, setRunLimit] = useState<number | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRun | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [saveProductImage, setSaveProductImage] = useState<Image | null>(null)
  const [interruptedDismissed, setInterruptedDismissed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const phaseInitialized = useRef(false)
  const handledJobs = useRef<Set<string>>(new Set())
  const lastProgress = useRef<string>('')
  const saveTimer = useRef<number | null>(null)

  const runningFromStore = Object.values(jobs).find(
    (job) => job.projectId === project.id && job.status === 'running'
  ) ?? null
  const currentJob = currentJobId
    ? jobs[currentJobId] ?? null
    : [...Object.values(jobs)].filter((job) => job.projectId === project.id).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  const job = runningFromStore ?? currentJob
  const isRunning = job?.status === 'running'
  const enabledShots = plan?.shots.filter((shot) => shot.enabled) ?? []
  const latestAttempts = enabledShots.map((shot) => latestAttempt(images, shot.id))
  const madeCount = latestAttempts.filter((image) => image?.status === 'ready').length
  const missingShots = enabledShots.filter((shot, index) => latestAttempts[index]?.status !== 'ready')
  const missingCount = missingShots.length
  const madeImages = latestAttempts.filter((image): image is Image => image?.status === 'ready')
  const exportableImages = plan ? latestReadyAll(images, plan) : []
  const hasAttempts = images.some((image) => image.shotId)
  const source = images.find((image) => image.id === project.sourceImageId) ?? images.find((image) => image.kind === 'upload')
  const showCategory = !plan && Boolean(source)
  const interrupted = activeStoredJob?.status === 'interrupted' && !interruptedDismissed && !isRunning && missingCount > 0
  const interruptedMissing = interrupted
    ? Math.max(0, (activeStoredJob?.total ?? 0) - (activeStoredJob?.done ?? 0) - (activeStoredJob?.failed ?? 0))
    : 0

  useEffect(() => {
    void (async () => {
      try {
        const summary = await unwrap(window.moss.usage.summary({ month: currentMonth() }))
        setMonthCents(summary.spendCents)
      } catch {
        setMonthCents(0)
      }
    })()
  }, [project.id])

  useEffect(() => {
    if (isRunning) {
      const timer = window.setInterval(() => setNow(Date.now()), 1000)
      return () => window.clearInterval(timer)
    }
  }, [isRunning])

  useEffect(() => {
    if (!plan || phaseInitialized.current) return
    phaseInitialized.current = true
    setPhase(hasAttempts || madeCount > 0 ? 'review' : 'plan')
  }, [hasAttempts, madeCount, plan])

  useEffect(() => {
    if (!plan) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void savePlan() }, 650)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [plan, savePlan])

  useEffect(() => {
    if (!job) return
    if (job.status !== 'running') {
      if (handledJobs.current.has(job.id)) return
      handledJobs.current.add(job.id)
      setPhase('review')
      void refresh()
      void unwrap(window.moss.usage.summary({ month: currentMonth() })).then((summary) => setMonthCents(summary.spendCents)).catch(() => undefined)
      return
    }
    const progress = `${job.done}-${job.failed}-${job.items.map((item) => item.status).join(',')}`
    if (progress !== lastProgress.current) {
      lastProgress.current = progress
      void refreshImages()
    }
  }, [job, refresh, refreshImages])

  useEffect(() => {
    if (!isRunning && runningFromStore) {
      setCurrentJobId(runningFromStore.id)
    }
  }, [isRunning, runningFromStore])

  useEffect(() => {
    return onCommand((command) => {
      if (command === 'export' && madeCount > 0) setExportOpen(true)
      if (command === 'toggle-panel' && leftHidden) setLeftSheet((open) => !open)
    })
  }, [madeCount, leftHidden])

  useEffect(() => {
    void window.moss.app.setMenuContext({
      editor: true,
      adjust: false,
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      canExport: exportableImages.length > 0,
      canZoom: false
    }).catch(() => undefined)
  }, [exportableImages.length])

  const loadMonth = async (): Promise<void> => {
    try {
      const summary = await unwrap(window.moss.usage.summary({ month: currentMonth() }))
      setMonthCents(summary.spendCents)
    } catch {
      // Keep the last month total.
    }
  }

  const createPlan = async (category: string): Promise<void> => {
    if (!project) return
    const next = createDefaultPlan({
      category,
      productName: project.name,
      shape: project.shape,
      format: project.format
    })
    const preferredPerson = preferredPersonId
      ? people.find((person) => person.id === preferredPersonId)
      : null
    const look = preferredPerson && preferredPersonLook
      ? preferredPerson.looks.find((entry) => entry.key === preferredPersonLook)?.key ?? null
      : null
    const withPerson = preferredPerson
      ? {
          ...next,
          shots: next.shots.map((shot) =>
            shot.type === 'onmodel'
              ? { ...shot, personId: preferredPerson.id, personLook: look }
              : shot
          )
        }
      : next
    setPlanDraft(withPerson)
    setRunLimit(null)
    await savePlan()
    phaseInitialized.current = true
    setPhase('plan')
  }

  const updatePlan = (next: PlanJson): void => {
    setRunLimit(null)
    setPlanDraft(next)
  }

  const changeCategory = async (next: string): Promise<void> => {
    if (!plan || next === plan.category) return
    await createPlan(next)
    toast.status(`Recipe changed to ${recipeById(next).label}.`)
  }

  const saveNow = useCallback(async (): Promise<void> => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = null
    await savePlan()
  }, [savePlan])

  const replaceSource = async (): Promise<void> => {
    const ok = !hasAttempts || await confirm({
      title: 'Replace the product photo?',
      body: 'The images already made stay. New images use the new photo.',
      confirmLabel: 'Replace Photo'
    })
    if (!ok) return
    setSourcePickerOpen(true)
  }

  const chooseReplacement = async (choice: SourceChoice): Promise<void> => {
    try {
      if (choice.kind === 'product') {
        await unwrap(window.moss.products.importIntoProject({ productId: choice.productId, projectId: project.id }))
      } else {
        const image = images.find((entry) => entry.id === choice.imageId)
        if (image?.projectId === project.id) {
          await unwrap(window.moss.images.setSource({ projectId: project.id, imageId: image.id }))
        } else {
          await unwrap(window.moss.media.importFromImage({ projectId: project.id, imageId: choice.imageId }))
        }
      }
      await refresh()
      toast.status('Product photo replaced.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const replaceWithFile = async (): Promise<void> => {
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ projectId: project.id, kind: 'source' }))
      if (result?.imageId) {
        warnIfSmallPhoto(result)
        await refresh()
        toast.status('Product photo replaced.')
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const chooseAddShot = (type: PlanShot['type']): void => {
    if (!plan) return
    if (plan.shots.length >= MAX_SET_SHOTS) {
      toast.error('A set holds eight images. Turn one off first.')
      return
    }
    updatePlan(addShotToPlan(plan, type))
  }

  const resetPlan = (): void => {
    if (!plan) return
    const shots = makeShots(plan.category)
    updatePlan({ ...plan, shots })
    phaseInitialized.current = true
    setPhase('plan')
  }

  const estimate = (count: number): number => estimateCents(count)
  const limit = settings?.budgetCents ?? null
  const overBudget = (count: number): boolean => limit !== null && monthCents + estimate(count) > limit

  const requestRun = async (mode: 'make' | 'remake', shotIds: string[], count: number, retry = false): Promise<void> => {
    if (!plan) return
    setError(null)
    if (!secrets?.hasKey) {
      setError('Add your Muse key in Settings to make images.')
      return
    }
    if (!canGenerate) {
      setError('Reactivate to make images.')
      return
    }
    await saveNow()
    if (!retry && mode === 'remake') {
      const ok = await confirm({
        title: 'Make the set again?',
        body: `This adds ${count} more ${count === 1 ? 'image' : 'images'} to the set. The ${madeCount} you have stay.`,
        confirmLabel: `Remake ${count} ${count === 1 ? 'Image' : 'Images'}`
      })
      if (!ok) return
    }
    const label = `${retry ? `Try the ${count} Again` : mode === 'remake' ? `Remake ${count} Image${count === 1 ? '' : 's'}` : `Make ${count} Image${count === 1 ? '' : 's'}`} · ${usd(estimate(count))}`
    const pendingRun: PendingRun = { mode, shotIds, count, label, retry }
    if (!settings?.firstRunConfirmShown) {
      setPending(pendingRun)
      setConfirmOpen(true)
      return
    }
    await executeRun(pendingRun)
  }

  const executeRun = async (pendingRun: PendingRun): Promise<void> => {
    setError(null)
    try {
      const result = await unwrap(window.moss.jobs.startSet({
        projectId: project.id,
        mode: pendingRun.mode,
        shotIds: pendingRun.shotIds.length ? pendingRun.shotIds : undefined
      }))
      const state = await unwrap(window.moss.jobs.state({ jobId: result.jobId }))
      upsert(state)
      setCurrentJobId(result.jobId)
      setInterruptedDismissed(true)
      lastProgress.current = ''
    } catch (caught) {
      setError(messageOf(caught))
      toast.error(messageOf(caught))
    }
  }

  const confirmFirstRun = async (): Promise<void> => {
    if (!pending) return
    try {
      await unwrap(window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }))
      await refreshSettings()
    } catch {
      // The confirmation is still acknowledged this session.
    }
    setConfirmOpen(false)
    const action = pending
    setPending(null)
    await executeRun(action)
  }

  const acknowledgeFirstRun = (): void => {
    setConfirmOpen(false)
    setPending(null)
    void window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }).then(() => refreshSettings()).catch(() => undefined)
  }

  const stop = async (): Promise<void> => {
    if (!job) return
    try {
      await unwrap(window.moss.jobs.cancel({ jobId: job.id }))
    } catch {
      toast.error('The run could not be stopped.')
    }
  }

  const startRetryMissing = (count: number): void => {
    if (!missingShots.length) return
    const targets = count === 1 ? missingShots.slice(0, 1) : missingShots
    void requestRun('remake', targets.map((shot) => shot.id), targets.length, true)
  }

  const retryShot = (shotId: string): void => {
    void requestRun('remake', [shotId], 1, true)
  }

  const regenerateShot = (shotId: string): void => {
    void requestRun('remake', [shotId], 1)
  }

  const pinImage = async (image: Image): Promise<void> => {
    if (!plan || !image.shotId || image.status !== 'ready') return
    if (!plan.shots.some((shot) => shot.id === image.shotId)) return
    updatePlan({
      ...plan,
      shots: plan.shots.map((shot) =>
        shot.id === image.shotId ? { ...shot, selectedImageId: image.id } : shot
      )
    })
    await savePlan()
    toast.status('Main version set for this shot.')
  }

  const lastErrorCode = enabledShots
    .map((shot) => {
      const latest = latestAttempt(images, shot.id)
      return latest?.status === 'failed' ? latest.errorCode : null
    })
    .filter((code): code is string => Boolean(code))
    .at(-1)

  const reviewTitle = madeCount === enabledShots.length && enabledShots.length > 0
    ? `Your set is ready. ${madeCount} ${madeCount === 1 ? 'image' : 'images'}.`
    : madeCount > 0
      ? `${madeCount} ${madeCount === 1 ? 'image' : 'images'} made. ${missingCount} did not come through. A refusal costs nothing. A timeout may still show on your Meta bill.`
      : hasAttempts
        ? 'No images came through. A refusal costs nothing. A timeout may still show on your Meta bill.'
        : ''

  const reviewPaidCount = madeCount === 0 && missingShots.length > 0 ? 1 : missingShots.length
  const paidCount = runLimit ?? (phase === 'plan' ? missingShots.length || enabledShots.length : reviewPaidCount)
  const planRunCount = runLimit
    ? Math.min(runLimit, missingShots.length || enabledShots.length)
    : missingShots.length || enabledShots.length
  const planRunShots = runLimit
    ? (missingShots.length ? missingShots : enabledShots).slice(0, runLimit)
    : missingShots
  const over = overBudget(paidCount)

  const lightboxImages = exportableImages

  const goOpenLibrary = (): void => {
    void navigate(project.productId ? `/product/${project.productId}` : '/library')
  }
  const goSettings = (): void => {
    void navigate('/settings/studio')
  }

  const setCover = async (image: Image): Promise<void> => {
    try {
      await unwrap(window.moss.images.setCover({ projectId: project.id, imageId: image.id }))
      await refresh()
      toast.status('Cover set.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const downloadImage = async (image: Image): Promise<void> => {
    try {
      const result = await unwrap(window.moss.exports.images({
        projectId: project.id,
        imageIds: [image.id],
        options: { format: project.format, quality: 90, maxDimension: null, filename: image.label }
      }))
      showExportToast(result.count, result.folderName, project.id)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const deleteImage = async (image: Image): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${image.label}"?`,
      body: 'This image leaves this computer. This cannot be undone.',
      confirmLabel: 'Delete Image',
      danger: true
    })
    if (!ok) return
    try {
      await useWorkspaceStore.getState().deleteImage(image.id)
      setLightboxIndex(null)
      await loadMonth()
      toast.status('Image deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const openEditor = (image: Image): void => {
    setParams({ view: 'photo', image: image.id })
  }

  const leftContent = (
    <>
      {plan ? (
        <PlanPanel
          plan={plan}
          images={images}
          people={people}
          readOnly={isRunning || phase === 'review'}
          running={isRunning}
          sourceUrl={source?.thumbUrl ?? source?.url ?? null}
          sourceImageId={project.sourceImageId}
          onChange={updatePlan}
          onSaveNow={() => void saveNow()}
          onReset={resetPlan}
          onAddShot={chooseAddShot}
          onReplaceSource={replaceSource}
          onChangeCategory={(next) => void changeCategory(next)}
          categoryLocked={hasAttempts}
        />
      ) : (
        <div className="p-4">
          <p className="section-label">Plan</p>
          <p className="mt-2 text-[12px] font-medium">Choose what you sell</p>
          <p className="hint mt-1">The recipe sets the six starting shots. You can edit every one.</p>
          {source?.thumbUrl && <img src={source.thumbUrl} alt="" className="mt-3 w-full rounded-[8px] object-contain" style={{ maxHeight: 160 }} />}
        </div>
      )}
    </>
  )


  return (
    <>
      <div className="workspace">
        {!leftHidden && (
          <>
            <aside className="ws-left" style={canResizeLeft ? { width: leftPanelWidth.width, minWidth: leftPanelWidth.width } : undefined}>{leftContent}</aside>
            {canResizeLeft && <WorkspaceResizeHandle label="Resize plan panel" side="left" width={leftPanelWidth.width} onPointerDown={leftPanelWidth.onPointerDown} onKeyDown={leftPanelWidth.onKeyDown} onReset={leftPanelWidth.reset} />}
          </>
        )}
        <section className="ws-center">
          <div className="flex items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
            {!isRunning && (
              <ToggleButtonGroup
                type="single"
                label="Set phase"
                value={phase}
                onChange={(value) => {
                  if (value !== 'plan' && value !== 'review') return
                  setPhase(value)
                  setRunLimit(null)
                }}
              >
                <ToggleButton value="plan" label="Plan" size="sm" />
                <ToggleButton value="review" label="Review" size="sm" isDisabled={!hasAttempts && madeCount === 0} />
              </ToggleButtonGroup>
            )}
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{isRunning ? 'Making the set' : phase === 'review' ? 'Review the set' : 'Plan the set'}</p>
            {leftHidden && <IconButton label="Open plan" onClick={() => setLeftSheet(true)}><PanelLeft size={16} /></IconButton>}
            {isRunning && <span className="badge" data-tone="success">Making</span>}
            {!isRunning && phase === 'review' && <span className="badge">{madeCount} of {enabledShots.length}</span>}
            {!isRunning && phase === 'review' && (
              <Button variant="ghost" size="sm" onClick={() => { setPhase('plan'); setRunLimit(null) }}>Edit Plan</Button>
            )}
          </div>
          <div className="canvas-wrap canvas-surface">
            {interrupted && (
              <div className="m-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)', color: 'var(--text)' }} role="status">
                <p className="text-[12px] font-semibold">The app closed while images were being made.</p>
                <p className="meta mt-1">
                  {interruptedMissing} didn't finish. No charge was recorded, though a request that timed out may still show on your Meta bill.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {interruptedMissing > 0 && (
                    <Button size="sm" variant="primary" onClick={() => startRetryMissing(interruptedMissing === 1 ? 1 : missingShots.length)}>
                      Make the {interruptedMissing} Again · {usd(estimate(interruptedMissing))}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setInterruptedDismissed(true)}>Dismiss</Button>
                </div>
              </div>
            )}

            {showCategory ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="card w-full max-w-[560px] p-5" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                  <h2 className="page-title">What do you sell?</h2>
                  <p className="meta mt-1">This picks the recipe for your first plan. Nothing is charged until you press Make.</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {CATEGORY_CHIPS.map((chip) => (
                      <button key={chip.id} type="button" className="chip" onClick={() => void createPlan(chip.id)}>{chip.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : isRunning && job && plan ? (
              <div className="shot-grid">
                {enabledShots.map((shot, index) => {
                  const item = jobItemFor(job, shot)
                  const ready = item?.imageId ? images.find((image) => image.id === item.imageId) : latestReady(images, shot.id)
                  const state = item?.status ?? 'queued'
                  return (
                    <div key={shot.id} className="shot-card" data-state={state === 'running' ? 'making' : state}>
                      {ready?.url ? (
                        <img src={ready.url} alt={`${shotDefinition(shot.type).label} of the product`} />
                      ) : (
                        <div className="relative flex flex-1 items-center justify-center" style={{ minHeight: 110 }}>
                          {state === 'running' ? <div className="shimmer-block absolute inset-0" /> : null}
                          <div className="relative z-[1] flex flex-col items-center gap-1 px-3 text-center">
                            {state === 'failed' ? <AlertCircle size={20} style={{ color: 'var(--danger)' }} /> : <Sparkles size={18} />}
                            <span className="text-[11px]" style={{ color: 'var(--white-80)' }}>
                              {state === 'failed' ? 'Failed' : state === 'running' ? (item?.waiting ? `Waiting for Meta · ${elapsedLabel(item?.startedAt, now)}` : `Making image ${index + 1} of ${job.total} · ${elapsedLabel(item?.startedAt, now)}`) : state === 'cancelled' ? 'Stopped' : 'Queued'}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="shot-card-body">
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{shotDefinition(shot.type).label}</span>
                        {state === 'done' || state === 'partial' ? <span className="badge" data-tone="success">Made</span> : state === 'failed' ? <span className="badge" data-tone="danger">Failed</span> : null}
                      </div>
                      {state === 'failed' && (
                        <p className="px-3 pb-2 text-[11px]" style={{ color: 'var(--white-80)' }}>
                          {errorMessage((item?.errorCode ?? 'unknown') as never)}{billingUncertain((item?.errorCode ?? null) as never) ? ' If Meta made it, it may still show on your bill.' : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : phase === 'review' && plan ? (
              <div className="flex h-full min-h-0 w-full flex-col">
                <div className="border-b px-5 py-3" style={{ borderColor: 'var(--canvas-line)' }}>
                  <h2 className="text-[14px] font-semibold" style={{ color: 'var(--canvas-text)' }}>{reviewTitle}</h2>
                  {madeCount === 0 && lastErrorCode && (
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--white-80)' }}>{errorMessage(lastErrorCode as never)}</p>
                  )}
                  <p className="mt-1 text-[11px] tabular" style={{ color: 'var(--white-60)' }}>{madeCount} made · {missingCount} still to make · {usd(madeImages.reduce((sum, image) => sum + image.costCents, 0))}</p>
                </div>
                <div className="shot-grid">
                  {enabledShots.map((shot) => {
                    const attempt = latestAttempt(images, shot.id)
                    const ready = attempt?.status === 'ready' ? attempt : null
                    const failed = attempt?.status === 'failed' ? attempt : null
                    const chosen = chosenReady(images, shot)
                    const shown = chosen ?? ready
                    const pinned = Boolean(chosen && shot.selectedImageId === chosen.id)
                    return (
                      <div key={shot.id} className="shot-card" data-state={shown ? 'done' : 'failed'}>
                        {shown?.url ? (
                          <button type="button" className="flex min-h-0 flex-1" onClick={() => {
                            const index = lightboxImages.findIndex((image) => image.id === shown.id)
                            setLightboxIndex(index >= 0 ? index : 0)
                          }}>
                            <img src={shown.url} alt={`${shotDefinition(shot.type).label} of the product`} />
                          </button>
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-3 text-center">
                            <AlertCircle size={20} style={{ color: failed ? 'var(--danger)' : 'var(--white-60)' }} />
                            <span className="text-[11px] font-medium" style={{ color: failed ? 'var(--danger)' : 'var(--white-60)' }}>{failed ? 'Failed' : 'Not made'}</span>
                            {failed && <span className="text-[11px]" style={{ color: 'var(--white-80)' }}>{errorMessage((failed.errorCode ?? 'unknown') as never)}</span>}
                          </div>
                        )}
                        <div className="shot-card-body">
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{shotDefinition(shot.type).label}</span>
                          {pinned && <span className="badge">Pinned</span>}
                          {shown && <span className="badge" data-tone="success">Made</span>}
                          {!shown && failed && (
                            <button
                              type="button"
                              className="text-[11px] font-semibold underline"
                              style={{ color: 'var(--canvas-text)' }}
                              onClick={() => retryShot(shot.id)}
                            >
                              Try Again · {usd(1)}
                            </button>
                          )}
                          {ready && (
                            <button
                              type="button"
                              className="text-[11px] underline"
                              style={{ color: 'var(--white-80)' }}
                              onClick={() => regenerateShot(shot.id)}
                            >
                              New · {usd(1)}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : plan ? (
              <div className="plan-board">
                <div className="plan-board-head">
                  <div className="min-w-0">
                    <p className="section-label">Plan preview</p>
                    <p className="mt-1 truncate text-[13px] font-semibold">{recipeById(plan.category).label}</p>
                    <p className="meta mt-0.5">{planRunCount} {planRunCount === 1 ? 'shot' : 'shots'} · {usd(estimate(planRunCount))} to make</p>
                  </div>
                  {source?.thumbUrl && <img src={source.thumbUrl} alt="The product photo" className="plan-board-source" />}
                </div>
                <div className="plan-board-grid">
                  {enabledShots.map((shot, index) => {
                    const definition = shotDefinition(shot.type)
                    const person = shot.personId ? people.find((entry) => entry.id === shot.personId) : null
                    const look = shot.personLook
                      ? person?.looks.find((entry) => entry.key === shot.personLook) ?? null
                      : null
                    return (
                      <article key={shot.id} className="plan-shot">
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-semibold tabular" style={{ color: 'var(--text-faint)' }}>{String(index + 1).padStart(2, '0')}</span>
                          <img src={SHOT_EXAMPLES[shot.type].src} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{definition.label}</span>
                          <span className="badge">On</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{shot.direction || definition.defaultDirection}</p>
                        {person && <p className="meta mt-2 truncate">Person · {person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}{look ? ` · ${look.label}` : ''}</p>}
                        {shot.type === 'feature' && shot.featureText && <p className="meta mt-2 truncate">Text · {shot.featureText}</p>}
                      </article>
                    )
                  })}
                </div>
                <p className="meta mt-3">The source photo is the starting point. Every shot you turn on is one image and one cent.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Plan">{leftContent}</Sheet>

      <div className="ws-bottom">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium tabular">{enabledShots.length} of {plan?.shots.length ?? enabledShots.length} shots on</p>
          <p className="meta tabular">Set {usd(usageCents)} · Month {usd(monthCents)}{limit !== null ? ` of ${usd(limit)}` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isRunning && job ? (
            <>
              <div className="hidden min-w-[150px] flex-col gap-1 sm:flex">
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="tabular" aria-live="polite">{job.done} made · {job.failed} failed · {job.total} total</span>
                  <span className="tabular">{usd(job.costCents)} so far</span>
                </div>
                <Progress value={job.done + job.failed} max={job.total} label={`${job.done} of ${job.total} images made`} />
              </div>
              <Button variant="secondary" onClick={() => void stop()}>Stop After This Image</Button>
              <Button variant="ghost" onClick={goOpenLibrary}>Open All Work</Button>
            </>
          ) : phase === 'review' ? (
            <>
              {madeCount > 0 && (
                <Button variant="ghost" onClick={() => setLightboxIndex(0)}>View Images</Button>
              )}
              {(madeCount > 0 && madeCount < enabledShots.length) || (exportableImages.length > 0 && madeCount === 0) ? (
                <Button variant="secondary" onClick={() => setExportOpen(true)}>Export What I Have</Button>
              ) : null}
              <Button variant="secondary" onClick={() => { setPhase('plan'); setRunLimit(null) }}>Make More</Button>
              {madeCount === enabledShots.length && enabledShots.length > 0 ? (
                <Button variant="primary" onClick={() => setExportOpen(true)}>Export Set</Button>
              ) : over ? (
                <BudgetWarning limitCents={limit!} onRaise={() => navigate('/usage')} onFewer={paidCount > 1 ? () => setRunLimit(1) : undefined} />
              ) : (
                <Button
                  variant="primary"
                  disabled={!secrets?.hasKey || !canGenerate || !plan}
                  onClick={() => startRetryMissing(runLimit ?? (madeCount === 0 ? 1 : missingShots.length))}
                >
                  {madeCount === 0 ? `Try Again · ${usd(1)}` : `Try the ${missingShots.length} Again · ${usd(estimate(missingShots.length))}`}
                </Button>
              )}
              {(!secrets?.hasKey || !canGenerate) && (
                <button type="button" className="hint underline" onClick={goSettings}>
                  {!secrets?.hasKey ? 'Add your Muse key in Settings to make images.' : 'Reactivate to make images.'}
                </button>
              )}
            </>
          ) : phase === 'plan' ? (
            <>
              {hasAttempts && <Button variant="ghost" onClick={() => setPhase('review')}>Back to Set</Button>}
              {!plan ? null : enabledShots.length === 0 ? (
                <Button variant="primary" disabled>Turn on at least one shot.</Button>
              ) : over ? (
                <BudgetWarning limitCents={limit!} onRaise={() => navigate('/usage')} onFewer={paidCount > 1 ? () => setRunLimit(1) : undefined} />
              ) : (
                <Button
                  variant="primary"
                  disabled={!secrets?.hasKey || !canGenerate}
                  onClick={() => void requestRun(missingCount ? 'make' : 'remake', (runLimit ? planRunShots : missingShots).map((shot) => shot.id), planRunCount)}
                >
                  {missingCount ? `Make ${planRunCount} ${planRunCount === 1 ? 'Image' : 'Images'} · ${usd(estimate(planRunCount))}` : `Remake ${planRunCount} ${planRunCount === 1 ? 'Image' : 'Images'} · ${usd(estimate(planRunCount))}`}
                </Button>
              )}
              {!secrets?.hasKey && <button type="button" className="hint underline" onClick={goSettings}>Add your Muse key in Settings to make images.</button>}
              {secrets?.hasKey && !canGenerate && <button type="button" className="hint underline" onClick={goSettings}>Reactivate to make images.</button>}
            </>
          ) : null}
        </div>
      </div>
      {error && <div className="px-4 pb-2 text-[12px]" style={{ color: 'var(--danger)' }} role="alert">{error}</div>}

      <FirstRunConfirm
        open={confirmOpen}
        runLabel={pending?.label ?? ''}
        imageCount={pending?.count ?? 1}
        onOpenChange={(open) => { setConfirmOpen(open); if (!open) setPending(null) }}
        onConfirm={() => void confirmFirstRun()}
        onGotIt={acknowledgeFirstRun}
      />
      <SetExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        imageCount={exportableImages.length}
        onExported={async () => {
          await loadMonth()
        }}
      />
      <SaveProductDialog
        open={Boolean(saveProductImage)}
        onOpenChange={(open) => { if (!open) setSaveProductImage(null) }}
        imageId={saveProductImage?.id ?? null}
        defaultName={project.name}
      />
      <SourcePickerDialog
        open={sourcePickerOpen}
        onOpenChange={setSourcePickerOpen}
        onChoose={(choice) => void chooseReplacement(choice)}
        onUpload={() => void replaceWithFile()}
        title="Replace the product photo"
        description="Use a saved product or any ready image in your library."
      />
      <Lightbox
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) setLightboxIndex(null) }}
        images={lightboxImages}
        index={lightboxIndex ?? 0}
        onIndex={setLightboxIndex}
        onDownload={(image) => void downloadImage(image)}
        onSetCover={(image) => void setCover(image)}
        onEdit={openEditor}
        onSaveProduct={setSaveProductImage}
        onDelete={(image) => void deleteImage(image)}
        onPin={(image) => void pinImage(image)}
        isPinned={(image) => Boolean(plan?.shots.find((shot) => shot.id === image.shotId)?.selectedImageId === image.id)}
        source={images.find((image) => image.id === project.sourceImageId) ?? null}
      />
    </>
  )
}
