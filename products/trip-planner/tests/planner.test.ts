import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { budgetLineFor, noFitLineFor, stretchCeiling } from '../src/domain/budget'
import { generatePlanSet } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { defaultWalk } from '../src/domain/questions/path'
import { VIBE_ORDER } from '../src/domain/vibes'
import type { AnswerPairs, Basics, PlanInput, Vibe } from '../src/domain/types'

/**
 * The engine (R7, R8, R9, R13, R14). `generatePlanSet` is pure, so these tests need
 * no mocks, no clock and no DOM — which is the point of the whole domain boundary.
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
): { input: PlanInput; defaulted: number } {
  const walk = defaultWalk(QUESTION_GRAPH, vibe, answers)
  return {
    input: { vibe, basics: { ...BASICS, ...basics }, answers: walk.pairs as AnswerPairs },
    defaulted: walk.defaulted,
  }
}

describe('determinism (R13)', () => {
  it('returns deep-equal output for deep-equal input, twice', () => {
    const { input } = inputFor('beach', { 'beach-region': 'within-india' })
    const a = generatePlanSet(input, CATALOGUE)
    const b = generatePlanSet(input, CATALOGUE)
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('returns the same plan for a freshly rebuilt but equal input', () => {
    const first = generatePlanSet(inputFor('mountains').input, CATALOGUE)
    const second = generatePlanSet(inputFor('mountains').input, CATALOGUE)
    expect(second.recommended.planId).toBe(first.recommended.planId)
    expect(second.recommended.destinationId).toBe(first.recommended.destinationId)
    expect(second.recommended.cost.partyTotal).toBe(first.recommended.cost.partyTotal)
  })

  it('changes the plan ID when the answers, the party or the budget change', () => {
    const base = generatePlanSet(inputFor('beach').input, CATALOGUE).recommended.planId
    expect(
      generatePlanSet(inputFor('beach', { 'beach-region': 'international' }).input, CATALOGUE)
        .recommended.planId,
    ).not.toBe(base)
    expect(
      generatePlanSet(inputFor('beach', {}, { travellers: 4 }).input, CATALOGUE).recommended
        .planId,
    ).not.toBe(base)
    expect(
      generatePlanSet(inputFor('beach', {}, { budget: 90000 }).input, CATALOGUE).recommended
        .planId,
    ).not.toBe(base)
  })

  it('puts the catalogue version in the plan set and in the ID hash', () => {
    const planSet = generatePlanSet(inputFor('beach').input, CATALOGUE)
    expect(planSet.catalogueVersion).toBe('2026-08-01')
    expect(planSet.snapshotDate).toBe('2026-08-01')

    const other = generatePlanSet(inputFor('beach').input, {
      ...CATALOGUE,
      meta: { ...CATALOGUE.meta, version: '2027-01-01' },
    })
    expect(other.recommended.planId).not.toBe(planSet.recommended.planId)
  })
})

describe('the plan itself (R7)', () => {
  it('gives a 5-night trip six day blocks, legs at each end and a stay for the whole trip', () => {
    const planSet = generatePlanSet(inputFor('beach').input, CATALOGUE)
    const plan = planSet.recommended

    expect(plan.days).toHaveLength(6)
    expect(plan.days.map((d) => d.label)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 4',
      'Day 5',
      'Day 6',
    ])
    for (const day of plan.days) {
      expect(day.experiences.length, day.label).toBeGreaterThanOrEqual(1)
      for (const experience of day.experiences) expect(experience.name.length).toBeGreaterThan(0)
    }
    expect(plan.days[0]!.legs.map((l) => l.kind)).toEqual(['outbound'])
    expect(plan.days[5]!.legs.map((l) => l.kind)).toEqual(['return'])
    expect(plan.days[0]!.stayEntry?.label).toContain('Check in')
    expect(plan.days[5]!.stayEntry?.label).toContain('Check out')
    expect(plan.stay.nights).toBe(5)
    expect(plan.stay.rooms).toBe(1)
    expect(plan.legs).toHaveLength(2)
    expect(plan.legs[0].perPerson + plan.legs[1].perPerson).toBe(
      plan.cost.travel / plan.travellers,
    )
  })

  it('produces a full itinerary for every vibe and every trip length in range', () => {
    for (const vibe of VIBE_ORDER) {
      for (const [endDate, nights] of [
        ['2026-10-11', 1],
        ['2026-10-15', 5],
        ['2026-10-31', 21],
      ] as const) {
        const { input } = inputFor(vibe, {}, { endDate })
        const plan = generatePlanSet(input, CATALOGUE).recommended
        expect(plan.days, `${vibe}/${nights}`).toHaveLength(nights + 1)
        // R21 — a day is filled or it says it is empty; it is never padded with an
        // experience the plan has already used (customer fix 6). A trip longer than
        // the base town has things to do therefore has honest empty days.
        for (const day of plan.days) {
          if (day.experiences.length === 0) {
            expect(
              day.note !== null || day.legs.length > 0,
              `${vibe}/${nights} day ${day.day}`,
            ).toBe(true)
          }
        }
        const names = plan.days.flatMap((day) => day.experiences.map((e) => e.name))
        expect(new Set(names).size, `${vibe}/${nights} repeats`).toBe(names.length)
        // Every trip of a week or less still fills its first days.
        if (nights <= 5) {
          expect(plan.days[1]?.experiences.length, `${vibe}/${nights}`).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('names the destination, the country and the stay property', () => {
    const plan = generatePlanSet(inputFor('culture').input, CATALOGUE).recommended
    expect(plan.destinationName.length).toBeGreaterThan(0)
    expect(plan.country.length).toBeGreaterThan(0)
    expect(plan.stay.name.length).toBeGreaterThan(0)
  })
})

describe('the budget line (R9)', () => {
  it('reads "under your budget" with the exact gap', () => {
    const line = budgetLineFor(51600, 60000)
    expect(line.status).toBe('within')
    expect(line.label).toBe('₹8,400 under your budget')
  })

  it('reads "On budget" inside half a percent', () => {
    expect(budgetLineFor(60000, 60000).label).toBe('On budget')
    expect(budgetLineFor(59900, 60000).label).toBe('On budget')
  })

  it('reads "Stretch — N% over your budget" above it', () => {
    expect(budgetLineFor(66000, 60000).label).toBe('Stretch — 10% over your budget')
    expect(budgetLineFor(67200, 60000).label).toBe('Stretch — 12% over your budget')
  })

  it('names the gap plainly when nothing in the catalogue fits', () => {
    expect(noFitLineFor(41300, 25000).label).toBe(
      'Nothing in this catalogue fits ₹25,000 — the closest is ₹41,300',
    )
  })

  it('never recommends a plan above budget × 1.25', () => {
    for (const vibe of VIBE_ORDER) {
      for (const budget of [20000, 45000, 60000, 120000, 300000]) {
        const { input } = inputFor(vibe, {}, { budget })
        const plan = generatePlanSet(input, CATALOGUE).recommended
        if (plan.budget.status === 'no-fit') continue
        expect(plan.cost.partyTotal, `${vibe} @ ${budget}`).toBeLessThanOrEqual(
          stretchCeiling(budget),
        )
      }
    }
  })

  it('labels the impossible case rather than showing nothing (R14)', () => {
    const { input } = inputFor('beach', {}, { budget: 5000, travellers: 12 })
    const planSet = generatePlanSet(input, CATALOGUE)
    expect(planSet.recommended.budget.status).toBe('no-fit')
    expect(planSet.recommended.budget.label).toContain('the closest is')
    expect(planSet.recommended.days.length).toBeGreaterThan(0)
  })
})

describe('constraints and the relaxation ladder (R4, R14)', () => {
  it('honours "Within India" and "International"', () => {
    const domestic = generatePlanSet(
      inputFor('beach', { 'beach-region': 'within-india' }).input,
      CATALOGUE,
    )
    expect(domestic.recommended.region).toBe('domestic')

    const international = generatePlanSet(
      inputFor('beach', { 'beach-region': 'international' }, { budget: 150000 }).input,
      CATALOGUE,
    )
    expect(international.recommended.region).toBe('international')
  })

  it('honours "under 6 hours in the air"', () => {
    const planSet = generatePlanSet(
      inputFor(
        'beach',
        { 'beach-region': 'international', 'beach-haul': 'under-6h' },
        { budget: 150000 },
      ).input,
      CATALOGUE,
    )
    const destination = CATALOGUE.destinations.find(
      (d) => d.id === planSet.recommended.destinationId,
    )!
    expect(destination.fares.Bengaluru.hours).toBeLessThan(6)
  })

  it('relaxes the least important constraint instead of dead-ending', () => {
    // The PRD's own dead-end case: international + party + tiny budget for four.
    const { input } = inputFor(
      'party',
      { 'party-region': 'international' },
      { budget: 25000, travellers: 4, endDate: '2026-10-12' },
    )
    const planSet = generatePlanSet(input, CATALOGUE)
    expect(planSet.recommended.destinationName.length).toBeGreaterThan(0)
    expect(planSet.recommended.days.length).toBeGreaterThan(0)
    expect(planSet.relaxation).not.toBeNull()
    expect(planSet.relaxation!.banner).toBe(
      'No international party trip fits ₹25,000 for 4 — we searched within India instead.',
    )
    expect(planSet.relaxation!.droppedKeys).toContain('region')
  })

  it('never asserts a universal the catalogue disproves (R14, fix round F1)', () => {
    // The architecture review's own reproduction: Party / Within India / A city /
    // A proper city night / Local stays, 13-16 Nov 2026, 9 adults, ₹4,50,000 from
    // Delhi. The old ladder dropped "city nightlife" (party-scene) by fixed order
    // and printed "No city nightlife party trip fits..." while 10 of 42
    // candidates that DO hold city nightlife fit the budget — the true blocker
    // was "a city" (party-domestic). The fixed ladder never reconsidered it.
    const { input } = inputFor(
      'party',
      {
        'party-region': 'within-india',
        'party-domestic': 'city',
        'party-scene': 'city-night',
        'stay-style': 'local-stays',
      },
      {
        startDate: '2026-11-13',
        endDate: '2026-11-16',
        budget: 450000,
        travellers: 9,
        adults: 9,
        origin: 'Delhi',
      },
    )
    const planSet = generatePlanSet(input, CATALOGUE)
    expect(planSet.relaxation).not.toBeNull()
    // The banner must not name "city nightlife" — dropping it was never what
    // unblocked the pool, so claiming nothing-with-it fits would be false.
    expect(planSet.relaxation!.banner).not.toContain('city nightlife')
    expect(planSet.relaxation!.droppedKeys).not.toContain('q:party-scene')
    // Putting the dropped constraint back can only ever cost the same or more —
    // never less, which would prove the banner's "nothing fits" claim false.
    const restore = planSet.relaxation!.restore
    if (restore.costDelta !== null) {
      expect(restore.costDelta).toBeGreaterThanOrEqual(0)
    }
  })

  it('the relaxation banner never lies: restore.costDelta < 0 never occurs', () => {
    // A wide sweep of scenarios that force the ladder to drop something, across
    // every vibe, with real (non-"no preference") answers so the ladder has
    // something to relax in the first place. Whatever the banner names,
    // restoring it must never turn out to be *cheaper* than the plan already on
    // screen — that arithmetic impossibility is exactly what proved the old
    // banner false.
    let sawARelaxation = false
    for (const vibe of VIBE_ORDER) {
      for (const region of ['within-india', 'international'] as const) {
        for (const budget of [20000, 25000, 30000, 45000, 60000, 90000]) {
          for (const travellers of [2, 4, 9]) {
            const { input } = inputFor(
              vibe,
              { [`${vibe}-region`]: region },
              { budget, travellers, adults: travellers, children: [] },
            )
            const planSet = generatePlanSet(input, CATALOGUE)
            if (planSet.relaxation === null) continue
            sawARelaxation = true
            const { costDelta } = planSet.relaxation.restore
            expect(
              costDelta === null || costDelta >= 0,
              `${vibe}/${region} @ ₹${budget} x${travellers}: restore.costDelta = ${costDelta}`,
            ).toBe(true)
          }
        }
      }
    }
    // The party/city-9/₹4,50,000 reproduction above already proves this branch
    // is reachable; this assertion just guards against the sweep silently
    // stopping triggering any relaxation at all (a test that can never fail is
    // worth nothing).
    expect(sawARelaxation).toBe(true)
  })

  it('always returns a plan, for every vibe and every origin', () => {
    for (const vibe of VIBE_ORDER) {
      for (const origin of ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad'] as const) {
        const { input } = inputFor(vibe, {}, { origin, budget: 30000 })
        const planSet = generatePlanSet(input, CATALOGUE)
        expect(planSet.recommended.destinationId.length, `${vibe}/${origin}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('the escape hatch (R5)', () => {
  it('carries the number of questions we answered for the user', () => {
    const { input, defaulted } = inputFor('beach')
    const planSet = generatePlanSet(input, CATALOGUE, { defaultedQuestions: defaulted })
    expect(planSet.defaultedQuestions).toBe(3)
  })

  it('carries zero once every question has a real answer', () => {
    const { input, defaulted } = inputFor('beach', {
      'beach-region': 'within-india',
      'beach-coast': 'west-coast',
      'beach-crowd': 'lively',
      'stay-style': 'local-stays',
    })
    expect(defaulted).toBe(0)
    expect(generatePlanSet(input, CATALOGUE, { defaultedQuestions: defaulted }).defaultedQuestions).toBe(0)
  })
})

describe('the engine stays fast (docs/02-architecture.md §6)', () => {
  it('plans a 21-night, 12-traveller trip well inside 20ms', () => {
    const { input } = inputFor('beach', {}, { endDate: '2026-10-31', travellers: 12 })
    const started = performance.now()
    for (let i = 0; i < 50; i += 1) generatePlanSet(input, CATALOGUE)
    const perRun = (performance.now() - started) / 50
    expect(perRun).toBeLessThan(20)
  })
})
