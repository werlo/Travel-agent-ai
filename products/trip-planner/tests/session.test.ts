import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialState, sessionReducer, type SessionState } from '../src/app/sessionReducer'
import { plannerRequest, questionView, summaryFacts } from '../src/app/selectors'
import {
  clearSession,
  readSession,
  writeSession,
  STORAGE_KEY,
  type PersistedSession,
} from '../src/storage/sessionStore'
import { CATALOGUE } from '../src/data/localCatalogue'
import { generatePlanSet } from '../src/domain/planner'
import type { Basics } from '../src/domain/types'

/**
 * The store and the session at rest (R2, R5, R6, R15). The reducer is pure, so it
 * is tested without React at all; the storage layer is tested against a hostile
 * blob, because `localStorage` is attacker-controllable (docs/02-architecture.md §8).
 */

const BASICS: Basics = {
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  budget: 60000,
  travellers: 2,
  origin: 'Bengaluru',
}

function afterBasics(): SessionState {
  let state = sessionReducer(initialState, { type: 'selectVibe', vibe: 'beach' })
  state = sessionReducer(state, { type: 'startBasics' })
  return sessionReducer(state, { type: 'submitBasics', basics: BASICS })
}

function answer(state: SessionState, questionId: string, optionId: string): SessionState {
  return sessionReducer(state, { type: 'answerQuestion', questionId, optionId })
}

describe('the summary bar (R2)', () => {
  it('reads exactly the four facts the acceptance criterion quotes', () => {
    expect(summaryFacts(afterBasics())?.join(' · ')).toBe(
      '5 nights · 2 travellers · from Bengaluru · ₹60,000',
    )
  })

  it('is absent until the basics exist', () => {
    expect(summaryFacts(initialState)).toBeNull()
  })
})

describe('walking the questionnaire', () => {
  it('lands on question 1 of 4 after the basics', () => {
    const view = questionView(afterBasics())
    expect(view?.node.id).toBe('beach-region')
    expect(view?.position).toBe(1)
    expect(view?.total).toBe(4)
    expect(view?.selected).toBeNull()
  })

  it('advances through the branch the answers choose (R4)', () => {
    const state = answer(afterBasics(), 'beach-region', 'international')
    const view = questionView(state)
    expect(view?.node.id).toBe('beach-haul')
    expect(view?.position).toBe(2)
    expect(view?.node.prompt).toContain('flight')
  })

  it('goes to the generating phase on the last answer', () => {
    let state = afterBasics()
    state = answer(state, 'beach-region', 'no-preference')
    state = answer(state, 'beach-crowd', 'empty')
    expect(state.phase).toBe('question')
    state = answer(state, 'stay-style', 'local-stays')
    expect(state.phase).toBe('generating')
  })

  it('takes Back to the previous question with its answer still selected (R6)', () => {
    let state = afterBasics()
    state = answer(state, 'beach-region', 'within-india')
    state = answer(state, 'beach-coast', 'west-coast')
    state = answer(state, 'beach-crowd', 'lively')
    expect(questionView(state)?.node.id).toBe('stay-style')

    state = sessionReducer(state, { type: 'back' })
    state = sessionReducer(state, { type: 'back' })
    const view = questionView(state)
    expect(view?.node.id).toBe('beach-coast')
    expect(view?.selected).toBe('west-coast')
    expect(view?.revisiting).toBe(true)
  })

  it('takes Back from the first question to the basics screen', () => {
    const state = sessionReducer(afterBasics(), { type: 'back' })
    expect(state.phase).toBe('basics')
  })

  it('re-derives the rest when an earlier answer changes, and keeps the earlier ones (R6)', () => {
    let state = afterBasics()
    state = answer(state, 'beach-region', 'international')
    state = answer(state, 'beach-haul', 'under-6h')
    state = answer(state, 'beach-crowd', 'empty')
    expect(questionView(state)?.node.id).toBe('stay-style')

    state = sessionReducer(state, { type: 'back' })
    state = sessionReducer(state, { type: 'back' })
    expect(questionView(state)?.node.id).toBe('beach-haul')

    state = answer(state, 'beach-region', 'within-india')
    expect(state.branchChanged).toBe(true)
    expect(questionView(state)?.node.id).toBe('beach-coast')
    // The orphaned answer is remembered but not on the path.
    expect(state.answers['beach-haul']).toBe('under-6h')
    expect(
      plannerRequest(state)?.input.answers.map(([q]) => q),
    ).not.toContain('beach-haul')
  })

  it('drops the answers when the vibe changes, because the graph changed', () => {
    let state = answer(afterBasics(), 'beach-region', 'within-india')
    state = sessionReducer(state, { type: 'selectVibe', vibe: 'mountains' })
    expect(state.answers).toEqual({})
    expect(questionView(state)?.node.id).toBe('mountains-region')
  })
})

