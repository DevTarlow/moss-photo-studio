import { Dialog } from './Dialog'
import { useUiStore } from '../../store/ui'

const rows: Array<[string, string]> = [
  ['Ctrl K', 'Command palette'],
  ['Ctrl N', 'New Set Creator'],
  ['Ctrl 1 / 2 / 3', 'New Set Creator / Image Editor / Image Generator'],
  ['Ctrl F', 'Focus search'],
  ['Ctrl E', 'Export the current project'],
  ['Ctrl Enter', 'Run the primary action'],
  ['Space', 'Hold to see the original'],
  ['Left / Right', 'Previous / next version'],
  ['Ctrl V', 'Paste a photo into a new Image Editor project'],
  ['Ctrl B', 'Toggle the rail'],
  ['Ctrl Alt B', 'Toggle the right panel'],
  ['Ctrl Z / Shift Ctrl Z', 'Undo / redo local adjust'],
  ['[ / ]', 'Nudge a focused slider'],
  ['Delete', 'Delete the selected version'],
  ['Esc', 'Close a dialog, lightbox, or palette'],
  ['?', 'This sheet']
]

export function ShortcutsSheet(): React.JSX.Element {
  const open = useUiStore((state) => state.shortcutsOpen)
  const setOpen = useUiStore((state) => state.setShortcuts)
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts" width={520}>
      <dl className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <dt className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{label}</dt>
            <dd>
              <kbd className="rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="hint mt-3">On a Mac, use Command instead of Ctrl.</p>
    </Dialog>
  )
}
