import { Layers } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { SetSummary } from '@shared/types'

export function SetCard({ set, onOpen }: { set: SetSummary; onOpen: () => void }): React.JSX.Element {
  return (
    <article className="card card-hover overflow-hidden">
      <button
        type="button"
        className="block w-full cursor-pointer bg-transparent p-0 text-left"
        onClick={onOpen}
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
  )
}
