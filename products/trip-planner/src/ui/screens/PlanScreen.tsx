import { formatRupees } from '../../domain/money'
import type { BudgetStatus, PlanSet } from '../../domain/types'
import { CostTable } from '../components/CostTable'
import { DayBlockCard } from '../components/DayBlock'
import { defaultedLabel, planFacts, planIdLine } from '../format'

/**
 * S5 — Plan (docs/03-design.md §4 S5; R7, R8, R9, R13, R16).
 *
 * Slice 2 ships the hero, the itinerary, the breakdown, the budget line and the
 * plan ID. "Why this trip" and the alternatives are slice 3; the adjust panel and
 * the text export are slice 4 (docs/02-architecture.md §10). Nothing here is a
 * placeholder: every section that renders is real.
 */

const BADGE_VARIANT: Record<BudgetStatus, string> = {
  within: 'badge--success',
  'on-budget': 'badge--neutral',
  stretch: 'badge--warn',
  'no-fit': 'badge--warn',
}

export interface PlanScreenProps {
  planSet: PlanSet
  onAnswerDefaulted: () => void
}

export function PlanScreen({ planSet, onAnswerDefaulted }: PlanScreenProps) {
  const plan = planSet.recommended
  const { cost } = plan

  return (
    <div className="screen screen--plan">
      <div className="plan-hero">
        <div className="plan-hero__head">
          <h1 className="plan-hero__title" tabIndex={-1}>
            {plan.destinationName}
          </h1>
          <div className="plan-hero__price">
            <p className="plan-hero__total">{formatRupees(cost.partyTotal)} total</p>
            <p className="plan-hero__perperson">{formatRupees(cost.perPerson)} per person</p>
          </div>
        </div>
        <p className={`badge ${BADGE_VARIANT[plan.budget.status]}`}>{plan.budget.label}</p>
        <p className="plan-hero__facts">{planFacts(plan)}</p>
        {planSet.defaultedQuestions > 0 ? (
          <p className="plan-hero__defaults">
            <span className="badge badge--accent">
              {defaultedLabel(planSet.defaultedQuestions)}
            </span>
            <button type="button" className="btn btn--ghost" onClick={onAnswerDefaulted}>
              Answer them
            </button>
          </p>
        ) : null}
        <p className="plan-hero__id">{planIdLine(plan, planSet.catalogueVersion)}</p>
      </div>

      <div className="plan-grid">
        <section className="plan-section" aria-labelledby="plan-days">
          <h2 id="plan-days" className="plan-section__title">
            Your days
          </h2>
          <div className="dayblocks">
            {plan.days.map((day) => (
              <DayBlockCard key={day.day} day={day} />
            ))}
          </div>
        </section>

        <section className="plan-section plan-section--aside" aria-labelledby="plan-cost">
          <h2 id="plan-cost" className="plan-section__title">
            What makes up {formatRupees(cost.partyTotal)}
          </h2>
          <CostTable cost={cost} travellers={plan.travellers} />
          <p className="plan-section__footnote">
            Priced per adult traveller. One room per two travellers, rounded up.
            Children aren&rsquo;t priced separately yet.
          </p>
          <p className="plan-section__footnote">
            Stay: {plan.stay.name}, {plan.stay.nights}{' '}
            {plan.stay.nights === 1 ? 'night' : 'nights'}, {plan.stay.rooms}{' '}
            {plan.stay.rooms === 1 ? 'room' : 'rooms'}.
          </p>
        </section>
      </div>
    </div>
  )
}
