import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import type { Person } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { Dialog } from '../components/ui/Dialog'
import { Dropzone } from '../components/ui/Dropzone'
import { Field } from '../components/ui/Field'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { fileToBytes } from '../lib/files'
import { toast } from '../lib/toast'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { DropdownMenu } from 'radix-ui'

function PersonCard({
  person,
  onOpen,
  onRename,
  onDelete
}: {
  person: Person
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <div className="card card-hover group relative overflow-hidden">
      <button type="button" className="block w-full cursor-zoom-in" onClick={onOpen} aria-label={`Open ${person.name} larger`}>
        <img src={person.portraitUrl} alt="" className="aspect-square w-full object-cover" />
      </button>
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}</p>
        <p className="meta mt-0.5">Used in {person.usedIn} {person.usedIn === 1 ? 'image' : 'images'}</p>
        {person.blurb && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>{person.blurb}</p>}
      </div>
      {person.source === 'user' && onRename && onDelete && (
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn" style={{ background: 'var(--surface)' }} aria-label={`Actions for ${person.name}`}>
                ⋯
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                <DropdownMenu.Item className="menu-item" onSelect={onRename}>Rename</DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>Delete</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}

export function People(): React.JSX.Element {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const people = useAppStore((state) => state.people)
  const refreshPeople = useAppStore((state) => state.refreshPeople)
  const [previewPerson, setPreviewPerson] = useState<Person | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Person | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(people.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [yoursPage, setYoursPage] = useState(1)

  const loadPeople = async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      await refreshPeople()
    } catch {
      setLoadError('Could not load people. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPeople()
  }, [])

  const included = people.filter((person) => person.source === 'bundled')
  const yours = people.filter((person) => person.source === 'user')
  const visibleYours = yours.slice((yoursPage - 1) * COLLECTION_PAGE_SIZE, yoursPage * COLLECTION_PAGE_SIZE)

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(yours.length / COLLECTION_PAGE_SIZE))
    if (yoursPage > pages) setYoursPage(pages)
  }, [yours.length, yoursPage])

  const addWithPicker = async (): Promise<void> => {
    if (!name.trim()) {
      setError('Give the person a name first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await unwrap(window.moss.dialogs.importImage({ kind: 'person', name: name.trim() }))
      if (result?.personId) {
        await refreshPeople()
        setAddOpen(false)
        setName('')
        toast.status('Person added.')
      }
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const addWithFile = async (file: File): Promise<void> => {
    if (!name.trim()) {
      setError('Give the person a name first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await unwrap(window.moss.people.create({
        name: name.trim(),
        bytes: await fileToBytes(file),
        mime: file.type
      }))
      await refreshPeople()
      setAddOpen(false)
      setName('')
      toast.status('Person added.')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (person: Person): Promise<void> => {
    const ok = await confirm({
      title: `Remove ${person.name}?`,
      body: `Removing ${person.name} doesn't delete the images ${person.name} is in.`,
      confirmLabel: 'Remove Person',
      danger: true
    })
    if (!ok) return
    try {
      await unwrap(window.moss.people.delete({ id: person.id }))
      await refreshPeople()
      toast.status('Person removed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const startSet = (): void => {
    if (!previewPerson) return
    const personId = previewPerson.id
    setPreviewPerson(null)
    navigate(`/library?new=set&person=${encodeURIComponent(personId)}`)
  }

  const createImage = async (): Promise<void> => {
    if (!previewPerson) return
    const person = previewPerson
    setPreviewPerson(null)
    try {
      const result = await unwrap(window.moss.people.createImageProject({ id: person.id }))
      navigate(`/project/${result.projectId}`)
    } catch {
      toast.error('That image project could not be created.')
    }
  }

  const rename = async (): Promise<void> => {
    if (!renaming || !renameValue.trim()) return
    try {
      await unwrap(window.moss.people.rename({ id: renaming.id, name: renameValue.trim() }))
      await refreshPeople()
      setRenaming(null)
      toast.status('Person renamed.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="page-title">People</h1>
              <p className="meta">The people you can put your products on.</p>
            </div>
            <Button className="ml-auto" variant="primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={16} /> Add a Person
            </Button>
          </div>

          {loadError && people.length === 0 ? (
            <ErrorState message={loadError} onRetry={() => void loadPeople()} />
          ) : loading && people.length === 0 ? (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="aspect-[4/5]" />)}
            </div>
          ) : people.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="No people yet"
              line="Add a person to put your products on someone."
              action={<Button variant="primary" onClick={() => setAddOpen(true)}>Add a Person</Button>}
            />
          ) : (
          <>
          <section className="mt-8" aria-labelledby="included-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="included-heading" className="section-label">Included</h2>
              <span className="meta-faint">{included.length}</span>
            </div>
            <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {included.map((person) => (
                <PersonCard key={person.id} person={person} onOpen={() => setPreviewPerson(person)} />
              ))}
            </div>
            <p className="hint mt-3">Synthetic reference people made for Moss. They are not photographs of real people.</p>
          </section>

          <section className="mt-8" aria-labelledby="yours-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="yours-heading" className="section-label">Yours</h2>
              <span className="meta-faint">{yours.length}</span>
            </div>
            {yours.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={<Users size={22} />}
                  title="Add your own person"
                  line="Add the person you want in your photos. One clear portrait, reused in every set."
                  action={<Button variant="secondary" onClick={() => setAddOpen(true)}>Add a Person</Button>}
                />
              </div>
            ) : (
              <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                {visibleYours.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onOpen={() => setPreviewPerson(person)}
                    onRename={() => { setRenaming(person); setRenameValue(person.name) }}
                    onDelete={() => void remove(person)}
                  />
                ))}
              </div>
            )}
            <Pagination
              page={yoursPage}
              total={yours.length}
              onPage={setYoursPage}
              label="Your people pages"
            />
          </section>
          </>
          )}
        </div>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => { setAddOpen(open); if (!open) { setError(null); setName('') } }}
        title="Add a person"
        description="One person, one clear portrait. The person is reused in every set and does not need to be added again."
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void addWithPicker()}>
              {busy ? 'Opening...' : 'Choose a Photo'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Maya"
            autoFocus
          />
          <Dropzone
            compact
            line="A portrait with the face visible."
            hint="JPEG, PNG or WebP. Up to 20 MB."
            onClick={() => void addWithPicker()}
            onFiles={(files) => { const file = files[0]; if (file) void addWithFile(file) }}
            label="Choose a Photo"
          />
          {error && <p className="error-text" role="alert">{error}</p>}
          <p className="hint">A clear portrait, no sunglasses, one person in the frame.</p>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => { if (!open) setRenaming(null) }}
        title="Rename person"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void rename()}>Save Name</Button>
          </>
        }
      >
        <Field label="Name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus maxLength={80} />
      </Dialog>

      <Dialog
        open={Boolean(previewPerson)}
        onOpenChange={(open) => { if (!open) setPreviewPerson(null) }}
        title={previewPerson ? `${previewPerson.name}${previewPerson.ageBand ? ` · ${previewPerson.ageBand}` : ''}` : 'Person'}
        description={previewPerson?.blurb ?? undefined}
        width={520}
        footer={<Button variant="ghost" onClick={() => setPreviewPerson(null)}>Close</Button>}
      >
        {previewPerson && (
          <>
            <img
              src={previewPerson.portraitUrl}
              alt={`${previewPerson.name} portrait`}
              className="mx-auto max-h-[60vh] w-full rounded-[12px] object-contain"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={startSet}>Create a Set</Button>
              <Button variant="secondary" onClick={() => void createImage()}>Create an Image</Button>
            </div>
            <p className="hint mt-2">A set preselects this person for On a person shots. An image starts the Image Generator with this portrait as its reference.</p>
          </>
        )}
      </Dialog>
    </AppFrame>
  )
}
