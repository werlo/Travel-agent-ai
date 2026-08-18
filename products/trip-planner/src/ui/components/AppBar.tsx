import { SummaryBar } from './SummaryBar'

/**
 * docs/03-design.md §3 — AppBar. The wordmark is plain text and deliberately not
 * focusable. "Start over" only exists once there is a session to clear, which is
 * slice 2; passing `onStartOver: null` is what "no session" means here.
 *
 * The SummaryBar lives inside <header> (docs/03-design.md §6.1 landmarks).
 */
export interface AppBarProps {
  sticky: boolean
  summaryFacts: readonly string[] | null
  onStartOver: (() => void) | null
}

export function AppBar({ sticky, summaryFacts, onStartOver }: AppBarProps) {
  return (
    <header className={sticky ? 'appbar-region appbar-region--sticky' : 'appbar-region'}>
      <div className="appbar">
        <div className="appbar__brand">
          <span className="appbar__wordmark">Compass</span>
          <span className="appbar__tagline">guided trip planner</span>
        </div>
        {onStartOver !== null ? (
          <button type="button" className="btn btn--ghost" onClick={onStartOver}>
            Start over
          </button>
        ) : null}
      </div>
      <SummaryBar facts={summaryFacts} />
    </header>
  )
}
