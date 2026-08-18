import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * docs/02-architecture.md §5 — an unexpected render throw must not brick the app.
 * The boundary logs the stable code `[compass] E-RENDER` and offers a working
 * Start over, which resets the session state above it and clears the boundary.
 *
 * Nothing is swallowed: the error is logged with its code before the fallback
 * renders, so a QA console check still sees exactly one explained failure.
 */
export interface ErrorBoundaryProps {
  children: ReactNode
  onStartOver: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[compass] E-RENDER', error, info.componentStack)
  }

  private readonly handleStartOver = (): void => {
    this.props.onStartOver()
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div className="crash" role="alert">
        <Icon name="alert-triangle" size={32} className="crash__glyph" />
        <h1 className="crash__title">Something went wrong</h1>
        <p className="crash__body">
          Nothing you did caused this. Start over and we&rsquo;ll take you back to the first
          screen.
        </p>
        <button type="button" className="btn btn--primary" onClick={this.handleStartOver}>
          Start over
        </button>
      </div>
    )
  }
}
