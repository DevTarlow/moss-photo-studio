import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import {
  Check,
  ChevronDown,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Ruler,
  Scan,
  Sparkles,
  Type,
  UserRound,
  Utensils,
  Wand2
} from 'lucide-react'
import type { Format, Image, Person, PlanJson, PlanShot } from '@shared/types'
import { MAX_SET_SHOTS } from '@shared/constants'

import { SHOT_TYPES, shotDefinition } from '@shared/prompts/shots'
import { recipeById } from '@shared/prompts/recipes'
import { bundledUrl } from '../../lib/assets'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Switch } from '../../components/ui/Switch'
import { useConfirm } from '../../components/ui/ConfirmProvider'

type PlanPanelFormat = Format

const glyphs = {
  hero: ImageIcon,
  lifestyle: Utensils,
  detail: Scan,
  scale: Ruler,
  flatlay: LayoutGrid,
  gift: Gift,
  feature: Type,
  onmodel: UserRound
} as const

function personPortrait(person: Person): string {
  return person.portraitUrl || bundledUrl(`people/${person.id}-portrait.webp`)
}

function DirectionEditor({
  shot,
  readOnly,
  onChange,
  onBlur
}: {
  shot: PlanShot
  readOnly: boolean
  onChange: (direction: string) => void
  onBlur: () => void
}): React.JSX.Element {
  const definition = shotDefinition(shot.type)
  const trimmed = shot.direction.trim()
  const isStudio = !trimmed || trimmed === definition.defaultDirection
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <label className="field-label text-[11px]" htmlFor={`direction-${shot.id}`}>Direction</label>
        <span className="text-[11px]" style={{ color: isStudio ? 'var(--text-faint)' : 'var(--accent)' }}>
          {isStudio ? 'Studio default' : 'Edited'}
        </span>
      </div>
      <textarea
        id={`direction-${shot.id}`}
        className="field min-h-[60px] text-[11px]"
        maxLength={400}
        disabled={readOnly}
        value={shot.direction}
        placeholder={definition.defaultDirection}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>Edit the direction to change what this shot shows.</p>
    </div>
  )
}

