import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, Maximize2, PanelLeft, PanelRight, Plus } from 'lucide-react'
import { Icon, Banner } from '@astryxdesign/core'
import type { AdjustTransform, Image, Project } from '@shared/types'
import { estimateCents, usd } from '@shared/cost'
import { errorMessage, billingUncertain } from '@shared/errors'
import type { ChangeKind } from '@shared/prompts/guards'
import { shapeLabel } from '@shared/shapes'
import { usedBrandColors } from '@shared/brandColors'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'
import { useUiStore } from '../../store/ui'
import { useJobsStore } from '../../store/jobs'
import { useIsWideWorkspace, useViewportTier } from '../../lib/viewport'
import { usePanelWidth, WorkspaceResizeHandle } from '../../components/ui/WorkspaceResizeHandle'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Sheet } from '../../components/ui/Sheet'
import { FirstRunConfirm } from '../../components/ui/FirstRunConfirm'
import { BudgetWarning } from '../../components/ui/BudgetWarning'
import { ChangePanel } from './ChangePanel'
import { AdjustPanel } from './AdjustPanel'
import { VersionDetails } from './VersionDetails'
import { ExportDialog } from './ExportDialog'
import { CropOverlay } from './CropOverlay'
import { Lightbox } from '../../components/ui/Lightbox'
import { SourcePickerDialog } from '../../components/sources/SourcePickerDialog'
import type { SourceChoice } from '../../components/sources/SourcePickerDialog'
import { SaveProductDialog } from '../../components/products/SaveProductDialog'
import { SavePersonDialog } from '../../components/people/SavePersonDialog'
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { elapsedLabel, formatDate, usd as usdMoney } from '../../lib/format'
import { previewFilter, previewTransform, isIdentity } from '../../lib/adjustPreview'
import { onCommand } from '../../lib/commands'
import { openSetPicker } from '../../store/setPicker'
import { currentMonth } from '../../store/library'

type Tab = 'change' | 'adjust'
type TextSource = 'user' | 'tile'

function emptyAdjust(): AdjustTransform {
  return {}
}

function readyInProject(images: Image[]): Image[] {
  return images
    .filter((image) => image.status === 'ready')
    .sort((a, b) => a.seq - b.seq || a.createdAt - b.createdAt)
}

