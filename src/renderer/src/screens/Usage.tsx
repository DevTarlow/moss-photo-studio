import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Download } from 'lucide-react'
import type { UsageEvent, UsageSummary } from '@shared/types'
import { AppFrame } from '../components/ui/AppFrame'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Pagination } from '../components/ui/Pagination'
import { Skeleton } from '../components/ui/Skeleton'
import { useAppStore } from '../store/app'
import { unwrap, messageOf } from '../lib/ipc'
import { usd, monthLabel, shortMonthLabel, formatDateTime } from '../lib/format'
import { toast } from '../lib/toast'
import { currentMonth } from '../store/library'
import { errorMessage } from '@shared/errors'
import { COLLECTION_PAGE_SIZE } from '@shared/constants'
import { Button, Card, Heading, ProgressBar, Selector, Text, TextInput } from '@astryxdesign/core'

function lastMonths(count: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

const actionLabels = { create: 'Create', set: 'Set', edit: 'Edit', adjust: 'Adjust', listing: 'Listing copy', analyze: 'Photo read', cutout: 'Cutout' } as const

function microsLabel(micros: number): string {
  if (micros <= 0) return 'Under a cent'
  return `$${(micros / 1_000_000).toFixed(4)}`
}

export function Usage(): React.JSX.Element {
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [month, setMonth] = useState(currentMonth())
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [projectPage, setProjectPage] = useState(1)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [budget, setBudget] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const months = useMemo(() => lastMonths(12), [])

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [nextSummary, list] = await Promise.all([
        unwrap(window.moss.usage.summary({ month })),
        unwrap(window.moss.usage.list({ month, limit: COLLECTION_PAGE_SIZE, offset: 0 }))
      ])
      setSummary(nextSummary)
      setEvents(list.items)
      setTotal(list.total)
      setPage(1)
      setProjectPage(1)
      setBudget(nextSummary.budgetCents === null ? '' : (nextSummary.budgetCents / 100).toFixed(2))
    } catch {
      setError('Could not load usage. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [month])

  const goToPage = async (requestedPage: number): Promise<void> => {
    setLoadingEvents(true)
    try {
      const listAt = (target: number) =>
        unwrap(window.moss.usage.list({
          month,
          limit: COLLECTION_PAGE_SIZE,
          offset: (target - 1) * COLLECTION_PAGE_SIZE
        }))
      let next = await listAt(requestedPage)
      const pages = Math.max(1, Math.ceil(next.total / COLLECTION_PAGE_SIZE))
      const target = Math.min(Math.max(1, requestedPage), pages)
      if (target !== requestedPage) next = await listAt(target)
      setEvents(next.items)
      setTotal(next.total)
      setPage(target)
    } catch {
      toast.error('Could not load that usage page.')
    } finally {
      setLoadingEvents(false)
    }
  }

  const exportCsv = async (): Promise<void> => {
    try {
      const result = await unwrap(window.moss.usage.exportCsv({ month }))
      if (result.saved) toast.status('Usage CSV exported.')
    } catch (caught) {
      toast.error(messageOf(caught))
    }
  }

  const saveBudget = async (): Promise<void> => {
    setSavingBudget(true)
    try {
      const trimmed = budget.trim().replace(/^\$/, '')
      if (!trimmed) {
        await unwrap(window.moss.settings.set({ key: 'budgetCents', value: null }))
      } else {
        const dollars = Number(trimmed)
        if (!Number.isFinite(dollars) || dollars < 0) {
          toast.error('Enter a monthly limit in dollars, or leave it empty.')
          return
        }
        await unwrap(window.moss.settings.set({ key: 'budgetCents', value: Math.round(dollars * 100) }))
      }
      await refreshSettings()
      toast.status('Monthly limit saved.')
      await load()
    } catch {
      toast.error('The monthly limit could not be saved.')
    } finally {
      setSavingBudget(false)
    }
  }

  const budgetCents = summary?.budgetCents ?? null
  const maxProject = Math.max(1, ...(summary?.projects.map((project) => project.spendCents) ?? [0]))
  const visibleProjects = (summary?.projects ?? []).slice(
    (projectPage - 1) * COLLECTION_PAGE_SIZE,
    projectPage * COLLECTION_PAGE_SIZE
  )

  return (
    <AppFrame>
      <div className="page-scroll">
        <div className="page-pad page-max">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <Heading level={1}>Usage</Heading>
              <Text type="supporting" color="secondary">Images that came back, and what they cost.</Text>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Selector
                label="Month"
                isLabelHidden
                value={month}
                onChange={setMonth}
                options={months.map((value) => ({ value, label: shortMonthLabel(value) }))}
                width={130}
              />
              <Button label="Export CSV" variant="secondary" icon={<Download size={15} />} onClick={() => void exportCsv()} />
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : (
            <>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <Card padding={4}>
                  <Text type="label" color="secondary" className="block">Images made</Text>
                  <Text weight="bold" className="mt-2 block tabular" style={{ fontSize: 24 }}>{summary?.images ?? 0}</Text>
                  <Text type="supporting" color="secondary" className="block">{monthLabel(month)} · one cent per returned image</Text>
                </Card>
                <Card padding={4}>
                  <Text type="label" color="secondary" className="block">Spent</Text>
                  <Text weight="bold" className="mt-2 block tabular" style={{ fontSize: 24 }}>{usd(summary?.spendCents ?? 0)}</Text>
                  <Text type="supporting" color="secondary" className="block">Images that came back</Text>
                  {(summary?.textMicros ?? 0) > 0 && (
                    <Text type="supporting" color="secondary" className="block">Listing text: {microsLabel(summary!.textMicros)}</Text>
                  )}
                </Card>
                <Card padding={4}>
                  <Text type="label" color="secondary" className="block">Budget</Text>
                  {budgetCents === null ? (
                    <Text weight="bold" className="mt-2 block">No monthly limit</Text>
                  ) : (
                    <>
                      <Text weight="bold" className="mt-2 block tabular">{usd(summary?.spendCents ?? 0)} of {usd(budgetCents)}</Text>
                      <div className="mt-2">
                        <ProgressBar
                          value={Math.min(summary?.spendCents ?? 0, budgetCents)}
                          max={budgetCents}
                          label={`${usd(summary?.spendCents ?? 0)} of ${usd(budgetCents)} used this month`}
                          hasValueLabel
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex items-end gap-2">
                    <div className="w-[130px]">
                      <TextInput
                        id="budget"
                        label="Budget in dollars"
                        isLabelHidden
                        value={budget}
                        onChange={setBudget}
                        placeholder="No limit"
                        width="100%"
                      />
                    </div>
                    <Button
                      label={savingBudget ? 'Saving...' : 'Save Limit'}
                      variant="primary"
                      size="sm"
                      isLoading={savingBudget}
                      isDisabled={savingBudget}
                      onClick={() => void saveBudget()}
                    />
                  </div>
                  <Text type="supporting" color="secondary" className="mt-2 block">A limit inside the app. Empty means no limit.</Text>
                </Card>
              </div>

              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="section-label">By project</h2>
                  <span className="meta-faint">{monthLabel(month)}</span>
                </div>
                <div className="card mt-2 overflow-hidden">
                  {(summary?.projects.length ?? 0) === 0 ? (
                    <p className="meta p-4">Nothing yet this month.</p>
                  ) : (
                    visibleProjects.map((project) => (
                      <div key={`${project.projectId}-${project.name}`} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                        {project.projectId ? (
                          <Link to={`/project/${project.projectId}`} className="min-w-[160px] max-w-[260px] truncate text-[12px] font-medium">{project.name}</Link>
                        ) : (
                          <span className="min-w-[160px] max-w-[260px] truncate text-[12px] font-medium">{project.name}</span>
                        )}
                        <div className="hidden flex-1 md:block">
                          <div className="meter" aria-hidden><span style={{ width: `${(project.spendCents / maxProject) * 100}%` }} /></div>
                        </div>
                        <span className="meta tabular">{project.images} {project.images === 1 ? 'image' : 'images'}</span>
                        <span className="w-[70px] text-right text-[12px] font-semibold tabular">{usd(project.spendCents)}</span>
                      </div>
                    ))
                  )}
                </div>
                <Pagination
                  page={projectPage}
                  total={summary?.projects.length ?? 0}
                  onPage={setProjectPage}
                  label="Project usage pages"
                />
              </section>

              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="section-label">Full ledger</h2>
                  <span className="meta-faint">{total} {total === 1 ? 'row' : 'rows'}</span>
                </div>
                {events.length === 0 ? (
                  <EmptyState icon={<BarChart3 size={22} />} title="No images made yet" line="Your runs and their cost show up here." />
                ) : (
                  <div className="card mt-2 overflow-x-auto">
                    <table className="w-full min-w-[780px] border-collapse text-left">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          {['Date', 'Project', 'Action', 'Images', 'Cost', 'Duration', 'Result'].map((heading) => (
                            <th key={heading} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-faint)' }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((event) => {
                          const failed = event.result === 'failed'
                          return (
                            <tr key={event.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                              <td className="whitespace-nowrap px-3 py-2 text-[12px]" title={new Date(event.at).toISOString()}>{formatDateTime(event.at)}</td>
                              <td className="max-w-[180px] truncate px-3 py-2 text-[12px]">{event.projectName || 'Deleted project'}</td>
                              <td
                                className="whitespace-nowrap px-3 py-2 text-[12px]"
                                style={{ color: failed ? 'var(--danger)' : 'var(--text)' }}
                                title={failed && event.errorCode ? errorMessage(event.errorCode as never) : undefined}
                              >
                                {failed ? 'Failed' : actionLabels[event.action]}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular">
                                {event.returned === event.requested ? event.returned : `${event.returned} of ${event.requested}`}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular">
                                {event.uncertainBilling ? 'Unknown' : event.action === 'adjust' ? 'Free' : event.action === 'listing' || event.action === 'analyze' || event.action === 'cutout' ? microsLabel(event.costMicros) : usd(event.costCents)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular">
                                {event.durationMs === null ? '-' : `${(event.durationMs / 1000).toFixed(1)}s`}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-[12px]">
                                <span className="badge" data-tone={failed ? 'danger' : 'success'}>
                                  {failed ? 'Failed' : 'Made'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  page={page}
                  total={total}
                  onPage={(next) => void goToPage(next)}
                  busy={loadingEvents}
                  label="Ledger pages"
                />
              </section>

            </>
          )}
        </div>
      </div>
    </AppFrame>
  )
}
