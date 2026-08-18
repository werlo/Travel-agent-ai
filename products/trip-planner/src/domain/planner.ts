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
  rerollRelaxationBanner,
  satisfies,
  sortByPriority,
  vibeConstraint,
  withPathPriorities,
} from './constraints'
import { nightsBetween } from './dates'
import { explain } from './explain'
import { canonicalise, planId } from './hash'
import { buildDays, buildLegs, scheduleItinerary, type Itinerary } from './itinerary'
import { roomsFor } from './money'
import { priceCandidate } from './pricing'
import { seasonFor } from './season'
import { QUESTION_GRAPH } from './questions/graph'
import { constraintsFor, preferredTags } from './questions/path'
import { scoreCandidate } from './scoring'
import type {
  CatalogueSnapshot,
  ConstraintKey,
  ConstraintSpec,
  CostBreakdown,
  Destination,
  Plan,
  PlanContext,
  PlanInput,
  PlanSet,
  PlanVariant,
  QuestionGraph,
  Relaxation,
  Restore,
  Rupees,
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
  /** The whole schedule: one base, no wrong-day placements, no repeats. */
  itinerary: Itinerary
  cost: CostBreakdown
  score: number
}

export function planContextFor(input: PlanInput, graph: QuestionGraph): PlanContext {
  const { basics } = input
  const nights = nightsBetween(basics.startDate, basics.endDate)
  const children = basics.children ?? []
  // `travellers` is the party size every requirement quotes, so it wins any
  // disagreement: a basics record written before R24 existed carries no split at
  // all, and one that carries an inconsistent split is normalised rather than
  // priced for a party nobody described.
  const declared = basics.adults ?? basics.travellers - children.length
  const adults =
    declared + children.length === basics.travellers
      ? declared
      : Math.max(0, basics.travellers - children.length)
  const travellers = adults + children.length
  return {
    vibe: input.vibe,
    origin: basics.origin,
    startDate: basics.startDate,
    endDate: basics.endDate,
    nights,
    days: nights + 1,
    travellers,
    adults,
    children,
    rooms: roomsFor(travellers),
    budget: basics.budget,
    freeDay: basics.freeDay === true,
    season: seasonFor(basics.startDate, basics.endDate),
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
    for (const stay of destination.stays) {
      // The schedule depends on the stay now: the stay picks the base town, and
      // the base town decides what can be reached from it (fix 9).
      const itinerary = scheduleItinerary(destination, stay, ctx)
      const cost = priceCandidate(destination, stay, itinerary.chosen, ctx)
      candidates.push({
        destination,
        stay,
        itinerary,
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

/** How many of `droppable` a candidate fails to satisfy — the size of the drop
 * set naming that candidate would require. */
function violationCount(
  candidate: Candidate,
  ctx: PlanContext,
  droppable: readonly ConstraintSpec[],
): number {
  let n = 0
  for (const spec of droppable) if (!spec.test(candidate.destination, ctx)) n += 1
  return n
}

/** Which of `ordered` a candidate satisfies — the mirror of `violationCount`,
 * used to build the banner from whichever candidate actually ends up shown. */
function activeFor(
  ordered: readonly ConstraintSpec[],
  droppable: readonly ConstraintSpec[],
  candidate: Candidate,
  ctx: PlanContext,
): ConstraintSpec[] {
  const violates = new Set(droppable.filter((spec) => !spec.test(candidate.destination, ctx)))
  return ordered.filter((spec) => !violates.has(spec))
}

/** The R14 banner + restore control, built from whatever `active` a shown
 * winner actually leaves standing. Shared by `survive` (the first guess) and
 * `stableSurvive`'s loop (each subsequent one), so the two can never compute a
 * banner two different ways for the same candidate. */
function relaxationForActive(
  ordered: readonly ConstraintSpec[],
  active: readonly ConstraintSpec[],
  ctx: PlanContext,
): LadderRelaxation | null {
  const dropped = ordered.filter((spec) => !active.includes(spec))
  const first = mostImportantDropped(ordered, active)
  if (first === null) return null
  return {
    dropped,
    first,
    droppedKeys: dropped.map((spec) => spec.key),
    banner: relaxationBanner(first, ctx),
  }
}

/**
 * The cheapest candidate that satisfies every spec in `mustHold`. Ceiling-bound
 * first; with `allowOverCeiling` (R14's restore preview only — never the main
 * recommendation), falls back to the cheapest that satisfies `mustHold`
 * regardless of price, mirroring `cheapestHonouring`'s "never a dead end" rule
 * so the restore control can honestly say what putting a constraint back would
 * cost even when that number is itself over the stretch ceiling.
 */
function cheapestSatisfying(
  candidates: readonly Candidate[],
  ctx: PlanContext,
  ceiling: number,
  mustHold: readonly ConstraintSpec[],
  allowOverCeiling = false,
): Candidate | null {
  const capped = candidates.filter(
    (c) => c.cost.partyTotal <= ceiling && satisfies(c.destination, ctx, mustHold),
  )
  if (capped.length > 0) return cheapestOf(capped)
  if (!allowOverCeiling) return null
  const uncapped = candidates.filter((c) => satisfies(c.destination, ctx, mustHold))
  return uncapped.length > 0 ? cheapestOf(uncapped) : null
}

/**
 * The ladder (fixed round F1, architecture review §2 / D2). It used to drop the
 * single most-recent answer, refilter, and drop the *next* most-recent one if
 * that still came up empty — accumulating drops in a fixed order and never
 * reconsidering the choice. That produced a banner naming the wrong constraint
 * whenever the fixed order was not the minimal, cheapest one: R14's own worked
 * example (party/city/9/₹4,50,000) dropped "city nightlife" (the more recent
 * answer) when dropping "a city" instead would have reached North Goa, ₹15,600
 * *cheaper* — the arithmetic impossibility that proved the old banner false
 * (`restore.costDelta` went negative).
 *
 * The fix asks the catalogue directly instead of guessing an order: for every
 * candidate, count how many droppable constraints it actually fails. The
 * smallest such count, over the whole catalogue, is the fewest concessions any
 * real trip needs — and among candidates tied at that count, the cheapest one
 * decides which constraints get named as dropped. Whatever the banner names was
 * therefore genuinely unavoidable at the minimum cost, which is what makes
 * `restore.costDelta < 0` structurally impossible: restoring a constraint can
 * only narrow the search that produced the original winner, never widen it (see
 * `tests/planner.test.ts`, "the relaxation banner never lies"). `budget`, `dates`
 * and `travellers` are never dropped. This is one pass over the (≤ 42) candidate
 * list per call — microseconds, not a search over combinations.
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
  const kept = ordered.filter((spec) => !canDrop(spec))
  const droppable = ordered.filter(canDrop)

  const poolFor = (active: readonly ConstraintSpec[]): Candidate[] =>
    candidates.filter((c) => satisfies(c.destination, ctx, active) && c.cost.partyTotal <= ceiling)

  // Every affordable candidate that at least honours what is never dropped
  // (budget/dates/travellers, plus anything R14's restore control forced back),
  // scored by how many droppable constraints it still fails.
  const eligible = candidates.filter(
    (c) => c.cost.partyTotal <= ceiling && satisfies(c.destination, ctx, kept),
  )
  if (eligible.length === 0) {
    return { pool: [], active: kept, relaxation: null, affordable: false }
  }

  const minViolations = Math.min(...eligible.map((c) => violationCount(c, ctx, droppable)))
  if (minViolations === 0) {
    return { pool: poolFor(ordered), active: ordered, affordable: true, relaxation: null }
  }

  // R25 — with two independently droppable *kinds* of thing (the vibe floor and
  // a graph answer/region) active at once, more than one candidate can tie at
  // the same minimal violation count while disagreeing about *which* spec they
  // each fail (one might fail only the vibe floor, another only a graph
  // answer). Restricting the pool to whichever one candidate happened to be
  // cheapest — and then separately letting `pickWinner` choose by *score* from
  // that already-narrowed pool — let the shown plan and the banner disagree
  // about what was actually given up. The pool here is every eligible
  // candidate tied at the minimum, full stop; which single constraint set gets
  // named in the banner is decided by the same rule `pickWinner` will use on
  // this exact pool (score when nothing is forced, cheapest when something is),
  // so the banner can never describe a different plan than the one on screen.
  const tied = eligible.filter((c) => violationCount(c, ctx, droppable) === minViolations)
  const representative = (forced.size === 0 ? bestOf(tied) : cheapestOf(tied))!
  const active = activeFor(ordered, droppable, representative, ctx)
  return { pool: tied, active, affordable: true, relaxation: relaxationForActive(ordered, active, ctx) }
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
 * The un-forced recommendation, made stable against R14's own restore control
 * (fix round F1, architecture review §2).
 *
 * `bestOf` picks by score, and `WEIGHT.budgetFit` deliberately rewards a plan
 * that spends closer to the budget — so it can pick something more expensive
 * than the cheapest candidate satisfying the very constraint the ladder just
 * dropped. When that happens, the banner's restore control offers a *cheaper*
 * plan than the one on screen for putting a requirement *back*, which is the
 * exact self-disproof the architecture review caught (`restore.costDelta < 0`).
 *
 * The fix: whenever the shown recommendation is dominated — a plan exists that
 * is no more expensive AND keeps the dropped constraint — prefer honouring the
 * constraint. Recompute with it held mandatory and check again; droppable specs
 * are few (≤ ~7 on any path), so this converges in a handful of rounds.
 *
 * R25 — with two independently droppable *kinds* of thing (the vibe floor and
 * a graph answer/region), the naive version of this loop — re-run the whole
 * ladder fresh with one more key forced, keep going if it is cheaper — could
 * wander past a genuinely-better fixed point: forcing back the answer the
 * shown plan gave up could only be satisfied by a *different* destination that
 * then failed the vibe floor too, which the loop happily accepted purely
 * because it was cheaper, ending up further from the user's answers than
 * necessary. The fix is `cheapestSatisfying`: each round only ever asks for
 * the cheapest candidate that keeps *everything the current winner already
 * has* (`active`) plus the one constraint being restored — never a fresh,
 * independent search that is free to trade a held constraint for a dropped
 * one. Because every accepted candidate's own violations are therefore a
 * strict subset of what came before, the drop set only ever shrinks and the
 * loop is monotone in both cost and constraint count.
 */
function stableSurvive(
  candidates: readonly Candidate[],
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
): { survivors: Survivors; winner: Candidate; forced: ReadonlySet<ConstraintKey> } {
  const ceiling = stretchCeiling(ctx.budget)
  const ordered = sortByPriority(specs)
  const droppable = ordered.filter(isDroppable)

  let forced = new Set<ConstraintKey>()
  let survivors = survive(candidates, ctx, specs, forced)
  let winner = pickWinner(survivors, candidates, ctx, specs, forced)
  if (winner === null) {
    throw new Error('[compass] E-PLANNER-EMPTY: no candidate survived the ladder')
  }

  for (let guard = 0; guard < specs.length && survivors.relaxation !== null; guard += 1) {
    const droppedSpec = survivors.relaxation.first
    const mustHold = [...survivors.active, droppedSpec]
    const restoredWinner = cheapestSatisfying(candidates, ctx, ceiling, mustHold)
    if (restoredWinner === null || restoredWinner.cost.partyTotal > winner.cost.partyTotal) {
      break
    }
    forced = new Set([...forced, droppedSpec.key])
    winner = restoredWinner
    const active = activeFor(ordered, droppable, winner, ctx)
    survivors = {
      ...survivors,
      // Every candidate that now clears the same bar the winner does — the
      // same broadened pool `survive` itself would build at this level — so
      // the Saver/Stretch alternatives stay genuine options, not just echoes
      // of this one candidate.
      pool: candidates.filter(
        (c) => c.cost.partyTotal <= ceiling && satisfies(c.destination, ctx, active),
      ),
      active,
      relaxation: relaxationForActive(ordered, active, ctx),
    }
  }

  return { survivors, winner, forced }
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
  shownTotal: number,
  /**
   * R25 — everything the shown plan already honours. "Put X back" means keep
   * all of that and add X, never quote a plan that is only cheaper because it
   * quietly gave up something else the shown plan got right. With a single
   * droppable dimension that could never happen (there was nothing else *to*
   * give up); with two independent ones — the vibe floor and a graph
   * answer/region — a plain "cheapest candidate that satisfies X" search can
   * wander into a destination that fails a *different* constraint instead,
   * which is exactly the false "cheaper" the F1 fix (`restore.costDelta < 0`)
   * exists to rule out.
   */
  held: readonly ConstraintSpec[],
): Restore {
  const ceiling = stretchCeiling(ctx.budget)
  const winner = cheapestSatisfying(candidates, ctx, ceiling, [...held, spec], true)

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
  const days = buildDays(candidate.stay, candidate.itinerary, legs, ctx)
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
    adults: ctx.adults,
    children: ctx.children.length,
    origin: ctx.origin,
    baseName: candidate.itinerary.base.name,
    stay: {
      id: candidate.stay.id,
      name: candidate.stay.name,
      tier: candidate.stay.tier,
      nights: ctx.nights,
      rooms: ctx.rooms,
      pricePerRoomPerNight: candidate.stay.pricePerRoomPerNight,
      baseName: candidate.itinerary.base.name,
    },
    legs,
    days,
    unscheduled: candidate.itinerary.unscheduled,
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

/**
 * R27 — true when one of the destinations the user has already turned down would,
 * on its own, have satisfied everything the shown plan currently honours plus the
 * constraint the ladder just dropped, within the stretch ceiling. That is exactly
 * "a plan shown moments earlier fit fine" — the case `relaxationBanner`'s blanket
 * "No `<x>` trip fits" claim must never paper over.
 */
function excludedSatisfiedDropped(
  droppedSpec: ConstraintSpec,
  active: readonly ConstraintSpec[],
  ctx: PlanContext,
  excludedIds: ReadonlySet<string>,
  catalogue: CatalogueSnapshot,
  ceiling: Rupees,
): boolean {
  if (excludedIds.size === 0) return false
  const excludedDestinations = catalogue.destinations.filter((d) => excludedIds.has(d.id))
  if (excludedDestinations.length === 0) return false
  const excludedCandidates = buildCandidates(
    { meta: catalogue.meta, destinations: excludedDestinations },
    ctx,
  )
  const mustHold = [...active, droppedSpec]
  return excludedCandidates.some(
    (c) => c.cost.partyTotal <= ceiling && satisfies(c.destination, ctx, mustHold),
  )
}

export function generatePlanSet(
  input: PlanInput,
  catalogue: CatalogueSnapshot,
  options: GenerateOptions = {},
): PlanSet {
  const graph = options.graph ?? QUESTION_GRAPH
  const ctx = planContextFor(input, graph)

  // R22 — a destination the user has turned down is not a candidate, is not a
  // rejected-alternative line, and is not a Saver. It is simply not in the search.
  const excludedIds = new Set(input.excludeDestinationIds ?? [])
  const excluded = catalogue.destinations
    .filter((destination) => excludedIds.has(destination.id))
    .map((destination) => ({ id: destination.id, name: destination.name }))
  const searchable: CatalogueSnapshot =
    excludedIds.size === 0
      ? catalogue
      : {
          meta: catalogue.meta,
          destinations: catalogue.destinations.filter((d) => !excludedIds.has(d.id)),
        }

  const candidates = buildCandidates(searchable, ctx)
  if (candidates.length === 0) {
    throw new Error('[compass] E-CATALOGUE-EMPTY: no destinations to plan against')
  }

  const specs = [
    nightsConstraint(),
    vibeConstraint(input.vibe),
    ...withPathPriorities(constraintsFor(graph, input.answers)),
  ]
  const externalForced = new Set<ConstraintKey>(input.forceConstraints ?? [])

  // With nothing forced by the caller, this is the primary recommendation, and
  // it has to survive its own restore control (fix round F1 — see
  // `stableSurvive`). With something forced (R14's "Use the ₹X plan"), the
  // caller already knows exactly what plan it is asking for, unchanged.
  let survivors: Survivors
  let winner: Candidate
  if (externalForced.size === 0) {
    const stable = stableSurvive(candidates, ctx, specs)
    survivors = stable.survivors
    winner = stable.winner
  } else {
    survivors = survive(candidates, ctx, specs, externalForced)
    const externalWinner = pickWinner(survivors, candidates, ctx, specs, externalForced)
    if (externalWinner === null) {
      throw new Error('[compass] E-PLANNER-EMPTY: no candidate survived the ladder')
    }
    winner = externalWinner
  }
  const { pool, active, affordable } = survivors
  // Separate from `affordable` (which gates whether the *natural* pool is used
  // for the Saver/Stretch alternatives, unaffected by a pin): the budget line
  // on `recommended` itself has to reflect whichever candidate actually ends up
  // there.
  let recommendedAffordable = affordable

  const ceiling = stretchCeiling(ctx.budget)

  // R11/R12 — a hand-picked destination (Saver/Stretch selected, or what
  // survived a "Not this one — somewhere else" reject) pins the recommendation.
  // The natural ladder run above still supplies the alternatives pool and any
  // relaxation banner; only the plan actually shown as `recommended` is
  // overridden, and only when the caller is not already asking for a specific
  // forced plan (R14's restore preview). If the pinned destination genuinely
  // cannot be scheduled any more (its nights no longer fit the trip, or it has
  // been excluded), the pin falls through to the natural winner and R19's
  // change notice — computed by the caller from the previous vs. next plan —
  // names the substitution instead of it happening silently.
  // R31 — true once a hand-picked destination has actually replaced the ladder's
  // own winner below, so `why` can tell the difference between "the engine
  // dropped this answer while searching" and "the user picked a destination that
  // does not hold this answer" — two different reasons that read as the same
  // `held: false`, and only one of which is the ladder's own "nothing fits" claim.
  let pinnedOverrideApplied = false
  if (
    externalForced.size === 0 &&
    input.pinnedDestinationId !== undefined &&
    input.pinnedDestinationId !== winner.destination.id
  ) {
    const pinnedCandidates = candidates.filter(
      (c) =>
        c.destination.id === input.pinnedDestinationId &&
        nightsConstraint().test(c.destination, ctx),
    )
    const pinnedWinner = bestOf(pinnedCandidates)
    if (pinnedWinner !== null) {
      winner = pinnedWinner
      recommendedAffordable = pinnedWinner.cost.partyTotal <= ceiling
      pinnedOverrideApplied = true
    }
  }

  const why = (candidate: Candidate, pinned = false): Why =>
    explain({
      chosen: candidate,
      all: candidates,
      ctx,
      graph,
      answers: input.answers,
      activeSpecs: active,
      ceiling,
      pinned,
    })

  const recommended = toPlan(
    winner,
    ctx,
    input,
    catalogue,
    'recommended',
    recommendedAffordable,
    why(winner, pinnedOverrideApplied),
  )

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

  // R27 — a reroll (or a pre-plan exclusion, R26) can leave the ladder needing to
  // drop the same constraint the just-excluded destination actually satisfied. The
  // blanket "No <x> trip fits" claim is false in exactly that case: a fitting <x>
  // trip was on screen a moment ago. Named explicitly instead of asserted away.
  const bannerIsReroll =
    survivors.relaxation !== null &&
    excludedSatisfiedDropped(survivors.relaxation.first, active, ctx, excludedIds, catalogue, ceiling)

  const relaxation: Relaxation | null =
    survivors.relaxation === null
      ? null
      : {
          droppedKeys: survivors.relaxation.droppedKeys,
          banner: bannerIsReroll
            ? rerollRelaxationBanner(survivors.relaxation.first, ctx)
            : survivors.relaxation.banner,
          restore: restoreFor(
            survivors.relaxation.first,
            candidates,
            ctx,
            winner.cost.partyTotal,
            active,
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
    excluded,
  }
}
