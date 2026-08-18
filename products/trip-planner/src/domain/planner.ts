import { budgetLineFor, noFitLineFor, stretchCeiling } from './budget'
import {
  nightsConstraint,
  relaxationBanner,
  satisfies,
  sortByPriority,
  withPathPriorities,
} from './constraints'
import { nightsBetween } from './dates'
import { canonicalise, planId } from './hash'
import { buildDays, buildLegs, chooseExperiences } from './itinerary'
import { roomsFor } from './money'
import { priceCandidate } from './pricing'
import { QUESTION_GRAPH } from './questions/graph'
import { constraintsFor, preferredTags } from './questions/path'
import { scoreCandidate } from './scoring'
import type {
  CatalogueSnapshot,
  ConstraintSpec,
  CostBreakdown,
  Destination,
  Experience,
  Plan,
  PlanContext,
  PlanInput,
  PlanSet,
  PlanVariant,
  QuestionGraph,
  Relaxation,
  Stay,
} from './types'

/**
 * The engine entry point (R7, R8, R9, R13, R14).
 *
 * `generatePlanSet` is a pure function of (answers + catalogue version). No clock,
 * no randomness, no network, no float money. Called twice with deep-equal inputs it
 * returns deep-equal output, which is R13 and is asserted directly in
 * tests/planner.test.ts.
 *
 * It takes a `CatalogueSnapshot` rather than a `TravelDataSource` on purpose: when
 * the source becomes async (docs/02-architecture.md §7) the engine does not change.
 */

interface Candidate {
  destination: Destination
  stay: Stay
  experiences: readonly Experience[]
  cost: CostBreakdown
  score: number
}

export function planContextFor(input: PlanInput, graph: QuestionGraph): PlanContext {
  const { basics } = input
  const nights = nightsBetween(basics.startDate, basics.endDate)
  return {
    vibe: input.vibe,
    origin: basics.origin,
    startDate: basics.startDate,
    endDate: basics.endDate,
    nights,
    days: nights + 1,
    travellers: basics.travellers,
    rooms: roomsFor(basics.travellers),
    budget: basics.budget,
    preferTags: preferredTags(graph, input.answers),
  }
}

function buildCandidates(
  catalogue: CatalogueSnapshot,
  ctx: PlanContext,
): Candidate[] {
  const candidates: Candidate[] = []
  for (const destination of catalogue.destinations) {
    const experiences = chooseExperiences(destination, ctx)
    for (const stay of destination.stays) {
      const cost = priceCandidate(destination, stay, experiences, ctx)
      candidates.push({
        destination,
        stay,
        experiences,
        cost,
        score: scoreCandidate(destination, stay, cost.partyTotal, ctx),
      })
    }
  }
  return candidates
}

/** `(score desc, total asc, destinationId asc, stayId asc)` — a total order. */
function bestOf(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null
  for (const candidate of candidates) {
    if (best === null) {
      best = candidate
      continue
    }
    if (candidate.score !== best.score) {
      if (candidate.score > best.score) best = candidate
      continue
    }
    if (candidate.cost.partyTotal !== best.cost.partyTotal) {
      if (candidate.cost.partyTotal < best.cost.partyTotal) best = candidate
      continue
    }
    const byDestination = candidate.destination.id.localeCompare(best.destination.id)
    if (byDestination !== 0) {
      if (byDestination < 0) best = candidate
      continue
    }
    if (candidate.stay.id.localeCompare(best.stay.id) < 0) best = candidate
  }
  return best
}

function cheapestOf(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null
  for (const candidate of candidates) {
    if (
      best === null ||
      candidate.cost.partyTotal < best.cost.partyTotal ||
      (candidate.cost.partyTotal === best.cost.partyTotal &&
        candidate.destination.id.localeCompare(best.destination.id) < 0)
    ) {
      best = candidate
    }
  }
  return best
}

interface Survivors {
  pool: Candidate[]
  relaxation: Relaxation | null
  affordable: boolean
}

/**
 * The ladder: filter → if empty, drop the highest-priority-number constraint →
 * refilter → repeat. `budget`, `dates` and `travellers` are never dropped; graph
 * answers go first, most recent first (A9). If the ladder exhausts and nothing is
 * inside the stretch band, the caller falls back to the cheapest plan in the whole
 * catalogue — there is no empty state in this product.
 */
