import type { PlanJson } from '@shared/types'
import { enableFirstShots, firstShotsEnabled } from '@shared/plans'
import { shotDefinition } from '@shared/prompts/shots'
import { estimateCents, usd } from '@shared/cost'
import { SHOT_EXAMPLES } from '../../lib/shotExamples'
import { Badge, SegmentedControl, SegmentedControlItem, Stack, Text, ToggleButton } from '@astryxdesign/core'

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
    <Stack gap={4}>
      <Stack direction="horizontal" gap={3} align="start" justify="between" wrap="wrap">
        <Stack gap={1}>
          <Text weight="bold">Images in this set</Text>
          <Text type="supporting" color="secondary">
            Pick how many, then switch off anything you do not need.
          </Text>
        </Stack>
        <Badge
          label={selectedPreset === null ? `Custom · ${count} of ${total}` : `${count} of ${total}`}
          variant="neutral"
        />
      </Stack>

      <Stack direction="horizontal" gap={3} align="center" justify="between" wrap="wrap">
        <Text weight="bold">How many images</Text>
        <SegmentedControl
          label="How many images"
          value={presetValue}
          onChange={(value) => {
            if (value === presetValue || value === 'custom') return
            onChange(enableFirstShots(plan, Number(value)))
          }}
          isDisabled={disabled}
        >
          {presets.map((preset) => (
            <SegmentedControlItem key={preset} value={String(preset)} label={String(preset)} isDisabled={disabled} />
          ))}
        </SegmentedControl>
      </Stack>

      <Stack gap={2}>
        <Text weight="bold">Choose the shots</Text>
        <Stack direction="horizontal" gap={1.5} wrap="wrap" role="group" aria-label="Choose the shots">
          {plan.shots.map((shot) => {
            const definition = shotDefinition(shot.type)
            return (
              <ToggleButton
                key={shot.id}
                label={definition.label}
                size="sm"
                className="first-set-shot"
                isPressed={shot.enabled}
                isDisabled={disabled}
                onPressedChange={() => toggleShot(shot.id)}
                tooltip={definition.question}
              />
            )
          })}
        </Stack>
        <Text type="supporting" color="secondary">
          Examples on other products. Click a shot to add or remove it.
        </Text>
        <div className="first-set-examples" role="group" aria-label="Shot examples">
          {plan.shots.map((shot) => {
            const definition = shotDefinition(shot.type)
            const example = SHOT_EXAMPLES[shot.type]
            return (
              <button
                key={shot.id}
                type="button"
                className="first-set-example"
                data-enabled={shot.enabled ? 'true' : 'false'}
                aria-label={`${definition.label} example`}
                aria-pressed={shot.enabled}
                disabled={disabled}
                onClick={() => toggleShot(shot.id)}
              >
                <span className="first-set-example-frame">
                  <img src={example.src} alt="" />
                  {example.sample && <span className="first-set-example-text">{example.sample}</span>}
                </span>
                <Text type="supporting" display="block" className="first-set-example-label">
                  {definition.label}
                </Text>
              </button>
            )
          })}
        </div>
      </Stack>

      <Text weight="bold">
        {count} {count === 1 ? 'image' : 'images'} · Meta charges {usd(estimateCents(count))}
      </Text>
      {count === 0 && (
        <Text role="alert" style={{ color: 'var(--color-text-error)' }}>
          Turn on at least one shot, or save the product only.
        </Text>
      )}
      {saving && (
        <Text type="supporting" color="secondary">
          Saving...
        </Text>
      )}
    </Stack>
  )
}
