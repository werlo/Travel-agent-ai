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
  /**
   * R29 (customer fix 3) — the plan-outcome line ('North Goa · ₹1,76,100 ·
   * ₹2,00,100 under budget'), shown only on the plan screen. It lives inside the
   * same sticky header as the SummaryBar so it stays visible on load and while
   * scrolling, without a second independently-positioned sticky element.
   */
  planSummary?: string | null
}

export function AppBar({ sticky, summaryFacts, onStartOver, planSummary = null }: AppBarProps) {
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
      {planSummary !== null ? (
        <p className="plan-summary-line" data-testid="plan-summary-line" role="status">
          {planSummary}
        </p>
      ) : null}
    </header>
  )
}
