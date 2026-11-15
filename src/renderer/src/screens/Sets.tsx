import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus } from 'lucide-react'
import { Heading, Icon, Text } from '@astryxdesign/core'
import type { SetSummary } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { SetNameDialog } from '../components/sets/SetNameDialog'
import { unwrap, messageOf } from '../lib/ipc'
import { toast } from '../lib/toast'

export function Sets(): React.JSX.Element {
  const navigate = useNavigate()
  const [sets, setSets] = useState<SetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setSets(await unwrap(window.moss.sets.list()))
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async (name: string): Promise<void> => {
    const created = await unwrap(window.moss.sets.create({ name }))
    setSets((current) => [created, ...current])
    toast.status(`Set "${created.name}" created.`)
  }

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <Heading level={1}>Sets</Heading>
              <Text type="supporting" color="secondary" className="block">
                Keep related images together, ready to revisit or export all at once.
              </Text>
            </div>
            <div className="ml-auto">
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Icon icon={Plus} size="sm" /> New Set
              </Button>
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : loading ? (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[4/3]" />)}
            </div>
          ) : sets.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Layers} size="lg" />}
              title="No Sets yet"
              line="Open any image and choose Save to Set, or create a Set now and add images later."
              action={<Button variant="secondary" onClick={() => setCreateOpen(true)}>New Set</Button>}
            />
          ) : (
            <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {sets.map((set) => (
                <article key={set.id} className="card card-hover overflow-hidden">
                  <button
                    type="button"
                    className="block w-full cursor-pointer bg-transparent p-0 text-left"
                    onClick={() => navigate(`/sets/${set.id}`)}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      {set.coverUrl ? (
                        <img src={set.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center" style={{ color: 'var(--text-faint)' }}>
                          <Icon icon={Layers} size="lg" />
                        </div>
                      )}
                      <span className="badge absolute right-2 top-2">{set.imageCount}</span>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-[13px] font-semibold">{set.name}</p>
                      <p className="meta mt-0.5">{set.imageCount} {set.imageCount === 1 ? 'image' : 'images'}</p>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <SetNameDialog
        open={createOpen}
        title="New Set"
        submitLabel="Create Set"
        onOpenChange={setCreateOpen}
        onSubmit={create}
      />
    </AppFrame>
  )
}