function ShotCard({
  shot,
  index,
  plan,
  people,
  made,
  readOnly,
  onChange,
  onSaveBlur
}: {
  shot: PlanShot
  index: number
  plan: PlanJson
  people: Person[]
  made: number
  readOnly: boolean
  onChange: (next: PlanShot) => void
  onSaveBlur: () => void
}): React.JSX.Element {
  const definition = shotDefinition(shot.type)
  const Glyph = glyphs[shot.type]
  const usedElsewhere = new Set(plan.shots.filter((entry) => entry.id !== shot.id).map((entry) => entry.type))
  const noPeople = people.length === 0
  const selectedPerson = people.find((person) => person.id === (shot.personId ?? 'maya')) ?? people[0]
  const [previewOpen, setPreviewOpen] = useState(false)
  const changeType = (type: PlanShot['type']): void => {
    const next = shotDefinition(type)
    onChange({
      ...shot,
      type,
      label: next.label,
      direction: next.defaultDirection,
      personId: type === 'onmodel' ? (shot.personId ?? 'maya') : null,
      ...(type === 'feature' ? { featureText: shot.featureText ?? '' } : {})
    })
    onSaveBlur()
  }
  return (
    <div className="plan-card" data-made={made > 0}>
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
          <Glyph size={13} />
        </span>
        <span className="text-[11px] font-semibold tabular" style={{ color: 'var(--text-faint)' }}>{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{definition.label}</span>
        {made > 0 && <span className="badge" data-tone="success">Made</span>}
        <Switch
          checked={shot.enabled}
          onCheckedChange={(enabled) => { onChange({ ...shot, enabled }); onSaveBlur() }}
          label={`${definition.label} on`}
          disabled={readOnly}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`shot-type-${shot.id}`}>Shot type</label>
        <select
          id={`shot-type-${shot.id}`}
          className="field h-7 flex-1 text-[11px]"
          value={shot.type}
          disabled={readOnly}
          onChange={(event) => changeType(event.target.value as PlanShot['type'])}
        >
          {SHOT_TYPES.map((entry) => (
            <option key={entry.type} value={entry.type} disabled={usedElsewhere.has(entry.type)}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      {!shot.enabled && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>Off. This shot is not made or charged.</p>
      )}
      {shot.type === 'onmodel' && (
        <div className="mt-2 flex items-center gap-2">
          {noPeople ? (
            <p className="text-[11px]" style={{ color: 'var(--warning)' }}>Add a person to use this shot.</p>
          ) : (
            <>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    id={`person-${shot.id}`}
                    className="field flex h-7 min-w-0 flex-1 items-center justify-between gap-2 text-[11px]"
                    disabled={readOnly}
                    aria-label={`Person for ${definition.label}`}
                  >
                    <span className="truncate">
                      {selectedPerson
                        ? `${selectedPerson.name}${selectedPerson.ageBand ? ` · ${selectedPerson.ageBand}` : ''}`
                        : 'Choose a person'}
                    </span>
                    <ChevronDown size={13} className="shrink-0" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-content" sideOffset={4} style={{ minWidth: 200 }}>
                    {people.map((person) => {
                      const selected = person.id === (shot.personId ?? 'maya')
                      return (
                        <DropdownMenu.Item
                          key={person.id}
                          className="menu-item"
                          onSelect={() => {
                            onChange({ ...shot, personId: person.id })
                            onSaveBlur()
                          }}
                        >
                          <img src={personPortrait(person)} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                          <span className="min-w-0 flex-1 truncate">
                            {person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}
                          </span>
                          {selected && <Check size={14} className="ml-auto shrink-0" />}
                        </DropdownMenu.Item>
                      )
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              {selectedPerson && (
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 hover:opacity-80"
                  aria-label={`See ${selectedPerson.name} larger`}
                  onClick={() => setPreviewOpen(true)}
                >
                  <img
                    src={personPortrait(selectedPerson)}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                    onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                  />
                </button>
              )}
            </>
          )}
        </div>
      )}
      {shot.type === 'feature' && (
        <div className="mt-2">
          <label className="field-label text-[11px]" htmlFor={`feature-${shot.id}`}>Text on image</label>
          <input
            id={`feature-${shot.id}`}
            className="field h-7 text-[11px]"
            maxLength={60}
            value={shot.featureText ?? ''}
            disabled={readOnly}
            placeholder="One short line"
            onChange={(event) => onChange({ ...shot, featureText: event.target.value })}
            onBlur={onSaveBlur}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--warning)' }}>The model draws the words. Check them before you upload.</p>
        </div>
      )}
      <DirectionEditor
        shot={shot}
        readOnly={readOnly}
        onChange={(direction) => onChange({ ...shot, direction })}
        onBlur={onSaveBlur}
      />
      {shot.type === 'onmodel' && selectedPerson && (
        <Dialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={selectedPerson.name}
          description={selectedPerson.ageBand ?? undefined}
          width={460}
          footer={<Button variant="secondary" onClick={() => setPreviewOpen(false)}>Close</Button>}
        >
          <img
            src={personPortrait(selectedPerson)}
            alt={`${selectedPerson.name} portrait`}
            className="mx-auto max-h-[60vh] w-full rounded-[12px] object-contain"
          />
        </Dialog>
      )}
    </div>
  )
}

export function PlanPanel({
  plan,
  images,
  people,
  readOnly,
  running = false,
  sourceUrl,
  onChange,
  onSaveNow,
  onReset,
  onAddShot,
  onReplaceSource
}: {
  plan: PlanJson
  images: Image[]
  people: Person[]
  readOnly: boolean
  running?: boolean
  sourceUrl: string | null
  onChange: (plan: PlanJson) => void
  onSaveNow: () => void
  onReset: () => void
  onAddShot: (type: PlanShot['type']) => void
  onReplaceSource: () => void
}): React.JSX.Element {
  const confirm = useConfirm()
  const ready = images.filter((image) => image.status === 'ready' && image.shotId)
  const usedTypes = new Set(plan.shots.map((shot) => shot.type))
  const remaining = SHOT_TYPES.filter((entry) => !usedTypes.has(entry.type))
  const canAdd = plan.shots.length < MAX_SET_SHOTS && remaining.length > 0
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">Plan</p>
          {running ? <span className="badge" data-tone="success">Making</span> : readOnly ? <span className="badge">Read-only</span> : null}
        </div>
        {sourceUrl ? (
          <div className="mt-3 overflow-hidden rounded-[8px]" style={{ background: 'var(--canvas)' }}>
            <img src={sourceUrl} alt="The product photo" className="h-[118px] w-full object-contain" />
          </div>
        ) : (
          <div className="mt-3 grid h-[100px] place-items-center rounded-[8px]" style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}>
            <Sparkles size={20} />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">{recipeById(plan.category).label}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{plan.shots.filter((shot) => shot.enabled).length} shots · {plan.shots.filter((shot) => shot.enabled).length} images</p>
          </div>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => void onReplaceSource()}>Replace</Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[11px]" htmlFor="plan-format" style={{ color: 'var(--text-faint)' }}>Format</label>
          <select
            id="plan-format"
            className="field h-7 flex-1 text-[11px]"
            value={plan.format}
            disabled={readOnly}
            onChange={(event) => { onChange({ ...plan, format: event.target.value as PlanPanelFormat }); onSaveNow() }}
          >
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
      </div>
      <div className="scroll-area flex-1 p-3" tabIndex={readOnly ? 0 : undefined} aria-label={readOnly ? 'Set plan' : undefined} role={readOnly ? 'region' : undefined}>
        <div className="space-y-2">
          {plan.shots.map((shot, index) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              index={index}
              plan={plan}
              people={people}
              made={ready.filter((image) => image.shotId === shot.id).length}
              readOnly={readOnly}
              onChange={(next) => {
                onChange({ ...plan, shots: plan.shots.map((entry) => entry.id === shot.id ? next : entry) })
              }}
              onSaveBlur={onSaveNow}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {plan.shots.length >= MAX_SET_SHOTS ? (
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>A set holds eight images. Turn one off first.</p>
          ) : remaining.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Every shot type is already in this set.</p>
          ) : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" size="sm" disabled={readOnly || !canAdd}>
                  <Plus size={14} /> Add a Shot
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-content" sideOffset={4}>
                  {remaining.map((entry) => {
                    const unavailablePerson = entry.type === 'onmodel' && people.length === 0
                    return (
                      <DropdownMenu.Item
                        key={entry.type}
                        className="menu-item"
                        disabled={unavailablePerson}
                        onSelect={() => onAddShot(entry.type)}
                      >
                        {entry.label}
                        {unavailablePerson && <span className="ml-auto text-[11px]">Add a person</span>}
                      </DropdownMenu.Item>
                    )
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => {
              void confirm({
                title: 'Reset the plan?',
                body: 'The recipe and its studio directions come back. Your own directions are discarded.',
                confirmLabel: 'Reset the Plan'
              }).then((ok) => { if (ok) onReset() })
            }}
          >
            <Wand2 size={14} /> Reset the Plan
          </Button>
        </div>
      </div>
      {!readOnly && (
        <div className="border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Changes save by themselves.</p>
        </div>
      )}
    </div>
  )
}
