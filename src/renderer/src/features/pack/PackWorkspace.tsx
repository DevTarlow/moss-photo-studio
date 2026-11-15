import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Sparkles,
  Trash2
} from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Image, JobState, PackJson, PackShot, Project } from '@shared/types'
import { PACK_SHOT_MAX, PACK_DIRECTION_MAX } from '@shared/constants'
import { estimateCents, usd } from '@shared/cost'
import { usedBrandColors } from '@shared/brandColors'
import { packTemplateById, PACK_SHOT_TEMPLATES } from '@shared/prompts/packTemplates'
import { createPackFromPreset, createShotFromPreset, PACK_PRESETS, packPresetById } from '@shared/prompts/packPresets'
import { composePackPrompt, enabledPackShots, personRequiredShots, promptFits } from '@shared/prompts/packPrompt'
import { STYLE_PRESETS } from '@shared/stylePresets'
import { bundledUrl } from '../../lib/assets'
import { unwrap, messageOf } from '../../lib/ipc'
import { showExportToast } from '../../lib/exportFeedback'
import { warnIfSmallPhoto } from '../../lib/photoWarnings'
import { toast } from '../../lib/toast'
import { currentMonth } from '../../store/library'
import { useAppStore } from '../../store/app'
import { useJobsStore } from '../../store/jobs'
import { useWorkspaceStore } from '../../store/workspace'
import { useViewportTier } from '../../lib/viewport'
import { Button } from '../../components/ui/Button'
import { FirstRunConfirm } from '../../components/ui/FirstRunConfirm'
import { BudgetWarning } from '../../components/ui/BudgetWarning'
import { Sheet } from '../../components/ui/Sheet'
import { Switch } from '../../components/ui/Switch'
import { SourcePickerDialog, type SourceChoice } from '../../components/sources/SourcePickerDialog'
import { useConfirm } from '../../components/ui/ConfirmProvider'

function monthCentsFromSettings(): string {
  return currentMonth()
}

function shotImage(images: Image[], shot: PackShot): Image | null {
  const ready = images
    .filter((image) => image.shotId === shot.id && image.status === 'ready')
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
  const chosen = shot.selectedImageId ? ready.find((image) => image.id === shot.selectedImageId) : undefined
  return chosen ?? ready.at(-1) ?? null
}

function shotVersions(images: Image[], shot: PackShot): Image[] {
  return images
    .filter((image) => image.shotId === shot.id && image.status === 'ready')
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
}

function shotStatus(job: JobState | null, shot: PackShot, hasImage: boolean): string {
  const item = job?.items.find((entry) => entry.key === shot.id)
  if (item?.status === 'running' || item?.status === 'queued') return 'Making'
  if (item?.status === 'failed') return 'Failed'
  if (item?.status === 'partial') return 'Partial'
  if (hasImage) return 'Ready'
  return 'Not made'
}

