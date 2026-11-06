import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Project } from '@shared/types'

const GRID_GAP = 20
const MIN_CARD_WIDTH = 240

/**
 * Above 200 projects the library mounts only the rows in and near the
 * viewport. Cards preserve their normal DOM and actions; the virtual rows
 * simply replace the full grid / list rendering.
 */
export function VirtualLibrary({
  items,
  view,
  scrollElement,
  renderCard
}: {
  items: Project[]
  view: 'grid' | 'list'
  scrollElement: RefObject<HTMLDivElement | null>
  renderCard: (project: Project, view: 'grid' | 'list') => ReactNode
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)
  const columns = view === 'list'
    ? 1
    : Math.max(1, Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)))
  const cardWidth = Math.max(0, (width - GRID_GAP * (columns - 1)) / columns)
  const estimateSize = view === 'list' ? 56 : Math.round(cardWidth * 0.75 + 72 + GRID_GAP)
  const rowCount = view === 'list' ? items.length : Math.ceil(items.length / columns)

  useLayoutEffect(() => {
    const element = rootRef.current
    if (!element) return
    const measure = (): void => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = rootRef.current
    if (element) setScrollMargin(element.offsetTop)
  }, [items.length, view, width])

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => estimateSize,
    overscan: 4,
    scrollMargin
  })

  return (
    <div ref={rootRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const rowItems = view === 'list'
          ? [items[row.index]].filter((item): item is Project => Boolean(item))
          : items.slice(row.index * columns, row.index * columns + columns)
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start - scrollMargin}px)`
            }}
          >
            <div
              style={view === 'grid'
                ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: GRID_GAP
                  }
                : undefined}
            >
              {rowItems.map((project) => (
                <div key={project.id} style={{ display: 'contents' }}>{renderCard(project, view)}</div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
