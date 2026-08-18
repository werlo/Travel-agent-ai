import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { changeNotice } from '../src/domain/changes'
import { generatePlanSet } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { defaultWalk } from '../src/domain/questions/path'
import type { AnswerPairs, Basics, PlanInput, PlanSet, Vibe } from '../src/domain/types'

/**
 * R22 (reject a destination, keep the trip) and R19 (say what changed) at the
 * engine level. The UI wiring is covered in tests/round1-screens.test.tsx; these
 * are the guarantees that have to hold whatever the screen does.
 */

const BASICS: Basics = {
  startDate: '2026-11-13',
  endDate: '2026-11-16',
  budget: 450000,
  travellers: 9,
  adults: 9,
  children: [],
  origin: 'Delhi',
  freeDay: false,
}

function inputFor(
  vibe: Vibe,
  answers: Record<string, string> = {},
  over: Partial<Basics> = {},
  excludeDestinationIds: readonly string[] = [],
): PlanInput {
  const walk = defaultWalk(QUESTION_GRAPH, vibe, answers)
  return {
    vibe,
    basics: { ...BASICS, ...over },
    answers: walk.pairs as AnswerPairs,
    excludeDestinationIds,
  }
}

describe('turning a destination down (R22)', () => {
  it('keeps every other input and returns a different destination with a new plan ID', () => {
    const first = generatePlanSet(inputFor('party', { 'party-region': 'within-india' }), CATALOGUE)
    const rejected = first.recommended.destinationId

    const second = generatePlanSet(
      inputFor('party', { 'party-region': 'within-india' }, {}, [rejected]),
      CATALOGUE,
    )

    expect(second.recommended.destinationId).not.toBe(rejected)
    expect(second.recommended.planId).not.toBe(first.recommended.planId)
    // The trip itself is untouched.
    expect(second.recommended.nights).toBe(first.recommended.nights)
    expect(second.recommended.travellers).toBe(first.recommended.travellers)
    expect(second.recommended.origin).toBe(first.recommended.origin)
    expect(second.recommended.startDate).toBe(first.recommended.startDate)
    expect(second.excluded.map((d) => d.id)).toEqual([rejected])
  })

  it('never offers a rejected destination back as a Saver or a Stretch', () => {
    const first = generatePlanSet(inputFor('beach'), CATALOGUE)
    const excluded = [first.recommended.destinationId]
    const second = generatePlanSet(inputFor('beach', {}, {}, excluded), CATALOGUE)

    for (const plan of [second.recommended, second.saver, second.stretch]) {
      if (plan !== null) expect(excluded).not.toContain(plan.destinationId)
    }
  })

  it('walks the ranked list to the last destination without ever failing', () => {
    const excluded: string[] = []
    const seen = new Set<string>()
    for (let i = 0; i < CATALOGUE.destinations.length - 1; i += 1) {
      const planSet = generatePlanSet(inputFor('beach', {}, {}, [...excluded]), CATALOGUE)
      const id = planSet.recommended.destinationId
      expect(seen.has(id)).toBe(false)
      seen.add(id)
      excluded.push(id)
      expect(planSet.excluded).toHaveLength(i)
    }
    // One left. Turning that one down is what the "exhausted" message is for, and
    // the caller never asks the engine for a plan out of an empty catalogue.
    expect(excluded).toHaveLength(CATALOGUE.destinations.length - 1)
  })

  it('is deterministic: the same rejections give the same plan (A14, R13)', () => {
    const excluded = ['in-goa']
    const a = generatePlanSet(inputFor('party', {}, {}, excluded), CATALOGUE)
    const b = generatePlanSet(inputFor('party', {}, {}, excluded), CATALOGUE)
    expect(a.recommended.planId).toBe(b.recommended.planId)
  })
})

