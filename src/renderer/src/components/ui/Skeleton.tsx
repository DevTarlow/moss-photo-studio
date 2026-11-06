export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div className={`skeleton ${className ?? ''}`} aria-hidden />
}

export function LibrarySkeleton(): React.JSX.Element {
  return (
    <div className="grid-library" aria-hidden>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index}>
          <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 10 }} />
          <div className="skeleton mt-3 h-3 w-2/3" />
          <div className="skeleton mt-2 h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  )
}
