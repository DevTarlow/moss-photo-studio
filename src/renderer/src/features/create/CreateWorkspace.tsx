import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DropdownMenu, Popover } from 'radix-ui'
import { Banner, Icon, MoreMenu } from '@astryxdesign/core'
import { Check, ChevronDown, Download, Image as ImageIcon, Loader2, Mountain, Package, Pencil, Sparkles, UserPlus, UserRound, X } from 'lucide-react'
import type { Format, Image, JobState, Project, Shape } from '@shared/types'
import { MAX_PROMPT } from '@shared/constants'
import { composeCreatePrompt } from '@shared/prompts/guards'
import { CREATE_PERSON_PROMPT, CREATE_PRODUCT_PROMPT, EXAMPLE_SCENES, exampleTextFor, startersByCategory } from '@shared/starters'
import type { ExampleScene, Starter } from '@shared/starters'
import { estimateCents, usd } from '@shared/cost'
import { errorMessage, billingUncertain } from '@shared/errors'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'
import { SourcePickerDialog } from '../../components/sources/SourcePickerDialog'
import type { SourceChoice } from '../../components/sources/SourcePickerDialog'
import { SaveProductDialog } from '../../components/products/SaveProductDialog'
import { SavePersonDialog } from '../../components/people/SavePersonDialog'
import { useJobsStore } from '../../store/jobs'
import { useIsWideWorkspace, useViewportTier } from '../../lib/viewport'
import { usePanelWidth, WorkspaceResizeHandle } from '../../components/ui/WorkspaceResizeHandle'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/Segmented'
import { Sheet } from '../../components/ui/Sheet'
import { Progress } from '../../components/ui/Progress'
import { Switch } from '../../components/ui/Switch'
import { FirstRunConfirm } from '../../components/ui/FirstRunConfirm'
import { Dialog } from '../../components/ui/Dialog'
import { BudgetWarning } from '../../components/ui/BudgetWarning'
import { TextareaCounter } from '../../components/ui/TextareaCounter'
import { Lightbox } from '../../components/ui/Lightbox'
import { exampleUrl } from '../../lib/assets'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { showExportToast } from '../../lib/exportFeedback'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { elapsedLabel, formatDate } from '../../lib/format'
import { currentMonth } from '../../store/library'
import { onCommand } from '../../lib/commands'
import { openSetPicker } from '../../store/setPicker'

type PromptSource = 'user' | 'starter' | 'example'

type PendingApply = {
  text: string
  source: 'starter' | 'example'
  scene?: ExampleScene
}