describe('saying what changed (R19)', () => {
  const four = generatePlanSet(
    inputFor(
      'peace',
      { 'peace-region': 'within-india' },
      {
        startDate: '2026-12-20',
        endDate: '2026-12-27',
        budget: 250000,
        travellers: 4,
        adults: 4,
        origin: 'Mumbai',
      },
    ),
    CATALOGUE,
  )
  const five = generatePlanSet(
    inputFor(
      'peace',
      { 'peace-region': 'within-india' },
      {
        startDate: '2026-12-20',
        endDate: '2026-12-27',
        budget: 250000,
        travellers: 5,
        adults: 5,
        origin: 'Mumbai',
      },
    ),
    CATALOGUE,
  )

  it('names the swapped stay, both rates and both tiers, next to the total', () => {
    const notice = changeNotice({
      previous: four.recommended,
      next: five.recommended,
      planSet: five,
    })

    if (four.recommended.stay.id === five.recommended.stay.id) {
      // The engine kept the stay; then there is nothing to disclose and the
      // notice must not invent a change.
      expect(notice).toBeNull()
      return
    }

    expect(notice).not.toBeNull()
    expect(notice).toContain('Changed to keep you inside budget:')
    expect(notice).toContain(
      `stay is now ${five.recommended.stay.name} (₹${five.recommended.stay.pricePerRoomPerNight.toLocaleString(
        'en-IN',
      )}/night, ${five.recommended.stay.tier}) instead of ${four.recommended.stay.name}`,
    )
    expect(notice).toContain(four.recommended.stay.tier)
  })

  it('says nothing when nothing changed', () => {
    expect(
      changeNotice({ previous: four.recommended, next: four.recommended, planSet: four }),
    ).toBeNull()
  })

  it('names an answer the ladder had to override', () => {
    const impossible = generatePlanSet(
      inputFor(
        'party',
        { 'party-region': 'international' },
        { budget: 80000, travellers: 12, adults: 12 },
      ),
      CATALOGUE,
    ) as PlanSet

    // The ladder exhausts here rather than relaxing one rung, which is exactly
    // how the override went unmentioned before: there was no banner to carry it.
    expect(impossible.recommended.region).toBe('domestic')
    const notice = changeNotice({
      previous: null,
      next: impossible.recommended,
      planSet: impossible,
    })
    expect(notice).toContain('you asked for international')
    expect(notice).toContain(impossible.recommended.destinationName)
    expect(notice).toContain('₹80,000')
  })
})

describe('internal-consistency of the generated reasoning (R31, customer fix 5)', () => {
  it('never applies another destination\'s category label to a hand-picked destination', () => {
    // Kabir's fixture: North Goa hand-picked as the Saver after a "city" question
    // it does not answer, for a party of 9 down to 7 — the exact scenario that
    // produced "you asked for a city — nothing fits ₹4,50,000 for 7, so this is
    // North Goa", a sentence that reads as though North Goa were a city.
    const input = inputFor(
      'party',
      { 'party-region': 'within-india', 'party-domestic': 'city' },
      { travellers: 9, adults: 9 },
    )
    const northGoa = CATALOGUE.destinations.find((d) => d.name === 'North Goa')
    if (northGoa === undefined) throw new Error('fixture requires North Goa in the catalogue')

    const pinnedInput = { ...input, pinnedDestinationId: northGoa.id }
    const pinned = generatePlanSet(pinnedInput, CATALOGUE)
    expect(pinned.recommended.destinationName).toBe('North Goa')

    const adjustedInput = { ...pinnedInput, basics: { ...pinnedInput.basics, travellers: 7, adults: 7 } }
    const adjusted = generatePlanSet(adjustedInput, CATALOGUE)
    expect(adjusted.recommended.destinationName).toBe('North Goa')

    for (const plan of [pinned.recommended, adjusted.recommended]) {
      const notice = changeNotice({ previous: null, next: plan, planSet: plan === pinned.recommended ? pinned : adjusted })
      // The unheld "A city" answer is reported as the user's own pick, not as a
      // catalogue-wide "nothing fits" claim that happens to land on North Goa.
      const cityReason = plan.why.reasons.find((r) => r.quotes === 'A city')
      expect(cityReason?.held).toBe(false)
      expect(cityReason?.pinnedOverride).toBe(true)
      expect(cityReason?.text).not.toContain('nothing fits')
      if (notice !== null) {
        expect(notice).not.toMatch(/nothing fits.*so this is North Goa/)
      }
    }
  })
})
