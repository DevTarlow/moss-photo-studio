import type { PlanJson } from '@shared/types'
import { enableFirstShots, firstShotsEnabled } from '@shared/plans'
import { shotDefinition } from '@shared/prompts/shots'
import { estimateCents, usd } from '@shared/cost'
import { Chip } from '../../components/ui/Chip'
import { Segmented } from '../../components/ui/Segmented'

export function FirstSetPicker({
  plan,
  disabled = false,
  saving = false,
  onChange
}: {
  plan: PlanJson
  disabled?: boolean
  saving?: boolean
  onChange: (plan: PlanJson) => void
}): React.JSX.Element {
  const total = plan.shots.length
  const count = plan.shots.filter((shot) => shot.enabled).length
  const presets = [...new Set([1, Math.min(3, total), total])]
    .filter((value) => value > 0 && value <= total)
    .sort((a, b) => a - b)
  const selectedPreset = presets.find((preset) => firstShotsEnabled(plan, preset)) ?? null
  const presetValue = selectedPreset === null ? 'custom' : String(selectedPreset)

  const toggleShot = (shotId: string): void => {
    onChange({
      ...plan,
      shots: plan.shots.map((shot) =>
        shot.id === shotId ? { ...shot, enabled: !shot.enabled } : shot
      )
    })
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">Images in this set</p>
          <p className="hint mt-1">Pick how many, then switch off anything you do not need.</p>
        </div>
        <span className="badge shrink-0">
          {selectedPreset === null ? `Custom · ${count} of ${total}` : `${count} of ${total}`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="field-label">How many images</p>
        <Segmented
          label="How many images"
          value={presetValue}
          onChange={(value) => {
            if (value === presetValue) return
            onChange(enableFirstShots(plan, Number(value)))
          }}
          options={presets.map((preset) => ({ value: String(preset), label: String(preset), disabled }))}
        />
      </div>

      <div className="mt-3">
        <p className="field-label">Choose the shots</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Choose the shots">
          {plan.shots.map((shot) => {
            const definition = shotDefinition(shot.type)
            return (
              <Chip
                key={shot.id}
                selected={shot.enabled}
                disabled={disabled}
                title={definition.question}
                onClick={() => toggleShot(shot.id)}
              >
                {definition.label}
              </Chip>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-[13px] font-medium">
        {count} {count === 1 ? 'image' : 'images'} · Meta charges {usd(estimateCents(count))}
      </p>
      {count === 0 && (
        <p className="error-text mt-1" role="alert">Turn on at least one shot, or just add the photo.</p>
      )}
      {saving && <p className="hint mt-1">Saving...</p>}
    </div>
  )
}
