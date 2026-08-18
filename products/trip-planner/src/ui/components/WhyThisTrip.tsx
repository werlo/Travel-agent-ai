import { useState } from 'react'
import type { Why } from '../../domain/types'

/**
 * R10 — "Why this trip" (docs/03-design.md §4 S5).
 *
 * Collapsed on first render, because P1 will not open it and P2 will. The two
 * sub-lists come straight from the engine: at least three reasons quoting the
 * user's own answers, and at least one named rejected destination whose line
 * carries a number. Nothing is generated here — if the section were empty it would
 * mean the engine failed, and the engine's own tests forbid that.
 *
 * `aria-expanded` is set explicitly rather than left to the browser's implicit
 * mapping for `<summary>`, so UX14 can assert it and a screen reader gets the same
 * answer in every engine.
 */
export function WhyThisTrip({ why }: { why: Why }) {
  const [open, setOpen] = useState(false)

  return (
    <details
      className="why"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="why__summary" aria-expanded={open}>
        Why this trip
      </summary>

      <h3 className="why__sub">Because you said</h3>
      <ul className="why__list" data-why="reasons">
        {why.reasons.map((reason) => (
          <li key={reason.text} className="why__item">
            {reason.text}
          </li>
        ))}
      </ul>

      <h3 className="why__sub">Considered and rejected</h3>
      <ul className="why__list" data-why="rejected">
        {why.rejected.map((rejection) => (
          <li key={rejection.line} className="why__item">
            {rejection.line}
          </li>
        ))}
      </ul>
    </details>
  )
}
