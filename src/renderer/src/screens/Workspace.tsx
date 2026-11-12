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
  const preferredPersonId = params.get('person')
  const preferredPersonLook = params.get('look') ?? project?.personLook ?? null

  useEffect(() => {
    if (!id) return
    void load(id, imageParam ?? undefined)
    // A different project is the only time the whole workspace reloads.
  }, [id])

  useEffect(() => {
    if (imageParam) selectImage(imageParam)
  }, [imageParam, selectImage])

  const titleContent = project ? <ProjectNameEditor /> : undefined
  const backTo = project?.productId ? `/product/${project.productId}` : '/library'
  if (!id) {
    return (
      <AppFrame backTo="/products">
        <ErrorState message="That project is not here anymore." onRetry={() => navigate('/library')} />
      </AppFrame>
    )
  }
  if (loading && !project) {
    return (
      <AppFrame backTo="/products">
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
      <AppFrame backTo="/products">
        <ErrorState message={error} onRetry={() => void load(id)} />
      </AppFrame>
    )
  }
  if (!project) {
    return (
      <AppFrame backTo="/products">
        <ErrorState message="Could not open that project. Nothing is lost. Try again." onRetry={() => void load(id)} />
      </AppFrame>
    )
  }
  const content = project.type === 'set'
    ? photoView
      ? <PhotoWorkspace key="set-photo" />
      : <SetWorkspace key="set" preferredPersonId={preferredPersonId} preferredPersonLook={preferredPersonLook} />
    : project.type === 'photo'
      ? <PhotoWorkspace key="photo" />
      : photoView
        ? <PhotoWorkspace key="image-photo" />
        : <CreateWorkspace key="image" preferredPersonLook={preferredPersonLook} />

  return (
    <AppFrame backTo={backTo} titleContent={titleContent}>
      {content}
    </AppFrame>
  )
}
