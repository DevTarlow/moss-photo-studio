import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Popover } from 'radix-ui'
import { Banner, Icon, MoreMenu } from '@astryxdesign/core'
import { ChevronDown, Download, Image as ImageIcon, Loader2, Mountain, Pencil, Sparkles, X } from 'lucide-react'
import type { Format, Image, JobState, Project, Shape } from '@shared/types'
import { MAX_PROMPT } from '@shared/constants'
import { isBundledProduct } from '@shared/products'
import { shapeLabel } from '@shared/shapes'
import { composeCreatePrompt } from '@shared/prompts/guards'
import { CREATE_PERSON_PROMPT, CREATE_PRODUCT_PROMPT, EXAMPLE_SCENES, exampleTextFor, startersByCategory } from '@shared/starters'
import type { ExampleScene, Starter } from '@shared/starters'
import { estimateCents, usd } from '@shared/cost'
import { errorMessage, billingUncertain } from '@shared/errors'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'
import { useUiStore } from '../../store/ui'
import { CreateInspector } from './CreateInspector'
import { SourcePickerDialog } from '../../components/sources/SourcePickerDialog'
import type { SourceChoice } from '../../components/sources/SourcePickerDialog'
import { SaveProductDialog } from '../../components/products/SaveProductDialog'
import { SavePersonDialog } from '../../components/people/SavePersonDialog'
import { PersonPicker } from '../../components/people/PersonPicker'
import { useJobsStore } from '../../store/jobs'
import { useIsWideWorkspace, useViewportTier } from '../../lib/viewport'
import { usePanelWidth, WorkspaceResizeHandle } from '../../components/ui/WorkspaceResizeHandle'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { Progress } from '../../components/ui/Progress'
import { Switch } from '../../components/ui/Switch'
import { FirstRunConfirm } from '../../components/ui/FirstRunConfirm'
import { BudgetWarning } from '../../components/ui/BudgetWarning'
import { TextareaCounter } from '../../components/ui/TextareaCounter'
import { Lightbox } from '../../components/ui/Lightbox'
import { exampleUrl } from '../../lib/assets'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { showExportToast } from '../../lib/exportFeedback'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { elapsedLabel, formatDate, plural } from '../../lib/format'
import { currentMonth } from '../../store/library'
import { onCommand } from '../../lib/commands'
import { openSetPicker } from '../../store/setPicker'

type PromptSource = 'user' | 'starter' | 'example'

type PendingApply = {
  text: string
  source: 'starter' | 'example'
  scene?: ExampleScene
}

const draftKey = (projectId: string): string => `moss.create-draft.${projectId}`

function readDraft(projectId: string): string {
  try {
    return sessionStorage.getItem(draftKey(projectId)) ?? ''
  } catch {
    return ''
  }
}

