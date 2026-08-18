import {
  recommendedDeltaLabel,
  saverDeltaLabel,
  stretchDeltaLabel,
} from '../../domain/budget'
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

export interface AlternativesProps {
  planSet: PlanSet
  selected: PlanVariant
  onSelect: (variant: PlanVariant) => void
}

export function Alternatives({ planSet, selected, onSelect }: AlternativesProps) {
  const shown = planSet[selected] ?? planSet.recommended
  const recommendedTotal = planSet.recommended.cost.partyTotal

  const slots = []

  if (selected !== 'saver') {
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

  if (selected !== 'stretch') {
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

  return (
    <section className="plan-section plan-section--alts" aria-labelledby="plan-alts">
      <h2 id="plan-alts" className="plan-section__title">
        Other ways to do this
      </h2>
      <ul className="altcards">{slots}</ul>
    </section>
  )
}