export function CreateWorkspace({ preferredPersonLook }: { preferredPersonLook?: string | null }): React.JSX.Element {
  const project = useWorkspaceStore((state) => state.project) as Project
  const images = useWorkspaceStore((state) => state.images)
  const sourceImageId = useWorkspaceStore((state) => state.project?.sourceImageId ?? null)
  const refresh = useWorkspaceStore((state) => state.refresh)
  const refreshImages = useWorkspaceStore((state) => state.refreshImages)
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const people = useAppStore((state) => state.people)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const jobs = useJobsStore((state) => state.jobs)
  const upsert = useJobsStore((state) => state.upsert)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const seededCreatePerson = useRef(false)
  const seededCreateProduct = useRef(false)
  const confirm = useConfirm()
  const tier = useViewportTier()
  const leftHidden = tier === 'tiny'
  const rightHidden = !useIsWideWorkspace()
  const canResizeLeft = tier === 'wide' || tier === 'medium'
  const [prompt, setPrompt] = useState('')
  const [promptSource, setPromptSource] = useState<PromptSource>('user')
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null)
  const [exampleUsesProduct, setExampleUsesProduct] = useState(true)
  const [loadedExample, setLoadedExample] = useState<{ scene: ExampleScene; text: string } | null>(null)
  const [count, setCount] = useState(1)
  const [shape, setShape] = useState<Shape>(settings?.defaultShape ?? 'square')
  const [format, setFormat] = useState<Format>(project.format ?? settings?.defaultFormat ?? 'webp')
  const [productRef, setProductRef] = useState<SourceChoice | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [sceneRef, setSceneRef] = useState<SourceChoice | null>(null)
  const [scenePickerOpen, setScenePickerOpen] = useState(false)
  const [personLook, setPersonLook] = useState<string | null>(
    preferredPersonLook && preferredPersonLook !== 'original' ? preferredPersonLook : null
  )
  useEffect(() => {
    // Keep the seeded look in step when the open image project changes.
    setPersonLook(preferredPersonLook && preferredPersonLook !== 'original' ? preferredPersonLook : null)
  }, [preferredPersonLook, project.id])
  const [saveProductImage, setSaveProductImage] = useState<Image | null>(null)
  const [savePersonImage, setSavePersonImage] = useState<Image | null>(null)
  const [personPreviewOpen, setPersonPreviewOpen] = useState(false)
  const [createPersonMode, setCreatePersonMode] = useState(false)
  const [createProductMode, setCreateProductMode] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [firstOpen, setFirstOpen] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [runs, setRuns] = useState<JobState[]>([])
  const [runFilter, setRunFilter] = useState<JobState | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [leftSheet, setLeftSheet] = useState(false)
  const [rightSheet, setRightSheet] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const leftPanelWidth = usePanelWidth('moss.workspace.create.left', 300)
  const rightPanelWidth = usePanelWidth('moss.workspace.create.right', 300, 260, 360)
  useEffect(() => {
    if (!leftHidden) setLeftSheet(false)
    if (!rightHidden) setRightSheet(false)
  }, [leftHidden, rightHidden])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const handled = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const running = Object.values(jobs).find(
    (job) => job.projectId === project.id && job.status === 'running' && job.kind === 'create'
  ) ?? null
  const currentJob = currentJobId ? jobs[currentJobId] ?? null : null
  const jobToReport = running ?? currentJob
  const job = running ?? (currentJob?.status === 'running' ? currentJob : null)
  const isRunning = Boolean(job)
  const completeJobs = runs.filter((run) => run.status !== 'running')
  const reportableRun = jobToReport ?? runFilter
  const remainingFromRun =
    reportableRun && reportableRun.status !== 'running' && reportableRun.done > 0 && reportableRun.done < reportableRun.total
      ? reportableRun.total - reportableRun.done
      : 0
  // An example-started prompt can leave the selected product photo out of the run.
  const productReferenceActive = promptSource !== 'example' || exampleUsesProduct
  const activeProductRef = productReferenceActive ? productRef : null
  const exampleUsesReference = Boolean(productRef) && exampleUsesProduct
  const hasScene = Boolean(sceneRef && activeProductRef)
  const hasReference = Boolean(activeProductRef || personId || hasScene)
  const requestedCount = hasReference ? 1 : count
  const selectedPerson = people.find((person) => person.id === personId) ?? null
  const selectedLook = selectedPerson?.looks.find((look) => look.key === personLook) ?? null
  const composedPrompt = composeCreatePrompt({ text: prompt, hasProduct: Boolean(activeProductRef), hasPerson: Boolean(personId), hasScene })
  const guardChars = composedPrompt.length - prompt.trim().length
  const results = images
    .filter((image) => image.status === 'ready' && image.kind !== 'upload')
    .filter((image) => {
      if (!runFilter) return true
      const end = runFilter.finishedAt ?? Date.now()
      return image.createdAt >= runFilter.startedAt - 100 && image.createdAt <= end + 100
    })
    .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)
  const examplesVisible = results.length === 0 && !isRunning
  const overBudget = (settings?.budgetCents ?? null) !== null && monthCents + estimateCents(requestedCount) > (settings?.budgetCents ?? 0)
  const promptTooLongForReference = hasReference && composedPrompt.length > MAX_PROMPT
  const canSubmit = Boolean(prompt.trim()) && composedPrompt.length <= MAX_PROMPT && Boolean(secrets?.hasKey) && canGenerate

  useEffect(() => {
    if (seededCreatePerson.current || params.get('createPerson') !== '1') return
    seededCreatePerson.current = true
    setCreatePersonMode(true)
    setPrompt((current) => (current.trim() ? current : CREATE_PERSON_PROMPT))
    setPromptSource((current) => (current === 'user' ? 'starter' : current))
    const next = new URLSearchParams(params)
    next.delete('createPerson')
    setParams(next, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    if (seededCreateProduct.current || params.get('createProduct') !== '1') return
    seededCreateProduct.current = true
    setCreateProductMode(true)
    setPrompt((current) => (current.trim() ? current : CREATE_PRODUCT_PROMPT))
    setPromptSource((current) => (current === 'user' ? 'starter' : current))
    const next = new URLSearchParams(params)
    next.delete('createProduct')
    setParams(next, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    void loadMonth()
    void loadRuns()
  }, [project.id])

  // The project can finish loading after this component mounts, so pick up the
  // source image when it arrives instead of only reading it at first render.
  const initializedSource = useRef<string | null>(null)
  useEffect(() => {
    if (!sourceImageId || initializedSource.current === sourceImageId) return
    const image = images.find((entry) => entry.id === sourceImageId)
    if (!image) return
    initializedSource.current = sourceImageId
    if (image.personId) {
      setPersonId(image.personId)
      setProductRef(null)
      return
    }
    setProductRef({ kind: 'image', imageId: image.id, label: image.label, thumbUrl: image.thumbUrl })
    setExampleUsesProduct(true)
    syncExampleText(true, true)
  }, [sourceImageId, images])

  useEffect(() => {
    if (hasReference && count !== 1) setCount(1)
  }, [hasReference, count])

  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  useEffect(() => {
    if (!jobToReport) return
    if (jobToReport.status === 'running') {
      const changed = jobToReport.done + jobToReport.failed
      if (changed) void refreshImages()
      return
    }
    if (handled.current.has(jobToReport.id)) return
    handled.current.add(jobToReport.id)
    void (async () => {
      await refresh()
      await loadRuns()
      await loadMonth()
      if (jobToReport.done > 0) {
        setError(jobToReport.done < jobToReport.total ? `${jobToReport.done} of ${jobToReport.total} came back. You were charged for ${jobToReport.done}.` : null)
        toast.status(`${jobToReport.done} ${jobToReport.done === 1 ? 'image' : 'images'} made · ${usd(jobToReport.costCents)}.`)
      } else {
        const code = jobToReport.items[0]?.errorCode ?? 'unknown'
        const suffix = billingUncertain(code as never) ? ' If Meta made it, it may still show on your bill.' : ''
        setError(`${errorMessage(code as never)}${suffix}`)
      }
    })()
  }, [jobToReport, refresh, refreshImages])

  useEffect(() => {
    return onCommand((command) => {
      if (command === 'export' && results[0]) void download(results[0])
      if (command === 'toggle-panel') {
        if (rightHidden) setRightSheet(true)
        else setRightCollapsed((collapsed) => !collapsed)
      }
    })
    // The newest result is the one the shortcut exports.
  }, [images, rightHidden])

  useEffect(() => {
    void window.moss.app.setMenuContext({
      editor: true,
      adjust: false,
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      canExport: results.length > 0,
      canZoom: false
    }).catch(() => undefined)
  }, [results.length])

  const loadMonth = async (): Promise<void> => {
    try {
      const summary = await unwrap(window.moss.usage.summary({ month: currentMonth() }))
      setMonthCents(summary.spendCents)
    } catch {
      // The cost hint is not worth blocking the page.
    }
  }

  const loadRuns = async (): Promise<void> => {
    try {
      const all = await unwrap(window.moss.jobs.listForProject({ projectId: project.id }))
      setRuns(all.filter((run) => run.kind === 'create'))
    } catch {
      setRuns([])
    }
  }

  const applyText = (text: string, source: 'starter' | 'example', scene?: ExampleScene): void => {
    setPrompt(text)
    setPromptSource(source)
    setPendingApply(null)
    setLoadedExample(source === 'example' && scene ? { scene, text } : null)
    setError(null)
    if (source === 'example') {
      if (leftHidden) setLeftSheet(true)
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }

  /** Keep an untouched example description in step with the product reference. */
  const syncExampleText = (usesProduct: boolean, productAvailable: boolean): void => {
    if (promptSource !== 'example' || !loadedExample) return
    if (prompt !== loadedExample.scene.exampleText && prompt !== loadedExample.scene.productText) return
    const next = exampleTextFor(loadedExample.scene, productAvailable && usesProduct)
    if (next === prompt) return
    setPrompt(next)
    setLoadedExample({ scene: loadedExample.scene, text: next })
  }

  const applyExampleToggle = (next: boolean): void => {
    setExampleUsesProduct(next)
    setPendingApply(null)
    syncExampleText(next, Boolean(productRef))
  }

  const requestApply = (entry: PendingApply): void => {
    if (prompt.trim() && promptSource === 'user') {
      setPendingApply(entry)
      return
    }
    applyText(entry.text, entry.source, entry.scene)
  }

  const chooseStarter = (starter: Starter): void => {
    requestApply({ text: starter.text, source: 'starter' })
  }

  const chooseExample = (scene: ExampleScene): void => {
    requestApply({
      text: exampleTextFor(scene, exampleUsesReference),
      source: 'example',
      scene
    })
  }

  const submit = async (): Promise<void> => {
    setError(null)
    if (!prompt.trim()) {
      setError('Describe the image first.')
      return
    }
    if (prompt.length > MAX_PROMPT) {
      setError(`That's ${prompt.length - MAX_PROMPT} characters over. Shorten it and try again.`)
      return
    }
    if (promptTooLongForReference) {
      setError(`These references add ${guardChars} characters to the request. Shorten your description by ${composedPrompt.length - MAX_PROMPT}.`)
      return
    }
    if (!settings?.firstRunConfirmShown) {
      setFirstOpen(true)
      return
    }
    await execute()
  }

  const execute = async (): Promise<void> => {
    try {
      const result = await unwrap(window.moss.jobs.startCreate({
        projectId: project.id,
        prompt,
        count: requestedCount,
        shape,
        format,
        sourceImageId: activeProductRef?.kind === 'image' ? activeProductRef.imageId : undefined,
        productId: activeProductRef?.kind === 'product' ? activeProductRef.productId : undefined,
        personId: personId ?? undefined,
        personLook: selectedLook?.key,
        sceneImageId: hasScene && sceneRef?.kind === 'image' ? sceneRef.imageId : undefined
      }))
      const state = await unwrap(window.moss.jobs.state({ jobId: result.jobId }))
      upsert(state)
      setCurrentJobId(result.jobId)
      handled.current.delete(result.jobId)
    } catch (caught) {
      setError(messageOf(caught))
      toast.error(messageOf(caught))
    }
  }

  const makeTheRest = async (): Promise<void> => {
    if (!reportableRun || remainingFromRun < 1) return
    setError(null)
    try {
      const result = await unwrap(window.moss.jobs.retryFailed({ jobId: reportableRun.id }))
      handled.current.delete(result.jobId)
      setCurrentJobId(result.jobId)
      toast.status(`Making the other ${remainingFromRun} ${remainingFromRun === 1 ? 'image' : 'images'}.`)
    } catch (caught) {
      setError(messageOf(caught))
      toast.error(messageOf(caught))
    }
  }

  const confirmFirst = async (): Promise<void> => {
    try {
      await unwrap(window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }))
      await refreshSettings()
    } catch {
      // Marked for this session.
    }
    setFirstOpen(false)
    await execute()
  }

  const download = async (image: Image): Promise<void> => {
    try {
      const result = await unwrap(window.moss.exports.images({
        projectId: project.id,
        imageIds: [image.id],
        options: { format, quality: 90, maxDimension: null, filename: image.label }
      }))
      showExportToast(result.count, result.folderName, project.id)
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const remove = async (image: Image): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${image.label}"?`,
      body: 'This image leaves this computer. This cannot be undone.',
      confirmLabel: 'Delete Image',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.images.delete({ id: image.id }))
      await refresh()
      if (lightboxIndex !== null) setLightboxIndex(null)
      toast.status('Image deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const chooseProductRef = (choice: SourceChoice): void => {
    setProductRef(choice)
    setExampleUsesProduct(true)
    setPendingApply(null)
    syncExampleText(true, true)
    if (choice.kind !== 'image') return
    const image = images.find((entry) => entry.id === choice.imageId)
    if (!image || image.projectId !== project.id || image.personId) return
    // Keep the project source in step with a reference chosen from this project,
    // matching the old reference picker. External sources are not copied.
    void window.moss.images.setSource({ projectId: project.id, imageId: image.id })
      .then(() => useWorkspaceStore.getState().refresh())
      .catch(() => undefined)
  }

  const chooseFile = async (): Promise<void> => {
    setPickerOpen(false)
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ projectId: project.id, kind: 'source' }))
      if (result?.imageId) {
        warnIfSmallPhoto(result)
        await useWorkspaceStore.getState().refresh()
        const added = useWorkspaceStore.getState().images.find((image) => image.id === result.imageId)
        if (added) {
          setProductRef({ kind: 'image', imageId: added.id, label: added.label, thumbUrl: added.thumbUrl })
          setExampleUsesProduct(true)
          setPendingApply(null)
          syncExampleText(true, true)
        }
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const leftPanel = (
    <div className="scroll-area p-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Describe the image</p>
        {prompt && <button type="button" className="text-[11px]" style={{ color: 'var(--text-faint)' }} onClick={() => { setPrompt(''); setPromptSource('user'); setLoadedExample(null); setPendingApply(null) }}>Clear</button>}
      </div>
      <div className="mt-2">
        <TextareaCounter
          ref={textareaRef}
          value={prompt}
          max={MAX_PROMPT}
          rows={5}
          onChange={(event) => { setPrompt(event.target.value); setPromptSource('user'); setLoadedExample(null); setPendingApply(null); setError(null) }}
          placeholder="Describe the picture you want. For example: a ceramic mug on a warm kitchen table, soft morning light."
          hint="Meta makes the picture. You pay a cent for every image that comes back."
        />
        {promptTooLongForReference && (
          <p className="error-text mt-1" role="alert">These references add {guardChars} characters. Shorten your description.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="field-label">Start from an idea</p>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button type="button" className="btn btn-secondary w-full justify-between">
              <span className="flex items-center gap-2"><Icon icon={Sparkles} size="sm" /> Start from an Idea</span>
              <Icon icon={ChevronDown} size="sm" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="menu-content max-h-[420px] w-[330px] overflow-y-auto" sideOffset={4} align="start">
              {startersByCategory().map((group) => (
                <div key={group.category}>
                  <p className="menu-group-title">{group.category}</p>
                  {group.items.map((starter) => (
                    <Popover.Close asChild key={starter.label}>
                      <button type="button" className="menu-item w-full text-left" onClick={() => chooseStarter(starter)}>
                        {starter.label}
                      </button>
                    </Popover.Close>
                  ))}
                </div>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {pendingApply && (
          <div className="mt-2 rounded-[8px] border p-3" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }} role="alert">
            <p className="text-[12px] font-medium">
              Replace your words with this {pendingApply.source === 'example' ? 'example' : 'idea'}?
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => applyText(pendingApply.text, pendingApply.source, pendingApply.scene)}>Replace</Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingApply(null)}>Keep</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="field-label">Product reference <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {productRef ? (
          <div className="flex items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: 'var(--border)' }}>
            {productRef.thumbUrl && <img src={productRef.thumbUrl} alt="The product reference" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{productRef.kind === 'product' ? productRef.name : productRef.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {activeProductRef ? 'Sent with the request so the product stays the same.' : 'Not used with this example.'}
              </p>
              {!examplesVisible && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  <Switch checked={exampleUsesProduct} onCheckedChange={applyExampleToggle} label="Use my product photo in examples" />
                  <span>Use in examples</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove product reference"
              onClick={() => {
                setProductRef(null)
                setPendingApply(null)
                syncExampleText(exampleUsesProduct, false)
              }}
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full justify-start" type="button" onClick={() => setPickerOpen(true)}>
            <Icon icon={ImageIcon} size="sm" /> Choose a Product Photo
          </Button>
        )}
      </div>

      <div className="mt-4">
        <p className="field-label">Person reference <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {people.length === 0 ? (
          <p className="hint">Add a person on the People page to use one here.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="field flex h-8 min-w-0 flex-1 items-center justify-between gap-2 text-[11px]"
                    aria-label={selectedPerson ? `Person reference: ${selectedPerson.name}` : 'Choose a Person'}
                  >
                    <span className="truncate">
                      {selectedPerson
                        ? `${selectedPerson.name}${selectedPerson.ageBand ? ` · ${selectedPerson.ageBand}` : ''}${selectedLook ? ` · ${selectedLook.label}` : ''}`
                        : 'Choose a Person'}
                    </span>
                    <Icon icon={ChevronDown} size="xsm" className="shrink-0" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-content min-w-[240px]" sideOffset={4}>
                    {people.map((person) => (
                      <DropdownMenu.Item
                        key={person.id}
                        className="menu-item"
                        onSelect={() => { setPersonId(person.id); setPersonLook(null) }}
                      >
                        <img src={person.portraitUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                        <span className="min-w-0 flex-1 truncate">{person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}</span>
                        {person.id === selectedPerson?.id && <Icon icon={Check} size="sm" className="ml-auto shrink-0" />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              {selectedPerson ? (
                <>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 hover:opacity-80"
                    aria-label={`See ${selectedPerson.name} larger`}
                    onClick={() => setPersonPreviewOpen(true)}
                  >
                    <img
                      src={selectedLook?.url ?? selectedPerson.portraitUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                      onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                    />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Remove person reference" onClick={() => { setPersonId(null); setPersonLook(null) }}><Icon icon={X} size="sm" /></button>
                </>
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }} aria-hidden>
                  <Icon icon={UserRound} size="sm" />
                </span>
              )}
            </div>
            {selectedPerson ? (
              <p className="hint mt-1">Sent with the request so the person stays the same.</p>
            ) : (
              <p className="hint mt-1">Pick a portrait to keep the same person in the image.</p>
            )}
          </>
        )}
      </div>

      <div className="mt-4">
        <p className="field-label">Scene reference <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {hasScene && sceneRef?.kind === 'image' ? (
          <div className="flex items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: 'var(--border)' }}>
            <img src={sceneRef.thumbUrl ?? ''} alt="" className="h-10 w-10 rounded object-cover" style={{ background: 'var(--surface-2)' }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{sceneRef.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>The setting and light are borrowed; its subject is not.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Remove scene reference" onClick={() => setSceneRef(null)}><Icon icon={X} size="sm" /></button>
          </div>
        ) : activeProductRef ? (
          <Button variant="secondary" className="w-full justify-start" type="button" onClick={() => setScenePickerOpen(true)}>
            <Icon icon={Mountain} size="sm" /> Choose a Scene
          </Button>
        ) : (
          <p className="hint">Choose a product reference first, then add a scene to borrow its setting and light.</p>
        )}
      </div>

      {hasReference && (
        <p className="hint mt-2">A product, person, and scene can be sent together. References make one image at a time.</p>
      )}

      <div className="mt-5 space-y-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="field-label">How many</p>
          <Segmented
            label="How many images"
            value={String(count) as '1' | '2' | '3' | '4'}
            onChange={(value) => setCount(Number(value))}
            options={[1, 2, 3, 4].map((value) => ({
              value: String(value) as '1' | '2' | '3' | '4',
              label: String(value),
              disabled: hasReference && value !== 1
            }))}
          />
          {hasReference && <p className="hint mt-1">References make one image at a time.</p>}
        </div>
        <div>
          <p className="field-label">Shape</p>
          <Segmented label="Shape" value={shape} onChange={(next) => { setShape(next); void useWorkspaceStore.getState().updateProject({ shape: next }).catch(() => undefined) }} options={[
            { value: 'square' as const, label: 'Square' },
            { value: 'portrait' as const, label: 'Portrait' },
            { value: 'landscape' as const, label: 'Landscape' }
          ]} />
        </div>
        <div>
          <label className="field-label" htmlFor="create-format">Format</label>
          <select id="create-format" className="field" value={format} onChange={(event) => { const next = event.target.value as Format; setFormat(next); void useWorkspaceStore.getState().updateProject({ format: next }).catch(() => undefined) }}>
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
        <p className="hint">The shape sets the frame, not the pixel size. Meta returns its own resolution.</p>
      </div>
    </div>
  )

  const rightPanel = (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Runs</p>
        {runFilter && <button type="button" className="text-[11px]" style={{ color: 'var(--accent)' }} onClick={() => setRunFilter(null)}>Show all</button>}
      </div>
      {completeJobs.length === 0 ? (
        <p className="meta mt-2">No runs yet.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {completeJobs.map((run) => (
            <button
              key={run.id}
              type="button"
              className="w-full rounded-[8px] border p-2 text-left"
              style={{ borderColor: run.id === runFilter?.id ? 'var(--accent)' : 'var(--border)', background: run.id === runFilter?.id ? 'var(--accent-soft)' : 'transparent' }}
              onClick={() => setRunFilter(run.id === runFilter?.id ? null : run)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">{formatDate(run.startedAt, true)}</span>
                <span className="badge" data-tone={run.status === 'done' ? 'success' : run.status === 'failed' ? 'danger' : undefined}>
                  {run.status === 'done' ? 'Made' : run.status === 'failed' ? 'Failed' : run.status}
                </span>
              </div>
              <p className="meta mt-0.5">{run.done} images · {usd(run.costCents)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="workspace">
        {!leftHidden && (
          <>
            <aside className="ws-left" style={canResizeLeft ? { width: leftPanelWidth.width, minWidth: leftPanelWidth.width } : undefined}>{leftPanel}</aside>
            {canResizeLeft && <WorkspaceResizeHandle label="Resize describe panel" side="left" width={leftPanelWidth.width} onPointerDown={leftPanelWidth.onPointerDown} onKeyDown={leftPanelWidth.onKeyDown} onReset={leftPanelWidth.reset} />}
          </>
        )}
        <section className="ws-center">
          <div className="flex items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{runFilter ? `One run · ${formatDate(runFilter.startedAt, true)}` : 'Image Generator'}</p>
            {leftHidden && <Button variant="ghost" size="sm" onClick={() => setLeftSheet(true)}>Describe</Button>}
            {(rightHidden || rightCollapsed) && <Button variant="ghost" size="sm" onClick={() => { if (rightHidden) setRightSheet(true); else setRightCollapsed(false) }}>Runs</Button>}
            {isRunning && job && <span className="badge" data-tone="success">Making</span>}
          </div>
          <div className="scroll-area flex-1 p-5">
            {createPersonMode && (
              <div className="mb-5">
                <Banner
                  status="info"
                  title="Make a new person"
                  description="Describe the person, generate an image, then choose Save as Person on the result."
                  collapsible={false}
                />
              </div>
            )}
            {createProductMode && (
              <div className="mb-5">
                <Banner
                  status="info"
                  title="Make a new product"
                  description="Describe the product, generate an image, then choose Save as Product on the result."
                  collapsible={false}
                />
              </div>
            )}
            {isRunning && job && (
              <div className="card mb-5 p-4">
                <div className="flex items-center gap-2">
                  <Icon icon={Loader2} size="sm" className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-[12px] font-semibold">Making {job.total} {job.total === 1 ? 'image' : 'images'} · {elapsedLabel(job.startedAt, now)}</p>
                  <p className="meta ml-auto tabular">{usd(job.costCents)} so far</p>
                </div>
                <div className="mt-2"><Progress value={job.done} max={job.total} label={`${job.done} of ${job.total} images made`} /></div>
                <p className="meta mt-1" aria-live="polite">{job.done} made · {job.failed} failed · {job.total} total</p>
              </div>
            )}
            {error && !isRunning ? (
              <div className="mb-4 rounded-[10px] border p-3" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }} role="alert">
                <p className="text-[12px] font-semibold">That did not come through.</p>
                <p className="mt-1 text-[12px]">{error}</p>
                <div className="mt-2">
                  {remainingFromRun > 0 ? (
                    <Button variant="secondary" size="sm" onClick={() => void makeTheRest()}>
                      Make the other {remainingFromRun} · {usd(remainingFromRun)}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => void submit()}>Try Again</Button>
                  )}
                </div>
              </div>
            ) : null}
            {results.length === 0 ? (
              !isRunning && (
                <div>
                  <p className="text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Describe the picture you want. Meta makes it, and you pay a cent an image.</p>
                  {productRef ? (
                    <div className="mx-auto mt-4 flex max-w-[760px] flex-wrap items-center justify-center gap-3">
                      <p className="text-center text-[13px] font-semibold">Examples</p>
                      <div className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <Switch checked={exampleUsesProduct} onCheckedChange={applyExampleToggle} label="Use my product photo in examples" />
                        <span>Use my product photo</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mx-auto mt-4 max-w-[760px] text-center text-[13px] font-semibold">Examples</p>
                  )}
                  <p className="mx-auto mt-1 max-w-[760px] text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    Click a photo to load a starting description.
                  </p>
                  <div className="mx-auto mt-2 grid max-w-[760px] grid-cols-2 gap-4">
                    {EXAMPLE_SCENES.map((scene) => (
                      <button
                        key={scene.key}
                        type="button"
                        className="card card-hover generator-example overflow-hidden text-left"
                        onClick={() => chooseExample(scene)}
                      >
                        <img src={exampleUrl(scene.key)} alt="" className="aspect-[4/3] w-full object-cover" />
                        <div className="p-3">
                          <p className="text-[12px] font-semibold">{scene.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="mx-auto grid max-w-[900px] grid-cols-2 gap-4">
                {results.map((image, index) => (
                  <div key={image.id} className="card overflow-hidden">
                    <button
                      type="button"
                      className="relative block w-full cursor-zoom-in"
                      onClick={() => setLightboxIndex(index)}
                    >
                      <span className="sr-only">Open {image.label} larger</span>
                      {image.url && <img src={image.url} alt="" className="aspect-[4/3] w-full object-cover" />}
                      {index === 0 && !runFilter && <span className="badge absolute left-2 top-2" data-tone="canvas">Newest</span>}
                    </button>
                    <div className="flex flex-wrap items-center gap-1 border-t px-2 py-2" style={{ borderColor: 'var(--border)' }}>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${project.id}?view=photo&image=${image.id}`)}>
                        <Icon icon={Pencil} size="xsm" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void download(image)}>
                        <Icon icon={Download} size="xsm" /> Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSaveProductImage(image)}>
                        <Icon icon={Package} size="xsm" /> Save as Product
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSavePersonImage(image)}>
                        <Icon icon={UserPlus} size="xsm" /> Save as Person
                      </Button>
                      <div className="ml-auto">
                        <MoreMenu
                          label={`More actions for ${image.label}`}
                          size="sm"
                          items={[
                            { label: 'Save to Set', onClick: () => openSetPicker(image) },
                            { label: 'Delete', onClick: () => void remove(image) }
                          ]}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 pb-2">
                      <span className="text-[11px] font-medium">{image.label}</span>
                      <span className="meta">1 image</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        {!rightHidden && !rightCollapsed && (
          <>
            <WorkspaceResizeHandle label="Resize runs panel" side="right" width={rightPanelWidth.width} min={260} max={360} onPointerDown={rightPanelWidth.onPointerDown} onKeyDown={rightPanelWidth.onKeyDown} onReset={rightPanelWidth.reset} />
            <aside className="ws-right" style={{ width: rightPanelWidth.width, minWidth: rightPanelWidth.width }}>{rightPanel}</aside>
          </>
        )}
      </div>
      <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Image Generator">{leftPanel}</Sheet>
      <Sheet open={rightSheet} onOpenChange={setRightSheet} side="right" title="Runs">{rightPanel}</Sheet>

      <div className="ws-bottom">
        <button type="button" className="min-w-0 text-left" onClick={() => navigate('/usage')}>
          <p className="truncate text-[12px] font-medium tabular">{requestedCount} {requestedCount === 1 ? 'image' : 'images'} · {usd(estimateCents(requestedCount))}</p>
          <p className="meta tabular">Month {usd(monthCents)}{settings?.budgetCents != null ? ` of ${usd(settings.budgetCents)}` : ''}</p>
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {overBudget ? (
            <BudgetWarning limitCents={settings?.budgetCents ?? 0} onRaise={() => navigate('/usage')} onFewer={requestedCount > 1 ? () => setCount((current) => Math.max(1, current - 1)) : undefined} />
          ) : (
            <Button variant="primary" disabled={!canSubmit || isRunning || promptTooLongForReference} onClick={() => void submit()}>
              {isRunning ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null}
              Create {requestedCount} {requestedCount === 1 ? 'Image' : 'Images'} · {usd(estimateCents(requestedCount))}
            </Button>
          )}
          {!secrets?.hasKey && <button type="button" className="hint underline" onClick={() => navigate('/settings/studio')}>Add your Muse key in Settings to make images.</button>}
          {secrets?.hasKey && !canGenerate && <button type="button" className="hint underline" onClick={() => navigate('/settings/license')}>Reactivate to make images.</button>}
        </div>
      </div>

      <SourcePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onChoose={chooseProductRef}
        onUpload={() => void chooseFile()}
        title="Choose a Product Photo"
        description="Use a saved product or any ready image in your library."
      />
      <SourcePickerDialog
        open={scenePickerOpen}
        onOpenChange={setScenePickerOpen}
        onChoose={(choice) => { if (choice.kind === 'image') setSceneRef(choice) }}
        title="Choose a Scene Reference"
        description="Use a ready image for the setting, light, and props. Its subject is never copied."
        libraryOnly
      />
      <SaveProductDialog
        open={Boolean(saveProductImage)}
        onOpenChange={(open) => { if (!open) setSaveProductImage(null) }}
        imageId={saveProductImage?.id ?? null}
        defaultName={project.name}
      />
      {selectedPerson && (
        <Dialog
          open={personPreviewOpen}
          onOpenChange={setPersonPreviewOpen}
          title={selectedPerson.name}
          description={selectedPerson.ageBand ?? undefined}
          width={460}
          footer={<Button variant="secondary" onClick={() => setPersonPreviewOpen(false)}>Close</Button>}
        >
          <img
            src={selectedLook?.url ?? selectedPerson.portraitUrl}
            alt={`${selectedPerson.name}${selectedLook ? ` ${selectedLook.label}` : ''} portrait`}
            className="mx-auto max-h-[60vh] w-full rounded-[12px] object-contain"
          />
        </Dialog>
      )}
      <SavePersonDialog
        open={Boolean(savePersonImage)}
        onOpenChange={(open) => { if (!open) setSavePersonImage(null) }}
        imageId={savePersonImage?.id ?? null}
      />
      <Lightbox
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) setLightboxIndex(null) }}
        images={results}
        index={lightboxIndex ?? 0}
        onIndex={setLightboxIndex}
        onDownload={(image) => void download(image)}
        onEdit={(image) => navigate(`/project/${project.id}?view=photo&image=${image.id}`)}
        onSaveProduct={(image) => { setLightboxIndex(null); setSaveProductImage(image) }}
        onSavePerson={(image) => { setLightboxIndex(null); setSavePersonImage(image) }}
        onSaveToSet={(image) => { setLightboxIndex(null); openSetPicker(image) }}
        onDelete={(image) => void remove(image)}
      />
      <FirstRunConfirm
        open={firstOpen}
        runLabel={`Create ${requestedCount} ${requestedCount === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(requestedCount))}`}
        imageCount={requestedCount}
        onOpenChange={setFirstOpen}
        onConfirm={() => void confirmFirst()}
        onGotIt={() => {
          setFirstOpen(false)
          void window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }).then(() => refreshSettings()).catch(() => undefined)
        }}
      />
    </>
  )
}
