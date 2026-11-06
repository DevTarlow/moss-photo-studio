import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'

interface State {
  error: Error | null
  code: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, code: '' }

  static getDerivedStateFromError(error: Error): State {
    return { error, code: `E-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The renderer has no telemetry. The code is shown so the seller can quote
    // it; the images stay on disk and are untouched by a render crash.
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h1 className="page-title">Something went wrong. Your images are safe.</h1>
        <p className="meta mt-2">Reload the studio. If this keeps happening, quote code {this.state.code}.</p>
        <Button className="mt-5" variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }
}
