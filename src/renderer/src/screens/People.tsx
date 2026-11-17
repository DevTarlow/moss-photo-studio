import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, UserPlus, Users } from 'lucide-react'
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
import { Heading, Icon, Selector, Text, TextInput, ToggleButton, ToggleButtonGroup } from '@astryxdesign/core'

function PersonCard({
  person,
  onOpen,
  onRename,
  onDelete,
  compact = false
}: {
  person: Person
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
  compact?: boolean
}): React.JSX.Element {
  return (
    <div className="card card-hover group relative overflow-hidden">
      <button type="button" className="block w-full cursor-zoom-in" onClick={onOpen} aria-label={`Open ${person.name} larger`}>
        <img src={person.portraitUrl} alt="" className="aspect-square w-full object-cover" />
      </button>
      <div className={compact ? 'p-2' : 'p-3'}>
        <p className="truncate text-[13px] font-semibold">{person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}</p>
        <p className="meta mt-0.5">Used in {person.usedIn} {person.usedIn === 1 ? 'image' : 'images'}</p>
        {!compact && person.blurb && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>{person.blurb}</p>}
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
  const [selectedLookKey, setSelectedLookKey] = useState<string | null>(null)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const canUseStudio = useAppStore((state) => state.canUseStudio)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Person | null>(null)
  const [creatingPerson, setCreatingPerson] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(people.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [yoursPage, setYoursPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'default' | 'name' | 'used'>('default')
  const [age, setAge] = useState<'all' | '20s' | '30s+'>('all')

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

  useEffect(() => {
    setSelectedLookKey(null)
    setImagePreviewOpen(false)
  }, [previewPerson?.id])

  const previewLook = previewPerson?.looks.find((look) => look.key === selectedLookKey) ?? null

  const ageMatches = (person: Person): boolean => {
    if (age === 'all') return true
    const years = Number(person.ageBand?.replace(/[^0-9]/g, '') ?? '')
    if (!Number.isFinite(years)) return false
    return age === '20s' ? years === 20 : years >= 30
  }
  const matching = people.filter(
    (person) => person.name.toLowerCase().includes(search.trim().toLowerCase()) && ageMatches(person)
  )
  const sortPeople = (list: Person[]): Person[] => {
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'used') return [...list].sort((a, b) => b.usedIn - a.usedIn || a.name.localeCompare(b.name))
    return list
  }
  const included = sortPeople(matching.filter((person) => person.source === 'bundled'))
  const yours = sortPeople(matching.filter((person) => person.source === 'user'))
  const visibleYours = yours.slice((yoursPage - 1) * COLLECTION_PAGE_SIZE, yoursPage * COLLECTION_PAGE_SIZE)

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(yours.length / COLLECTION_PAGE_SIZE))
    if (yoursPage > pages) setYoursPage(pages)
  }, [yours.length, yoursPage])

  useEffect(() => {
    setYoursPage(1)
  }, [search, sort, age])

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

  const createImage = async (): Promise<void> => {
    if (!previewPerson) return
    const person = previewPerson
    const look = previewLook?.key
    setPreviewPerson(null)
    try {
      const result = await unwrap(window.moss.people.createImageProject({ id: person.id, look }))
      navigate(`/project/${result.projectId}`)
    } catch {
      toast.error('That image project could not be created.')
    }
  }

  const createPerson = async (): Promise<void> => {
    setCreatingPerson(true)
    try {
      const detail = await unwrap(window.moss.projects.create({
        type: 'image',
        name: 'New person',
        draft: true
      }))
      navigate(`/project/${detail.project.id}?createPerson=1`)
    } catch {
      toast.error('A new person could not be started.')
    } finally {
      setCreatingPerson(false)
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
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <Heading level={1}>People</Heading>
              <Text type="supporting" color="secondary" className="block">
                {search.trim()
                  ? `Showing ${matching.length} of ${people.length}`
                  : `${included.length} starter people · ${yours.length} of yours`}
              </Text>
              <Text type="supporting" color="secondary" className="block">People you can add to your product photos.</Text>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" disabled={creatingPerson || !canUseStudio} onClick={() => void createPerson()}>
                <Icon icon={Sparkles} size="sm" /> Generate Person Photo
              </Button>
              <Button variant="primary" disabled={!canUseStudio} onClick={() => setAddOpen(true)}>
                <Icon icon={UserPlus} size="sm" /> Add Portrait
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1 md:max-w-[340px]">
              <TextInput
                label="Search people"
                isLabelHidden
                value={search}
                onChange={setSearch}
                placeholder="Search people"
                startIcon={<Icon icon={Search} size="sm" />}
                hasClear
                width="100%"
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <ToggleButtonGroup
                type="single"
                label="Cast by age"
                value={age}
                onChange={(value) => { if (value) setAge(value as 'all' | '20s' | '30s+') }}
              >
                <ToggleButton value="all" label="All" size="sm" />
                <ToggleButton value="20s" label="20s" size="sm" />
                <ToggleButton value="30s+" label="30s+" size="sm" />
              </ToggleButtonGroup>
              <Selector
                label="Sort people"
                isLabelHidden
                value={sort}
                onChange={(value) => { if (value) setSort(value as 'default' | 'name' | 'used') }}
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'name', label: 'Name' },
                  { value: 'used', label: 'Most used' }
                ]}
                width={160}
              />
            </div>
          </div>

          {loadError && people.length === 0 ? (
            <ErrorState message={loadError} onRetry={() => void loadPeople()} />
          ) : loading && people.length === 0 ? (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="aspect-[4/5]" />)}
            </div>
          ) : people.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Users} size="lg" />}
              title="No people yet"
              line="Add a person to put your products on someone."
            />
          ) : matching.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Search} size="lg" />}
              title={`No people match "${search.trim()}".`}
              line="Try a different name."
              action={<Button variant="secondary" onClick={() => setSearch('')}>Clear Search</Button>}
            />
          ) : (
          <>
          <section className="mt-8" aria-labelledby="yours-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="yours-heading" className="section-label">Your People</h2>
              <span className="meta-faint">{yours.length}</span>
            </div>
            {yours.length === 0 ? (
              <Text type="supporting" color="secondary" className="mt-1 block">
                Add a portrait to keep your own person first in this list.
              </Text>
            ) : (
              <div className="people-grid mt-3">
                {visibleYours.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    compact
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

          <section className="mt-8" aria-labelledby="included-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="included-heading" className="section-label">Starter People</h2>
              <span className="meta-faint">{included.length}</span>
            </div>
            <div className="people-grid mt-3">
              {included.map((person) => (
                <PersonCard key={person.id} person={person} compact onOpen={() => setPreviewPerson(person)} />
              ))}
            </div>
            <p className="hint mt-3">Starter people made for Moss. They are not photographs of real people.</p>
          </section>
          </>
          )}
        </div>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => { setAddOpen(open); if (!open) { setError(null); setName('') } }}
        title="Add a Portrait"
        description="One person, one clear portrait. The person is reused in edits and images and does not need to be added again."
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void addWithPicker()}>
              {busy ? 'Opening...' : 'Choose a Portrait'}
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
            label="Choose a Portrait"
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
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPerson(null)
            setImagePreviewOpen(false)
          }
        }}
        title={previewPerson ? `${previewPerson.name}${previewPerson.ageBand ? ` · ${previewPerson.ageBand}` : ''}` : 'Person'}
        description={previewPerson?.blurb ?? undefined}
        width={520}
        footer={<Button variant="ghost" onClick={() => setPreviewPerson(null)}>Close</Button>}
      >
        {previewPerson && (
          <>
            <button
              type="button"
              className="mx-auto block w-full cursor-zoom-in rounded-[12px] border-0 bg-transparent p-0 hover:opacity-95"
              aria-label={`Open ${previewPerson.name}${previewLook ? ` ${previewLook.label}` : ''} larger`}
              onClick={() => setImagePreviewOpen(true)}
            >
              <img
                src={previewLook?.url ?? previewPerson.defaultImageUrl}
                alt=""
                className="mx-auto max-h-[42vh] w-full rounded-[12px] object-contain"
              />
            </button>
            {previewPerson.looks.length > 0 && (
              <>
                <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label={`Photos of ${previewPerson.name}`}>
                  {previewPerson.looks.map((look) => {
                    const active = look.key === previewLook?.key
                    return (
                      <button
                        key={look.key}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Use ${look.label} for ${previewPerson.name}`}
                        onClick={() => setSelectedLookKey(look.key)}
                        className="cursor-pointer overflow-hidden rounded-[10px] border-2 bg-transparent p-0 transition-colors"
                        style={{ borderColor: active ? 'var(--accent)' : 'var(--border)' }}
                      >
                        <img src={look.url} alt="" className="aspect-square w-full object-cover object-top" />
                      </button>
                    )
                  })}
                </div>
                <p className="hint mt-2" aria-live="polite">
                  {previewLook
                    ? `${previewLook.label} sets the pose and framing for the next image. ${previewLook.hint ?? ''}`
                    : 'The original photo is used. Choose a studio angle to set the pose and framing.'}
                  {previewLook && (
                    <>
                      {' '}
                      <button type="button" className="underline" onClick={() => setSelectedLookKey(null)}>
                        Use the original
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void createImage()}>Make an Image with This Person</Button>
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        open={imagePreviewOpen}
        onOpenChange={setImagePreviewOpen}
        title={previewPerson ? `${previewPerson.name}${previewLook ? ` · ${previewLook.label}` : ''}` : 'Person photo'}
        width={860}
        footer={<Button variant="secondary" onClick={() => setImagePreviewOpen(false)}>Close</Button>}
      >
        {previewPerson && (
          <img
            src={previewLook?.url ?? previewPerson.defaultImageUrl}
            alt={`${previewPerson.name}${previewLook ? ` ${previewLook.label}` : ''}`}
            className="mx-auto max-h-[78vh] w-full rounded-[12px] object-contain"
          />
        )}
      </Dialog>
    </AppFrame>
  )
}
