import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  line,
  action
}: {
  icon: ReactNode
  title: string
  line?: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
        {icon}
      </div>
      <h2 className="empty-title mt-4">{title}</h2>
      {line && <p className="meta mt-1 max-w-[380px]">{line}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
