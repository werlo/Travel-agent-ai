/**
 * The persistent summary bar (docs/03-design.md §3, §6.3).
 *
 * It is shown from S2 onwards and carries the running trip facts —
 * `5 nights · 2 travellers · from Bengaluru · ₹60,000`. Until the basics screen
 * exists (slice 2) there are no facts to show, so the bar renders nothing: an
 * empty accent strip on the vibe screen would be decoration, and the design puts
 * the bar under the app bar only once it has content.
 *
 * The separator is rendered as its own element so the spacing is CSS, not
 * whitespace in the string, while the accessible text still reads with the `·`.
 */
export interface SummaryBarProps {
  facts: readonly string[] | null
}

export function SummaryBar({ facts }: SummaryBarProps) {
  if (facts === null || facts.length === 0) return null

  return (
    <div className="summary-bar" role="status" aria-live="polite" aria-atomic="true">
      <p className="summary-bar__text">
        {facts.map((fact, i) => (
          <span key={fact} className="summary-bar__fact">
            {i > 0 ? <span className="summary-bar__sep"> · </span> : null}
            {fact}
          </span>
        ))}
      </p>
    </div>
  )
}
