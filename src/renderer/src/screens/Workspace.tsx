import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppFrame } from '../components/ui/AppFrame'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { ProjectNameEditor } from '../components/workspace/ProjectNameEditor'
import { useWorkspaceStore } from '../store/workspace'
import { PhotoWorkspace } from '../features/photo/PhotoWorkspace'
import { CreateWorkspace } from '../features/create/CreateWorkspace'

export function Workspace(): React.JSX.Element {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const project = useWorkspaceStore((state) => state.project)
  const error = useWorkspaceStore((state) => state.error)
  const load = useWorkspaceStore((state) => state.load)
  const selectImage = useWorkspaceStore((state) => state.selectImage)
  const imageParam = params.get('image')
  const view = params.get('view')
  const fromSet = params.get('fromSet')
  const photoView = view === 'photo'
  const projectForRoute = project && project.id === id ? project : null
  const preferredPersonLook = params.get('look') ?? projectForRoute?.personLook ?? null

  useEffect(() => {
    if (!id) return
    void load(id, imageParam ?? undefined)
    // A different project is the only time the whole workspace reloads.
  }, [id])

  useEffect(() => {
    if (imageParam) selectImage(imageParam)
  }, [imageParam, selectImage])

  const titleContent = projectForRoute ? <ProjectNameEditor /> : undefined
  const backTo = fromSet
    ? `/sets/${fromSet}`
    : projectForRoute?.productId
      ? `/product/${projectForRoute.productId}`
      : '/library'
  const backLabel = fromSet ? 'Back to Set' : projectForRoute?.productId ? 'Back to Product' : 'Back to All Work'
  if (!id) {
    return (
      <AppFrame backTo="/products" backLabel="Back to Products">
        <ErrorState message="That project is not here anymore." onRetry={() => navigate('/library')} />
      </AppFrame>
    )
  }
  if (!projectForRoute) {
    if (error) {
      return (
        <AppFrame backTo="/products" backLabel="Back to Products">
          <ErrorState message={error} onRetry={() => void load(id)} />
        </AppFrame>
      )
    }
    return (
      <AppFrame backTo="/products" backLabel="Back to Products">
        <div className="flex h-full gap-4 p-4">
          <Skeleton className="h-full w-[300px]" />
          <Skeleton className="h-full flex-1" />
          <Skeleton className="h-full w-[280px]" />
        </div>
      </AppFrame>
    )
  }
  const content = projectForRoute.type === 'photo'
    ? <PhotoWorkspace key={`photo-${projectForRoute.id}`} />
    : photoView
      ? <PhotoWorkspace key={`image-photo-${projectForRoute.id}`} />
      : <CreateWorkspace key={`create-${projectForRoute.id}`} preferredPersonLook={preferredPersonLook} />

  return (
    <AppFrame backTo={backTo} backLabel={backLabel} titleContent={titleContent}>
      {content}
    </AppFrame>
  )
}
