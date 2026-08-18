import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import {
  recommendedDeltaLabel,
  SAVER_ABSENT_REASON,
  saverCeiling,
  saverDeltaLabel,
  STRETCH_ABSENT_REASON,
  stretchCeiling,
  stretchDeltaLabel,
} from '../src/domain/budget'
import { generatePlanSet } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { defaultWalk } from '../src/domain/questions/path'
import { VIBE_ORDER } from '../src/domain/vibes'
import type { AnswerPairs, Basics, PlanInput, Vibe } from '../src/domain/types'

/**
 * R11 — the Saver and the Stretch.
 *
 * The two guarantees the requirement makes are asserted as invariants over a sweep
 * rather than on one lucky plan: a Saver is always at least 10% below the
 * recommendation, a Stretch is always above it and inside budget x 1.25, and where
 * either is missing the slot carries its sentence instead of nothing at all.
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

describe('the Saver and Stretch invariants', () => {
  it('holds across every vibe, budget, party size and trip length', () => {
    let savers = 0
    let stretches = 0
    let absentSavers = 0
    let absentStretches = 0

    for (const vibe of VIBE_ORDER) {
      for (const budget of [25000, 45000, 60000, 90000, 150000, 300000]) {
        for (const travellers of [1, 2, 4, 9]) {
          for (const endDate of ['2026-10-13', '2026-10-15', '2026-10-20']) {
            const planSet = generatePlanSet(
              inputFor(vibe, {}, { budget, travellers, endDate }),
              CATALOGUE,
            )
            const rec = planSet.recommended.cost.partyTotal
            const where = `${vibe}/${budget}/${travellers}/${endDate}`

            if (planSet.saver === null) {
              absentSavers += 1
              expect(planSet.saverAbsentReason, where).toBe(SAVER_ABSENT_REASON)
            } else {
              savers += 1
              expect(planSet.saverAbsentReason, where).toBeNull()
              expect(planSet.saver.cost.partyTotal, where).toBeLessThanOrEqual(
                saverCeiling(rec),
              )
              expect(planSet.saver.destinationId, where).not.toBe(
                planSet.recommended.destinationId,
              )
              expect(planSet.saver.variant, where).toBe('saver')
            }

            if (planSet.stretch === null) {
              absentStretches += 1
              expect(planSet.stretchAbsentReason, where).toBe(STRETCH_ABSENT_REASON)
            } else {
              stretches += 1
              expect(planSet.stretchAbsentReason, where).toBeNull()
              expect(planSet.stretch.cost.partyTotal, where).toBeGreaterThan(rec)
              expect(planSet.stretch.cost.partyTotal, where).toBeLessThanOrEqual(
                stretchCeiling(budget),
              )
              expect(planSet.stretch.destinationId, where).not.toBe(
                planSet.recommended.destinationId,
              )
              expect(planSet.stretch.variant, where).toBe('stretch')
            }

            if (planSet.saver !== null && planSet.stretch !== null) {
              // Two cards naming the same place is one idea shown twice.
              expect(planSet.stretch.destinationId, where).not.toBe(
                planSet.saver.destinationId,
              )
            }
          }
        }
      }
    }

    // The sweep is only meaningful if it actually met all four situations.
    expect(savers).toBeGreaterThan(0)
    expect(stretches).toBeGreaterThan(0)
    expect(absentSavers).toBeGreaterThan(0)
    expect(absentStretches).toBeGreaterThan(0)
  })

  it('gives an alternative a complete plan of its own, not a summary', () => {
    const planSet = generatePlanSet(inputFor('beach'), CATALOGUE)
    const saver = planSet.saver!
    expect(saver).not.toBeNull()

    expect(saver.days).toHaveLength(6)
    for (const day of saver.days) expect(day.experiences.length).toBeGreaterThanOrEqual(1)
    expect(saver.legs).toHaveLength(2)
    expect(saver.stay.name.length).toBeGreaterThan(0)
    expect(
      saver.cost.travel + saver.cost.stay + saver.cost.experiences + saver.cost.localAllowance,
    ).toBe(saver.cost.partyTotal)
    expect(saver.budget.label.length).toBeGreaterThan(0)
    expect(saver.why.reasons.length).toBeGreaterThanOrEqual(3)
    // R11: switching must change the plan ID, so the variant is inside the hash.
    expect(saver.planId).not.toBe(planSet.recommended.planId)
  })

  it('never offers an alternative the user’s own answers ruled out', () => {
    const planSet = generatePlanSet(
      inputFor('beach', { 'beach-region': 'within-india' }, { budget: 150000 }),
      CATALOGUE,
    )
    for (const plan of [planSet.recommended, planSet.saver, planSet.stretch]) {
      if (plan === null) continue
      expect(plan.region).toBe('domestic')
    }
  })

  it('offers no alternatives at all on the no-fit path, with both sentences', () => {
    const planSet = generatePlanSet(
      inputFor('beach', {}, { budget: 5000, travellers: 12 }),
      CATALOGUE,
    )
    expect(planSet.recommended.budget.status).toBe('no-fit')
    expect(planSet.saver).toBeNull()
    expect(planSet.stretch).toBeNull()
    expect(planSet.saverAbsentReason).toBe(
      'No cheaper option in this catalogue for these dates',
    )
    expect(planSet.stretchAbsentReason).toBe(
      'No pricier option that still stays inside your stretch band',
    )
  })
})

describe('the delta copy (docs/03-design.md §4 S5)', () => {
  it('reads exactly as the design specifies', () => {
    expect(saverDeltaLabel(51600, 43900)).toBe('₹7,700 less than the recommendation')
    expect(stretchDeltaLabel(51600, 71400)).toBe(
      '₹19,800 more — within your stretch band',
    )
    expect(recommendedDeltaLabel(43900, 51600)).toBe('₹7,700 more')
  })

  it('says which way round it is when the recommendation is the cheaper one', () => {
    expect(recommendedDeltaLabel(71400, 51600)).toBe('₹19,800 less')
    expect(recommendedDeltaLabel(51600, 51600)).toBe('The same total')
  })
})
