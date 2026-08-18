import {
  recommendedDeltaLabel,
  saverDeltaLabel,
  stretchDeltaLabel,
} from '../../domain/budget'
import { exclusionDisplayName } from '../../domain/exclusions'
import { formatRupees } from '../../domain/money'
import type { Plan, PlanSet, PlanVariant } from '../../domain/types'

/**
 * R11 — the Saver and Stretch alternatives (docs/03-design.md §4 S5).
 *
 * Two rules the design is explicit about and this component enforces structurally:
 *
 * - **A slot is never an empty box.** Where the engine found no qualifying plan it
 *   supplies the sentence that goes in its place, and the sentence renders inside a
 *   card of the same shape as a real one.
 * - **Switching is symmetrical.** Whichever plan is on screen, the other two are
 *   cards, so the previous recommendation is always one click away.
 *
 * Selecting a card only dispatches a variant: every region of the plan screen reads
 * `planSet[selectedVariant]`, so the itinerary, the breakdown, the budget line and
 * the plan ID cannot update out of step with one another.
 */

const BADGE: Record<PlanVariant, { label: string; className: string }> = {
  saver: { label: 'Saver', className: 'badge--neutral' },
  stretch: { label: 'Stretch', className: 'badge--warn' },
  recommended: { label: 'Recommended', className: 'badge--accent' },
}

function AltCard({
  variant,
  plan,
  delta,
  onSelect,
}: {
  variant: PlanVariant
  plan: Plan
  delta: string
  onSelect: () => void
}) {
  const badge = BADGE[variant]
  const nameId = `alt-${variant}-name`

  return (
    <li className={`altcard altcard--${variant}`} data-alt={variant}>
      <p className={`badge ${badge.className}`}>{badge.label}</p>
      <p className="altcard__name" id={nameId}>
        {plan.destinationName}
      </p>
      <p className="altcard__total">{formatRupees(plan.cost.partyTotal)}</p>
      <p className="altcard__delta">{delta}</p>
      <button
        type="button"
        className="btn btn--secondary altcard__action"
        aria-describedby={nameId}
        onClick={onSelect}
      >
        Use this plan
      </button>
    </li>
  )
}

function AbsentCard({ variant, reason }: { variant: PlanVariant; reason: string }) {
  const badge = BADGE[variant]
  return (
    <li className="altcard altcard--absent" data-alt={`${variant}-absent`}>
      <p className={`badge ${badge.className}`}>{badge.label}</p>
      <p className="altcard__absent">{reason}</p>
    </li>
  )
}

/** R22 — the control that replaced two empty dashed boxes and a Start over. */
export const REJECT_LABEL = 'Not this one — somewhere else'
export const EXHAUSTED_MESSAGE =
  "That's every destination that fits — here are the ones you turned down"

function RejectCard({ onReject }: { onReject: () => void }) {
  return (
    <li className="altcard altcard--reject" data-alt="reject">
      <p className="badge badge--neutral">Somewhere else</p>
      <p className="altcard__absent">
        Keep the dates, the budget, the party and every answer — we will find the next
        best place.
      </p>
      <button
        type="button"
        className="btn btn--secondary altcard__action"
        onClick={onReject}
      >
        {REJECT_LABEL}
      </button>
    </li>
  )
}

export interface AlternativesProps {
  planSet: PlanSet
  selected: PlanVariant
  onSelect: (variant: PlanVariant) => void
  /** R22 — turn the shown destination down and keep the whole trip. */
  onReject: () => void
  onUndoReject: (destinationId: string) => void
  /** True once every destination that fits has been turned down. */
  exhausted: boolean
}

export function Alternatives({
  planSet,
  selected,
  onSelect,
  onReject,
  onUndoReject,
  exhausted,
}: AlternativesProps) {
  const shown = planSet[selected] ?? planSet.recommended
  const recommendedTotal = planSet.recommended.cost.partyTotal

  const slots = []
  // R22 — where neither alternative exists, the space carries the one control that
  // does something instead of two dashed boxes that do not.
  const noAlternatives = planSet.saver === null && planSet.stretch === null

  if (selected !== 'saver' && !noAlternatives) {
    slots.push(
      planSet.saver !== null ? (
        <AltCard
          key="saver"
          variant="saver"
          plan={planSet.saver}
          delta={saverDeltaLabel(recommendedTotal, planSet.saver.cost.partyTotal)}
          onSelect={() => onSelect('saver')}
        />
      ) : (
        <AbsentCard
          key="saver"
          variant="saver"
          reason={planSet.saverAbsentReason ?? ''}
        />
      ),
    )
  }

  if (selected !== 'stretch' && !noAlternatives) {
    slots.push(
      planSet.stretch !== null ? (
        <AltCard
          key="stretch"
          variant="stretch"
          plan={planSet.stretch}
          delta={stretchDeltaLabel(recommendedTotal, planSet.stretch.cost.partyTotal)}
          onSelect={() => onSelect('stretch')}
        />
      ) : (
        <AbsentCard
          key="stretch"
          variant="stretch"
          reason={planSet.stretchAbsentReason ?? ''}
        />
      ),
    )
  }

  if (selected !== 'recommended') {
    slots.push(
      <AltCard
        key="recommended"
        variant="recommended"
        plan={planSet.recommended}
        delta={recommendedDeltaLabel(shown.cost.partyTotal, recommendedTotal)}
        onSelect={() => onSelect('recommended')}
      />,
    )
  }

  if (!exhausted) slots.push(<RejectCard key="reject" onReject={onReject} />)

  return (
    <section className="plan-section plan-section--alts" aria-labelledby="plan-alts">
      <h2 id="plan-alts" className="plan-section__title">
        Other ways to do this
      </h2>
      <ul className="altcards">{slots}</ul>
      {exhausted ? (
        <p className="plan-section__footnote" role="status">
          {EXHAUSTED_MESSAGE}
        </p>
      ) : null}
      {planSet.excluded.length > 0 ? (
        <div className="excluded">
          <h3 className="excluded__title">You turned these down</h3>
          <ul className="excluded__list">
            {planSet.excluded.map((destination) => (
              <li key={destination.id} className="excluded__item">
                <span className="excluded__name">{exclusionDisplayName(destination.name)}</span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onUndoReject(destination.id)}
                >
                  {`Put ${destination.name} back`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
