import { formatDateRange, nightsLabel } from './dates'
import { formatRupees } from './money'
import { nodeFor, optionFor } from './questions/path'
import { VIBE_LABELS } from './vibes'
import type {
  AnswerPairs,
  ConstraintSpec,
  CostBreakdown,
  Destination,
  PlanContext,
  QuestionGraph,
  Reason,
  Rejection,
  Rupees,
  Stay,
  Why,
} from './types'

/**
 * R10 — "Why this trip".
 *
 * Two guarantees, and they are the whole point of the module:
 *
 * 1. **At least three reasons, each quoting one of the user's own answers.** Vibe,
 *    budget position and trip length are always available whatever the user
 *    answered, so the floor of three holds for every destination at every tier;
 *    each adaptive answer that is not "No preference" adds one more.
 * 2. **At least one named rejected destination whose line contains a numeral.**
 *    Rejections are computed against **all 14 destinations**, not just the ones
 *    that survived the filter, so the list is never empty — the runner-up is
 *    always there even when nothing was excluded at all.
 *
 * Every sentence is derived from data the user can check: an affinity out of five,
 * a rupee gap, a flight duration, a night range. Nothing here is decorative.
 */

/** The three-key ordering used for "the best of the ones we did not pick". */
interface Runner {
  destination: Destination
  cheapestTotal: Rupees
  bestScore: number
}

export interface ExplainCandidate {
  destination: Destination
  stay: Stay
  cost: CostBreakdown
  score: number
}

export interface ExplainInput {
  chosen: ExplainCandidate
  /** Every priced (destination x tier) candidate, survivors and casualties alike. */
  all: readonly ExplainCandidate[]
  ctx: PlanContext
  graph: QuestionGraph
  answers: AnswerPairs
  /** The constraints that were actually in force — a relaxed one rejected nobody. */
  activeSpecs: readonly ConstraintSpec[]
  /** budget x 1.25; above it a destination was excluded on price. */
  ceiling: Rupees
  /**
   * R31 — true when `chosen` is a hand-picked destination (Saver/Stretch/reject)
   * that replaced the ladder's own winner. An unheld answer then means "the user
   * picked this, not the engine" rather than "the engine searched and nothing
   * fit" — two different facts that must not share the ladder's wording, or the
   * ladder's own reasoning about a different candidate gets attached to this one.
   */
  pinned?: boolean
}

