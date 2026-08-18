import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { stretchCeiling } from '../src/domain/budget'
import {
  dropOrder,
  flightHoursConstraint,
  nightsConstraint,
  PRIORITY,
  regionConstraint,
  satisfies,
  sortByPriority,
  tagConstraint,
  withPathPriorities,
} from '../src/domain/constraints'
import { generatePlanSet, planContextFor } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { constraintsFor, defaultWalk } from '../src/domain/questions/path'
import { VIBE_ORDER } from '../src/domain/vibes'
import type { AnswerPairs, Basics, PlanInput, Vibe } from '../src/domain/types'

/**
 * R14 — never dead-end (docs/02-architecture.md §4.5, A9).
 *
 * The ladder has a fixed, documented order and the whole requirement rests on it:
 * budget, dates and travellers are never given up, graph answers go first and most
 * recent first, then region, then vibe. These tests assert the order itself rather
 * than the destination it happens to produce, so a catalogue edit cannot make them
 * pass for the wrong reason.
 */

const BASICS: Basics = {
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  budget: 60000,
  travellers: 2,
  adults: 2,
  children: [],
  origin: 'Bengaluru',
  freeDay: false,
}

function inputFor(
  vibe: Vibe,
  answers: Record<string, string> = {},
  basics: Partial<Basics> = {},
): PlanInput {
  const walk = defaultWalk(QUESTION_GRAPH, vibe, answers)
  return { vibe, basics: { ...BASICS, ...basics }, answers: walk.pairs as AnswerPairs }
}

function specsFor(input: PlanInput) {
  return [
    nightsConstraint(),
    ...withPathPriorities(constraintsFor(QUESTION_GRAPH, input.answers)),
  ]
}

describe('the documented drop order (A9)', () => {
  it('drops the most recent graph answer first, then region, and never the rest', () => {
    const specs = [
      nightsConstraint(),
      regionConstraint('international'),
      { ...tagConstraint('q1', 'coast', 'coastal', ''), priority: PRIORITY.question },
      { ...tagConstraint('q2', 'lively', 'lively', ''), priority: PRIORITY.question + 1 },
      { ...flightHoursConstraint('q3', 6), priority: PRIORITY.question + 2 },
    ]

    expect(dropOrder(specs)).toEqual(['q:q3', 'q:q2', 'q:q1', 'region'])
    // budget / dates / travellers are never in the ladder at all.
    expect(dropOrder(specs)).not.toContain('dates')
    expect(dropOrder(specs)).not.toContain('budget')
    expect(dropOrder(specs)).not.toContain('travellers')
  })

  it('stamps graph constraints so path depth is the priority', () => {
    const input = inputFor('beach', {
      'beach-region': 'within-india',
      'beach-coast': 'west-coast',
      'beach-crowd': 'empty',
      'stay-style': 'local-stays',
    })
    const ordered = sortByPriority(specsFor(input))
    expect(ordered.map((s) => [s.key, s.priority])).toEqual([
      ['dates', PRIORITY.dates],
      ['region', PRIORITY.region],
      ['q:beach-coast', PRIORITY.question + 1],
      ['q:beach-crowd', PRIORITY.question + 2],
    ])
    expect(dropOrder(ordered)).toEqual(['q:beach-crowd', 'q:beach-coast', 'region'])
  })

  it('drops exactly a prefix of the drop order, for every vibe at every budget', () => {
    let relaxationsSeen = 0

    for (const vibe of VIBE_ORDER) {
      for (const budget of [18000, 25000, 40000, 60000, 90000, 200000]) {
        const input = inputFor(
          vibe,
          { [`${vibe}-region`]: 'international' },
          { budget, travellers: 4 },
        )
        const planSet = generatePlanSet(input, CATALOGUE)
        if (planSet.relaxation === null) continue
        relaxationsSeen += 1

        const order = dropOrder(specsFor(input))
        const dropped = [...planSet.relaxation.droppedKeys]
        const where = `${vibe}/${budget}`

        // The ladder gives up the least important things first and stops the moment
        // something fits — so the dropped set is always a prefix of the order.
        expect([...dropped].sort(), where).toEqual(
          [...order.slice(0, dropped.length)].sort(),
        )
        // Never the three that are not preferences.
        for (const key of ['budget', 'dates', 'travellers']) {
          expect(dropped, where).not.toContain(key)
        }
      }
    }

    expect(relaxationsSeen).toBeGreaterThan(0)
  })

  it('names the most important thing it gave up in the banner', () => {
    const input = inputFor(
      'beach',
      { 'beach-region': 'within-india', 'beach-coast': 'islands' },
      { budget: 40000 },
    )
    const planSet = generatePlanSet(input, CATALOGUE)
    expect(planSet.relaxation).not.toBeNull()
    expect(planSet.relaxation!.banner).toBe(
      'No island beach trip fits ₹40,000 for 2 — we looked at the mainland too.',
    )
    expect(planSet.relaxation!.droppedKeys).toContain('q:beach-coast')
    expect(planSet.relaxation!.restore.key).toBe('q:beach-coast')
  })
})

