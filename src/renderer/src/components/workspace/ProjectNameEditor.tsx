import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../store/workspace'
import { toast } from '../../lib/toast'

const typeLabel = { photo: 'Image Editor', image: 'Image Generator' } as const

export function ProjectNameEditor(): React.JSX.Element | null {
  const project = useWorkspaceStore((state) => state.project)
  const updateProject = useWorkspaceStore((state) => state.updateProject)
  const [value, setValue] = useState(project?.name ?? '')

  useEffect(() => {
    setValue(project?.name ?? '')
  }, [project?.name])

  if (!project) return null

  const save = async (): Promise<void> => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === project.name) {
      setValue(project.name)
      return
    }
    try {
      await updateProject({ name: trimmed })
      toast.status('Project renamed.')
    } catch {
      setValue(project.name)
      toast.error('The project could not be renamed.')
    }
  }

  return (
    <div className="no-drag flex min-w-0 items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setValue(project.name)
            event.currentTarget.blur()
          }
        }}
        maxLength={140}
        aria-label="Project name"
        className="min-w-[100px] max-w-[340px] flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-semibold outline-none hover:border-[var(--border)] focus:border-[var(--border-strong)]"
      />
      <span className="badge">{typeLabel[project.type]}</span>
    </div>
  )
}
