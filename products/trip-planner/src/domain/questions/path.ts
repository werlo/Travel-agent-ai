import type {
  AnswerPairs,
  Answers,
  DestinationTag,
  ConstraintSpec,
  OptionId,
  QuestionGraph,
  QuestionId,
  QuestionNode,
  QuestionOption,
  Vibe,
} from '../types'

/**
 * Walking the graph (R4, R5, R6). All pure, all trivially unit-testable.
 *
 * R6 falls out for free: change question 2's answer and `derivePath` re-walks, so
 * question 3 is whatever the new branch says while question 1 — upstream of the
 * change — is untouched. Answers that are no longer on the path are simply not
 * visited; the session keeps them so that changing back restores them.
 */

export function nodeFor(graph: QuestionGraph, id: QuestionId): QuestionNode | null {
  return graph.nodes[id] ?? null
}

export function optionFor(node: QuestionNode, optionId: OptionId): QuestionOption | null {
  return node.options.find((option) => option.id === optionId) ?? null
}

/**
 * entry[vibe] → answers[q] → option.next, stopping at the first unanswered question
 * or at `next === null`. The last element is the question on screen.
 */
export function derivePath(graph: QuestionGraph, vibe: Vibe, answers: Answers): QuestionId[] {
  const path: QuestionId[] = []
  const seen = new Set<QuestionId>()
  let id: QuestionId | null = graph.entry[vibe]

  while (id !== null && !seen.has(id)) {
    const node = nodeFor(graph, id)
    if (node === null) break
    seen.add(id)
    path.push(id)

    const answerId = answers[id]
    if (answerId === undefined) break
    const option = optionFor(node, answerId)
    // An answer that no longer resolves (the graph changed under a saved session)
    // resumes the questionnaire here rather than throwing.
    if (option === null) break
    id = option.next
  }

  return path
}

/** True when the questionnaire has been walked to a leaf. */
export function isComplete(graph: QuestionGraph, vibe: Vibe, answers: Answers): boolean {
  const path = derivePath(graph, vibe, answers)
  const lastId = path[path.length - 1]
  if (lastId === undefined) return false
  const node = nodeFor(graph, lastId)
  if (node === null) return false
  const answerId = answers[lastId]
  if (answerId === undefined) return false
  const option = optionFor(node, answerId)
  return option !== null && option.next === null
}

/** The current (unanswered) question, or null when the questionnaire is done. */
export function currentQuestion(
  graph: QuestionGraph,
  vibe: Vibe,
  answers: Answers,
): QuestionNode | null {
  if (isComplete(graph, vibe, answers)) return null
  const path = derivePath(graph, vibe, answers)
  const lastId = path[path.length - 1]
  if (lastId === undefined) return null
  return nodeFor(graph, lastId)
}

/** Longest number of questions from `id` to a leaf, counting `id` itself. */
export function longestRemaining(graph: QuestionGraph, id: QuestionId): number {
  const memo = new Map<QuestionId, number>()

  const walk = (nodeId: QuestionId, stack: ReadonlySet<QuestionId>): number => {
    const cached = memo.get(nodeId)
    if (cached !== undefined) return cached
    const node = nodeFor(graph, nodeId)
    if (node === null) return 0
    if (stack.has(nodeId)) return 0

    const nextStack = new Set(stack).add(nodeId)
    let best = 0
    for (const option of node.options) {
      const depth = option.next === null ? 0 : walk(option.next, nextStack)
      if (depth > best) best = depth
    }
    const result = best + 1
    memo.set(nodeId, result)
    return result
  }

  return walk(id, new Set())
}

/**
 * The denominator in "Question 2 of 4" (R4): questions already answered on the path
 * plus the longest run still ahead. It is branch-dependent by design — picking a
 * deeper branch can move it, which is correct behaviour, not a bug
 * (docs/02-architecture.md §11).
 */