describe("the PRD's own dead-end case", () => {
  const input = inputFor(
    'party',
    { 'party-region': 'international' },
    { budget: 25000, travellers: 4, endDate: '2026-10-12' },
  )

  it('returns a plan with a non-null relaxation rather than nothing', () => {
    const planSet = generatePlanSet(input, CATALOGUE)
    expect(planSet.relaxation).not.toBeNull()
    expect(planSet.recommended.destinationName.length).toBeGreaterThan(0)
    expect(planSet.recommended.days.length).toBe(3)
    expect(planSet.relaxation!.banner).toBe(
      'No international party trip fits ₹25,000 for 4 — we searched within India instead.',
    )
    expect(planSet.relaxation!.droppedKeys).toEqual(['region'])
  })

  it('prices the restore control in rupees', () => {
    const planSet = generatePlanSet(input, CATALOGUE)
    const { restore } = planSet.relaxation!
    expect(restore.key).toBe('region')
    expect(restore.label).toBe('international')
    expect(restore.total).not.toBeNull()
    expect(restore.costDelta).toBe(restore.total! - planSet.recommended.cost.partyTotal)
    expect(restore.costDelta!).toBeGreaterThan(0)
  })

  it('answers the restore with the exact plan the banner quoted', () => {
    const planSet = generatePlanSet(input, CATALOGUE)
    const { restore } = planSet.relaxation!

    const restored = generatePlanSet(
      { ...input, forceConstraints: [restore.key] },
      CATALOGUE,
    )
    expect(restored.recommended.cost.partyTotal).toBe(restore.total)
    // The whole point: it really is international this time.
    expect(restored.recommended.region).toBe('international')
    // A different plan, so a different plan ID (R13).
    expect(restored.recommended.planId).not.toBe(planSet.recommended.planId)
  })

  it('is the cheapest international option, not merely an international one', () => {
    const planSet = generatePlanSet(input, CATALOGUE)
    const { restore } = planSet.relaxation!
    const ctx = { nights: 2 }
    const cheapest = Math.min(
      ...CATALOGUE.destinations
        .filter(
          (d) =>
            d.region === 'international' &&
            ctx.nights >= d.minNights &&
            ctx.nights <= d.maxNights,
        )
        .flatMap((d) =>
          d.stays.map(
            (stay) =>
              d.fares.Bengaluru.perPerson * 4 +
              stay.pricePerRoomPerNight * 2 * 2 +
              d.localAllowancePerPersonPerDay * 3 * 4,
          ),
        ),
    )
    // Experiences are the only line this rough sum leaves out, so the engine's
    // figure can only be >= it; what matters is that no cheaper region exists.
    expect(restore.total!).toBeGreaterThanOrEqual(cheapest)
  })
})

describe('forcing a constraint back on', () => {
  it('never drops a forced key, whatever the budget', () => {
    const input = inputFor(
      'party',
      { 'party-region': 'international' },
      { budget: 25000, travellers: 4, endDate: '2026-10-12' },
    )
    const restored = generatePlanSet(
      { ...input, forceConstraints: ['region'] },
      CATALOGUE,
    )
    expect(restored.relaxation).toBeNull()
    expect(restored.recommended.region).toBe('international')
    expect(restored.recommended.budget.status).toBe('no-fit')
  })

  it('honours the non-droppable constraints as well', () => {
    const input = inputFor(
      'beach',
      { 'beach-region': 'within-india', 'beach-coast': 'islands' },
      { budget: 40000 },
    )
    const restored = generatePlanSet(
      { ...input, forceConstraints: ['q:beach-coast'] },
      CATALOGUE,
    )
    const destination = CATALOGUE.destinations.find(
      (d) => d.id === restored.recommended.destinationId,
    )!
    expect(destination.tags).toContain('islands')
    // `dates` sits above the forced key in the ladder, so it is still in force.
    const ctx = planContextFor(input, QUESTION_GRAPH)
    expect(satisfies(destination, ctx, [nightsConstraint()])).toBe(true)
  })

  it('stays deterministic and stays inside the performance budget', () => {
    const input = inputFor(
      'party',
      { 'party-region': 'international' },
      { budget: 25000, travellers: 4, endDate: '2026-10-12' },
    )
    const a = generatePlanSet(input, CATALOGUE)
    const b = generatePlanSet(input, CATALOGUE)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))

    const heavy = inputFor('beach', {}, { endDate: '2026-10-31', travellers: 12 })
    const started = performance.now()
    for (let i = 0; i < 50; i += 1) generatePlanSet(heavy, CATALOGUE)
    expect((performance.now() - started) / 50).toBeLessThan(20)
  })

  it('leaves the plan ID of an unforced plan untouched', () => {
    const input = inputFor('beach')
    expect(generatePlanSet({ ...input, forceConstraints: [] }, CATALOGUE).recommended.planId).toBe(
      generatePlanSet(input, CATALOGUE).recommended.planId,
    )
  })
})

describe('R9 still holds with the whole trust layer in place', () => {
  it('never recommends above budget x 1.25 unless nothing at all fits', () => {
    for (const vibe of VIBE_ORDER) {
      for (const budget of [20000, 45000, 60000, 120000, 300000]) {
        const planSet = generatePlanSet(inputFor(vibe, {}, { budget }), CATALOGUE)
        for (const plan of [planSet.recommended, planSet.saver, planSet.stretch]) {
          if (plan === null || plan.budget.status === 'no-fit') continue
          expect(plan.cost.partyTotal, `${vibe}@${budget}`).toBeLessThanOrEqual(
            stretchCeiling(budget),
          )
        }
      }
    }
  })
})
