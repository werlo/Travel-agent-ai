import {
  budgetLineFor,
  noFitLineFor,
  SAVER_ABSENT_REASON,
  saverCeiling,
  STRETCH_ABSENT_REASON,
  stretchCeiling,
} from './budget'
import {
  isDroppable,
  mostImportantDropped,
  nightsConstraint,
  relaxationBanner,
  satisfies,
  sortByPriority,
  withPathPriorities,
} from './constraints'
import { nightsBetween } from './dates'
import { explain } from './explain'
import { canonicalise, planId } from './hash'
import { buildDays, buildLegs, chooseExperiences } from './itinerary'
import { roomsFor } from './money'
import { priceCandidate } from './pricing'
import { QUESTION_GRAPH } from './questions/graph'
import { constraintsFor, preferredTags } from './questions/path'
import { scoreCandidate } from './scoring'
import type {
  CatalogueSnapshot,
  ConstraintKey,
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
  Restore,
  Stay,
  Why,
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

export interface Candidate {
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

/**
 * Every (destination x stay tier) pair, priced and scored — 42 in the MVP catalogue.
 * Exported because R10's floor (">= 3 reasons and >= 1 numeric rejection for every
 * destination at every tier") is a property of the whole candidate set, and a test
 * that rebuilt the set by hand would be testing its own copy of the engine.
 */
export function buildCandidates(
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

interface LadderRelaxation {
  dropped: ConstraintSpec[]
  first: ConstraintSpec
  droppedKeys: ConstraintKey[]
  banner: string
}

interface Survivors {
  pool: Candidate[]
  /** The specs still standing when the pool was found — what actually filtered. */
  active: readonly ConstraintSpec[]
  relaxation: LadderRelaxation | null
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
  forced: ReadonlySet<ConstraintKey> = new Set(),
): Survivors {
  const ceiling = stretchCeiling(ctx.budget)
  const ordered = sortByPriority(specs)
  const canDrop = (spec: ConstraintSpec): boolean =>
    isDroppable(spec) && !forced.has(spec.key)
  const droppable = ordered.filter(canDrop)
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
      const first = mostImportantDropped(ordered, active)
      return {
        pool,
        active,
        affordable: true,
        relaxation:
          first === null
            ? null
            : {
                dropped,
                first,
                droppedKeys: dropped.map((spec) => spec.key),
                banner: relaxationBanner(first, ctx),
              },
      }
    }
    // Drop the least important constraint still standing: the highest priority
    // number, which is the most recent graph answer.
    const victim = [...active].reverse().find(canDrop)
    if (victim === undefined) break
    active = active.filter((spec) => spec !== victim)
  }

  return { pool: [], active, relaxation: null, affordable: false }
}

/**
 * The last-resort winner (docs/02-architecture.md §4.8 rule 3). It still honours the
 * constraints that are never dropped, plus anything R14's restore control has
 * forced back on — otherwise "put international back" could answer with a domestic
 * plan, which would be a lie.
 */
function cheapestHonouring(
  candidates: readonly Candidate[],
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
  forced: ReadonlySet<ConstraintKey>,
): Candidate | null {
  const kept = specs.filter((spec) => !isDroppable(spec) || forced.has(spec.key))
  const pool = candidates.filter((c) => satisfies(c.destination, ctx, kept))
  if (pool.length > 0) return cheapestOf(pool)
  // A key R14 forced back on has no plan at all rather than a plan that quietly
  // ignores it; the banner has a sentence for exactly that case.
  return forced.size > 0 ? null : cheapestOf(candidates)
}

/**
 * The recommendation, given a run of the ladder.
 *
 * With no forced key this is `bestOf` — the best answer to the user's answers. With
 * a key forced back on (R14's restore control) it is the **cheapest**, because the
 * question that control asks is "what would having this back cost me", and the
 * banner quotes that figure before the user commits to it. Selecting by score there
 * would put a number on screen that the plan behind the button does not match.
 */
function pickWinner(
  run: Survivors,
  candidates: readonly Candidate[],
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
  forced: ReadonlySet<ConstraintKey>,
): Candidate | null {
  if (run.affordable) return forced.size === 0 ? bestOf(run.pool) : cheapestOf(run.pool)
  return cheapestHonouring(candidates, ctx, specs, forced)
}

/**
 * R14's restore control: what the dropped constraint would cost if we put it back.
 * `null` on both figures means the catalogue has nothing at all with it re-applied,
 * and the banner says exactly that rather than offering a plan that does not exist.
 *
 * It runs precisely what `generatePlanSet(..., forceConstraints: [key])` runs, so
 * the figure in the banner and the plan behind `Use the ₹X plan` cannot disagree.
 */
function restoreFor(
  spec: ConstraintSpec,
  candidates: readonly Candidate[],
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
  shownTotal: number,
): Restore {
  const forced = new Set<ConstraintKey>([spec.key])
  const winner = pickWinner(
    survive(candidates, ctx, specs, forced),
    candidates,
    ctx,
    specs,
    forced,
  )

  return {
    key: spec.key,
    label: spec.label,
    costDelta: winner === null ? null : winner.cost.partyTotal - shownTotal,
    total: winner === null ? null : winner.cost.partyTotal,
  }
}

function toPlan(
  candidate: Candidate,
  ctx: PlanContext,
  input: PlanInput,
  catalogue: CatalogueSnapshot,
  variant: PlanVariant,
  affordable: boolean,
  why: Why,
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
    why,
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
  const forced = new Set<ConstraintKey>(input.forceConstraints ?? [])

  const survivors = survive(candidates, ctx, specs, forced)
  const { pool, active, affordable } = survivors
  const winner = pickWinner(survivors, candidates, ctx, specs, forced)
  if (winner === null) {
    throw new Error('[compass] E-PLANNER-EMPTY: no candidate survived the ladder')
  }

  const ceiling = stretchCeiling(ctx.budget)
  const why = (candidate: Candidate): Why =>
    explain({
      chosen: candidate,
      all: candidates,
      ctx,
      graph,
      answers: input.answers,
      activeSpecs: active,
      ceiling,
    })

  const recommended = toPlan(winner, ctx, input, catalogue, 'recommended', affordable, why(winner))

  // R11 — the two alternatives, chosen from the same survivors the recommendation
  // came from, so a Saver can never be a plan the user's answers already excluded.
  const alternatives = affordable ? pool : []
  const saverPick = bestOf(
    alternatives.filter(
      (c) =>
        c.destination.id !== winner.destination.id &&
        c.cost.partyTotal <= saverCeiling(winner.cost.partyTotal),
    ),
  )
  // A Stretch that names the same place as the Saver is two cards and one idea, so
  // the third card has to be a third destination.
  const stretchPick = bestOf(
    alternatives.filter(
      (c) =>
        c.destination.id !== winner.destination.id &&
        c.destination.id !== saverPick?.destination.id &&
        c.cost.partyTotal > winner.cost.partyTotal &&
        c.cost.partyTotal <= ceiling,
    ),
  )

  const relaxation: Relaxation | null =
    survivors.relaxation === null
      ? null
      : {
          droppedKeys: survivors.relaxation.droppedKeys,
          banner: survivors.relaxation.banner,
          restore: restoreFor(
            survivors.relaxation.first,
            candidates,
            ctx,
            specs,
            winner.cost.partyTotal,
          ),
        }

  return {
    recommended,
    saver:
      saverPick === null
        ? null
        : toPlan(saverPick, ctx, input, catalogue, 'saver', true, why(saverPick)),
    stretch:
      stretchPick === null
        ? null
        : toPlan(stretchPick, ctx, input, catalogue, 'stretch', true, why(stretchPick)),
    saverAbsentReason: saverPick === null ? SAVER_ABSENT_REASON : null,
    stretchAbsentReason: stretchPick === null ? STRETCH_ABSENT_REASON : null,
    relaxation,
    defaultedQuestions: options.defaultedQuestions ?? 0,
    catalogueVersion: catalogue.meta.version,
    snapshotDate: catalogue.meta.snapshotDate,
    candidatesEvaluated: candidates.length,
  }
}