export function PackWorkspace(): React.JSX.Element {
  const navigate = useNavigate()
  const project = useWorkspaceStore((state) => state.project) as Project
  const images = useWorkspaceStore((state) => state.images)
  const pack = useWorkspaceStore((state) => state.pack)
  const refresh = useWorkspaceStore((state) => state.refresh)
  const savePack = useWorkspaceStore((state) => state.savePack)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const settings = useAppStore((state) => state.settings)
  const secrets = useAppStore((state) => state.secrets)
  const people = useAppStore((state) => state.people)
  const brand = useAppStore((state) => state.brand)
  const canGenerate = useAppStore((state) => state.canGenerate)
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const jobs = useJobsStore((state) => state.jobs)
  const confirm = useConfirm()
  const tier = useViewportTier()
  const leftHidden = tier === 'tiny'

  const [draft, setDraft] = useState<PackJson | null>(pack)
  const [activeShotId, setActiveShotId] = useState<string | null>(pack?.shots[0]?.id ?? null)
  const [leftSheet, setLeftSheet] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstOpen, setFirstOpen] = useState(false)
  const [pendingRun, setPendingRun] = useState<{ mode: 'missing' | 'remake'; shotIds?: string[] } | null>(null)
  const [monthCents, setMonthCents] = useState(0)
  const [sceneImage, setSceneImage] = useState<Image | null>(null)
  const loadedProject = useRef<string | null>(null)
  const skipAutoSave = useRef(true)

  const projectJobs = useMemo(() => {
    return Object.values(jobs)
      .filter((job) => job.projectId === project.id)
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [jobs, project.id])
  const latestJob = projectJobs.find((job) => job.kind === 'pack') ?? null
  const latestProjectJob = projectJobs[0] ?? null
  const running = Object.values(jobs).some((job) => job.projectId === project.id && job.status === 'running')
  const source = project.sourceImageId ? images.find((image) => image.id === project.sourceImageId) ?? null : null
  const person = draft?.personId ? people.find((entry) => entry.id === draft.personId) ?? null : null
  const preset = draft ? packPresetById(draft.presetId) : undefined
  const activeShot = draft && activeShotId ? draft.shots.find((shot) => shot.id === activeShotId) ?? null : null
  const activeTemplate = activeShot ? packTemplateById(activeShot.templateId) : undefined
  const enabled = draft ? enabledPackShots(draft) : []
  const readyShots = enabled.filter((shot) => Boolean(shotImage(images, shot)))
  const missingShots = enabled.filter((shot) => !shotImage(images, shot))
  const personMissing = Boolean(draft && personRequiredShots(draft).length && !draft.personId)
  const effectiveStyle = draft?.stylePreset ?? brand?.stylePreset ?? null
  const palette = brand?.colorsEnabled ? usedBrandColors(brand.colors) : []
  const missingCount = missingShots.length
  const runCount = missingCount > 0 ? missingCount : enabled.length
  const overBudget =
    settings?.budgetCents !== null &&
    settings?.budgetCents !== undefined &&
    monthCents + estimateCents(runCount) > settings.budgetCents

  useEffect(() => {
    void refresh()
  }, [project.id, refresh])

  useEffect(() => {
    if (!project || !pack || loadedProject.current === project.id) return
    loadedProject.current = project.id
    setDraft(pack)
    setActiveShotId(pack.shots[0]?.id ?? null)
  }, [pack, project])

  useEffect(() => {
    if (!project || pack || loadedProject.current === project.id) return
    void savePack(createPackFromPreset()).catch(() => {
      setError('The pack could not be saved.')
    })
  }, [pack, project, savePack])

  useEffect(() => {
    if (!draft) return
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void persist(draft)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => {
    if (!latestProjectJob || latestProjectJob.status === 'running') return
    void refresh()
  }, [latestProjectJob?.id, latestProjectJob?.status, refresh])

  useEffect(() => {
    void unwrap(window.moss.usage.summary({ month: monthCentsFromSettings() }))
      .then((summary) => setMonthCents(summary.spendCents))
      .catch(() => undefined)
  }, [project.id, latestJob?.status, latestJob?.done, latestJob?.failed])

  useEffect(() => {
    if (!draft?.sceneImageId) {
      setSceneImage(null)
      return
    }
    const local = images.find((image) => image.id === draft.sceneImageId) ?? null
    if (local) {
      setSceneImage(local)
      return
    }
    void window.moss.images.get({ id: draft.sceneImageId }).then((result) => {
      if (result.ok) setSceneImage(result.data)
    }).catch(() => setSceneImage(null))
  }, [draft?.sceneImageId, images])

  if (!draft) {
    return <div className="p-6 text-[12px]" style={{ color: 'var(--text-muted)' }}>Opening the pack...</div>
  }

  const updateDraft = (next: PackJson): void => {
    setDraft(next)
    setError(null)
  }

  const persist = async (next: PackJson): Promise<PackJson | null> => {
    setSaving(true)
    try {
      const saved = await savePack(next)
      if (!saved) throw new Error('The pack could not be saved.')
      return saved
    } catch (caught) {
      setError(messageOf(caught))
      toast.error('The pack could not be saved.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const patchShot = (shotId: string, patch: Partial<PackShot>): void => {
    updateDraft({
      ...draft,
      shots: draft.shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot))
    })
  }

  const selectShot = (shotId: string): void => {
    setActiveShotId(shotId)
    if (leftHidden) setLeftSheet(true)
  }

  const changePreset = async (presetId: string): Promise<void> => {
    if (presetId === draft.presetId) return
    if (images.some((image) => Boolean(image.shotId))) {
      const ok = await confirm({
        title: 'Change the pack preset?',
        body: 'The new preset replaces the shot list. Images you already made stay in the project, but they will no longer be attached to a shot.',
        confirmLabel: 'Change Preset'
      })
      if (!ok) return
    }
    const next = createPackFromPreset(presetId)
    next.personId = draft.personId
    next.personLook = draft.personLook
    next.sceneImageId = draft.sceneImageId
    next.direction = draft.direction
    updateDraft(next)
    setActiveShotId(next.shots[0]?.id ?? null)
  }

  const addShot = (templateId: string): void => {
    if (draft.shots.length >= PACK_SHOT_MAX) {
      toast.error(`A pack holds up to ${PACK_SHOT_MAX} shots.`)
      return
    }
    const shot = createShotFromPreset({ templateId })
    updateDraft({ ...draft, shots: [...draft.shots, shot] })
    setActiveShotId(shot.id)
  }

  const removeShot = (shotId: string): void => {
    const next = draft.shots.filter((shot) => shot.id !== shotId)
    updateDraft({ ...draft, shots: next })
    if (activeShotId === shotId) setActiveShotId(next[0]?.id ?? null)
  }

  const moveShot = (shotId: string, direction: -1 | 1): void => {
    const index = draft.shots.findIndex((shot) => shot.id === shotId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= draft.shots.length) return
    const next = [...draft.shots]
    const [shot] = next.splice(index, 1)
    if (!shot) return
    next.splice(target, 0, shot)
    updateDraft({ ...draft, shots: next })
  }

  const toggleShot = (shotId: string, enabledNext: boolean): void => {
    patchShot(shotId, { enabled: enabledNext })
  }

  const chooseVersion = (shot: PackShot, imageId: string): void => {
    patchShot(shot.id, { selectedImageId: imageId })
  }

  const confirmSourceChange = async (): Promise<boolean> => {
    if (!images.some((image) => Boolean(image.shotId))) return true
    return confirm({
      title: 'Change the source photo?',
      body: 'Images already made stay in the pack. New shots will use the new source photo.',
      confirmLabel: 'Use This Photo'
    })
  }

  const chooseSource = async (choice: SourceChoice): Promise<void> => {
    if (!(await confirmSourceChange())) return
    setSourceBusy(true)
    setError(null)
    try {
      if (choice.kind === 'product') {
        await unwrap(window.moss.products.importIntoProject({ productId: choice.productId, projectId: project.id }))
        await updateProject({ productId: choice.productId })
      } else {
        await unwrap(window.moss.media.importFromImage({ projectId: project.id, imageId: choice.imageId }))
        await updateProject({ productId: null })
      }
      await refresh()
      setSourceOpen(false)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setSourceBusy(false)
    }
  }

  const uploadSource = async (): Promise<void> => {
    if (!(await confirmSourceChange())) return
    setSourceBusy(true)
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ projectId: project.id, kind: 'source' }))
      if (result?.imageId) {
        warnIfSmallPhoto(result)
        await refresh()
      }
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setSourceBusy(false)
    }
  }

  const chooseScene = (choice: SourceChoice): void => {
    if (choice.kind !== 'image') return
    updateDraft({ ...draft, sceneImageId: choice.imageId })
    setSceneOpen(false)
  }

  const changeShape = async (shape: Project['shape']): Promise<void> => {
    await updateProject({ shape })
  }

  const changeFormat = async (format: Project['format']): Promise<void> => {
    await updateProject({ format })
  }

  const requestRun = (mode: 'missing' | 'remake', shotIds?: string[]): void => {
    if (running) return
    if (!secrets?.hasKey) {
      toast.error('Add your Meta Muse key in Settings before making a pack.')
      return
    }
    if (personMissing) {
      toast.error('Choose a person for the On person shots first.')
      return
    }
    if (!settings?.firstRunConfirmShown) {
      setPendingRun({ mode, shotIds })
      setFirstOpen(true)
      return
    }
    void executeRun(mode, shotIds)
  }

  const markFirstRun = async (): Promise<void> => {
    try {
      await unwrap(window.moss.settings.set({ key: 'firstRunConfirmShown', value: true }))
      await refreshSettings()
    } catch {
      // Marked for this session.
    }
  }

  const executeRun = async (mode: 'missing' | 'remake', shotIds?: string[]): Promise<void> => {
    const saved = await persist(draft)
    if (!saved) return
    try {
      await unwrap(window.moss.jobs.startPack({ projectId: project.id, mode, shotIds }))
      setPendingRun(null)
    } catch (caught) {
      const message = messageOf(caught)
      setError(message)
      toast.error(message)
    }
  }

  const confirmFirst = async (): Promise<void> => {
    await markFirstRun()
    setFirstOpen(false)
    if (pendingRun) await executeRun(pendingRun.mode, pendingRun.shotIds)
  }

  const gotFirstRun = (): void => {
    setFirstOpen(false)
    void markFirstRun()
  }

  const exportPack = async (): Promise<void> => {
    try {
      const saved = await persist(draft)
      if (!saved) return
      const result = await unwrap(window.moss.exports.pack({
        projectId: project.id,
        options: { format: project.format, quality: 90, maxDimension: null }
      }))
      if (result.count < 1) {
        toast.error(result.warnings[0] ?? 'Make at least one image first.')
        return
      }
      showExportToast(result.count, result.folderName, project.id)
      if (result.warnings.length) toast.error(result.warnings.join(' '))
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const previewFor = (shot: PackShot): string => {
    const template = packTemplateById(shot.templateId)
    return composePackPrompt({
      shot,
      pack: draft,
      hasProduct: Boolean(source),
      hasPerson: Boolean(template?.needsPerson && draft.personId),
      hasScene: Boolean(draft.sceneImageId),
      stylePreset: effectiveStyle,
      palette
    })
  }

  const sourcePanel = (
    <div className="scroll-area p-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Pack setup</p>
        {saving && <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Saving...</span>}
      </div>

      <div className="mt-3 card p-3">
        <div className="flex items-center gap-2">
          <p className="field-label">Source</p>
          <span className="badge ml-auto">{source ? 'From a photo' : 'Prompt only'}</span>
        </div>
        {source ? (
          <div className="mt-2 flex items-center gap-2">
            {(source.thumbUrl || source.url) && <img src={source.thumbUrl ?? source.url ?? ''} alt="" className="h-12 w-12 rounded object-cover" />}
            <p className="min-w-0 flex-1 truncate text-[12px]">{source.label}</p>
            <Button variant="ghost" size="sm" disabled={sourceBusy || running} onClick={() => setSourceOpen(true)}>Change</Button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="hint">A source photo keeps the product consistent across shots. Without one, this pack uses the prompts only.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" disabled={sourceBusy || running} onClick={() => setSourceOpen(true)}>Choose a photo</Button>
              <Button variant="ghost" size="sm" disabled={sourceBusy || running} onClick={() => void uploadSource()}>Upload</Button>
            </div>
          </div>
        )}
        {source && (
          <Button variant="ghost" size="sm" className="mt-2" disabled={sourceBusy || running} onClick={() => void uploadSource()}>Upload a replacement</Button>
        )}
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="pack-preset">Pack preset</label>
        <select id="pack-preset" className="field mt-1" value={draft.presetId} disabled={running} onChange={(event) => void changePreset(event.target.value)}>
          {PACK_PRESETS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        {preset && <p className="hint mt-1">{preset.blurb}</p>}
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="pack-direction">Shared direction <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></label>
        <textarea
          id="pack-direction"
          className="field mt-1 min-h-[72px]"
          value={draft.direction}
          maxLength={PACK_DIRECTION_MAX}
          disabled={running}
          placeholder="For example: soft daylight, warm neutral tones, calm and lived-in."
          onChange={(event) => updateDraft({ ...draft, direction: event.target.value })}
        />
        <p className="hint mt-1">Added to every shot in the pack.</p>
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="pack-style">Look</label>
        <select
          id="pack-style"
          className="field mt-1"
          value={draft.stylePreset ?? ''}
          disabled={running}
          onChange={(event) => updateDraft({ ...draft, stylePreset: event.target.value || null })}
        >
          <option value="">Brand default</option>
          {STYLE_PRESETS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <label className="field-label" htmlFor="pack-shape">Shape</label>
          <select id="pack-shape" className="field mt-1" value={project.shape} disabled={running} onChange={(event) => void changeShape(event.target.value as Project['shape'])}>
            <option value="square">Square</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="pack-format">Format</label>
          <select id="pack-format" className="field mt-1" value={project.format} disabled={running} onChange={(event) => void changeFormat(event.target.value as Project['format'])}>
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="pack-person">Person <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></label>
        <select
          id="pack-person"
          className="field mt-1"
          value={draft.personId ?? ''}
          disabled={running}
          onChange={(event) => {
            const next = event.target.value || null
            updateDraft({ ...draft, personId: next, personLook: null })
          }}
        >
          <option value="">No person</option>
          {people.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        {person && person.looks.length > 0 && (
          <select
            className="field mt-2"
            aria-label={`Look for ${person.name}`}
            value={draft.personLook ?? ''}
            disabled={running}
            onChange={(event) => updateDraft({ ...draft, personLook: event.target.value || null })}
          >
            <option value="">Original look</option>
            {person.looks.map((look) => <option key={look.key} value={look.key}>{look.label}</option>)}
          </select>
        )}
        {personMissing && <p className="hint mt-1" style={{ color: 'var(--danger)' }}>This pack has On person shots. Choose a person before making it.</p>}
      </div>

      <div className="mt-4 card p-3">
        <div className="flex items-center gap-2">
          <p className="field-label">Scene reference <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
          {draft.sceneImageId && <Button variant="ghost" size="sm" className="ml-auto" disabled={running} onClick={() => updateDraft({ ...draft, sceneImageId: null })}>Clear</Button>}
        </div>
        {sceneImage ? (
          <div className="mt-2 flex items-center gap-2">
            <img src={sceneImage.thumbUrl ?? sceneImage.url ?? ''} alt="" className="h-10 w-10 rounded object-cover" />
            <p className="min-w-0 flex-1 truncate text-[12px]">{sceneImage.label}</p>
            <Button variant="ghost" size="sm" disabled={running} onClick={() => setSceneOpen(true)}>Change</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="mt-2" disabled={running} onClick={() => setSceneOpen(true)}>Choose a scene</Button>
        )}
        {!source && <p className="hint mt-1">Add a source photo before using a scene reference.</p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="section-label">Shots</p>
        <span className="meta">{draft.shots.length} / {PACK_SHOT_MAX}</span>
      </div>
      <div className="mt-2 space-y-1">
        {draft.shots.map((shot, index) => {
          const template = packTemplateById(shot.templateId)
          return (
            <div
              key={shot.id}
              className="rounded-[8px] border p-2"
              style={{
                borderColor: activeShotId === shot.id ? 'var(--border-strong)' : 'var(--border)',
                background: activeShotId === shot.id ? 'var(--surface-2)' : 'transparent'
              }}
            >
              <div className="flex items-center gap-2">
                <Switch checked={shot.enabled} onCheckedChange={(next) => toggleShot(shot.id, next)} label={`Turn ${shot.label} ${shot.enabled ? 'off' : 'on'}`} disabled={running} />
                <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-medium" onClick={() => selectShot(shot.id)}>
                  {shot.label}
                </button>
                <span className="meta">{template?.label ?? 'Custom'}</span>
              </div>
              <div className="mt-1 flex justify-end gap-0.5">
                <button type="button" className="icon-btn" aria-label={`Move ${shot.label} up`} disabled={running || index === 0} onClick={() => moveShot(shot.id, -1)}><Icon icon={ArrowUp} size="xsm" /></button>
                <button type="button" className="icon-btn" aria-label={`Move ${shot.label} down`} disabled={running || index === draft.shots.length - 1} onClick={() => moveShot(shot.id, 1)}><Icon icon={ArrowDown} size="xsm" /></button>
                <button type="button" className="icon-btn" aria-label={`Remove ${shot.label}`} disabled={running} onClick={() => removeShot(shot.id)}><Icon icon={Trash2} size="xsm" /></button>
              </div>
            </div>
          )
        })}
      </div>
      <select
        className="field mt-2"
        aria-label="Add a shot"
        value=""
        disabled={running || draft.shots.length >= PACK_SHOT_MAX}
        onChange={(event) => {
          if (event.target.value) addShot(event.target.value)
        }}
      >
        <option value="">Add a shot...</option>
        {PACK_SHOT_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>{template.label}</option>
        ))}
      </select>

      {activeShot && activeTemplate && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="section-label">Shot settings</p>
          <label className="field-label mt-3 block" htmlFor="shot-label">Label</label>
          <input
            id="shot-label"
            className="field mt-1"
            value={activeShot.label}
            maxLength={80}
            disabled={running}
            onChange={(event) => patchShot(activeShot.id, { label: event.target.value })}
          />
          <label className="field-label mt-3 block" htmlFor="shot-direction">Direction</label>
          <textarea
            id="shot-direction"
            className="field mt-1 min-h-[90px]"
            value={activeShot.direction}
            maxLength={PACK_DIRECTION_MAX}
            disabled={running}
            placeholder={activeTemplate.defaultDirection || 'Describe this shot.'}
            onChange={(event) => patchShot(activeShot.id, { direction: event.target.value })}
          />
          <details className="mt-2">
            <summary className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Prompt preview</summary>
            <pre className="mt-1 whitespace-pre-wrap rounded-[6px] p-2 text-[11px] leading-4" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {previewFor(activeShot)}
            </pre>
            {!promptFits(previewFor(activeShot)) && <p className="error-text mt-1">This prompt is over the 2,000 character limit. Shorten the direction.</p>}
          </details>
        </div>
      )}
    </div>
  )

  const shotBoard = (
    <section className="ws-center">
      <div className="flex flex-wrap items-center gap-2 border-b px-4" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
        {leftHidden && <Button variant="ghost" size="sm" onClick={() => setLeftSheet(true)}>Pack setup</Button>}
        <span className="badge">Image Pack</span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{preset?.label ?? 'Image Pack'}</p>
        <span className="badge" data-tone={missingShots.length > 0 ? undefined : 'success'}>
          {readyShots.length} of {enabled.length} ready
        </span>
        {running && <span className="badge" data-tone="success">Making</span>}
        <Button variant="secondary" size="sm" disabled={running || readyShots.length === 0} onClick={() => void exportPack()}>Export Pack</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <p className="error-text mb-3" role="alert">{error}</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {draft.shots.map((shot) => {
            const template = packTemplateById(shot.templateId)
            const versions = shotVersions(images, shot)
            const image = shotImage(images, shot)
            const job = latestJob?.items.find((item) => item.key === shot.id) ?? null
            const status = shotStatus(latestJob, shot, Boolean(image))
            const selectedId = image?.id ?? ''
            const needsPerson = template?.needsPerson && !draft.personId
            const shown = image?.thumbUrl ?? image?.url ?? (template ? bundledUrl(template.asset) : null)
            return (
              <article key={shot.id} className={`card overflow-hidden ${shot.enabled ? '' : 'opacity-50'}`}>
                <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  {shown ? <img src={shown} alt="" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center"><Icon icon={ImageIcon} size="lg" /></div>}
                  {!image && <span className="badge absolute left-2 top-2">Example</span>}
                  {image && shot.selectedImageId === image.id && <span className="badge absolute left-2 top-2" data-tone="success">Chosen</span>}
                  <span className="badge absolute right-2 top-2">{status}</span>
                </div>
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{shot.label}</p>
                      <p className="hint mt-0.5">{template?.blurb ?? 'A custom shot.'}</p>
                    </div>
                    {job?.status === 'failed' && <span className="badge" data-tone="danger">Failed</span>}
                  </div>
                  {versions.length > 1 && (
                    <select
                      className="field mt-2"
                      aria-label={`Version for ${shot.label}`}
                      value={selectedId}
                      disabled={running}
                      onChange={(event) => chooseVersion(shot, event.target.value)}
                    >
                      {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
                    </select>
                  )}
                  {needsPerson && <p className="hint mt-2" style={{ color: 'var(--danger)' }}>Choose a person to make this shot.</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {image ? (
                      <>
                        <Button variant="secondary" size="sm" disabled={running || !canGenerate} onClick={() => requestRun('remake', [shot.id])}>New Version</Button>
                        <Button variant="ghost" size="sm" disabled={running} onClick={() => navigate(`/project/${project.id}?view=photo&image=${image.id}`)}><Icon icon={Pencil} size="xsm" /> Edit</Button>
                      </>
                    ) : (
                      <Button variant="primary" size="sm" disabled={running || needsPerson} onClick={() => requestRun('remake', [shot.id])}><Icon icon={Sparkles} size="xsm" /> Make</Button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        {draft.shots.length === 0 && <p className="hint mt-4">Add a shot in Pack setup to begin.</p>}
      </div>

      <div className="ws-bottom">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] font-medium tabular">{runCount} {runCount === 1 ? 'image' : 'images'} · {usd(estimateCents(runCount))}</p>
          {running && <p className="meta">Making images... You can leave this screen; the run keeps going.</p>}
          {!running && missingShots.length === 0 && enabled.length > 0 && <p className="meta">Every enabled shot has an image. Make new versions when you want to explore.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {overBudget && settings?.budgetCents != null && (
            <BudgetWarning limitCents={settings.budgetCents} onRaise={() => navigate('/usage')} />
          )}
          <Button
            variant="primary"
            disabled={running || enabled.length === 0 || personMissing || !canGenerate || runCount === 0}
            onClick={() => requestRun(missingShots.length > 0 ? 'missing' : 'remake')}
          >
            {running ? <><Icon icon={Loader2} size="sm" className="animate-spin" /> Making</> : missingShots.length > 0 ? `Make ${missingShots.length} ${missingShots.length === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(missingShots.length))}` : `Make ${enabled.length} New ${enabled.length === 1 ? 'Version' : 'Versions'} · ${usd(estimateCents(enabled.length))}`}
          </Button>
        </div>
      </div>
    </section>
  )

  return (
    <>
      <div className="workspace">
        {!leftHidden && (
          <aside className="ws-left" style={{ width: 340, minWidth: 300 }}>{sourcePanel}</aside>
        )}
        {shotBoard}
      </div>

      {leftHidden && <Sheet open={leftSheet} onOpenChange={setLeftSheet} side="left" title="Pack setup">{sourcePanel}</Sheet>}

      <SourcePickerDialog
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        onChoose={(choice) => void chooseSource(choice)}
        title="Choose a source photo"
        description="Use a saved product or any ready image in your library."
      />
      <SourcePickerDialog
        open={sceneOpen}
        onOpenChange={setSceneOpen}
        onChoose={chooseScene}
        title="Choose a scene reference"
        description="The pack uses its setting, light and props without copying its subject."
        libraryOnly
      />

      <FirstRunConfirm
        open={firstOpen}
        runLabel={`Make ${pendingRun?.shotIds?.length ?? runCount} ${(pendingRun?.shotIds?.length ?? runCount) === 1 ? 'Image' : 'Images'} · ${usd(estimateCents(pendingRun?.shotIds?.length ?? runCount))}`}
        imageCount={pendingRun?.shotIds?.length ?? runCount}
        onOpenChange={setFirstOpen}
        onConfirm={() => void confirmFirst()}
        onGotIt={gotFirstRun}
      />
    </>
  )
}