export function CreateWorkspace({ preferredPersonLook }: { preferredPersonLook?: string | null }): React.JSX.Element {
  const project = useWorkspaceStore((state) => state.project) as Project
  const images = useWorkspaceStore((state) => state.images)
  const sourceImageId = useWorkspaceStore((state) => state.project?.sourceImageId ?? null)
  const refresh = useWorkspaceStore((state) => state.refresh)
  const refreshImages = useWorkspaceStore((state) => state.refreshImages)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const people = useAppStore((state) => state.people)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const setMetaKeyOpen = useUiStore((state) => state.setMetaKeyOpen)
  const setBudgetOpen = useUiStore((state) => state.setBudgetOpen)
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
  const [prompt, setPrompt] = useState(() => readDraft(project.id))
  const hydratedProject = useRef(project.id)
  const [promptSource, setPromptSource] = useState<PromptSource>('user')
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null)
  const [exampleUsesProduct, setExampleUsesProduct] = useState(true)
  const [loadedExample, setLoadedExample] = useState<{ scene: ExampleScene; text: string } | null>(null)
  const [count, setCount] = useState(1)
  const [shape, setShape] = useState<Shape>(project.shape)
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
  const [createPersonMode, setCreatePersonMode] = useState(false)
  const [createProductMode, setCreateProductMode] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [firstOpen, setFirstOpen] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [runs, setRuns] = useState<JobState[]>([])
  const [runFilter, setRunFilter] = useState<JobState | null>(null)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [leftSheet, setLeftSheet] = useState(false)
  const [rightSheet, setRightSheet] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const leftPanelWidth = usePanelWidth('moss.workspace.create.left', 300)
  const rightPanelWidth = usePanelWidth('moss.workspace.create.right', 300, 260, 360, 'right')
  useEffect(() => {
    if (!leftHidden) setLeftSheet(false)
    if (!rightHidden) setRightSheet(false)
  }, [leftHidden, rightHidden])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const handled = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const photoViewUrl = (imageId: string): string => {
    const next = new URLSearchParams(params)
    next.set('view', 'photo')
    next.set('image', imageId)
    return `/project/${project.id}?${next.toString()}`
  }

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
  const selectedResult = results.find((image) => image.id === selectedResultId) ?? results[0] ?? null
  const examplesVisible = results.length === 0 && !isRunning && !runFilter
  const filterEmpty = Boolean(runFilter) && results.length === 0 && !isRunning
  const canSaveAsPerson = Boolean(personId || selectedResult?.personId || createPersonMode)
  const lastDescription = results.find((image) => image.userText?.trim())?.userText ?? null
  const overBudget = (settings?.budgetCents ?? null) !== null && monthCents + estimateCents(requestedCount) > (settings?.budgetCents ?? 0)
  const promptTooLongForReference = hasReference && composedPrompt.length > MAX_PROMPT
  const canSubmit = Boolean(prompt.trim()) && composedPrompt.length <= MAX_PROMPT && Boolean(secrets?.hasKey) && canGenerate

  useEffect(() => {
    // Persist only after the prompt belongs to the project on screen. See the
    // rehydrate effect below; the guard avoids writing one project's draft into
    // the next project during the same render.
    if (hydratedProject.current !== project.id) return
    try {
      sessionStorage.setItem(draftKey(project.id), prompt)
    } catch {
      // Session storage is best-effort; the workspace still works.
    }
  }, [prompt, project.id])

  useEffect(() => {
    if (hydratedProject.current === project.id) return
    hydratedProject.current = project.id
    setPrompt(readDraft(project.id))
    setPromptSource('user')
    setLoadedExample(null)
    setPendingApply(null)
  }, [project.id])

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
    // A finished make should bring the newest image into the inspector.
    setSelectedResultId(null)
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
      if (command === 'export' && selectedResult) void download(selectedResult)
      if (command === 'toggle-panel') {
        if (rightHidden) setRightSheet(true)
        else setRightCollapsed((collapsed) => !collapsed)
      }
    })
    // The image in the inspector is the one the shortcut exports.
  }, [selectedResult, rightHidden])

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

  const focusResult = (image: Image): void => setSelectedResultId(image.id)

  const showAllResults = (): void => {
    setRunFilter(null)
    setSelectedResultId(null)
  }

  const selectRun = (run: JobState): void => {
    setRunFilter(run.id === runFilter?.id ? null : run)
    setSelectedResultId(null)
  }

  const changeShape = (next: Shape): void => {
    setShape(next)
    void updateProject({ shape: next }).catch(() => toast.error('That setting could not be saved.'))
  }

  const changeFormat = (next: Format): void => {
    setFormat(next)
    void updateProject({ format: next }).catch(() => toast.error('That setting could not be saved.'))
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
      setError(`This product, person, or scene adds ${guardChars} characters. Shorten your description by ${composedPrompt.length - MAX_PROMPT}.`)
      return
    }
    if (!settings?.firstRunConfirmShown) {
      setFirstOpen(true)
      return
    }
    await execute()
  }

  const execute = async (): Promise<void> => {
    setRunFilter(null)
    setSelectedResultId(null)
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
    setRunFilter(null)
    setSelectedResultId(null)
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
      if (selectedResultId === image.id) setSelectedResultId(null)
      await refresh()
      if (lightboxIndex !== null) setLightboxIndex(null)
      toast.status('Image deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const useStarterProduct = async (choice: Extract<SourceChoice, { kind: 'product' }>): Promise<void> => {
    try {
      const existing = images.find(
        (image) => image.projectId === project.id && !image.personId && image.label === choice.name
      )
      if (existing) {
        setProductRef({ kind: 'image', imageId: existing.id, label: existing.label, thumbUrl: existing.thumbUrl })
        setExampleUsesProduct(true)
        syncExampleText(true, true)
        return
      }
      const imported = await unwrap(window.moss.products.importIntoProject({ productId: choice.productId, projectId: project.id }))
      if (!imported?.imageId) throw new Error('The starter product could not be added.')
      await useWorkspaceStore.getState().refresh()
      const added = useWorkspaceStore.getState().images.find((image) => image.id === imported.imageId)
      if (!added) throw new Error('The starter product could not be added.')
      setProductRef({ kind: 'image', imageId: added.id, label: added.label, thumbUrl: added.thumbUrl })
      setExampleUsesProduct(true)
      syncExampleText(true, true)
    } catch (caught) {
      setProductRef(null)
      setExampleUsesProduct(false)
      toast.error(messageOf(caught))
    }
  }

  const chooseProductRef = (choice: SourceChoice): void => {
    setProductRef(choice)
    setExampleUsesProduct(true)
    setPendingApply(null)
    syncExampleText(true, true)
    if (choice.kind === 'product') {
      if (isBundledProduct(choice.productId)) void useStarterProduct(choice)
      return
    }
    const image = images.find((entry) => entry.id === choice.imageId)
    if (!image || image.projectId !== project.id || image.personId) return
    // Keep the project source in step with a photo chosen from this project.
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
      {!prompt.trim() && lastDescription && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
          title={lastDescription}
          onClick={() => {
            setPrompt(lastDescription)
            setPromptSource('user')
            setLoadedExample(null)
            setPendingApply(null)
            setError(null)
            window.setTimeout(() => textareaRef.current?.focus(), 0)
          }}
        >
          <Icon icon={Sparkles} size="xsm" /> Use Last Description
        </button>
      )}
      <div className="mt-2">
        <TextareaCounter
          ref={textareaRef}
          value={prompt}
          max={MAX_PROMPT}
          rows={5}
          onChange={(event) => { setPrompt(event.target.value); setPromptSource('user'); setLoadedExample(null); setPendingApply(null); setError(null) }}
          placeholder="Describe the picture you want. For example: a ceramic mug on a warm kitchen table, soft morning light."
          hint={`Meta makes the picture. You pay ${usd(1)} for every image that comes back.`}
        />
        {promptTooLongForReference && (
          <p className="error-text mt-1" role="alert">This product, person, or scene adds {guardChars} characters. Shorten your description.</p>
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
        <p className="field-label">Product photo <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {productRef ? (
          <div className="flex items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: 'var(--border)' }}>
            {productRef.thumbUrl && <img src={productRef.thumbUrl} alt="The product photo" className="h-10 w-10 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{productRef.kind === 'product' ? productRef.name : productRef.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {activeProductRef ? 'Sent with your description so the product stays the same.' : 'Not used with this example.'}
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
              aria-label="Remove product photo"
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
        <p className="field-label">Person <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {people.length === 0 ? (
          <p className="hint">Add a person on the People page to use one here.</p>
        ) : (
          <>
            <PersonPicker
              people={people}
              personId={personId}
              personLook={personLook}
              onPerson={(id, look) => { setPersonId(id); setPersonLook(look) }}
            />
            {selectedPerson ? (
              <p className="hint mt-1">Sent with your description so the person stays the same.</p>
            ) : (
              <p className="hint mt-1">Pick a portrait to keep the same person in the image.</p>
            )}
          </>
        )}
      </div>

      <div className="mt-4">
        <p className="field-label">Scene <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {hasScene && sceneRef?.kind === 'image' ? (
          <div className="flex items-center gap-2 rounded-[8px] border p-2" style={{ borderColor: 'var(--border)' }}>
            <img src={sceneRef.thumbUrl ?? ''} alt="" className="h-10 w-10 rounded object-cover" style={{ background: 'var(--surface-2)' }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{sceneRef.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>The setting and light are borrowed; its subject is not.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Remove scene" onClick={() => setSceneRef(null)}><Icon icon={X} size="sm" /></button>
          </div>
        ) : activeProductRef ? (
          <Button variant="secondary" className="w-full justify-start" type="button" onClick={() => setScenePickerOpen(true)}>
            <Icon icon={Mountain} size="sm" /> Choose a Scene
          </Button>
        ) : (
          <p className="hint">Choose a product photo first, then add a scene to borrow its setting and light.</p>
        )}
      </div>

      {hasReference && (
        <p className="hint mt-2">You can add a product, a person, and a scene. With any of them, Moss makes one image at a time.</p>
      )}
    </div>
  )

  const rightPanel = (
    <CreateInspector
      selected={selectedResult}
      completeJobs={completeJobs}
      runFilterId={runFilter?.id ?? null}
      isRunning={isRunning}
      canSaveAsPerson={canSaveAsPerson}
      settings={{ count, requestedCount, hasReference, shape, format, open: outputOpen }}
      onOutputOpenChange={setOutputOpen}
      onCount={setCount}
      onShape={changeShape}
      onFormat={changeFormat}
      onSelectRun={selectRun}
      onShowAll={showAllResults}
      onEdit={(image) => { focusResult(image); navigate(photoViewUrl(image.id)) }}
      onDownload={(image) => { focusResult(image); void download(image) }}
      onSaveProduct={(image) => { focusResult(image); setSaveProductImage(image) }}
      onSavePerson={(image) => { focusResult(image); setSavePersonImage(image) }}
      onSaveToSet={(image) => { focusResult(image); openSetPicker(image) }}
      onDelete={(image) => void remove(image)}
      onOpenSet={(setId) => navigate(`/sets/${setId}`)}
    />
  )

  return (
    <>
      <div className="workspace">
        {!leftHidden && (
          <>
            <aside className="ws-left" aria-label="Describe" style={canResizeLeft ? { width: leftPanelWidth.width, minWidth: leftPanelWidth.width } : undefined}>{leftPanel}</aside>
            {canResizeLeft && <WorkspaceResizeHandle label="Resize describe panel" side="left" width={leftPanelWidth.width} onPointerDown={leftPanelWidth.onPointerDown} onKeyDown={leftPanelWidth.onKeyDown} onReset={leftPanelWidth.reset} />}
          </>
        )}
        <section className="ws-center">
          <div className="flex items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{runFilter ? `History · ${formatDate(runFilter.startedAt, true)}` : 'Image Generator'}</p>
            {runFilter && (rightHidden || rightCollapsed) && <Button variant="ghost" size="sm" onClick={showAllResults}>Show all</Button>}
            {leftHidden && <Button variant="ghost" size="sm" onClick={() => setLeftSheet(true)}>Describe</Button>}
            {(rightHidden || rightCollapsed) && <Button variant="ghost" size="sm" onClick={() => { if (rightHidden) setRightSheet(true); else setRightCollapsed(false) }}>Details</Button>}
            {isRunning && job && <span className="badge" data-tone="success">Making</span>}
          </div>
          <div className="scroll-area flex-1 p-5">
            {!secrets?.hasKey && (
              <div className="mb-5">
                <Banner
                  status="info"
                  title="Add a Meta key to make images"
                  description="Your description, examples, and free photo edits still work. A key connects Moss to your Meta account for paid images."
                  endContent={<Button variant="secondary" size="sm" onClick={() => setMetaKeyOpen(true)}>Add Key</Button>}
                  collapsible={false}
                />
              </div>
            )}
            {secrets?.hasKey && !canGenerate && (
              <div className="mb-5">
                <Banner
                  status="warning"
                  title="Reactivate to make images"
                  description="Your library and local edits still work. Open License to restore paid image making."
                  endContent={<Button variant="secondary" size="sm" onClick={() => navigate('/settings/license')}>Open License</Button>}
                  collapsible={false}
                />
              </div>
            )}
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
              examplesVisible ? (
                <div>
                  <p className="text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Describe the picture you want. Meta makes it, and you pay {usd(1)} an image.</p>
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
              ) : filterEmpty ? (
                <div className="py-12 text-center">
                  <p className="text-[13px] font-semibold">No images from this make.</p>
                  <p className="meta mt-1">Choose Show all to see your other images.</p>
                </div>
              ) : null
            ) : (
              <div className="mx-auto grid max-w-[900px] grid-cols-2 gap-4">
                {results.map((image, index) => (
                  <div
                    key={image.id}
                    className="card result-card overflow-hidden"
                    data-selected={image.id === selectedResult?.id}
                  >
                    <button
                      type="button"
                      className="relative block w-full cursor-zoom-in"
                      onClick={() => { focusResult(image); setLightboxIndex(index) }}
                    >
                      <span className="sr-only">Open {image.label} larger</span>
                      {image.url && <img src={image.url} alt="" className="aspect-[4/3] w-full object-cover" />}
                      {index === 0 && !runFilter && <span className="badge absolute left-2 top-2" data-tone="canvas">Newest</span>}
                      {image.setId && <span className="badge absolute right-2 top-2" data-tone="success">In a Set</span>}
                    </button>
                    <div className="flex flex-wrap items-center gap-1 border-t px-2 py-2" style={{ borderColor: 'var(--border)' }}>
                      <Button variant="ghost" size="sm" onClick={() => { focusResult(image); navigate(photoViewUrl(image.id)) }}>
                        <Icon icon={Pencil} size="xsm" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { focusResult(image); void download(image) }}>
                        <Icon icon={Download} size="xsm" /> Download
                      </Button>
                      <div className="ml-auto">
                        <MoreMenu
                          label={`More actions for ${image.label}`}
                          size="sm"
                          onOpenChange={(open) => { if (open) focusResult(image) }}
                          items={[
                            { label: 'Save as Product', onClick: () => setSaveProductImage(image) },
                            ...(personId || image.personId || createPersonMode
                              ? [{ label: 'Save as Person', onClick: () => setSavePersonImage(image) }]
                              : []),
                            { label: 'Add to Set', onClick: () => openSetPicker(image) },
                            { label: 'Delete', onClick: () => void remove(image) }
                          ]}
                        />
                      </div>
                    </div>
                    <div className="px-3 pb-2">
                      <span className="text-[11px] font-medium">{image.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        {!rightHidden && !rightCollapsed && (
          <>
            <WorkspaceResizeHandle label="Resize details panel" side="right" width={rightPanelWidth.width} min={260} max={360} onPointerDown={rightPanelWidth.onPointerDown} onKeyDown={rightPanelWidth.onKeyDown} onReset={rightPanelWidth.reset} />
            <aside className="ws-right" aria-label="Details" style={{ width: rightPanelWidth.width, minWidth: rightPanelWidth.width }}>{rightPanel}</aside>
          </>
        )}
      </div>
      <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Describe">{leftPanel}</Sheet>
      <Sheet open={rightSheet} onOpenChange={setRightSheet} side="right" title="Details">{rightPanel}</Sheet>

      <div className="ws-bottom">
        <button type="button" className="min-w-0 text-left" onClick={() => navigate('/usage')}>
          <p className="truncate text-[12px] font-medium tabular">{plural(requestedCount, 'image')} · {shapeLabel(shape)} · {usd(estimateCents(requestedCount))}</p>
          <p className="meta tabular">Month {usd(monthCents)}{settings?.budgetCents != null ? ` of ${usd(settings.budgetCents)}` : ''}</p>
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {overBudget ? (
            <BudgetWarning limitCents={settings?.budgetCents ?? 0} onRaise={() => setBudgetOpen(true)} onFewer={requestedCount > 1 ? () => setCount((current) => Math.max(1, current - 1)) : undefined} />
          ) : !secrets?.hasKey ? (
            <Button variant="primary" onClick={() => setMetaKeyOpen(true)}>
              Connect Meta to Make Images
            </Button>
          ) : !canGenerate ? (
            <Button variant="primary" onClick={() => navigate('/settings/license')}>
              Reactivate to Make Images
            </Button>
          ) : (
            <Button variant="primary" disabled={!canSubmit || isRunning || promptTooLongForReference} onClick={() => void submit()}>
              {isRunning ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null}
              Make {requestedCount} {requestedCount === 1 ? 'Image' : 'Images'} · {usd(estimateCents(requestedCount))}
            </Button>
          )}
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
        title="Choose a Scene"
        description="Use a ready image for the setting, light, and props. Its subject is never copied."
        libraryOnly
      />
      <SaveProductDialog
        open={Boolean(saveProductImage)}
        onOpenChange={(open) => { if (!open) setSaveProductImage(null) }}
        imageId={saveProductImage?.id ?? null}
        defaultName={project.name}
      />
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
        onIndex={(index) => {
          setLightboxIndex(index)
          const next = results[index]
          if (next) focusResult(next)
        }}
        onDownload={(image) => void download(image)}
        onEdit={(image) => navigate(photoViewUrl(image.id))}
        onSaveProduct={(image) => { setLightboxIndex(null); setSaveProductImage(image) }}
        onSavePerson={(image) => { setLightboxIndex(null); setSavePersonImage(image) }}
        onSaveToSet={(image) => { setLightboxIndex(null); openSetPicker(image) }}
        onDelete={(image) => void remove(image)}
      />
      <FirstRunConfirm
        open={firstOpen}
        runLabel={`Make ${requestedCount} ${requestedCount === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(requestedCount))}`}
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
