import { nightsLabel, travellersLabel } from '../../domain/dates'
import { formatRupees } from '../../domain/money'
import { vibeLabel } from '../../domain/vibes'
import type { Plan, PlanSet, Relaxation, Rupees, Vibe } from '../../domain/types'

/**
 * R14 — never dead-end (docs/03-design.md §4 S5).
 *
 * Two states, both of them honest, and no dismiss control in either: the fact that
 * we changed the search is not something the user should be able to hide from
 * themselves.
 *
 * 1. **Relaxed.** Names the constraint we dropped and what we did instead, with a
 *    control to put it back.
 * 2. **Restored.** States, in rupees, what putting it back costs, and offers both
 *    the restored plan and the one already on screen. Where the catalogue has
 *    nothing at all with the constraint back on, it says that instead of offering a
 *    plan that does not exist.
 */

export function restoredSentence(
  relaxation: Relaxation,
  vibe: Vibe,
  travellers: number,
  budget: Rupees,
  nights: number,
): string {
  const { label } = relaxation.restore
  const total = relaxation.restore.total
  if (total === null) {
    return `Nothing in this catalogue is ${label} for ${nightsLabel(nights)} with ${travellersLabel(
      travellers,
    )} — the plan below is the closest we have.`
  }
  const head = `The cheapest ${label} ${vibeLabel(vibe).toLowerCase()} trip for ${travellers} over these dates is ${formatRupees(total)}`
  const gap = total - budget
  if (gap > 0) return `${head} — ${formatRupees(gap)} over your budget.`
  if (gap < 0) return `${head} — ${formatRupees(-gap)} under your budget.`
  return `${head} — exactly your budget.`
}

export interface RelaxBannerProps {
  relaxation: Relaxation
  /** The plan currently on screen — the one `Keep the ₹X plan` keeps. */
  shown: Plan
  vibe: Vibe
  budget: Rupees
  requested: boolean
  /** The engine re-run with the constraint forced back on; null until requested. */
  restored: PlanSet | null
  onRequest: () => void
  onApply: (planSet: PlanSet) => void
  onDismiss: () => void
}

export function RelaxBanner({
  relaxation,
  shown,
  vibe,
  budget,
  requested,
  restored,
  onRequest,
  onApply,
  onDismiss,
}: RelaxBannerProps) {
  const { label, total } = relaxation.restore
  const keepLabel = `Keep the ${formatRupees(shown.cost.partyTotal)} plan`

  if (!requested) {
    return (
      <div className="banner banner--warn plan-relax" role="region" aria-label="Relaxed constraint">
        <h2 className="banner__title">We changed one thing to make this work</h2>
        <p className="banner__body">{relaxation.banner}</p>
        <div className="banner__actions">
          <button type="button" className="btn btn--secondary" onClick={onRequest}>
            Put {label} back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="banner banner--warn plan-relax" role="region" aria-label="Relaxed constraint">
      <h2 className="banner__title">With {label} back in</h2>
      <p className="banner__body">
        {restoredSentence(relaxation, vibe, shown.travellers, budget, shown.nights)}
      </p>
      <div className="banner__actions">
        {total !== null && restored !== null ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onApply(restored)}
          >
            Use the {formatRupees(total)} plan
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={onDismiss}>
          {keepLabel}
        </button>
      </div>
    </div>
  )
}
