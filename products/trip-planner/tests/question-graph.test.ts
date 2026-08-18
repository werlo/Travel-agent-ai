import { describe, expect, it } from 'vitest'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import {
  currentQuestion,
  defaultWalk,
  defaultedCount,
  derivePath,
  effectiveAnswers,
  enumeratePaths,
  isComplete,
  nodeFor,
  optionFor,
  projectedLength,
} from '../src/domain/questions/path'
import { VIBE_ORDER } from '../src/domain/vibes'
import type { Answers } from '../src/domain/types'

/**
 * R4/A5 — the graph invariant. Every root-to-leaf path for every vibe is between 3
 * and 5 questions long, every node offers "No preference" with no constraints
 * attached, and every default resolves. Enumerated rather than spot-checked, so a
 * new branch cannot quietly break the guarantee.
 */

describe('graph invariants', () => {
  for (const vibe of VIBE_ORDER) {
    describe(vibe, () => {
      it('has an entry question that exists', () => {
        expect(nodeFor(QUESTION_GRAPH, QUESTION_GRAPH.entry[vibe])).not.toBeNull()
      })

      it('has every root-to-leaf path between 3 and 5 questions long', () => {
        const paths = enumeratePaths(QUESTION_GRAPH, vibe)
        expect(paths.length).toBeGreaterThan(0)
        for (const path of paths) {
          expect(path.length, path.join(' → ')).toBeGreaterThanOrEqual(3)
          expect(path.length, path.join(' → ')).toBeLessThanOrEqual(5)
        }
      })

      it('never repeats a question on a path', () => {
        for (const path of enumeratePaths(QUESTION_GRAPH, vibe)) {
          expect(new Set(path).size).toBe(path.length)
        }
      })
    })
  }

  it('gives every node a No preference option that constrains nothing', () => {
    for (const node of Object.values(QUESTION_GRAPH.nodes)) {
      const neutral = optionFor(node, 'no-preference')
      expect(neutral, `${node.id} has no 'no-preference' option`).not.toBeNull()
      expect(neutral?.label).toBe('No preference')
      expect(neutral?.description).toBe("We'll pick this one for you.")
      expect(neutral?.constraints).toEqual([])
    }
  })

  it('gives every node a default that resolves, and points every next at a real node', () => {
    for (const node of Object.values(QUESTION_GRAPH.nodes)) {
      expect(optionFor(node, node.defaultOptionId), node.id).not.toBeNull()
      for (const option of node.options) {
        if (option.next === null) continue
        expect(nodeFor(QUESTION_GRAPH, option.next), `${node.id} → ${option.next}`).not.toBeNull()
      }
    }
  })

  it('gives every option a label and a description', () => {
    for (const node of Object.values(QUESTION_GRAPH.nodes)) {
      expect(node.prompt.length).toBeGreaterThan(0)
      expect(node.options.length).toBeGreaterThanOrEqual(3)
      for (const option of node.options) {
        expect(option.label.length).toBeGreaterThan(0)
        expect(option.description.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the Beach branch ships as the designer wrote it (R4)', () => {
  it('asks about India or international first', () => {
    const first = currentQuestion(QUESTION_GRAPH, 'beach', {})
    expect(first?.id).toBe('beach-region')
    expect(first?.prompt).toBe('Within India, or international?')
  })

  it('asks about long-haul flights after International', () => {
    const answers: Answers = { 'beach-region': 'international' }
    const next = currentQuestion(QUESTION_GRAPH, 'beach', answers)
    expect(next?.prompt).toContain('flight')
    expect(next?.options.map((o) => o.label)).toContain('Happy with long-haul')
  })

  it('asks about the coast after Within India, and never mentions long-haul', () => {
    const answers: Answers = { 'beach-region': 'within-india' }
    const next = currentQuestion(QUESTION_GRAPH, 'beach', answers)
    expect(next?.prompt).toContain('coast')

    const branch = JSON.stringify([
      next?.prompt,
      next?.options.map((o) => [o.label, o.description]),
    ])
    expect(branch.toLowerCase()).not.toContain('long-haul')
  })

  it('advances to a different question on No preference', () => {
    const next = currentQuestion(QUESTION_GRAPH, 'beach', { 'beach-region': 'no-preference' })
    expect(next?.id).toBe('beach-crowd')
    expect(next?.id).not.toBe('beach-region')
  })

  it('reads "Question 1 of 4" on the first question', () => {
    expect(derivePath(QUESTION_GRAPH, 'beach', {})).toEqual(['beach-region'])
    expect(projectedLength(QUESTION_GRAPH, 'beach', {})).toBe(4)
  })

  it('fills three questions when the user skips from question 1 (R5)', () => {
    const walk = defaultWalk(QUESTION_GRAPH, 'beach', {})
    expect(walk.defaulted).toBe(3)
    expect(walk.pairs.map(([q]) => q)).toEqual(['beach-region', 'beach-crowd', 'stay-style'])
    expect(walk.pairs.every(([, option]) => option === 'no-preference')).toBe(true)
    expect(defaultedCount(QUESTION_GRAPH, 'beach', {})).toBe(3)
  })

  it('counts nothing as defaulted once the questionnaire is complete', () => {
    const answers: Answers = {
      'beach-region': 'within-india',
      'beach-coast': 'west-coast',
      'beach-crowd': 'lively',
      'stay-style': 'local-stays',
    }
    expect(isComplete(QUESTION_GRAPH, 'beach', answers)).toBe(true)
    expect(defaultedCount(QUESTION_GRAPH, 'beach', answers)).toBe(0)
    expect(currentQuestion(QUESTION_GRAPH, 'beach', answers)).toBeNull()
  })
})

describe('changing an answer re-derives what follows it (R6)', () => {
  const answered: Answers = {
    'beach-region': 'international',
    'beach-haul': 'under-6h',
    'beach-crowd': 'empty',
  }

  it('walks the whole path while the answers hold', () => {
    expect(derivePath(QUESTION_GRAPH, 'beach', answered)).toEqual([
      'beach-region',
      'beach-haul',
      'beach-crowd',
      'stay-style',
    ])
  })

  it('replaces the branch when question 1 changes, and keeps still-valid answers', () => {
    const changed: Answers = { ...answered, 'beach-region': 'within-india' }
    const path = derivePath(QUESTION_GRAPH, 'beach', changed)
    expect(path).toEqual(['beach-region', 'beach-coast'])
    expect(path).not.toContain('beach-haul')

    // The orphaned answer is still in the record — changing back restores it —
    // but it is not on the path, so it never reaches the engine.
    expect(changed['beach-haul']).toBe('under-6h')
    expect(effectiveAnswers(QUESTION_GRAPH, 'beach', changed).map(([q]) => q)).toEqual([
      'beach-region',
    ])

    const back = derivePath(QUESTION_GRAPH, 'beach', answered)
    expect(back).toContain('beach-haul')
  })

  it('keeps the downstream answer when the new branch leads to the same question', () => {
    const changed: Answers = { ...answered, 'beach-haul': 'long-haul' }
    expect(derivePath(QUESTION_GRAPH, 'beach', changed)).toEqual([
      'beach-region',
      'beach-haul',
      'beach-crowd',
      'stay-style',
    ])
    expect(effectiveAnswers(QUESTION_GRAPH, 'beach', changed)).toContainEqual([
      'beach-crowd',
      'empty',
    ])
  })

  it('resumes at the first question it can still reach when an answer is unknown', () => {
    const stale: Answers = { 'beach-region': 'a-branch-that-no-longer-exists' }
    expect(derivePath(QUESTION_GRAPH, 'beach', stale)).toEqual(['beach-region'])
    expect(defaultWalk(QUESTION_GRAPH, 'beach', stale).defaulted).toBe(3)
  })
})
