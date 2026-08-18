import { nightsBetween, nightsLabel } from '../domain/dates'
import { formatRupees } from '../domain/money'
import { travellersFact } from '../domain/party'
import { QUESTION_GRAPH } from '../domain/questions/graph'
import {
  defaultWalk,
  derivePath,
  nodeFor,
  projectedLength,
} from '../domain/questions/path'
import type {
  PlanInput,
  QuestionGraph,
  QuestionNode,
  OptionId,
} from '../domain/types'
import type { SessionState } from './sessionReducer'

/**
 * Derived view state. Nothing here is stored: the questionnaire position, the
 * summary facts and the planner input are all functions of (vibe, basics, answers),
 * which is what keeps R6 and R13 honest.
 */

export interface QuestionView {
  node: QuestionNode
  /** 1-based, for "Question 2 of 4". */
  position: number
  total: number
  selected: OptionId | null
  /** True when the user arrived here with Back (docs/03-design.md §4 S3). */
  revisiting: boolean
}

export function questionView(
  state: SessionState,
  graph: QuestionGraph = QUESTION_GRAPH,
): QuestionView | null {
  if (state.vibe === null) return null
  const path = derivePath(graph, state.vibe, state.answers)
  if (path.length === 0) return null

  const autoIndex = path.length - 1
  const index = Math.min(state.questionCursor ?? autoIndex, autoIndex)
  const id = path[index]
  if (id === undefined) return null
  const node = nodeFor(graph, id)
  if (node === null) return null

  const selected = state.answers[id] ?? null
  return {
    node,
    position: index + 1,
    total: Math.max(projectedLength(graph, state.vibe, state.answers), path.length),
    selected,
    revisiting: state.questionCursor !== null && selected !== null,
  }
}

/**
 * R2 — the summary bar, exactly four facts:
 * `5 nights · 2 travellers · from Bengaluru · ₹60,000`, and
 * `4 travellers (2 adults, 2 children)` once there are children in the party (R24).
 */
export function summaryFacts(state: SessionState): string[] | null {
  const { basics } = state
  if (basics === null) return null
  return [
    nightsLabel(nightsBetween(basics.startDate, basics.endDate)),
    travellersFact(basics.adults, basics.children.length),
    `from ${basics.origin}`,
    formatRupees(basics.budget),
  ]
}

export interface PlannerRequest {
  input: PlanInput
  defaultedQuestions: number
}

/**
 * What the engine is asked for. Unanswered questions are filled with their neutral
 * defaults — zero of them on the normal path, and the count behind
 * "3 questions answered for you" when the user took the escape hatch (R5).
 */
export function plannerRequest(
  state: SessionState,
  graph: QuestionGraph = QUESTION_GRAPH,
): PlannerRequest | null {
  if (state.vibe === null || state.basics === null) return null
  const walk = defaultWalk(graph, state.vibe, state.answers)
  return {
    input: {
      vibe: state.vibe,
      basics: state.basics,
      answers: walk.pairs,
      excludeDestinationIds: state.excluded,
    },
    defaultedQuestions: walk.defaulted,
  }
}
