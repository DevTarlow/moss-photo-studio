import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command as CommandIcon, CornerDownLeft, Search } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Project } from '@shared/types'
import { unwrap } from '../../lib/ipc'
import { useAppStore } from '../../store/app'
import { useUiStore } from '../../store/ui'
import { emitCommand } from '../../lib/commands'
import { toast } from '../../lib/toast'
import { Dialog } from './Dialog'

interface PaletteItem {
  id: string
  group: 'Projects' | 'Actions' | 'People' | 'Settings'
  label: string
  hint?: string
  run: () => void | Promise<void>
}

function fuzzy(haystack: string, needle: string): boolean {
  if (!needle) return true
  const hay = haystack.toLowerCase()
  const query = needle.toLowerCase()
  if (hay.includes(query)) return true
  let index = 0
  for (const char of query) {
    index = hay.indexOf(char, index)
    if (index === -1) return false
    index += 1
  }
  return true
}

export function CommandPalette(): React.JSX.Element {
  const open = useUiStore((state) => state.paletteOpen)
  const setOpen = useUiStore((state) => state.setPalette)
  const navigate = useNavigate()
  const people = useAppStore((state) => state.people)
  const settings = useAppStore((state) => state.settings)
  const setTheme = useAppStore((state) => state.setTheme)
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    void unwrap(window.moss.projects.list({ limit: 100, sort: 'recent' }))
      .then((result) => setProjects(result.items))
      .catch(() => setProjects([]))
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  const go = (to: string): void => {
    setOpen(false)
    navigate(to)
  }

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = []
    for (const project of projects) {
      list.push({
        id: `project-${project.id}`,
        group: 'Projects',
        label: project.name,
        hint: project.type === 'set' ? 'Set' : project.type === 'photo' ? 'Image Editor' : 'Image Generator',
        run: () => go(`/project/${project.id}`)
      })
    }
    list.push(
      {
        id: 'new-set',
        group: 'Actions',
        label: 'New Set',
        hint: 'One photo in, a full set out',
        run: () => go('/library?new=set')
      },
      {
        id: 'new-photo',
        group: 'Actions',
        label: 'New Image Editor',
        hint: 'Change a photo you have',
        run: () => go('/library?new=photo')
      },
      {
        id: 'new-image',
        group: 'Actions',
        label: 'New Image Generator',
        hint: 'Describe a picture and make it',
        run: async () => {
          const detail = await unwrap(window.moss.projects.create({ type: 'image', draft: true }))
          setOpen(false)
          navigate(`/project/${detail.project.id}`)
        }
      },
      {
        id: 'listing-kit',
        group: 'Actions',
        label: 'Open Listing Kit',
        hint: 'Pack a product, set, or image',
        run: () => go('/listing-kit')
      },
      {
        id: 'export-current',
        group: 'Actions',
        label: 'Export current project',
        run: () => {
          setOpen(false)
          if (!window.location.hash.includes('/project/')) {
            toast.error('Open a project to export it.')
            return
          }
          emitCommand('export')
        }
      },
      {
        id: 'usage',
        group: 'Actions',
        label: 'Open Usage',
        run: () => go('/usage')
      },
      {
        id: 'products',
        group: 'Actions',
        label: 'Open Products',
        hint: 'Reusable product photos',
        run: () => go('/products')
      },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Toggle theme',
        hint: settings?.theme === 'dark' ? 'Switch to light' : 'Switch to dark',
        run: async () => {
          setOpen(false)
          await setTheme(settings?.theme === 'dark' ? 'light' : 'dark').catch(() => toast.error('The theme could not be changed.'))
        }
      }
    )
    for (const person of people) {
      list.push({
        id: `person-${person.id}`,
        group: 'People',
        label: person.name,
        hint: person.ageBand ?? 'Yours',
        run: () => go('/people')
      })
    }
    ;[
      ['API key', '/settings/studio'],
      ['Logo & Colors', '/settings/brand'],
      ['Library', '/settings/library'],
      ['Appearance', '/settings/appearance'],
      ['License', '/settings/license'],
      ['Privacy', '/settings/privacy'],
      ['About', '/settings/about']
    ].forEach(([label, to]) => {
      list.push({
        id: `settings-${label}`,
        group: 'Settings',
        label: `Settings: ${label}`,
        run: () => go(to!)
      })
    })
    return list.filter((item) => fuzzy(`${item.label} ${item.hint ?? ''}`, query))
  }, [people, projects, query, settings?.theme, setOpen, setTheme, navigate])

  useEffect(() => {
    setActive((previous) => Math.min(previous, Math.max(0, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-palette-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  let lastGroup = ''
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Jump anywhere" hideClose width={560} className="p-0">
      <div className="-mt-2">
        <div className="flex items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)' }}>
          <Icon icon={Search} size="sm" style={{ color: 'var(--text-faint)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => Math.min(items.length - 1, value + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => Math.max(0, value - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const item = items[active]
                if (item) void item.run()
              }
            }}
            placeholder="Search projects, actions, people, settings"
            className="h-11 w-full border-0 bg-transparent text-[13px] outline-none"
            aria-label="Command palette search"
            aria-activedescendant={items[active]?.id}
            aria-controls="command-results"
            role="combobox"
            aria-expanded
          />
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            <Icon icon={CornerDownLeft} size="xsm" /> to open
          </span>
        </div>
        <div ref={listRef} id="command-results" role="listbox" className="max-h-[380px] overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Nothing matches that. Try a different word.
            </p>
          )}
          {items.map((item, index) => {
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            return (
              <div key={item.id}>
                {showGroup && <p className="section-label px-4 pb-1 pt-2">{item.group}</p>}
                <button
                  type="button"
                  id={item.id}
                  data-palette-index={index}
                  role="option"
                  aria-selected={index === active}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left"
                  style={{ background: index === active ? 'var(--surface-2)' : 'transparent' }}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => void item.run()}
                >
                  <Icon icon={CommandIcon} size="xsm" style={{ color: index === active ? 'var(--accent)' : 'var(--text-faint)' }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.label}</span>
                  {item.hint && <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{item.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