export function PhotoWorkspace(): React.JSX.Element {
  const project = useWorkspaceStore((state) => state.project) as Project
  const images = useWorkspaceStore((state) => state.images)
  const selectedImageId = useWorkspaceStore((state) => state.selectedImageId)
  const selectImage = useWorkspaceStore((state) => state.selectImage)
  const refresh = useWorkspaceStore((state) => state.refresh)
  const people = useAppStore((state) => state.people)
  const brand = useAppStore((state) => state.brand)
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const setMetaKeyOpen = useUiStore((state) => state.setMetaKeyOpen)
  const setBudgetOpen = useUiStore((state) => state.setBudgetOpen)
  const jobs = useJobsStore((state) => state.jobs)
  const upsert = useJobsStore((state) => state.upsert)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromSet = params.get('fromSet')
  const tier = useViewportTier()
  const leftHidden = tier === 'tiny'
  const rightHidden = !useIsWideWorkspace()
  const canResizeLeft = tier === 'wide' || tier === 'medium'
  const [tab, setTab] = useState<Tab>('change')
  const [text, setText] = useState('')
  const [textSource, setTextSource] = useState<TextSource>('user')
  const [kind, setKind] = useState<ChangeKind>('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [sceneRef, setSceneRef] = useState<SourceChoice | null>(null)
  const [scenePickerOpen, setScenePickerOpen] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [labelBusy, setLabelBusy] = useState(false)
  const [adjust, setAdjust] = useState<AdjustTransform>(emptyAdjust())
  const [undoStack, setUndoStack] = useState<AdjustTransform[]>([])
  const [redoStack, setRedoStack] = useState<AdjustTransform[]>([])
  const [compare, setCompare] = useState(false)
  const [compareValue, setCompareValue] = useState(50)
  const [addPhotoOpen, setAddPhotoOpen] = useState(false)
  const [saveProductImageId, setSaveProductImageId] = useState<string | null>(null)
  const [savePersonImageId, setSavePersonImageId] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [confirmFirst, setConfirmFirst] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [leftSheet, setLeftSheet] = useState(false)
  const [rightSheet, setRightSheet] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const leftPanelWidth = usePanelWidth('moss.workspace.photo.left', 300)
  const rightPanelWidth = usePanelWidth('moss.workspace.photo.right', 300, 260, 360)
  useEffect(() => {
    if (!leftHidden) setLeftSheet(false)
    if (!rightHidden) setRightSheet(false)
  }, [leftHidden, rightHidden])
  const [applyBusy, setApplyBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const handledJob = useRef<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const compareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (personId && !people.some((person) => person.id === personId)) setPersonId(null)
  }, [people, personId])

  const runningForProject = Object.values(jobs).find(
    (job) => job.projectId === project.id && job.status === 'running' && job.kind === 'edit'
  ) ?? null
  const currentJob = currentJobId ? jobs[currentJobId] ?? null : null
  const runningJob = runningForProject ?? (currentJob?.status === 'running' ? currentJob : null)
  const jobToReport = currentJob ?? runningForProject
  const isRunning = Boolean(runningJob)
  const ready = readyInProject(images)
  const selected = ready.find((image) => image.id === selectedImageId) ?? ready.at(-1) ?? null
  const parent = selected?.parentId ? ready.find((image) => image.id === selected.parentId) ?? null : null

  useEffect(() => {
    void window.moss.app.setMenuContext({
      editor: true,
      adjust: tab === 'adjust',
      canUndo: tab === 'adjust' && undoStack.length > 0,
      canRedo: tab === 'adjust' && redoStack.length > 0,
      hasSelection: Boolean(selected),
      canExport: Boolean(selected),
      canZoom: true
    }).catch(() => undefined)
  }, [tab, undoStack.length, redoStack.length, selected?.id])
  const parentLabel = parent?.label ?? null
  const overBudget = (settings?.budgetCents ?? null) !== null && monthCents + estimateCents(1) > (settings?.budgetCents ?? 0)

  useEffect(() => {
    void unwrap(window.moss.usage.summary({ month: currentMonth() }))
      .then((summary) => setMonthCents(summary.spendCents))
      .catch(() => setMonthCents(0))
  }, [project.id])

  useEffect(() => {
    setAdjust(emptyAdjust())
    setUndoStack([])
    setRedoStack([])
    setCompare(false)
    setShowOriginal(false)
    setTab('change')
    setCurrentJobId(null)
    handledJob.current = null
  }, [selected?.id])

  useEffect(() => {
    return () => {
      // No request is fired here. Pending saves live in the plan editor only.
    }
  }, [])
  useEffect(() => {
    const stage = canvasRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setStageSize({ width: box.width, height: box.height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  useEffect(() => {
    if (!jobToReport) return
    if (jobToReport.status === 'running') return
    if (handledJob.current === jobToReport.id) return
    handledJob.current = jobToReport.id
    const item = jobToReport.items[0]
    if (jobToReport.done > 0 && item?.imageId) {
      void refresh(item.imageId)
      void unwrap(window.moss.usage.summary({ month: currentMonth() })).then((summary) => setMonthCents(summary.spendCents)).catch(() => undefined)
      toast.status('Image made · 1 cent.')
    } else {
      void refresh()
      const code = item?.errorCode ?? 'unknown'
      const suffix = billingUncertain(code as never) ? ' If Meta made it, it may still show on your bill.' : ''
      setError(`${errorMessage(code as never)}${suffix}`)
    }
  }, [jobToReport, refresh])

  const loadMonth = async (): Promise<void> => {
    try {
      const summary = await unwrap(window.moss.usage.summary({ month: currentMonth() }))
      setMonthCents(summary.spendCents)
    } catch {
      // Keep the last known total.
    }
  }

  const beginAdjust = useCallback((): void => {
    setUndoStack((stack) => [...stack, adjust])
    setRedoStack([])
  }, [adjust])

  const changeAdjust = (next: AdjustTransform): void => setAdjust(next)

  const changeWithHistory = (next: AdjustTransform): void => {
    setUndoStack((stack) => [...stack, adjust])
    setRedoStack([])
    setAdjust(next)
  }

  const undo = (): void => {
    setUndoStack((stack) => {
      if (!stack.length) return stack
      const previous = stack[stack.length - 1]!
      setRedoStack((redo) => [...redo, adjust])
      setAdjust(previous)
      return stack.slice(0, -1)
    })
  }

  const redo = (): void => {
    setRedoStack((stack) => {
      if (!stack.length) return stack
      const next = stack[stack.length - 1]!
      setUndoStack((undoList) => [...undoList, adjust])
      setAdjust(next)
      return stack.slice(0, -1)
    })
  }

  const resetAll = (): void => {
    setUndoStack((stack) => [...stack, adjust])
    setRedoStack([])
    setAdjust(emptyAdjust())
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (tab !== 'adjust') return
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    return onCommand((command) => {
      if (command === 'export') setExportOpen(true)
      else if (command === 'copy-image' && selected) void copySelected(selected)
      else if (command === 'paste-image') void pasteImage()
      else if (command === 'toggle-panel') {
        if (rightHidden) setRightSheet(true)
        else setRightCollapsed((collapsed) => !collapsed)
      }
      else if (command === 'zoom-in') setZoom((value) => Math.min(2.5, +(value + 0.15).toFixed(2)))
      else if (command === 'zoom-out') setZoom((value) => Math.max(0.4, +(value - 0.15).toFixed(2)))
      else if (command === 'zoom-reset') setZoom(1)
      else if (command === 'undo' && tab === 'adjust') undo()
      else if (command === 'redo' && tab === 'adjust') redo()
    })
    // Handlers read current state through the component closure on each render.
  }, [selected, tab, adjust])

  const copySelected = async (image: Image): Promise<void> => {
    try {
      await unwrap(window.moss.app.copyImage({ imageId: image.id }))
      toast.status('Image copied.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const pasteImage = async (): Promise<void> => {
    try {
      const result = await unwrap(window.moss.app.readClipboardImage())
      if (!result.bytes || !result.mime) {
        toast.error('There is no image on the clipboard.')
        return
      }
      if (images.length > 1) {
        const ok = await confirm({
          title: 'Paste this image?',
          body: 'It is added as a new version. The versions you have stay.',
          confirmLabel: 'Paste Image'
        })
        if (!ok) return
      }
      const imported = await unwrap(window.moss.media.importBytes({
        projectId: project.id,
        kind: 'source',
        bytes: result.bytes,
        mime: result.mime,
        name: 'Pasted photo'
      }))
      if (imported?.imageId) await refresh(imported.imageId)
      toast.status('Image pasted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const chooseAddedPhoto = async (choice: SourceChoice): Promise<void> => {
    try {
      if (choice.kind === 'product') {
        const imported = await unwrap(window.moss.products.importIntoProject({ productId: choice.productId, projectId: project.id }))
        if (imported?.imageId) await refresh(imported.imageId)
      } else {
        const image = images.find((entry) => entry.id === choice.imageId)
        if (image?.projectId === project.id) {
          selectImage(image.id)
          return
        }
        const imported = await unwrap(window.moss.media.importFromImage({ projectId: project.id, imageId: choice.imageId }))
        if (imported?.imageId) await refresh(imported.imageId)
      }
      toast.status('Photo added.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const addPhotoWithFile = async (): Promise<void> => {
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ projectId: project.id, kind: 'source' }))
      if (result?.imageId) {
        warnIfSmallPhoto(result)
        await refresh(result.imageId)
        toast.status('Photo added.')
      }
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.code === 'Space') {
      event.preventDefault()
      setShowOriginal(true)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const index = ready.findIndex((image) => image.id === selected?.id)
      if (index < 0) return
      const next = ready[index + (event.key === 'ArrowRight' ? 1 : -1)]
      if (next) selectImage(next.id)
      return
    }
    if (event.key === 'Delete' && selected) {
      event.preventDefault()
      void deleteSelected(selected)
    }
  }

  const onCanvasKeyUp = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.code === 'Space' && event.target === event.currentTarget) setShowOriginal(false)
  }

  const startChange = async (): Promise<void> => {
    setError(null)
    if (!selected) return
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Describe the change first.')
      return
    }
    if (text.length > 2000) {
      setError(`That's ${text.length - 2000} characters over. Shorten it and try again.`)
      return
    }
    if (kind === 'model' && !people.some((person) => person.id === personId)) {
      setError('Choose a person for this change.')
      return
    }
    if (!secrets?.hasKey) {
      setError('Add your Meta key in Settings to make images.')
      return
    }
    if (!canGenerate) {
      setError('Reactivate to make images.')
      return
    }
    if (!settings?.firstRunConfirmShown) {
      setConfirmFirst(true)
      return
    }
    await executeChange()
  }

  const selectedPerson = people.find((person) => person.id === personId) ?? null

  const executeChange = async (): Promise<void> => {
    if (!selected) return
    setError(null)
    try {
      const result = await unwrap(window.moss.jobs.startEdit({
        projectId: project.id,
        imageId: selected.id,
        change: text,
        kind: selectedPerson ? 'model' : kind,
        templateId: templateId ?? undefined,
        personId: selectedPerson ? selectedPerson.id : undefined,
        sceneImageId: sceneRef?.kind === 'image' ? sceneRef.imageId : undefined,
        palette: brand ? usedBrandColors(brand.colors) : undefined,
        isGiftShot: templateId === 'gift-ready'
      }))
      const state = await unwrap(window.moss.jobs.state({ jobId: result.jobId }))
      upsert(state)
      setCurrentJobId(result.jobId)
      handledJob.current = null
    } catch (caught) {
      setError(messageOf(caught))
      toast.error(messageOf(caught))
    }
  }

  const applyBatch = async (): Promise<void> => {
    const count = ready.length
    const ok = await confirm({
      title: `Apply this color grade to ${count} images?`,
      body: 'This creates a new local version of each ready image. Crop, rotate, flips, and the current selection stay as they are.',
      confirmLabel: 'Apply to All'
    })
    if (!ok) return
    setBatchBusy(true)
    try {
      const result = await unwrap(window.moss.adjust.applyBatch({
        projectId: project.id,
        transform: {
          brightness: adjust.brightness ?? 0,
          contrast: adjust.contrast ?? 0,
          saturation: adjust.saturation ?? 0,
          warmth: adjust.warmth ?? 0,
          sharpen: adjust.sharpen ?? 0,
          vignette: adjust.vignette ?? 0
        }
      }))
      await useWorkspaceStore.getState().refresh()
      toast.status(`${result.count} new local versions.`)
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setBatchBusy(false)
    }
  }

  const addSizeLabel = async (width: number, height: number, unit: 'cm' | 'in'): Promise<void> => {
    if (!selected) return
    setLabelBusy(true)
    try {
      const result = await unwrap(window.moss.adjust.sizeLabel({ imageId: selected.id, width, height, unit }))
      await useWorkspaceStore.getState().refresh(result.imageId)
      toast.status('Size label added as a new version.')
    } catch (caught) {
      toast.error(messageOf(caught))
    } finally {
      setLabelBusy(false)
    }
  }

  const confirmFirstRun = async (): Promise<void> => {
    try {
      await unwrap(window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }))
      await refreshSettings()
    } catch {
      // Acknowledge for this session.
    }
    setConfirmFirst(false)
    await executeChange()
  }

  const applyAdjust = async (): Promise<void> => {
    if (!selected) return
    if (isIdentity(adjust)) return
    setApplyBusy(true)
    setError(null)
    try {
      const result = await unwrap(window.moss.adjust.apply({ imageId: selected.id, transform: adjust }))
      await refresh(result.imageId)
      setAdjust(emptyAdjust())
      setUndoStack([])
      setRedoStack([])
      setTab('change')
      await loadMonth()
      toast.status('Local adjust applied. Free.')
    } catch (caught) {
      setError(messageOf(caught))
      toast.error(messageOf(caught))
    } finally {
      setApplyBusy(false)
    }
  }

  const deleteSelected = async (image: Image): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${image.label}"?`,
      body: 'This version leaves this computer. Other versions stay. This cannot be undone.',
      confirmLabel: 'Delete Version',
      danger: true
    })
    if (!ok) return
    try {
      await useWorkspaceStore.getState().deleteImage(image.id)
      toast.status('Version deleted.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const startNewVersion = (): void => {
    setTab('change')
    window.setTimeout(() => document.getElementById('change-description')?.focus(), 20)
  }

  const tabDisabled = isRunning || applyBusy
  const changePrimaryDisabled =
    tab === 'change' &&
    (!selected || !text.trim() || text.length > 2000 || !secrets?.hasKey || !canGenerate || (kind === 'model' && !people.some((person) => person.id === personId)))
  const applyDisabled = isIdentity(adjust) || isRunning || applyBusy

  const leftPanel = (
    <div className="flex h-full flex-col">
      <div className="tabs px-4 pt-2">
        <button type="button" data-selected={tab === 'change'} disabled={tabDisabled} onClick={() => setTab('change')}>Change Photo <span className="ml-1 badge pill-sm">AI</span></button>
        <button type="button" data-selected={tab === 'adjust'} disabled={tabDisabled} onClick={() => setTab('adjust')}>Adjust Photo <span className="ml-1 badge pill-sm">Free</span></button>
      </div>
      {tab === 'change' && (!secrets?.hasKey || !canGenerate) && (
        <div className="px-4 pt-3">
          <Banner
            status={!secrets?.hasKey ? 'info' : 'warning'}
            title={!secrets?.hasKey ? 'Add a Meta key to make images' : 'Reactivate to make images'}
            description={!secrets?.hasKey
              ? 'You can still crop, light, and color for free in Adjust Photo. A key connects Moss to your Meta account for paid changes.'
              : 'Your library and free adjustments still work. Open License to restore paid image making.'}
            endContent={!secrets?.hasKey ? (
              <Button variant="secondary" size="sm" onClick={() => setMetaKeyOpen(true)}>Add Key</Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => navigate('/settings/license')}>Open License</Button>
            )}
            collapsible={false}
          />
        </div>
      )}
      <div className="scroll-area flex-1 p-4">
        {tab === 'change' ? (
          <ChangePanel
            text={text}
            textSource={textSource}
            templateId={templateId}
            personId={personId}
            people={people}
            sceneRef={sceneRef}
            disabled={tabDisabled}
            onText={(next, source) => { setText(next); setTextSource(source); setError(null) }}
            onKind={setKind}
            onTemplate={setTemplateId}
            onPerson={(id) => {
              setPersonId(id)
              if (!id && kind === 'model') {
                setKind('')
                setTemplateId(null)
              }
            }}
            onChooseScene={() => setScenePickerOpen(true)}
            onClearScene={() => setSceneRef(null)}
            onClear={() => { setText(''); setKind(''); setTemplateId(null) }}
          />
        ) : (
          <AdjustPanel
            transform={adjust}
            width={selected?.width ?? null}
            height={selected?.height ?? null}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={undo}
            onRedo={redo}
            onChange={changeAdjust}
            onChangeWithHistory={changeWithHistory}
            onBegin={beginAdjust}
            onResetAll={resetAll}
            batchCount={Object.values({
              brightness: adjust.brightness ?? 0,
              contrast: adjust.contrast ?? 0,
              saturation: adjust.saturation ?? 0,
              warmth: adjust.warmth ?? 0,
              sharpen: adjust.sharpen ?? 0,
              vignette: adjust.vignette ?? 0
            }).some((value) => value !== 0) ? ready.length : 0}
            batchBusy={batchBusy}
            onApplyBatch={() => void applyBatch()}
            labelBusy={labelBusy}
            onAddSizeLabel={(width, height, unit) => void addSizeLabel(width, height, unit)}
          />
        )}
      </div>
    </div>
  )

  const rightPanel = (
    <VersionDetails
      project={project}
      selected={selected}
      parentLabel={parentLabel}
      onNewVersion={startNewVersion}
      onFormatChange={(format) => { void useWorkspaceStore.getState().updateProject({ format }).catch(() => toast.error('The format could not be saved.')) }}
      onSaveProduct={selected ? () => setSaveProductImageId(selected.id) : undefined}
      onSavePerson={selected ? () => setSavePersonImageId(selected.id) : undefined}
      onSaveToSet={selected ? () => openSetPicker(selected) : undefined}
    />
  )

  const crop = tab === 'adjust' && adjust.crop && !compare ? adjust.crop : null
  const showParent = showOriginal && parent
  const displayImage = showParent ? parent : selected
  const jobItem = runningJob?.items[0]
  // Compare mode owns the canvas drag, crop mode owns the pointer, and a run
  // dims the canvas, so the click-to-preview affordance is off in those states.
  const canPreview = Boolean(displayImage?.url) && !compare && !crop && !isRunning
  const lightboxIndex = Math.max(0, ready.findIndex((image) => image.id === selected?.id))

  const backLabel = project.type === 'image' ? 'Back to Image Generator' : null
  const goBackToProject = (): void => {
    void navigate(`/project/${project.id}${fromSet ? `?fromSet=${encodeURIComponent(fromSet)}` : ''}`)
  }

  const rotate = tab === 'adjust' ? (adjust.rotate ?? 0) : 0
  const swapped = rotate === 90 || rotate === 270
  const baseWidth = swapped ? (selected?.height ?? 0) : (selected?.width ?? 0)
  const baseHeight = swapped ? (selected?.width ?? 0) : (selected?.height ?? 0)
  const fit = stageSize.width > 0 && stageSize.height > 0 && baseWidth > 0 && baseHeight > 0
    ? Math.min((stageSize.width - 56) / baseWidth, (stageSize.height - (compare ? 96 : 48)) / baseHeight)
    : 0
  const displayWidth = Math.max(1, Math.round(baseWidth * fit))
  const displayHeight = Math.max(1, Math.round(baseHeight * fit))
  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    left: swapped ? (displayWidth - displayHeight) / 2 : 0,
    top: swapped ? (displayHeight - displayWidth) / 2 : 0,
    width: swapped ? displayHeight : displayWidth,
    height: swapped ? displayWidth : displayHeight,
    objectFit: compare ? 'contain' : 'fill',
    transform: tab === 'adjust' && !showParent ? previewTransform(adjust) : undefined,
    transformOrigin: 'center',
    filter: tab === 'adjust' && !showParent ? previewFilter(adjust) : undefined
  }
  const updateCompare = (clientX: number): void => {
    const rect = compareRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    setCompareValue(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }
  const startCompareDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    updateCompare(event.clientX)
    const move = (moveEvent: PointerEvent): void => updateCompare(moveEvent.clientX)
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div className="workspace">
        {!leftHidden && (
          <>
            <aside className="ws-left" style={canResizeLeft ? { width: leftPanelWidth.width, minWidth: leftPanelWidth.width } : undefined}>{leftPanel}</aside>
            {canResizeLeft && <WorkspaceResizeHandle label="Resize edit panel" side="left" width={leftPanelWidth.width} onPointerDown={leftPanelWidth.onPointerDown} onKeyDown={leftPanelWidth.onKeyDown} onReset={leftPanelWidth.reset} />}
          </>
        )}
        <section className="ws-center">
          <div className="flex items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
            {backLabel && (
              <Button variant="ghost" size="sm" onClick={goBackToProject}><Icon icon={ArrowLeft} size="sm" /> {backLabel}</Button>
            )}
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{selected?.label ?? 'Photo'}</p>
            {(leftHidden || rightHidden) && (
              <div className="flex items-center gap-1">
                {leftHidden && <IconButton label="Open change panel" onClick={() => setLeftSheet(true)}><Icon icon={PanelLeft} size="sm" /></IconButton>}
                {(rightHidden || rightCollapsed) && <IconButton label="Open version details" onClick={() => { if (rightHidden) setRightSheet(true); else setRightCollapsed(false) }}><Icon icon={PanelRight} size="sm" /></IconButton>}
              </div>
            )}
            {tab === 'change' && (
              <Button variant="ghost" size="sm" disabled={!parent || isRunning} onClick={() => { setCompare((value) => !value); setShowOriginal(false) }}>
                {compare ? 'Done Comparing' : 'Compare'}
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={!selected || isRunning} onClick={() => setExportOpen(true)}>
              <Icon icon={Download} size="sm" /> Export
            </Button>
          </div>
          <div className="canvas-wrap canvas-surface">
            <div
              ref={canvasRef}
              tabIndex={0}
              role="group"
              aria-label="Photo canvas. Use arrow keys to change version. Hold Space to see the original."
              className="canvas-stage outline-none"
              onKeyDown={onCanvasKeyDown}
              onKeyUp={onCanvasKeyUp}
              onBlur={() => setShowOriginal(false)}
            >
              {displayImage?.url && fit > 0 ? (
                <div
                  ref={compareRef}
                  className={canPreview ? 'relative cursor-zoom-in' : 'relative'}
                  title={canPreview ? 'Click the photo to preview it larger' : undefined}
                  onClick={canPreview ? () => setLightboxOpen(true) : undefined}
                  style={{ width: displayWidth, height: displayHeight, transform: `scale(${zoom})`, transformOrigin: 'center' }}
                >
                  {compare && parent?.url && selected?.url ? (
                    <>
                      <img src={parent.url} alt="The version before this change" style={imageStyle} />
                      <img
                        src={selected.url}
                        alt="The version after this change"
                        style={{ ...imageStyle, clipPath: `inset(0 0 0 ${compareValue}%)` }}
                      />
                      <div
                        className="compare-divider"
                        style={{ left: `${compareValue}%` }}
                        onPointerDown={startCompareDrag}
                        aria-hidden
                      >
                        <span className="compare-divider-knob" />
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={displayImage.url}
                        alt={showParent ? 'The source version' : `${selected?.label ?? 'Selected'} image`}
                        style={{ ...imageStyle, boxShadow: 'var(--shadow-dark)' }}
                      />
                      {crop && (
                        <CropOverlay
                          crop={crop}
                          onBegin={beginAdjust}
                          onChange={(next) => changeAdjust({ ...adjust, crop: next })}
                        />
                      )}
                      {showParent && <span className="absolute left-2 top-2 badge" data-tone="canvas">Original</span>}
                    </>
                  )}
                </div>
              ) : (
                <p className="canvas-meta">{displayImage?.url ? 'Fitting the photo…' : 'No version selected.'}</p>
              )}
              {isRunning && runningJob && (
                <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'var(--scrim)' }} role="status" aria-live="polite">
                  <div className="text-center">
                    <div className="mx-auto shimmer-block h-24 w-64 rounded-[10px]" aria-hidden />
                    <Icon icon={Loader2} size="md" className="mx-auto mt-4 animate-spin" aria-hidden />
                    <p className="mt-2 text-[13px] font-semibold" style={{ color: 'var(--canvas-text)' }}>{jobItem?.waiting ? 'Waiting for Meta' : 'Making your change'} · {elapsedLabel(jobItem?.startedAt ?? runningJob.startedAt, now)}</p>
                    <p className="canvas-meta mt-1 text-[11px]">{usd(runningJob.costCents)} so far</p>
                  </div>
                </div>
              )}
            </div>
            {canPreview && (
              <button
                type="button"
                className="canvas-preview-btn"
                aria-label="Preview larger"
                title="Preview larger"
                onClick={() => setLightboxOpen(true)}
              >
                <Icon icon={Maximize2} size="sm" />
              </button>
            )}
            {compare && parent && (
              <div className="px-8 pb-3">
                <label className="sr-only" htmlFor="compare-slider">Compare before and after</label>
                <input
                  id="compare-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={compareValue}
                  onChange={(event) => setCompareValue(Number(event.target.value))}
                  className="w-full"
                  aria-valuetext={`${Math.round(compareValue)}% after`}
                />
                <div className="flex justify-between text-[11px]" style={{ color: 'var(--white-60)' }}>
                  <span>Before</span>
                  <span>After</span>
                </div>
                <p className="mt-1 text-center text-[11px]" style={{ color: 'var(--white-60)' }}>Drag the line on the photo, or use the slider.</p>
              </div>
            )}
            {!compare && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px]" style={{ color: 'var(--white-60)' }}>
                {selected?.width && selected?.height ? `${selected.width} × ${selected.height}` : ''} {zoom !== 1 ? `· ${Math.round(zoom * 100)}%` : ''} · {shapeLabel(project.shape)}
              </div>
            )}
          </div>
          <div className="ws-filmstrip" role="list" aria-label="Versions">
            {ready.map((image, index) => {
              const parentForImage = image.parentId ? ready.find((entry) => entry.id === image.parentId) : null
              return (
                <div key={image.id} className="relative" role="listitem">
                  <button
                    type="button"
                    className="ws-film-card"
                    data-selected={image.id === selected?.id}
                    disabled={isRunning}
                    aria-label={`${image.label}${index === 0 ? ', original' : ''}`}
                    title={parentForImage ? `from ${parentForImage.label}` : undefined}
                    onClick={() => selectImage(image.id)}
                  >
                    {image.thumbUrl ? <img src={image.thumbUrl} alt="" /> : <div className="h-[60px] w-full" style={{ background: 'var(--white-08)' }} />}
                    <span className="ws-film-label">{image.label}</span>
                  </button>
                  {image.id === selected?.id && (
                    <button
                      type="button"
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full"
                      style={{ background: 'var(--canvas-text)', color: 'var(--canvas)' }}
                      aria-label="New version from this image"
                      onClick={startNewVersion}
                    >
                      <Icon icon={Plus} size="xsm" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
        {!rightHidden && !rightCollapsed && (
          <>
            <WorkspaceResizeHandle label="Resize version panel" side="right" width={rightPanelWidth.width} min={260} max={360} onPointerDown={rightPanelWidth.onPointerDown} onKeyDown={rightPanelWidth.onKeyDown} onReset={rightPanelWidth.reset} />
            <aside className="ws-right" style={{ width: rightPanelWidth.width, minWidth: rightPanelWidth.width }}>{rightPanel}</aside>
          </>
        )}
      </div>

      <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Edit">{leftPanel}</Sheet>
      <Sheet open={rightSheet} onOpenChange={setRightSheet} side="right" title="Version">{rightPanel}</Sheet>

      <div className="ws-bottom">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium">{selected?.label ?? 'No version'}</p>
          <p className="meta">{formatDate(selected?.createdAt ?? Date.now())}{isRunning ? ' · making' : ''}</p>
          <p className="meta tabular">Month {usd(monthCents)}{settings?.budgetCents != null ? ` of ${usd(settings.budgetCents)}` : ''}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" disabled={isRunning} onClick={() => setAddPhotoOpen(true)}>
            <Icon icon={Plus} size="sm" /> Add Photo
          </Button>
          {tab === 'adjust' ? (
            <Button variant="primary" disabled={applyDisabled} onClick={() => void applyAdjust()}>
              {applyBusy ? <Icon icon={Loader2} size="sm" className="animate-spin" /> : null} Apply Adjustment · Free
            </Button>
          ) : overBudget ? (
            <BudgetWarning limitCents={settings?.budgetCents ?? 0} onRaise={() => setBudgetOpen(true)} />
          ) : !secrets?.hasKey ? (
            <Button variant="primary" onClick={() => setMetaKeyOpen(true)}>
              Connect Meta to Make Images
            </Button>
          ) : !canGenerate ? (
            <Button variant="primary" onClick={() => navigate('/settings/license')}>
              Reactivate to Make Images
            </Button>
          ) : (
            <Button variant="primary" disabled={changePrimaryDisabled || isRunning} onClick={() => void startChange()}>
              Make This Change · {usdMoney(estimateCents(1))}
            </Button>
          )}
        </div>
      </div>
      {error && <div className="px-4 pb-2 text-[12px]" style={{ color: 'var(--danger)' }} role="alert">{error}</div>}

      <FirstRunConfirm
        open={confirmFirst}
        runLabel={`Make This Change · ${usdMoney(estimateCents(1))}`}
        imageCount={1}
        onOpenChange={setConfirmFirst}
        onConfirm={() => void confirmFirstRun()}
        onGotIt={() => {
          setConfirmFirst(false)
          void window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }).then(() => refreshSettings()).catch(() => undefined)
        }}
      />
      <SourcePickerDialog
        open={addPhotoOpen}
        onOpenChange={setAddPhotoOpen}
        onChoose={(choice) => void chooseAddedPhoto(choice)}
        onUpload={() => void addPhotoWithFile()}
        title="Add a Photo"
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
        open={Boolean(saveProductImageId)}
        onOpenChange={(open) => { if (!open) setSaveProductImageId(null) }}
        imageId={saveProductImageId}
        defaultName={project.name}
      />
      <SavePersonDialog
        open={Boolean(savePersonImageId)}
        onOpenChange={(open) => { if (!open) setSavePersonImageId(null) }}
        imageId={savePersonImageId}
      />
      <Lightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={ready}
        index={lightboxIndex}
        onIndex={(index) => {
          const next = ready[index]
          if (next) selectImage(next.id)
        }}
        onSaveToSet={(image) => { setLightboxOpen(false); openSetPicker(image) }}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} image={selected} />
    </>
  )
}
