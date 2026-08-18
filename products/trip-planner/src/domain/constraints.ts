import { formatRupees } from './money'
import { VIBE_LABELS } from './vibes'
import type {
  ConstraintKey,
  ConstraintSpec,
  Destination,
  DestinationTag,
  PlanContext,
  Region,
} from './types'

/**
 * Constraints and the relaxation ladder (docs/02-architecture.md §4.5, R14, A9).
 *
 * Priority order is fixed and documented, lowest number first:
 *   0 budget · 1 dates · 2 travellers · 3 vibe · 4 region · 5..n graph answers.
 * Lower priority number = more important = dropped LAST. Graph answers are dropped
 * first, most recent first, which is why their priority grows with path depth.
 */

export const PRIORITY = {
  budget: 0,
  dates: 1,
  travellers: 2,
  vibe: 3,
  region: 4,
  /** First graph answer; each later answer on the path is one higher. */
  question: 5,
} as const

export function regionConstraint(region: Region): ConstraintSpec {
  return {
    key: 'region',
    label: region === 'domestic' ? 'within India' : 'international',
    priority: PRIORITY.region,
    test: (d) => d.region === region,
    relaxNote:
      region === 'domestic'
        ? 'we looked outside India too'
        : 'we searched within India instead',
  }
}

export function tagConstraint(
  questionId: string,
  tag: DestinationTag,
  label: string,
  relaxNote: string,
): ConstraintSpec {
  return {
    key: `q:${questionId}`,
    label,
    priority: PRIORITY.question,
    test: (d) => d.tags.includes(tag),
    relaxNote,
  }
}

export function flightHoursConstraint(questionId: string, maxHours: number): ConstraintSpec {
  return {
    key: `q:${questionId}`,
    label: `under ${maxHours} hours in the air`,
    priority: PRIORITY.question,
    test: (d, ctx) => d.fares[ctx.origin].hours < maxHours,
    relaxNote: 'we included longer flights',
  }
}

/**
 * Nights inside the destination's own window. Never dropped: relaxing it would
 * produce an itinerary the destination cannot support (§4.5).
 */
export function nightsConstraint(): ConstraintSpec {
  return {
    key: 'dates',
    label: 'your dates',
    priority: PRIORITY.dates,
    test: (d, ctx) => ctx.nights >= d.minNights && ctx.nights <= d.maxNights,
    relaxNote: 'we ignored the suggested trip length',
  }
}

/**
 * Re-stamps the priority of graph-derived constraints so that the most recent
 * answer carries the highest number and is therefore dropped first (A9).
 */
export function withPathPriorities(
  perQuestion: ReadonlyArray<readonly ConstraintSpec[]>,
): ConstraintSpec[] {
  const out: ConstraintSpec[] = []
  perQuestion.forEach((specs, index) => {
    for (const spec of specs) {
      out.push(
        spec.key.startsWith('q:')
          ? { ...spec, priority: PRIORITY.question + index }
          : { ...spec },
      )
    }
  })
  return out
}

/** Most-important-first, so a filter reads in the same order it is documented. */
export function sortByPriority(specs: readonly ConstraintSpec[]): ConstraintSpec[] {
  return [...specs].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key))
}

export function satisfies(
  d: Destination,
  ctx: PlanContext,
  specs: readonly ConstraintSpec[],
): boolean {
  return specs.every((spec) => spec.test(d, ctx))
}

/**
 * The R14 banner sentence, built from the constraint that was dropped:
 * `No international party trip fits ₹25,000 for 4 — we searched within India instead.`
 */
export function relaxationBanner(dropped: ConstraintSpec, ctx: PlanContext): string {
  const vibe = VIBE_LABELS[ctx.vibe].toLowerCase()
  return `No ${dropped.label} ${vibe} trip fits ${formatRupees(ctx.budget)} for ${ctx.travellers} — ${dropped.relaxNote}.`
}

export function keysOf(specs: readonly ConstraintSpec[]): ConstraintKey[] {
  return specs.map((spec) => spec.key)
}
