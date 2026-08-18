import { travellersLabel } from '../domain/dates'
import { formatRupees } from '../domain/money'
import { derivePath, isComplete, nodeFor, optionFor } from '../domain/questions/path'
import { QUESTION_GRAPH } from '../domain/questions/graph'
import type {
  Basics,
  OptionId,
  Phase,
  PlanSet,
  PlanVariant,
  QuestionGraph,
  QuestionId,
  Vibe,
} from '../domain/types'
import type { PersistedSession } from '../storage/sessionStore'

/**
 * The one store (docs/02-architecture.md §1, §4.2). Pure, and unit-tested directly:
 * `SessionProvider` owns the only impure things in the app — reading the clock once
 * for the basics defaults, and writing the session to `localStorage`.
 *
 * There is no cursor into the questionnaire in the persisted data on purpose: the
 * path is *derived* from the answers every render, which is exactly why R6 works.
 * `questionCursor` is the one exception — it is how Back looks at an earlier
 * question without deleting the answers that follow it.
 */

export interface SessionState {
  phase: Phase
  vibe: Vibe | null
  basics: Basics | null
  answers: Record<QuestionId, OptionId>
  /** null = show the first unanswered question; a number = the user pressed Back. */
  questionCursor: number | null
  selectedVariant: PlanVariant
  planSet: PlanSet | null
  /**
   * R14 — the user pressed `Put <constraint> back` and is being shown what it
   * costs. It is a request, not a plan: the engine re-runs from the same answers,
   * so nothing about it can drift out of step with the plan on screen.
   */
  restoreRequested: boolean
  /** True for one render after an edit sent the user down a different branch (R6). */
  branchChanged: boolean
  /** Field name -> message, basics only (R3). */
  errors: Record<string, string>
  persistenceAvailable: boolean
  /** Text for the app-level polite live region. */
  announcement: string
}

export type SessionAction =
  | { type: 'selectVibe'; vibe: Vibe }
  | { type: 'startBasics' }
  | { type: 'backToVibe' }
  | { type: 'submitBasics'; basics: Basics }
  | { type: 'answerQuestion'; questionId: QuestionId; optionId: OptionId }
  | { type: 'back' }
  | { type: 'skipToPlan' }
  | { type: 'answerDefaulted' }
  | { type: 'selectVariant'; variant: PlanVariant }
  | { type: 'requestRestore' }
  | { type: 'dismissRestore' }
  | { type: 'applyRestore'; planSet: PlanSet; label: string }
  | { type: 'resume' }
  | { type: 'planReady'; planSet: PlanSet }
  | { type: 'restore'; session: PersistedSession }
  | { type: 'storageUnavailable' }
  | { type: 'startOver' }