export function projectedLength(graph: QuestionGraph, vibe: Vibe, answers: Answers): number {
  const path = derivePath(graph, vibe, answers)
  const lastId = path[path.length - 1]
  if (lastId === undefined) return 0
  return path.length - 1 + longestRemaining(graph, lastId)
}

/** 1-based position of the question on screen, for "Question 2 of 4". */
export function questionPosition(graph: QuestionGraph, vibe: Vibe, answers: Answers): number {
  return derivePath(graph, vibe, answers).length
}

export interface DefaultedWalk {
  /** Every question on the completed path, in order, with its answer. */
  pairs: AnswerPairs
  /** How many of those answers were filled in by us (R5). */
  defaulted: number
  /** The first question we answered on the user's behalf, if any. */
  firstDefaultedId: QuestionId | null
}

/**
 * Completes the path, filling every unanswered question with its neutral default.
 * This is what "Plan my trip now" does (R5) and it is also how a normally completed
 * questionnaire is turned into planner input — in that case `defaulted` is 0.
 */
export function defaultWalk(graph: QuestionGraph, vibe: Vibe, answers: Answers): DefaultedWalk {
  const pairs: Array<readonly [QuestionId, OptionId]> = []
  const seen = new Set<QuestionId>()
  let defaulted = 0
  let firstDefaultedId: QuestionId | null = null
  let id: QuestionId | null = graph.entry[vibe]

  while (id !== null && !seen.has(id)) {
    const node = nodeFor(graph, id)
    if (node === null) break
    seen.add(id)

    const given = answers[id]
    const resolved = given !== undefined && optionFor(node, given) !== null ? given : null
    const chosen = resolved ?? node.defaultOptionId
    if (resolved === null) {
      defaulted += 1
      if (firstDefaultedId === null) firstDefaultedId = id
    }

    pairs.push([id, chosen])
    const option = optionFor(node, chosen)
    if (option === null) break
    id = option.next
  }

  return { pairs, defaulted, firstDefaultedId }
}

/** On-path answers only, in path order — off-path answers never reach the engine. */
export function effectiveAnswers(graph: QuestionGraph, vibe: Vibe, answers: Answers): AnswerPairs {
  const pairs: Array<readonly [QuestionId, OptionId]> = []
  for (const id of derivePath(graph, vibe, answers)) {
    const answerId = answers[id]
    if (answerId === undefined) continue
    pairs.push([id, answerId])
  }
  return pairs
}

export function defaultedCount(graph: QuestionGraph, vibe: Vibe, answers: Answers): number {
  return defaultWalk(graph, vibe, answers).defaulted
}

/** The constraints carried by a completed set of answer pairs, in path order. */
export function constraintsFor(
  graph: QuestionGraph,
  pairs: AnswerPairs,
): ConstraintSpec[][] {
  return pairs.map(([questionId, optionId]) => {
    const node = nodeFor(graph, questionId)
    if (node === null) return []
    const option = optionFor(node, optionId)
    return option === null ? [] : [...option.constraints]
  })
}

/** The soft signals carried by a completed set of answer pairs. */
export function preferredTags(graph: QuestionGraph, pairs: AnswerPairs): DestinationTag[] {
  const tags: DestinationTag[] = []
  for (const [questionId, optionId] of pairs) {
    const node = nodeFor(graph, questionId)
    if (node === null) continue
    const option = optionFor(node, optionId)
    if (option === null) continue
    for (const tag of option.preferTags) if (!tags.includes(tag)) tags.push(tag)
  }
  return tags
}

/** Every root-to-leaf path for a vibe, as question-id lists. Used by the graph tests. */
export function enumeratePaths(graph: QuestionGraph, vibe: Vibe): QuestionId[][] {
  const out: QuestionId[][] = []

  const walk = (id: QuestionId, acc: QuestionId[]): void => {
    const node = nodeFor(graph, id)
    if (node === null) return
    if (acc.includes(id)) return
    const next = [...acc, id]
    for (const option of node.options) {
      if (option.next === null) out.push(next)
      else walk(option.next, next)
    }
  }

  walk(graph.entry[vibe], [])
  return out
}
