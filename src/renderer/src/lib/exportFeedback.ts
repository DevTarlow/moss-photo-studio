import { toast } from './toast'

export function showExportToast(count: number, folderName: string, projectId: string | null, setId?: string | null): void {
  if (count < 1) return
  toast.status(
    `${count} ${count === 1 ? 'image' : 'images'} exported to "${folderName || 'the chosen folder'}".`,
    {
      label: 'Open Folder',
      onClick: () => {
        void window.moss.app.openPath({
          kind: 'exports',
          ...(projectId ? { projectId } : {}),
          ...(setId ? { setId } : {})
        }).catch(() => {
          toast.error('That folder could not be opened.')
        })
      }
    }
  )
}
