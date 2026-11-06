export type AppCommand =
  | 'export'
  | 'run-primary'
  | 'undo'
  | 'redo'
  | 'copy-image'
  | 'paste-image'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'focus-search'
  | 'toggle-panel'

const target = new EventTarget()

export function emitCommand(command: AppCommand): void {
  target.dispatchEvent(new CustomEvent<AppCommand>('command', { detail: command }))
}

export function onCommand(listener: (command: AppCommand) => void): () => void {
  const wrapped = (event: Event): void => {
    listener((event as CustomEvent<AppCommand>).detail)
  }
  target.addEventListener('command', wrapped)
  return () => target.removeEventListener('command', wrapped)
}
