import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { exclusionDisplayName, matchDestinationsByName } from '../src/domain/exclusions'
import { generatePlanSet } from '../src/domain/planner'
import { defaultWalk } from '../src/domain/questions/path'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { initialState, sessionReducer } from '../src/app/sessionReducer'
import type { AnswerPairs, Basics, PlanInput, Vibe } from '../src/domain/types'

/**
 * R26 — exclude a destination before any plan exists. `matchDestinationsByName` is
 * the pure matcher behind the "Anywhere except…" control; the reducer cases are
 * what write to the same `excluded` array R22's post-plan reject reads and writes
 * (tests/reject-and-notice.test.ts); the engine-level tests here prove a pre-plan
 * exclusion is invisible to the recommendation, both alternatives and every reroll
 * for the rest of the session.
 */

describe('matching a typed name against the catalogue', () => {
  const catalogue = CATALOGUE.destinations.map((d) => ({ id: d.id, name: d.name }))

  it('matches "Goa" to "North Goa" — a loose, case-insensitive substring match', () => {
    const matches = matchDestinationsByName(catalogue, 'Goa')
    expect(matches.map((m) => m.name)).toEqual(['North Goa'])
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(matchDestinationsByName(catalogue, '  goa  ').map((m) => m.name)).toEqual([
      'North Goa',
    ])
  })

  it('matches nothing for an unrecognised name', () => {
    expect(matchDestinationsByName(catalogue, 'Narnia')).toEqual([])
  })

  it('matches nothing for an empty or whitespace-only query', () => {
    expect(matchDestinationsByName(catalogue, '')).toEqual([])
    expect(matchDestinationsByName(catalogue, '   ')).toEqual([])
  })

  it('matches every destination containing the substring', () => {
    // Kochi & Varkala is the only catalogue name containing "kochi".
    expect(matchDestinationsByName(catalogue, 'kochi').map((m) => m.id)).toEqual(['in-varkala'])
  })
})

describe('the exclusion chip names every known variant (R28)', () => {
  it('renders "North Goa" as "Goa (covers North Goa & South Goa)"', () => {
    expect(exclusionDisplayName('North Goa')).toBe('Goa (covers North Goa & South Goa)')
  })

  it('leaves a destination with no known variants unchanged', () => {
    expect(exclusionDisplayName('Kochi & Varkala')).toBe('Kochi & Varkala')
    expect(exclusionDisplayName('Manali & Solang')).toBe('Manali & Solang')
  })
})

describe('the excludeDestination / undoExcludeDestination reducer cases', () => {
  it('adds a destination id, de-duplicated', () => {
    let state = sessionReducer(initialState, {
      type: 'excludeDestination',
      destinationId: 'in-goa',
    })
    expect(state.excluded).toEqual(['in-goa'])
    state = sessionReducer(state, { type: 'excludeDestination', destinationId: 'in-goa' })
    expect(state.excluded).toEqual(['in-goa'])
  })

  it('supports more than one entry, in the order added', () => {
    let state = sessionReducer(initialState, {
      type: 'excludeDestination',
      destinationId: 'in-goa',
    })
    state = sessionReducer(state, { type: 'excludeDestination', destinationId: 'in-varkala' })
    expect(state.excluded).toEqual(['in-goa', 'in-varkala'])
  })

  it('undoes a single entry without touching the rest', () => {
    let state = sessionReducer(initialState, {
      type: 'excludeDestination',
      destinationId: 'in-goa',
    })
    state = sessionReducer(state, { type: 'excludeDestination', destinationId: 'in-varkala' })
    state = sessionReducer(state, { type: 'undoExcludeDestination', destinationId: 'in-goa' })
    expect(state.excluded).toEqual(['in-varkala'])
  })

  it('survives submitBasics and every question answer untouched — the same set feeds the plan', () => {
    let state = sessionReducer(initialState, {
      type: 'excludeDestination',
      destinationId: 'in-goa',
    })
    state = sessionReducer(state, { type: 'selectVibe', vibe: 'beach' })
    // selectVibe intentionally clears the set — it is chosen before the vibe, so
    // re-add it the way the basics screen would, after the vibe is picked.
    state = sessionReducer(state, {
      type: 'excludeDestination',
      destinationId: 'in-goa',
    })
    state = sessionReducer(state, { type: 'startBasics' })
    const basics: Basics = {
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      budget: 60000,
      travellers: 2,
      adults: 2,
      children: [],
      origin: 'Bengaluru',
      freeDay: false,
    }
    state = sessionReducer(state, { type: 'submitBasics', basics })
    expect(state.excluded).toEqual(['in-goa'])
    state = sessionReducer(state, { type: 'answerQuestion', questionId: 'beach-region', optionId: 'within-india' })
    expect(state.excluded).toEqual(['in-goa'])
  })
})

function inputFor(
  vibe: Vibe,
  answers: Record<string, string> = {},
  excludeDestinationIds: readonly string[] = [],
): PlanInput {
  const walk = defaultWalk(QUESTION_GRAPH, vibe, answers)
  const basics: Basics = {
    startDate: '2026-10-10',
    endDate: '2026-10-15',
    budget: 60000,
    travellers: 2,
    adults: 2,
    children: [],
    origin: 'Bengaluru',
    freeDay: false,
  }
  return { vibe, basics, answers: walk.pairs as AnswerPairs, excludeDestinationIds }
}

describe('a pre-plan exclusion (R26) never resurfaces for the rest of the session', () => {
  it('is absent from the very first recommendation, both alternatives and five rerolls', () => {
    const excluded = ['in-goa']
    let request = inputFor('beach', {}, excluded)
    let planSet = generatePlanSet(request, CATALOGUE)

    for (const plan of [planSet.recommended, planSet.saver, planSet.stretch]) {
      if (plan !== null) expect(plan.destinationId).not.toBe('in-goa')
    }

    // Reroll five times ("Not this one — somewhere else"), narrowing further each
    // time — the same excluded array R22 writes to, so Goa can never reappear.
    const seen = new Set<string>()
    let rolling = [...excluded]
    for (let i = 0; i < 5; i += 1) {
      request = inputFor('beach', {}, rolling)
      planSet = generatePlanSet(request, CATALOGUE)
      expect(planSet.recommended.destinationId).not.toBe('in-goa')
      seen.add(planSet.recommended.destinationId)
      rolling = [...rolling, planSet.recommended.destinationId]
    }
    expect(seen.has('in-goa')).toBe(false)
  })

  it('reproduces the same plan for the same answers plus the same exclusion (R13 determinism)', () => {
    const a = generatePlanSet(inputFor('beach', {}, ['in-goa']), CATALOGUE)
    const b = generatePlanSet(inputFor('beach', {}, ['in-goa']), CATALOGUE)
    expect(a.recommended.planId).toBe(b.recommended.planId)
    // And a different plan ID from the unexcluded run, proving the exclusion is
    // one of the determinism inputs, not decoration.
    const unexcluded = generatePlanSet(inputFor('beach', {}, []), CATALOGUE)
    if (unexcluded.recommended.destinationId === 'in-goa') {
      expect(a.recommended.planId).not.toBe(unexcluded.recommended.planId)
    }
  })
})
