import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { stretchCeiling } from '../src/domain/budget'
import { nightsConstraint, withPathPriorities } from '../src/domain/constraints'
import { explain, rejectionsFor } from '../src/domain/explain'
import { buildCandidates, generatePlanSet, planContextFor } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { constraintsFor, defaultWalk } from '../src/domain/questions/path'
import { VIBE_ORDER } from '../src/domain/vibes'
import type { AnswerPairs, Basics, PlanInput, Vibe } from '../src/domain/types'

/**
 * R10 — "Why this trip".
 *
 * The headline test is the sweep: **every one of the 14 destinations, at every one
 * of its three stay tiers, for every vibe and across four budgets**, must produce
 * at least three reasons that each quote one of the user's own answers and at least
 * one named rejected destination whose line contains a numeral. That is 14 x 3 x 6
 * x 4 explanations, and the floor is asserted on all of them — R10 is a guarantee,
 * not a property of whichever plan the engine happened to pick today.
 */

const BASICS: Basics = {
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  budget: 60000,
  travellers: 2,
  origin: 'Bengaluru',
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

describe('the R10 floor holds for every destination at every tier', () => {
  it('gives >= 3 answer-quoting reasons and >= 1 numeric rejection, everywhere', () => {
    let checked = 0

    for (const vibe of VIBE_ORDER) {
      for (const budget of [25000, 60000, 150000, 300000]) {
        const input = inputFor(vibe, {}, { budget })
        const ctx = planContextFor(input, QUESTION_GRAPH)
        const all = buildCandidates(CATALOGUE, ctx)
        expect(all).toHaveLength(CATALOGUE.destinations.length * 3)

        for (const chosen of all) {
          const why = explain({
            chosen,
            all,
            ctx,
            graph: QUESTION_GRAPH,
            answers: input.answers,
            activeSpecs: specsFor(input),
            ceiling: stretchCeiling(budget),
          })
          const where = `${vibe}/${budget}/${chosen.destination.id}/${chosen.stay.tier}`

          expect(why.reasons.length, where).toBeGreaterThanOrEqual(3)
          for (const reason of why.reasons) {
            // The proof that the reason is the user's own answer and not ours.
            expect(reason.quotes.length, where).toBeGreaterThan(0)
            expect(reason.text, where).toContain(reason.quotes)
          }

          expect(why.rejected.length, where).toBeGreaterThanOrEqual(1)
          for (const rejection of why.rejected) {
            expect(rejection.line, where).toMatch(/\d/)
            expect(rejection.line, where).toContain(rejection.destinationName)
            expect(rejection.destinationName, where).not.toBe(chosen.destination.name)
          }
          checked += 1
        }
      }
    }

    expect(checked).toBe(14 * 3 * VIBE_ORDER.length * 4)
  })

  it('holds the floor on a fully answered path too, where every answer is quoted', () => {
    const input = inputFor('beach', {
      'beach-region': 'within-india',
      'beach-coast': 'west-coast',
      'beach-crowd': 'empty',
      'stay-style': 'local-stays',
    })
    const ctx = planContextFor(input, QUESTION_GRAPH)
    const all = buildCandidates(CATALOGUE, ctx)

    for (const chosen of all) {
      const why = explain({
        chosen,
        all,
        ctx,
        graph: QUESTION_GRAPH,
        answers: input.answers,
        activeSpecs: specsFor(input),
        ceiling: stretchCeiling(ctx.budget),
      })
      // Vibe + budget + dates + the four answers.
      expect(why.reasons.length, chosen.destination.id).toBe(7)
      expect(why.reasons.map((r) => r.quotes)).toEqual([
        'Beach',
        '₹60,000',
        '5 nights',
        'Within India',
        'West coast',
        'Empty',
        'Local stays',
      ])
    }
  })

  it('never quotes "No preference" back at the user as though it were an answer', () => {
    const input = inputFor('beach')
    const plan = generatePlanSet(input, CATALOGUE).recommended
    expect(plan.why.reasons.map((r) => r.quotes)).not.toContain('No preference')
    expect(plan.why.reasons).toHaveLength(3)
  })
})

describe('the reasons say what the engine actually did', () => {
  it('quotes the vibe, the budget position and the trip length', () => {
    const plan = generatePlanSet(inputFor('beach'), CATALOGUE).recommended
    const texts = plan.why.reasons.map((r) => r.text)
    expect(texts[0]).toMatch(/^You chose Beach — .+ rates \d out of 5 for that in this catalogue\.$/)
    expect(texts[1]).toMatch(
      /^Your budget is ₹60,000 for 5 nights — this lands (₹[\d,]+ (under|over) it|exactly on it)\.$/,
    )
    expect(texts[2]).toMatch(
      /^You have 5 nights, Sat 10 – Thu 15 Oct 2026 — .+ works for anything from \d+ to \d+ nights\.$/,
    )
  })

  it('counts the destinations that answer a constraint the plan actually holds', () => {
    const plan = generatePlanSet(
      inputFor('beach', { 'beach-region': 'within-india' }),
      CATALOGUE,
    ).recommended
    expect(plan.region).toBe('domestic')
    expect(plan.why.reasons.map((r) => r.text)).toContain(
      `You said Within India — ${plan.destinationName} is one of 6 destinations in this catalogue that answer that.`,
    )
  })

  it('admits it when the ladder had to drop the answer, instead of claiming a match', () => {
    // International party, two nights, ₹25,000 for four: the PRD's dead end.
    const plan = generatePlanSet(
      inputFor(
        'party',
        { 'party-region': 'international' },
        { budget: 25000, travellers: 4, endDate: '2026-10-12' },
      ),
      CATALOGUE,
    ).recommended
    expect(plan.region).toBe('domestic')
    expect(plan.why.reasons.map((r) => r.text)).toContain(
      'You said International — nothing in this catalogue held that for ₹25,000, so it counted for less than your other answers.',
    )
  })
})

describe('the rejections are genuine runners-up', () => {
  it('names a destination excluded on price with the rupee gap', () => {
    const plan = generatePlanSet(inputFor('beach'), CATALOGUE).recommended
    const priced = plan.why.rejected.filter((r) =>
      /— ₹[\d,]+ over your budget for 2\.$/.test(r.line),
    )
    expect(priced.length).toBeGreaterThanOrEqual(1)
  })

  it('names a destination excluded by the user’s own constraint, with a number', () => {
    const plan = generatePlanSet(
      inputFor('beach', { 'beach-region': 'international' }, { budget: 150000 }),
      CATALOGUE,
    ).recommended
    expect(plan.region).toBe('international')
    const byConstraint = plan.why.rejected.filter((r) =>
      r.line.includes('you asked to go international'),
    )
    expect(byConstraint.length).toBeGreaterThanOrEqual(1)
    for (const rejection of byConstraint) expect(rejection.line).toMatch(/\d+h/)
  })

  it('falls back to the plain runner-up when nothing at all was excluded', () => {
    // A budget nothing can exceed and no constraints: every destination survives,
    // so the only honest rejection left is "this one cost more".
    const input = inputFor('beach', {}, { budget: 900000 })
    const ctx = planContextFor(input, QUESTION_GRAPH)
    const all = buildCandidates(CATALOGUE, ctx)
    const chosen = all[0]!
    const rejected = rejectionsFor({
      chosen,
      all,
      ctx,
      graph: QUESTION_GRAPH,
      answers: input.answers,
      activeSpecs: [],
      ceiling: stretchCeiling(900000),
    })
    expect(rejected.length).toBe(3)
    for (const rejection of rejected) {
      expect(rejection.line).toMatch(
        /(more than|cheaper, but it rates|the same price, but it rates)/,
      )
      expect(rejection.line).toMatch(/\d/)
    }
  })

  it('is carried by the saver and the stretch plans too, not just the recommendation', () => {
    const planSet = generatePlanSet(inputFor('beach'), CATALOGUE)
    for (const plan of [planSet.recommended, planSet.saver, planSet.stretch]) {
      if (plan === null) continue
      expect(plan.why.reasons.length).toBeGreaterThanOrEqual(3)
      expect(plan.why.rejected.length).toBeGreaterThanOrEqual(1)
      // Each plan explains itself, not the recommendation.
      expect(plan.why.reasons[0]!.text).toContain(plan.destinationName)
    }
  })
})
