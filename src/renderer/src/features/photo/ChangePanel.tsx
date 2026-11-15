import { useState } from 'react'
import { Mountain, Sparkles, X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Person } from '@shared/types'
import type { Template as TemplateType } from '@shared/prompts/templates'
import { TEMPLATE_GROUPS, templateAsset, templateById } from '@shared/prompts/templates'
import { bundledUrl } from '../../lib/assets'
import { isBundledPerson } from '@shared/people'
import { PROMPT_MAX } from '@shared/prompts/guards'
import type { ChangeKind } from '@shared/prompts/guards'
import { Button } from '../../components/ui/Button'
import type { SourceChoice } from '../../components/sources/SourcePickerDialog'
import { TextareaCounter } from '../../components/ui/TextareaCounter'

type TextSource = 'user' | 'tile'

interface PendingTile {
  id: string
  label: string
  prompt: string
  kind: Exclude<ChangeKind, ''>
}

function tilePending(template: TemplateType): PendingTile {
  return { id: template.id, label: template.label, prompt: template.prompt, kind: template.kind }
}

export function ChangePanel({
  text,
  textSource,
  kind,
  templateId,
  personId,
  people,
  sceneRef,
  disabled,
  onText,
  onKind,
  onTemplate,
  onPerson,
  onChooseScene,
  onClearScene,
  onClear
}: {
  text: string
  textSource: TextSource
  kind: ChangeKind
  templateId: string | null
  personId: string
  people: Person[]
  sceneRef: SourceChoice | null
  disabled: boolean
  onText: (text: string, source: TextSource) => void
  onKind: (kind: ChangeKind) => void
  onTemplate: (id: string | null) => void
  onPerson: (id: string) => void
  onChooseScene: () => void
  onClearScene: () => void
  onClear: () => void
}): React.JSX.Element {
  const [pending, setPending] = useState<PendingTile | null>(null)
  const selectedTemplate = templateId ? templateById(templateId) : undefined
  const modelPerson = people.find((person) => person.id === personId) ?? people[0]
  const over = text.length > PROMPT_MAX

  const applyTile = (tile: PendingTile): void => {
    onText(tile.prompt, 'tile')
    onKind(tile.kind)
    onTemplate(tile.id)
    if (tile.kind === 'model' && !people.some((person) => person.id === personId)) {
      const first = people[0]
      if (first) onPerson(first.id)
    }
    setPending(null)
  }

  const chooseTile = (tile: PendingTile): void => {
    if (disabled) return
    if (text.trim() && textSource === 'user') {
      setPending(tile)
      return
    }
    applyTile(tile)
  }

  const tileImage = (template: TemplateType): string => {
    if (template.group === 'model' && modelPerson) {
      if (isBundledPerson(modelPerson.id)) return bundledUrl(templateAsset(template, modelPerson.id))
      return modelPerson.portraitUrl
    }
    return bundledUrl(template.asset)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Change this photo</p>
        {text && (
          <button
            type="button"
            className="text-[11px]"
            style={{ color: 'var(--text-faint)' }}
            disabled={disabled}
            onClick={() => { onClear(); setPending(null) }}
          >
            Clear
          </button>
        )}
      </div>

      {pending && (
        <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }} role="alert">
          <p className="text-[12px] font-medium">Replace your words with this tile?</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => applyTile(pending)}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              onKind(pending.kind)
              onTemplate(pending.id)
              if (pending.kind === 'model' && !people.some((person) => person.id === personId)) {
                const first = people[0]
                if (first) onPerson(first.id)
              }
              setPending(null)
            }}>Keep</Button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <TextareaCounter
          id="change-description"
          label="Describe the change"
          value={text}
          max={PROMPT_MAX}
          rows={4}
          disabled={disabled}
          onChange={(event) => onText(event.target.value, 'user')}
          placeholder="Describe the change. For example: a warmer light from the left."
          hint={over ? undefined : 'The price is on the button. Your words are not rewritten.'}
        />
        {over && (
          <p className="error-text mt-1" role="alert">
            That's {text.length - PROMPT_MAX} characters over. Shorten it and try again.
          </p>
        )}
      </div>

      <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
        <p className="field-label">Scene reference <span className="font-normal" style={{ color: 'var(--text-faint)' }}>Optional</span></p>
        {sceneRef?.kind === 'image' ? (
          <div className="flex items-center gap-2">
            <img src={sceneRef.thumbUrl ?? ''} alt="" className="h-8 w-8 rounded object-cover" style={{ background: 'var(--surface-2)' }} />
            <p className="min-w-0 flex-1 truncate text-[11px]">{sceneRef.label}</p>
            <button type="button" className="icon-btn" aria-label="Remove scene reference" disabled={disabled} onClick={onClearScene}><Icon icon={X} size="xsm" /></button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="mt-1 w-full justify-start" disabled={disabled} onClick={onChooseScene}>
            <Icon icon={Mountain} size="sm" /> Choose a Scene
          </Button>
        )}
        <p className="hint mt-1">Borrows the setting and light, never the subject.</p>
      </div>

      {kind === 'model' && (
        <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)' }}>
          <label className="field-label" htmlFor="editor-person">Person</label>
          {people.length === 0 ? (
            <p className="hint">Add a person to use these tiles.</p>
          ) : (
            <div className="flex items-center gap-2">
              {modelPerson?.portraitUrl && <img src={modelPerson.portraitUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
              <select
                id="editor-person"
                className="field"
                value={personId}
                disabled={disabled}
                onChange={(event) => onPerson(event.target.value)}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-5">
        {TEMPLATE_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`tile-group-${group.id}`}>
            <h3 id={`tile-group-${group.id}`} className="text-[12px] font-semibold">{group.title}</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{group.intro}</p>
            <div className="tile-grid mt-2">
              {group.templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="tile"
                  data-armed={templateId === template.id}
                  disabled={disabled || (group.id === 'model' && people.length === 0)}
                  title={template.suits ?? template.label}
                  aria-label={`${template.label}. ${template.suits ?? ''}`}
                  onClick={() => chooseTile(tilePending(template))}
                >
                  <img src={tileImage(template)} alt="" loading="lazy" />
                  <span className="tile-label">{template.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {textSource === 'tile' && selectedTemplate && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <Icon icon={Sparkles} size="xsm" /> Studio words from {selectedTemplate.label}.
        </p>
      )}
    </div>
  )
}