function survive(
  candidates: readonly Candidate[],
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
): Survivors {
  const ceiling = stretchCeiling(ctx.budget)
  const ordered = sortByPriority(specs)
  const droppable = ordered.filter((spec) => spec.priority > 2)
  let active = ordered

  for (let round = 0; round <= droppable.length; round += 1) {
    const pool = candidates.filter(
      (c) =>
        satisfies(c.destination, ctx, active) && c.cost.partyTotal <= ceiling,
    )
    if (pool.length > 0) {
      const dropped = ordered.filter((spec) => !active.includes(spec))
      // `ordered` runs most-important-first, so the head of `dropped` is the
      // biggest thing we gave up — that is what the banner has to name.
      const first = dropped[0]
      return {
        pool,
        affordable: true,
        relaxation:
          first === undefined
            ? null
            : {
                droppedKeys: dropped.map((spec) => spec.key),
                banner: relaxationBanner(first, ctx),
              },
      }
    }
    // Drop the least important constraint still standing: the highest priority
    // number, which is the most recent graph answer.
    const victim = [...active].reverse().find((spec) => spec.priority > 2)
    if (victim === undefined) break
    active = active.filter((spec) => spec !== victim)
  }

  return { pool: [], relaxation: null, affordable: false }
}

function toPlan(
  candidate: Candidate,
  ctx: PlanContext,
  input: PlanInput,
  catalogue: CatalogueSnapshot,
  variant: PlanVariant,
  affordable: boolean,
): Plan {
  const legs = buildLegs(candidate.destination, ctx)
  const days = buildDays(candidate.stay, candidate.experiences, legs, ctx)
  const canonical = canonicalise(input, catalogue.meta.version)

  return {
    planId: planId(canonical, variant, {
      destinationName: candidate.destination.name,
      nights: ctx.nights,
      travellers: ctx.travellers,
      budget: ctx.budget,
    }),
    variant,
    destinationId: candidate.destination.id,
    destinationName: candidate.destination.name,
    country: candidate.destination.country,
    region: candidate.destination.region,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    nights: ctx.nights,
    travellers: ctx.travellers,
    origin: ctx.origin,
    stay: {
      id: candidate.stay.id,
      name: candidate.stay.name,
      tier: candidate.stay.tier,
      nights: ctx.nights,
      rooms: ctx.rooms,
    },
    legs,
    days,
    cost: candidate.cost,
    budget: affordable
      ? budgetLineFor(candidate.cost.partyTotal, ctx.budget)
      : noFitLineFor(candidate.cost.partyTotal, ctx.budget),
    score: candidate.score,
  }
}

export interface GenerateOptions {
  graph?: QuestionGraph
  /** R5 — how many answers we filled in on the user's behalf. */
  defaultedQuestions?: number
}

export function generatePlanSet(
  input: PlanInput,
  catalogue: CatalogueSnapshot,
  options: GenerateOptions = {},
): PlanSet {
  const graph = options.graph ?? QUESTION_GRAPH
  const ctx = planContextFor(input, graph)

  const candidates = buildCandidates(catalogue, ctx)
  if (candidates.length === 0) {
    throw new Error('[compass] E-CATALOGUE-EMPTY: no destinations to plan against')
  }

  const specs = [
    nightsConstraint(),
    ...withPathPriorities(constraintsFor(graph, input.answers)),
  ]

  const { pool, relaxation, affordable } = survive(candidates, ctx, specs)
  const winner = affordable ? bestOf(pool) : cheapestOf(candidates)
  if (winner === null) {
    throw new Error('[compass] E-PLANNER-EMPTY: no candidate survived the ladder')
  }

  return {
    recommended: toPlan(winner, ctx, input, catalogue, 'recommended', affordable),
    relaxation,
    defaultedQuestions: options.defaultedQuestions ?? 0,
    catalogueVersion: catalogue.meta.version,
    snapshotDate: catalogue.meta.snapshotDate,
    candidatesEvaluated: candidates.length,
  }
}
