import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppFrame } from '../components/ui/AppFrame'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { ProjectNameEditor } from '../components/workspace/ProjectNameEditor'
import { useWorkspaceStore } from '../store/workspace'
import { SetWorkspace } from '../features/set/SetWorkspace'
import { PhotoWorkspace } from '../features/photo/PhotoWorkspace'
import { CreateWorkspace } from '../features/create/CreateWorkspace'
import { Button } from '../components/ui/Button'

export function Workspace(): React.JSX.Element {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const project = useWorkspaceStore((state) => state.project)
  const loading = useWorkspaceStore((state) => state.loading)
  const error = useWorkspaceStore((state) => state.error)
  const load = useWorkspaceStore((state) => state.load)
  const selectImage = useWorkspaceStore((state) => state.selectImage)
  const imageParam = params.get('image')
  const view = params.get('view')
  const photoView = view === 'photo'

  useEffect(() => {
    if (!id) return
    void load(id, imageParam ?? undefined)
    // A different project is the only time the whole workspace reloads.
  }, [id])

  useEffect(() => {
    if (imageParam) selectImage(imageParam)
  }, [imageParam, selectImage])

  const titleContent = project ? <ProjectNameEditor /> : undefined
  if (!id) {
    return (
      <AppFrame backTo="/library">
        <ErrorState message="That project is not here anymore." onRetry={() => navigate('/library')} />
      </AppFrame>
    )
  }
  if (loading && !project) {
    return (
      <AppFrame backTo="/library">
        <div className="flex h-full gap-4 p-4">
          <Skeleton className="h-full w-[300px]" />
          <Skeleton className="h-full flex-1" />
          <Skeleton className="h-full w-[280px]" />
        </div>
      </AppFrame>
    )
  }
  if (error && !project) {
    return (
      <AppFrame backTo="/library">
        <ErrorState message={error} onRetry={() => void load(id)} />
      </AppFrame>
    )
  }
  if (!project) {
    return (
      <AppFrame backTo="/library">
        <ErrorState message="Could not open that project. Nothing is lost. Try again." onRetry={() => void load(id)} />
      </AppFrame>
    )
  }
  const content = project.type === 'set'
    ? photoView ? <PhotoWorkspace key="set-photo" /> : <SetWorkspace key="set" />
    : project.type === 'photo'
      ? <PhotoWorkspace key="photo" />
      : photoView
        ? <PhotoWorkspace key="image-photo" />
        : <CreateWorkspace key="image" />

  return (
    <AppFrame backTo="/library" titleContent={titleContent}>
      {content}
    </AppFrame>
  )
}
