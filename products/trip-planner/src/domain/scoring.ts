import type { Destination, DestinationTag, PlanContext, Rupees, Stay } from './types'

/**
 * How well a (destination × stay) candidate answers what the user actually said.
 *
 * Integers only: the ranking is `(score desc, total asc, destinationId asc,
 * stayId asc)`, which is a total order with no ties, and floats would make the
 * tie-breaks unstable across runtimes. The budget component is what stops the
 * engine from always recommending the cheapest possible trip — a plan that uses
 * the budget scores higher than one that ignores it, and the Saver alternative
 * (slice 3) is what serves the user who wants to spend less.
 */

export const WEIGHT = {
  vibe: 20,
  destinationTag: 6,
  stayTag: 4,
  budgetFit: 25,
} as const

export function tagMatches(
  tags: readonly DestinationTag[],
  preferred: readonly DestinationTag[],
): number {
  let matches = 0
  for (const tag of preferred) if (tags.includes(tag)) matches += 1
  return matches
}

/**
 * 0..25. Peaks at exactly the budget and falls to 0 at budget × 1.25, so a plan
 * that overshoots is only ever chosen when nothing cheaper fits (R9).
 */
export function budgetFitScore(total: Rupees, budget: Rupees): number {
  if (budget <= 0) return 0
  if (total <= budget) {
    return Math.round((WEIGHT.budgetFit * total) / budget)
  }
  const over = Math.round((100 * (total - budget)) / budget)
  return Math.max(0, WEIGHT.budgetFit - over)
}

export function scoreCandidate(
  destination: Destination,
  stay: Stay,
  total: Rupees,
  ctx: PlanContext,
): number {
  return (
    destination.vibeAffinity[ctx.vibe] * WEIGHT.vibe +
    tagMatches(destination.tags, ctx.preferTags) * WEIGHT.destinationTag +
    tagMatches(stay.tags, ctx.preferTags) * WEIGHT.stayTag +
    budgetFitScore(total, ctx.budget)
  )
}
