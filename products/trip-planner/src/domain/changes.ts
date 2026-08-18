import { formatRupees } from './money'
import type { Plan, PlanSet, StayTier } from './types'

/**
 * R19 (customer fix 3) — say what changed, where the user is already looking.
 *
 * The plan's honesty used to live inside the cost breakdown and a collapsed
 * accordion, and every judge acted on the headline: one of them added a traveller,
 * watched the total go *down*, and only found the swapped hotel because she reads
 * breakdowns for a living. This module turns those silent substitutions into one
 * sentence rendered next to the total.
 *
 * It is pure and comparative: it is handed the plan that was on screen and the plan
 * that replaced it, and it names only what actually differs.
 */

const TIER_RANK: Readonly<Record<StayTier, number>> = {
  saver: 0,
  standard: 1,
  premium: 2,
}

const BUDGET_PREFIX = 'Changed to keep you inside budget:'
const UPDATE_PREFIX = 'Changed after your update:'

function stayClause(previous: Plan, next: Plan): string {
  return (
    `stay is now ${next.stay.name} (${formatRupees(next.stay.pricePerRoomPerNight)}/night, ` +
    `${next.stay.tier}) instead of ${previous.stay.name} ` +
    `(${formatRupees(previous.stay.pricePerRoomPerNight)}/night, ${previous.stay.tier})`
  )
}

/**
 * The relaxation ladder dropping an answer *is* an override, and the user gave that
 * answer on purpose: "International" answered with Manali is named here, in the
 * same notice, rather than left to a banner they may have scrolled past.
 */
function overriddenAnswerClauses(plan: Plan): string[] {
  // The engine already knows which answers it could not hold — R10 puts one
  // reason per answer on the plan, and `held` is false for the ones it dropped.
  // Reading it here means the notice covers the relaxation ladder AND the
  // exhausted-ladder case, which is the one that handed a judge Manali after he
  // asked for international and said nothing at all.
  const budget = plan.cost.partyTotal + plan.budget.delta
  // Mid-sentence, so only the first letter is lowered: 'Within India' has to stay
  // 'within India' rather than become 'within india'.
  const midSentence = (label: string): string =>
    label.charAt(0).toLowerCase() + label.slice(1)
  return plan.why.reasons
    .filter((reason) => !reason.held)
    .map((reason) =>
      // R31 — a pinned destination did not lose this answer to the relaxation
      // ladder searching the catalogue; the user picked it themselves. Reusing the
      // ladder's "nothing fits" sentence here would attach a claim about the whole
      // catalogue — reasoning that belongs to a different candidate — to the one
      // hand-picked plan actually on screen.
      reason.pinnedOverride === true
        ? `you picked ${plan.destinationName} yourself, which does not answer ${midSentence(reason.quotes)}`
        : `you asked for ${midSentence(reason.quotes)} — nothing fits ${formatRupees(
            budget,
          )} for ${plan.travellers}, so this is ${plan.destinationName}`,
    )
}

export interface ChangeNoticeInput {
  /** The plan that was on screen before the re-plan, or null on a first render. */
  previous: Plan | null
  next: Plan
  planSet: PlanSet
}

/**
 * One sentence, or null when nothing worth saying changed. Rendered adjacent to the
 * total on S5 (docs/03-design.md §4 S5).
 */
export function changeNotice({ previous, next }: ChangeNoticeInput): string | null {
  const clauses: string[] = []
  let budgetDriven = false

  if (previous !== null) {
    if (previous.destinationId !== next.destinationId) {
      clauses.push(
        `destination is now ${next.destinationName} instead of ${previous.destinationName}`,
      )
      if (next.cost.partyTotal < previous.cost.partyTotal) budgetDriven = true
    }
    if (previous.stay.id !== next.stay.id) {
      clauses.push(stayClause(previous, next))
      if (
        TIER_RANK[next.stay.tier] < TIER_RANK[previous.stay.tier] ||
        next.stay.pricePerRoomPerNight < previous.stay.pricePerRoomPerNight
      ) {
        budgetDriven = true
      }
    }
  }

  const overridden = overriddenAnswerClauses(next)
  if (overridden.length > 0) {
    clauses.push(...overridden)
    // R31 — a pin-driven override is the user's own choice, not the engine
    // giving up something to stay inside budget; only the ladder-driven case
    // earns the "kept you inside budget" framing.
    if (next.why.reasons.some((reason) => !reason.held && reason.pinnedOverride !== true)) {
      budgetDriven = true
    }
  }

  if (clauses.length === 0) return null
  const prefix = budgetDriven ? BUDGET_PREFIX : UPDATE_PREFIX
  return `${prefix} ${clauses.join('; ')}`
}

export { BUDGET_PREFIX, UPDATE_PREFIX }
