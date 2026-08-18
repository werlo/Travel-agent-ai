import { formatRupees } from './money'
import type { BudgetLine, Rupees } from './types'

/**
 * R9 — pricing against the budget with a soft cutoff (A4).
 *
 * Nothing above `budget × 1.25` is ever recommended. The one exception is the
 * `no-fit` line: when the relaxation ladder is exhausted and the catalogue simply
 * has nothing inside the band, the cheapest plan is still rendered — never a dead
 * end — and it is labelled as not fitting rather than as a recommendation
 * (docs/02-architecture.md §4.8 rule 3, §11).
 */

export const STRETCH_MULTIPLIER_PERCENT = 125

/** The hard ceiling for anything presented as a recommendation. */
export function stretchCeiling(budget: Rupees): Rupees {
  return Math.floor((budget * STRETCH_MULTIPLIER_PERCENT) / 100)
}

/** Within half a percent of the budget reads as "On budget" rather than ±₹40. */
function onBudgetBand(budget: Rupees): Rupees {
  return Math.floor(budget / 200)
}

export function budgetLineFor(total: Rupees, budget: Rupees): BudgetLine {
  const delta = budget - total
  if (Math.abs(delta) <= onBudgetBand(budget)) {
    return { status: 'on-budget', delta, label: 'On budget' }
  }
  if (delta > 0) {
    return {
      status: 'within',
      delta,
      label: `${formatRupees(delta)} under your budget`,
    }
  }
  const percent = Math.max(1, Math.round((100 * -delta) / budget))
  return {
    status: 'stretch',
    delta,
    label: `Stretch — ${percent}% over your budget`,
  }
}

/** The label of last resort: honest about the gap, and still showing a plan (R14). */
export function noFitLineFor(total: Rupees, budget: Rupees): BudgetLine {
  return {
    status: 'no-fit',
    delta: budget - total,
    label: `Nothing in this catalogue fits ${formatRupees(budget)} — the closest is ${formatRupees(total)}`,
  }
}
