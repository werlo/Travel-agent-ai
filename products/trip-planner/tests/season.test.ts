import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { generatePlanSet } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { defaultWalk } from '../src/domain/questions/path'
import { SEASON_BASIS_NOTE, seasonFor, seasonalLoading } from '../src/domain/season'
import type { AnswerPairs, Basics, PlanInput } from '../src/domain/types'

/**
 * R23 (customer fix 8) — the calendar is an input to the price.
 *
 * The judge who came for a Christmas number got an average-week number with her
 * Christmas dates printed on top of it, and nothing on the page said so. These
 * tests are the ones that would have caught that: the same answers, two calendars,
 * two totals.
 */

const BASICS: Basics = {
  startDate: '2026-12-20',
  endDate: '2026-12-27',
  budget: 250000,
  travellers: 4,
  adults: 4,
  children: [],
  origin: 'Mumbai',
  freeDay: false,
}

function inputFor(startDate: string, endDate: string): PlanInput {
  const walk = defaultWalk(QUESTION_GRAPH, 'peace', {})
  return {
    vibe: 'peace',
    basics: { ...BASICS, startDate, endDate },
    answers: walk.pairs as AnswerPairs,
  }
}

describe('seasonFor', () => {
  it('calls the festive window peak, whichever end of it the trip touches', () => {
    expect(seasonFor('2026-12-20', '2026-12-27').id).toBe('peak')
    expect(seasonFor('2026-12-28', '2027-01-04').id).toBe('peak')
    expect(seasonFor('2026-12-25', '2026-12-26').id).toBe('peak')
  })

  it('calls July off season and everything else standard', () => {
    expect(seasonFor('2027-07-05', '2027-07-12').id).toBe('off')
    expect(seasonFor('2027-02-10', '2027-02-17').id).toBe('standard')
    expect(seasonFor('2026-10-10', '2026-10-15').id).toBe('standard')
  })

  it('names the window and the loading in one line', () => {
    expect(seasonFor('2026-12-20', '2026-12-27').line).toBe(
      'Peak season (25 Dec – 2 Jan): +35% on stay and travel',
    )
    expect(seasonFor('2027-07-05', '2027-07-12').line).toBe(
      'Off season (Jul): −20% on stay and travel',
    )
    expect(seasonFor('2027-02-10', '2027-02-17').line).toBe(
      'Standard season: no loading on stay and travel',
    )
  })

  it('signs the loading, and applies it to stay and travel only', () => {
    expect(seasonalLoading(100000, 100000, seasonFor('2026-12-25', '2026-12-26'))).toBe(70000)
    expect(seasonalLoading(100000, 100000, seasonFor('2027-07-05', '2027-07-06'))).toBe(-40000)
    expect(seasonalLoading(100000, 100000, seasonFor('2026-10-10', '2026-10-11'))).toBe(0)
  })

  it('labels its own basis as sample data, like every other figure', () => {
    expect(SEASON_BASIS_NOTE).toContain('indicative sample data')
  })
})

describe('the same trip on two calendars (R23)', () => {
  it('returns different party totals for Christmas week and monsoon July', () => {
    const christmas = generatePlanSet(inputFor('2026-12-20', '2026-12-27'), CATALOGUE)
    const july = generatePlanSet(inputFor('2027-07-05', '2027-07-12'), CATALOGUE)

    expect(christmas.recommended.cost.partyTotal).not.toBe(july.recommended.cost.partyTotal)
    expect(christmas.recommended.cost.seasonal).toBeGreaterThan(0)
    expect(july.recommended.cost.seasonal).toBeLessThan(0)
    expect(christmas.recommended.cost.basis.seasonal).toContain('Peak season')
    expect(july.recommended.cost.basis.seasonal).toContain('Off season')
  })

  it('keeps the seasonal line inside the sum that ties to the total', () => {
    for (const [start, end] of [
      ['2026-12-20', '2026-12-27'],
      ['2027-07-05', '2027-07-12'],
      ['2027-02-10', '2027-02-17'],
    ] as const) {
      const { cost } = generatePlanSet(inputFor(start, end), CATALOGUE).recommended
      expect(
        cost.travel + cost.stay + cost.experiences + cost.localAllowance + cost.seasonal,
      ).toBe(cost.partyTotal)
    }
  })

  it('still returns the same plan twice for the same dates (R13)', () => {
    const a = generatePlanSet(inputFor('2026-12-20', '2026-12-27'), CATALOGUE)
    const b = generatePlanSet(inputFor('2026-12-20', '2026-12-27'), CATALOGUE)
    expect(a.recommended.planId).toBe(b.recommended.planId)
    expect(a.recommended.cost.partyTotal).toBe(b.recommended.cost.partyTotal)
  })
})