/** 'west coast and lively' — Oxford-free, because these are two-item lists at most. */
function joinWords(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function droppedText(label: string, ctx: PlanContext): string {
  return `You said ${label} — nothing in this catalogue held that for ${formatRupees(ctx.budget)}, so it counted for less than your other answers.`
}

/**
 * R31 — the pinned case: the destination did not go unanswered because the ladder
 * searched the catalogue, it went unanswered because the user picked this specific
 * destination themselves (Saver, Stretch, or "Not this one — somewhere else"). The
 * ladder's own "nothing in this catalogue held that" sentence is a claim about the
 * whole search, and it is not true here — this is one destination, chosen on
 * purpose, that simply does not answer an earlier question.
 */
function droppedPinnedText(label: string, destinationName: string): string {
  return `You said ${label} — ${destinationName} is the plan you picked yourself, and it does not answer that.`
}

/** The honest case: we could not hold this answer, so `held` is false (R19). */
function dropped(label: string, ctx: PlanContext, pinnedDestinationName?: string): Reason {
  if (pinnedDestinationName !== undefined) {
    return {
      quotes: label,
      text: droppedPinnedText(label, pinnedDestinationName),
      held: false,
      pinnedOverride: true,
    }
  }
  return { quotes: label, text: droppedText(label, ctx), held: false }
}

function vibeReason(ctx: PlanContext, destination: Destination): Reason {
  const label = VIBE_LABELS[ctx.vibe]
  return {
    quotes: label,
    text: `You chose ${label} — ${destination.name} rates ${destination.vibeAffinity[ctx.vibe]} out of 5 for that in this catalogue.`,
    held: true,
  }
}

function budgetReason(ctx: PlanContext, total: Rupees): Reason {
  const delta = ctx.budget - total
  const head = `Your budget is ${formatRupees(ctx.budget)} for ${nightsLabel(ctx.nights)}`
  if (delta > 0)
    return {
      quotes: formatRupees(ctx.budget),
      text: `${head} — this lands ${formatRupees(delta)} under it.`,
      held: true,
    }
  if (delta < 0)
    return {
      quotes: formatRupees(ctx.budget),
      text: `${head} — this lands ${formatRupees(-delta)} over it.`,
      // The budget position has its own badge on the headline; `held` is about
      // the adaptive answers the plan could not honour (R19).
      held: true,
    }
  return {
    quotes: formatRupees(ctx.budget),
    text: `${head} — this lands exactly on it.`,
    held: true,
  }
}

function datesReason(ctx: PlanContext, destination: Destination): Reason {
  return {
    quotes: nightsLabel(ctx.nights),
    text: `You have ${nightsLabel(ctx.nights)}, ${formatDateRange(ctx.startDate, ctx.endDate)} — ${destination.name} works for anything from ${destination.minNights} to ${destination.maxNights} nights.`,
    held: true,
  }
}

/** How many distinct destinations in the catalogue answer this option outright. */
function destinationsAnswering(input: ExplainInput, specs: readonly ConstraintSpec[]): number {
  const ids = new Set<string>()
  for (const candidate of input.all) {
    if (specs.every((spec) => spec.test(candidate.destination, input.ctx))) {
      ids.add(candidate.destination.id)
    }
  }
  return ids.size
}

/**
 * One reason per adaptive answer the user actually gave. "No preference" is not an
 * answer and is never quoted back as though it were, and an answer the ladder had
 * to drop is reported as dropped rather than dressed up as a match.
 */
function adaptiveReasons(input: ExplainInput): Reason[] {
  const { graph, answers, ctx, chosen, pinned } = input
  const out: Reason[] = []
  const pinnedName = pinned === true ? chosen.destination.name : undefined

  for (const [questionId, optionId] of answers) {
    if (optionId === 'no-preference') continue
    const node = nodeFor(graph, questionId)
    if (node === null) continue
    const option = optionFor(node, optionId)
    if (option === null) continue

    if (option.constraints.length > 0) {
      const held = option.constraints.every((spec) => spec.test(chosen.destination, ctx))
      if (held) {
        const count = destinationsAnswering(input, option.constraints)
        out.push({
          quotes: option.label,
          text: `You said ${option.label} — ${chosen.destination.name} is one of ${count} ${count === 1 ? 'destination' : 'destinations'} in this catalogue that answer that.`,
          held: true,
        })
      } else {
        out.push(dropped(option.label, ctx, pinnedName))
      }
      continue
    }

    const onDestination = option.preferTags.filter((tag) =>
      chosen.destination.tags.includes(tag),
    )
    if (onDestination.length > 0) {
      out.push({
        quotes: option.label,
        text: `You said ${option.label} — ${chosen.destination.name} is tagged ${joinWords(onDestination)}.`,
        held: true,
      })
      continue
    }

    const onStay = option.preferTags.filter((tag) => chosen.stay.tags.includes(tag))
    if (onStay.length > 0) {
      out.push({
        quotes: option.label,
        text: `You said ${option.label} — ${chosen.stay.name} is the ${joinWords(onStay)} choice in ${chosen.destination.name}.`,
        held: true,
      })
      continue
    }

    // The honest case: we could not hold this answer, so we say so rather than
    // inventing a match. This is the same fact the R14 banner reports.
    out.push(dropped(option.label, ctx, pinnedName))
  }

  return out
}

export function reasonsFor(input: ExplainInput): Reason[] {
  return [
    vibeReason(input.ctx, input.chosen.destination),
    budgetReason(input.ctx, input.chosen.cost.partyTotal),
    datesReason(input.ctx, input.chosen.destination),
    ...adaptiveReasons(input),
  ]
}

function runnersUp(input: ExplainInput): Runner[] {
  const byDestination = new Map<string, Runner>()
  for (const candidate of input.all) {
    if (candidate.destination.id === input.chosen.destination.id) continue
    const existing = byDestination.get(candidate.destination.id)
    if (existing === undefined) {
      byDestination.set(candidate.destination.id, {
        destination: candidate.destination,
        cheapestTotal: candidate.cost.partyTotal,
        bestScore: candidate.score,
      })
      continue
    }
    if (candidate.cost.partyTotal < existing.cheapestTotal) {
      existing.cheapestTotal = candidate.cost.partyTotal
    }
    if (candidate.score > existing.bestScore) existing.bestScore = candidate.score
  }
  return [...byDestination.values()].sort(
    (a, b) =>
      b.bestScore - a.bestScore ||
      a.cheapestTotal - b.cheapestTotal ||
      a.destination.id.localeCompare(b.destination.id),
  )
}

/** `Bali, Indonesia — ₹18,200 over your budget for 4.` */
function priceLine(runner: Runner, ctx: PlanContext): string {
  const over = runner.cheapestTotal - ctx.budget
  return `${formatRupees(over)} over your budget for ${ctx.travellers}.`
}

/** `₹12,300 more than Kochi & Varkala.` — always carries a numeral, whichever way. */
function runnerUpLine(runner: Runner, input: ExplainInput): string {
  const chosenTotal = input.chosen.cost.partyTotal
  const delta = runner.cheapestTotal - chosenTotal
  const name = input.chosen.destination.name
  if (delta > 0) return `${formatRupees(delta)} more than ${name}.`
  const theirs = runner.destination.vibeAffinity[input.ctx.vibe]
  const ours = input.chosen.destination.vibeAffinity[input.ctx.vibe]
  const vibe = VIBE_LABELS[input.ctx.vibe]
  const head =
    delta === 0 ? 'the same price' : `${formatRupees(-delta)} cheaper`
  return `${head}, but it rates ${theirs} out of 5 for ${vibe} against ${name}'s ${ours}.`
}

/**
 * Preference order (docs/02-architecture.md §4.8 rule 8): excluded on price first,
 * then excluded by a constraint the user set, then the plain runner-up. Up to three
 * are named — the design shows three bullets — and there is always at least one.
 */
export function rejectionsFor(input: ExplainInput, limit = 3): Rejection[] {
  const onPrice: Rejection[] = []
  const onConstraint: Rejection[] = []
  const runnerUp: Rejection[] = []

  for (const runner of runnersUp(input)) {
    const failed = input.activeSpecs.find(
      (spec) => !spec.test(runner.destination, input.ctx),
    )
    if (runner.cheapestTotal > input.ceiling) {
      onPrice.push({
        destinationName: runner.destination.name,
        line: `${runner.destination.name} — ${priceLine(runner, input.ctx)}`,
      })
      continue
    }
    if (failed !== undefined) {
      onConstraint.push({
        destinationName: runner.destination.name,
        line: `${runner.destination.name} — ${failed.rejectNote(runner.destination, input.ctx)}.`,
      })
      continue
    }
    runnerUp.push({
      destinationName: runner.destination.name,
      line: `${runner.destination.name} — ${runnerUpLine(runner, input)}`,
    })
  }

  return [...onPrice, ...onConstraint, ...runnerUp].slice(0, limit)
}

export function explain(input: ExplainInput): Why {
  return { reasons: reasonsFor(input), rejected: rejectionsFor(input) }
}
