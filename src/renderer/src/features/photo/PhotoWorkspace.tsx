import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, PanelLeft, PanelRight, Plus } from 'lucide-react'
import type { AdjustTransform, Image, Project } from '@shared/types'
import { estimateCents, usd } from '@shared/cost'
import { errorMessage, billingUncertain } from '@shared/errors'
import type { ChangeKind } from '@shared/prompts/guards'
import { shapeLabel } from '@shared/shapes'
import { useWorkspaceStore } from '../../store/workspace'
import { useAppStore } from '../../store/app'
import { useJobsStore } from '../../store/jobs'
import { useViewportTier } from '../../lib/viewport'
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
import { unwrap, messageOf } from '../../lib/ipc'
import { toast } from '../../lib/toast'
import { elapsedLabel, formatDate, usd as usdMoney } from '../../lib/format'
import { previewFilter, previewTransform, isIdentity } from '../../lib/adjustPreview'
import { onCommand } from '../../lib/commands'
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
  const jobs = useJobsStore((state) => state.jobs)
  const upsert = useJobsStore((state) => state.upsert)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const tier = useViewportTier()
  const leftHidden = tier === 'tiny'
  const rightHidden = tier === 'narrow' || tier === 'tiny'
  const [tab, setTab] = useState<Tab>('change')
  const [text, setText] = useState('')
  const [textSource, setTextSource] = useState<TextSource>('user')
  const [kind, setKind] = useState<ChangeKind>('')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [personId, setPersonId] = useState('maya')
  const [adjust, setAdjust] = useState<AdjustTransform>(emptyAdjust())
  const [undoStack, setUndoStack] = useState<AdjustTransform[]>([])
  const [redoStack, setRedoStack] = useState<AdjustTransform[]>([])
  const [compare, setCompare] = useState(false)
  const [compareValue, setCompareValue] = useState(50)
  const [showOriginal, setShowOriginal] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [confirmFirst, setConfirmFirst] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [leftSheet, setLeftSheet] = useState(false)
  const [rightSheet, setRightSheet] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [applyBusy, setApplyBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const handledJob = useRef<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!people.some((person) => person.id === personId) && people[0]) setPersonId(people[0].id)
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
      setError('Add your Muse key in Settings to make images.')
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

  const executeChange = async (): Promise<void> => {
    if (!selected) return
    setError(null)
    try {
      const result = await unwrap(window.moss.jobs.startEdit({
        projectId: project.id,
        imageId: selected.id,
        change: text,
        kind,
        templateId: templateId ?? undefined,
        personId: kind === 'model' ? personId : undefined,
        palette: brand?.colors.slice(0, 3),
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
        <button type="button" data-selected={tab === 'change'} disabled={tabDisabled} onClick={() => setTab('change')}>Change</button>
        <button type="button" data-selected={tab === 'adjust'} disabled={tabDisabled} onClick={() => setTab('adjust')}>Local Adjust <span className="ml-1 badge pill-sm">Free</span></button>
      </div>
      <div className="scroll-area flex-1 p-4">
        {tab === 'change' ? (
          <ChangePanel
            text={text}
            textSource={textSource}
            kind={kind}
            templateId={templateId}
            personId={personId}
            people={people}
            disabled={tabDisabled}
            onText={(next, source) => { setText(next); setTextSource(source); setError(null) }}
            onKind={setKind}
            onTemplate={setTemplateId}
            onPerson={setPersonId}
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
          />
        )}
      </div>
    </div>
  )

  const rightPanel = (
    <VersionDetails
      project={project}
      selected={selected}
      images={ready}
      parentLabel={parentLabel}
      onSelect={(id) => selectImage(id)}
      onNewVersion={startNewVersion}
      onFormatChange={(format) => { void useWorkspaceStore.getState().updateProject({ format }).catch(() => toast.error('The format could not be saved.')) }}
    />
  )

  const crop = tab === 'adjust' && adjust.crop && !compare ? adjust.crop : null
  const showParent = showOriginal && parent
  const displayImage = showParent ? parent : selected
  const jobItem = runningJob?.items[0]

  const backLabel = project.type === 'set' ? 'Back to Set Creator' : project.type === 'image' ? 'Back to Image Generator' : null
  const goBackToProject = (): void => {
    void navigate(`/project/${project.id}`)
  }

  return (
    <>
      <div className="workspace">
        {!leftHidden && <aside className="ws-left">{leftPanel}</aside>}
        <section className="ws-center">
          <div className="flex items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
            {backLabel && (
              <Button variant="ghost" size="sm" onClick={goBackToProject}><ArrowLeft size={14} /> {backLabel}</Button>
            )}
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{selected?.label ?? 'Photo'}</p>
            {(leftHidden || rightHidden) && (
              <div className="flex items-center gap-1">
                {leftHidden && <IconButton label="Open change panel" onClick={() => setLeftSheet(true)}><PanelLeft size={16} /></IconButton>}
                {(rightHidden || rightCollapsed) && <IconButton label="Open version details" onClick={() => { if (rightHidden) setRightSheet(true); else setRightCollapsed(false) }}><PanelRight size={16} /></IconButton>}
              </div>
            )}
            {tab === 'change' && (
              <Button variant="ghost" size="sm" disabled={!parent || isRunning} onClick={() => { setCompare((value) => !value); setShowOriginal(false) }}>
                {compare ? 'Done Comparing' : 'Compare'}
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={!selected || isRunning} onClick={() => setExportOpen(true)}>
              <Download size={14} /> Export
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
              {displayImage?.url ? (
                <div className="relative inline-flex max-h-[86%] max-w-[92%] items-center justify-center">
                  {compare && parent?.url && selected?.url ? (
                    <>
                      <img src={parent.url} alt="The version before this change" className="canvas-image" style={{ maxWidth: 'none', maxHeight: '76vh', transform: `scale(${zoom})` }} />
                      <img
                        src={selected.url}
                        alt="The version after this change"
                        className="canvas-image absolute inset-0 m-auto"
                        style={{ maxWidth: 'none', maxHeight: '76vh', clipPath: `inset(0 ${100 - compareValue}% 0 0)`, transform: `scale(${zoom})` }}
                      />
                      <div className="absolute bottom-0 top-0 w-px" style={{ left: `${compareValue}%`, background: 'var(--canvas-text)' }} aria-hidden />
                      <span className="absolute left-2 top-2 badge" data-tone="canvas">Before</span>
                      <span className="absolute right-2 top-2 badge" data-tone="canvas">After</span>
                    </>
                  ) : (
                    <div className="relative inline-flex" style={{ transform: `scale(${zoom})` }}>
                      <img
                        src={displayImage.url}
                        alt={showParent ? 'The source version' : `${selected?.label ?? 'Selected'} image`}
                        className="canvas-image"
                        style={{
                          maxWidth: 'none',
                          maxHeight: '74vh',
                          filter: tab === 'adjust' ? previewFilter(adjust) : undefined,
                          transform: tab === 'adjust' ? previewTransform(adjust) : undefined
                        }}
                      />
                      {crop && (
                        <CropOverlay
                          crop={crop}
                          onBegin={beginAdjust}
                          onChange={(next) => changeAdjust({ ...adjust, crop: next })}
                        />
                      )}
                      {showParent && <span className="absolute left-2 top-2 badge" data-tone="canvas">Original</span>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="canvas-meta">No version selected.</p>
              )}
              {isRunning && runningJob && (
                <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'var(--scrim)' }} role="status" aria-live="polite">
                  <div className="text-center">
                    <div className="mx-auto shimmer-block h-24 w-64 rounded-[10px]" aria-hidden />
                    <Loader2 size={18} className="mx-auto mt-4 animate-spin" aria-hidden />
                    <p className="mt-2 text-[13px] font-semibold">{jobItem?.waiting ? 'Waiting for Meta' : 'Making your change'} · {elapsedLabel(jobItem?.startedAt ?? runningJob.startedAt, now)}</p>
                    <p className="canvas-meta mt-1 text-[11px]">{usd(runningJob.costCents)} so far</p>
                  </div>
                </div>
              )}
            </div>
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
                  aria-valuetext={`${compareValue}% after`}
                />
                <div className="flex justify-between text-[11px]" style={{ color: 'var(--white-60)' }}>
                  <span>Before</span>
                  <span>After</span>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px]" style={{ color: 'var(--white-60)' }}>
              {selected?.width && selected?.height ? `${selected.width} × ${selected.height}` : ''} {zoom !== 1 ? `· ${Math.round(zoom * 100)}%` : ''} · {shapeLabel(project.shape)}
            </div>
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
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
        {!rightHidden && !rightCollapsed && <aside className="ws-right">{rightPanel}</aside>}
      </div>

      <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Edit">{leftPanel}</Sheet>
      <Sheet open={rightSheet} onOpenChange={setRightSheet} side="right" title="Version">{rightPanel}</Sheet>

      <div className="ws-bottom">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium">{selected?.label ?? 'No version'}</p>
          <p className="meta">{formatDate(selected?.createdAt ?? Date.now())}{isRunning ? ' · making' : ''}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tab === 'adjust' ? (
            <Button variant="primary" disabled={applyDisabled} onClick={() => void applyAdjust()}>
              {applyBusy ? <Loader2 size={14} className="animate-spin" /> : null} Apply Locally · Free
            </Button>
          ) : overBudget ? (
            <BudgetWarning limitCents={settings?.budgetCents ?? 0} onRaise={() => navigate('/usage')} onFewer={() => setTab('change')} />
          ) : (
            <Button variant="primary" disabled={changePrimaryDisabled || isRunning} onClick={() => void startChange()}>
              Make This Change · {usdMoney(estimateCents(1))}
            </Button>
          )}
          {tab === 'change' && (!secrets?.hasKey || !canGenerate) && (
            <button type="button" className="hint underline" onClick={() => navigate(!secrets?.hasKey ? '/settings/studio' : '/settings/license')}>
              {!secrets?.hasKey ? 'Add your Muse key in Settings to make images.' : 'Reactivate to make images.'}
            </button>
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
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} image={selected} />
    </>
  )
}