describe('the escape hatch and the plan (R5)', () => {
  it('fills three answers and goes straight to generating', () => {
    const state = sessionReducer(afterBasics(), { type: 'skipToPlan' })
    expect(state.phase).toBe('generating')
    const request = plannerRequest(state)
    expect(request?.defaultedQuestions).toBe(3)
    expect(request?.input.answers).toHaveLength(3)
  })

  it('takes "Answer them" back to the first unanswered question', () => {
    let state = sessionReducer(afterBasics(), { type: 'skipToPlan' })
    const request = plannerRequest(state)!
    const planSet = generatePlanSet(request.input, CATALOGUE, {
      defaultedQuestions: request.defaultedQuestions,
    })
    state = sessionReducer(state, { type: 'planReady', planSet })
    expect(state.phase).toBe('plan')

    state = sessionReducer(state, { type: 'answerDefaulted' })
    expect(state.phase).toBe('question')
    expect(questionView(state)?.node.id).toBe('beach-region')
  })
})

describe('start over', () => {
  it('clears everything and announces it', () => {
    const state = sessionReducer(afterBasics(), { type: 'startOver' })
    expect(state.vibe).toBeNull()
    expect(state.basics).toBeNull()
    expect(state.answers).toEqual({})
    expect(state.phase).toBe('vibe')
    expect(state.announcement).toBe('Saved trip cleared.')
  })
})

describe('the session at rest (R15)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  function persist(overrides: Partial<PersistedSession> = {}): PersistedSession {
    const session: PersistedSession = {
      schema: 1,
      catalogueVersion: CATALOGUE.meta.version,
      phase: 'question',
      vibe: 'beach',
      basics: BASICS,
      answers: { 'beach-region': 'within-india' },
      selectedVariant: 'recommended',
      planSet: null,
      ...overrides,
    }
    writeSession(session)
    return session
  }

  it('round-trips a mid-questionnaire session', () => {
    persist()
    const { session, available } = readSession(CATALOGUE.meta.version)
    expect(available).toBe(true)
    expect(session?.phase).toBe('question')
    expect(session?.vibe).toBe('beach')
    expect(session?.basics).toEqual(BASICS)
    expect(session?.answers).toEqual({ 'beach-region': 'within-india' })
  })

  it('round-trips a rendered plan without regenerating it', () => {
    const request = plannerRequest(
      sessionReducer(afterBasics(), { type: 'skipToPlan' }),
    )!
    const planSet = generatePlanSet(request.input, CATALOGUE, {
      defaultedQuestions: request.defaultedQuestions,
    })
    persist({ phase: 'plan', planSet })

    const restored = readSession(CATALOGUE.meta.version).session
    expect(restored?.phase).toBe('plan')
    expect(restored?.planSet?.recommended.planId).toBe(planSet.recommended.planId)
    expect(restored?.planSet?.recommended.cost.partyTotal).toBe(
      planSet.recommended.cost.partyTotal,
    )
    expect(restored?.planSet?.recommended.days).toHaveLength(6)
  })

  it('discards a plan built against a different catalogue and re-plans instead', () => {
    const request = plannerRequest(sessionReducer(afterBasics(), { type: 'skipToPlan' }))!
    const planSet = generatePlanSet(request.input, CATALOGUE)
    persist({ phase: 'plan', planSet, catalogueVersion: '2020-01-01' })

    const restored = readSession('2027-05-05').session
    expect(restored?.planSet).toBeNull()
    expect(restored?.phase).toBe('generating')
    expect(restored?.answers).toEqual({ 'beach-region': 'within-india' })
  })

  it('returns nothing and clears the key when the schema does not match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 99, vibe: 'beach' }))
    expect(readSession(CATALOGUE.meta.version).session).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(warn).toHaveBeenCalledWith('[compass] E-STORAGE-SCHEMA', 'unexpected schema')
  })

  it('never throws on corrupt JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    expect(() => readSession(CATALOGUE.meta.version)).not.toThrow()
    expect(readSession(CATALOGUE.meta.version).session).toBeNull()
  })

  it('refuses a hostile blob rather than spreading it into state', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema: 1,
        catalogueVersion: CATALOGUE.meta.version,
        phase: 'plan',
        vibe: 'not-a-vibe',
        basics: { startDate: 'x', endDate: 'y', budget: 'lots', travellers: [], origin: 'Mars' },
        answers: { __proto__: 'polluted', 'beach-region': 42 },
        planSet: { recommended: { planId: 5 } },
      }),
    )
    const { session } = readSession(CATALOGUE.meta.version)
    expect(session).toBeNull()
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('walks a phase back when its own data is missing', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema: 1,
        catalogueVersion: CATALOGUE.meta.version,
        phase: 'question',
        vibe: 'beach',
        basics: null,
        answers: {},
        selectedVariant: 'recommended',
        planSet: null,
      }),
    )
    expect(readSession(CATALOGUE.meta.version).session?.phase).toBe('basics')
  })

  it('reports storage as unavailable rather than throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const result = readSession(CATALOGUE.meta.version)
    expect(result).toEqual({ session: null, available: false })
    expect(warn).toHaveBeenCalled()
    getItem.mockRestore()
  })

  it('clears the key on Start over', () => {
    persist()
    clearSession()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
