import { AlertCircle } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({
  message,
  onRetry
}: {
  message: string
  onRetry?: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <AlertCircle size={28} style={{ color: 'var(--danger)' }} aria-hidden />
      <p className="mt-3 font-semibold">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}
