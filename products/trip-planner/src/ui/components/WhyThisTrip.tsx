import { useState } from 'react'
import type { Why } from '../../domain/types'

/**
 * R10 — "Why this trip" (docs/03-design.md §4 S5), R19 (customer fix 3).
 *
 * **Open on first render.** It was collapsed, on the theory that P1 would not open
 * it — and all three judges proved that true, including the two who said it was the
 * most persuasive thing in the product once they finally found it. An accordion is
 * where honesty goes to be ignored, so it starts expanded. The two
 * sub-lists come straight from the engine: at least three reasons quoting the
 * user's own answers, and at least one named rejected destination whose line
 * carries a number. Nothing is generated here — if the section were empty it would
 * mean the engine failed, and the engine's own tests forbid that.
 *
 * `aria-expanded` is set explicitly rather than left to the browser's implicit
 * mapping for `<summary>`, so UX14 can assert it and a screen reader gets the same
 * answer in every engine.
 */
export interface WhyThisTripProps {
  why: Why
  /**
   * R29 (customer fix 3) — the same sticky one-line summary shown at the top of the
   * page, repeated here as the opening sentence so a reader who opens this section
   * sees the same first fact they skimmed above.
   */
  summaryLine: string
}

export function WhyThisTrip({ why, summaryLine }: WhyThisTripProps) {
  const [open, setOpen] = useState(true)

  return (
    <details
      className="why"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="why__summary" aria-expanded={open}>
        Why this trip
      </summary>

      <p className="why__summary-line">{summaryLine}</p>

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
