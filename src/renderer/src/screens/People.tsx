import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import type { Person } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Dialog } from '../components/ui/Dialog'
import { Dropzone } from '../components/ui/Dropzone'
import { Field } from '../components/ui/Field'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { fileToBytes } from '../lib/files'
import { toast } from '../lib/toast'
import { DropdownMenu } from 'radix-ui'

function PersonCard({
  person,
  onRename,
  onDelete
}: {
  person: Person
  onRename?: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <div className="card card-hover group relative overflow-hidden">
      <img src={person.portraitUrl} alt="" className="aspect-square w-full object-cover" />
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
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Person | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    void refreshPeople()
  }, [refreshPeople])

  const included = people.filter((person) => person.source === 'bundled')
  const yours = people.filter((person) => person.source === 'user')

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

          <section className="mt-8" aria-labelledby="included-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="included-heading" className="section-label">Included</h2>
              <span className="meta-faint">{included.length}</span>
            </div>
            <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {included.map((person) => (
                <PersonCard key={person.id} person={person} />
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
                {yours.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onRename={() => { setRenaming(person); setRenameValue(person.name) }}
                    onDelete={() => void remove(person)}
                  />
                ))}
              </div>
            )}
          </section>
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
    </AppFrame>
  )
}