export const initialState: SessionState = {
  phase: 'vibe',
  vibe: null,
  basics: null,
  answers: {},
  questionCursor: null,
  selectedVariant: 'recommended',
  planSet: null,
  restoreRequested: false,
  branchChanged: false,
  errors: {},
  persistenceAvailable: true,
  announcement: '',
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
  graph: QuestionGraph = QUESTION_GRAPH,
): SessionState {
  switch (action.type) {
    case 'selectVibe': {
      if (state.vibe === action.vibe) return state
      // A different vibe means a different entry question; the old answers belong
      // to a graph the user is no longer walking.
      return {
        ...state,
        vibe: action.vibe,
        answers: {},
        questionCursor: null,
        planSet: null,
        selectedVariant: 'recommended',
        restoreRequested: false,
      }
    }

    case 'startBasics': {
      if (state.vibe === null) return state
      return { ...state, phase: 'basics', announcement: '' }
    }

    case 'backToVibe':
      return { ...state, phase: 'vibe', announcement: '' }

    case 'submitBasics': {
      return {
        ...state,
        basics: action.basics,
        errors: {},
        phase: 'question',
        questionCursor: null,
        planSet: null,
        selectedVariant: 'recommended',
        restoreRequested: false,
        announcement: '',
      }
    }

    case 'answerQuestion': {
      if (state.vibe === null) return state
      const answers = { ...state.answers, [action.questionId]: action.optionId }
      const done = isComplete(graph, state.vibe, answers)

      // Changing an answer that leads somewhere else is what R6 calls re-deriving:
      // the questions after it change, and the user is told so on the next screen.
      const previous = state.answers[action.questionId]
      const node = nodeFor(graph, action.questionId)
      const oldNext =
        previous === undefined || node === null ? undefined : optionFor(node, previous)?.next
      const newNext = node === null ? undefined : optionFor(node, action.optionId)?.next

      return {
        ...state,
        answers,
        questionCursor: null,
        planSet: null,
        selectedVariant: 'recommended',
        restoreRequested: false,
        branchChanged:
          previous !== undefined && previous !== action.optionId && oldNext !== newNext,
        phase: done ? 'generating' : 'question',
      }
    }

    case 'back': {
      if (state.vibe === null) return { ...state, phase: 'basics' }
      const path = derivePath(graph, state.vibe, state.answers)
      const shown = state.questionCursor ?? path.length - 1
      if (shown > 0) return { ...state, questionCursor: shown - 1, branchChanged: false }
      // Back from the first question is Back to the basics screen.
      return { ...state, phase: 'basics', questionCursor: null }
    }

    case 'skipToPlan':
      return {
        ...state,
        phase: 'generating',
        questionCursor: null,
        planSet: null,
        selectedVariant: 'recommended',
        restoreRequested: false,
      }

    case 'resume': {
      if (state.planSet !== null) return { ...state, phase: 'plan', announcement: '' }
      if (state.basics !== null) return { ...state, phase: 'question', announcement: '' }
      return { ...state, phase: 'basics', announcement: '' }
    }

    case 'answerDefaulted':
      return { ...state, phase: 'question', questionCursor: null }

    case 'planReady':
      return {
        ...state,
        planSet: action.planSet,
        phase: 'plan',
        questionCursor: null,
        selectedVariant: 'recommended',
        restoreRequested: false,
      }

    // R11 — switching alternative rewires the whole screen, because every region of
    // it reads `planSet[selectedVariant]`. There is no partial update to get wrong.
    case 'selectVariant': {
      const { planSet } = state
      if (planSet === null) return state
      const next = planSet[action.variant]
      if (next === null || action.variant === state.selectedVariant) return state
      return {
        ...state,
        selectedVariant: action.variant,
        announcement: `Plan updated. ${next.destinationName}, ${formatRupees(
          next.cost.partyTotal,
        )} total for ${travellersLabel(next.travellers)}.`,
      }
    }

    case 'requestRestore': {
      if (state.planSet?.relaxation == null) return state
      return { ...state, restoreRequested: true, announcement: '' }
    }

    case 'dismissRestore':
      return { ...state, restoreRequested: false, announcement: '' }

    case 'applyRestore':
      return {
        ...state,
        planSet: action.planSet,
        selectedVariant: 'recommended',
        restoreRequested: false,
        announcement: `Showing the ${action.label} plan. ${
          action.planSet.recommended.destinationName
        }, ${formatRupees(action.planSet.recommended.cost.partyTotal)} total.`,
      }

    case 'restore': {
      const { session } = action
      return {
        ...state,
        phase: session.phase,
        vibe: session.vibe,
        basics: session.basics,
        answers: session.answers,
        questionCursor: null,
        selectedVariant:
          session.planSet?.[session.selectedVariant] == null
            ? 'recommended'
            : session.selectedVariant,
        planSet: session.planSet,
        restoreRequested: false,
        errors: {},
      }
    }

    case 'storageUnavailable':
      return { ...state, persistenceAvailable: false }

    case 'startOver':
      return {
        ...initialState,
        persistenceAvailable: state.persistenceAvailable,
        announcement: 'Saved trip cleared.',
      }

    default:
      return state
  }
}
