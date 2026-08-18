// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { dayLine, toPlainText } from '../src/domain/export'
import { generatePlanSet } from '../src/domain/planner'
import { QUESTION_GRAPH } from '../src/domain/questions/graph'
import { defaultWalk } from '../src/domain/questions/path'
import type { Basics, Plan, Vibe } from '../src/domain/types'

/**
 * R17 — the plain-text export.
 *
 * R17 names four things the text must contain: the destination, the dates, the
 * party total and one line per day. Those are asserted structurally rather than
 * against one golden string, because the destination the engine picks is allowed
 * to change when the catalogue does — the *shape* is the contract.
 */

const REFERENCE: Basics = {
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  budget: 60000,
  travellers: 2,
  origin: 'Bengaluru',
}

function planFor(vibe: Vibe, basics: Basics = REFERENCE): Plan {
  const walk = defaultWalk(QUESTION_GRAPH, vibe, {})
  return generatePlanSet(
    { vibe, basics, answers: walk.pairs },
    CATALOGUE,
    { defaultedQuestions: walk.defaulted },
  ).recommended
}

describe('toPlainText (R17)', () => {
  const plan = planFor('beach')
  const text = toPlainText(plan, CATALOGUE.meta)
  const lines = text.split('\n')

  it('opens with the destination and the trip length', () => {
    expect(lines[0]).toBe(`${plan.destinationName} — 5 nights`)
  })

  it('carries the date range, the party and the origin on the second line', () => {
    expect(lines[1]).toBe('Sat 10 – Thu 15 Oct 2026 · 2 travellers · from Bengaluru')
  })

  it('states the party total and the per-person figure', () => {
    expect(lines[2]).toMatch(/^Total ₹[\d,]+ for 2 \(₹[\d,]+ per person\)$/)
    const total = Number((lines[2] ?? '').replace(/^Total ₹([\d,]+).*$/, '$1').replace(/,/g, ''))
    expect(total).toBe(plan.cost.partyTotal)
  })

  it('has exactly one line per day, in order, each naming something to do', () => {
    const dayLines = lines.filter((line) => /^Day \d+ — /.test(line))
    expect(dayLines).toHaveLength(plan.days.length)
    expect(dayLines).toHaveLength(6)
    dayLines.forEach((line, index) => {
      expect(line.startsWith(`Day ${index + 1} — `)).toBe(true)
      // Everything after the `: ` is at least one item.
      expect((line.split(': ')[1] ?? '').length).toBeGreaterThan(0)
    })
  })

  it('names the stay, the four line items and the plan ID', () => {
    expect(text).toContain(`Stay: ${plan.stay.name}, 5 nights, 1 room`)
    expect(text).toMatch(
      /Travel ₹[\d,]+ · Stay ₹[\d,]+ · Experiences ₹[\d,]+ · Local allowance ₹[\d,]+/,
    )
    expect(text).toContain(`Plan ${plan.planId} · Compass catalogue 2026-08-01`)
  })

  it('ends with the honesty sentence, so a pasted itinerary carries it too (R16)', () => {
    expect(lines[lines.length - 1]).toBe(
      'Prices are indicative sample data. Compass does not sell or reserve anything.',
    )
    expect(text).toContain('indicative')
  })

  it('is deterministic: the same plan produces byte-identical text (R13)', () => {
    expect(toPlainText(planFor('beach'), CATALOGUE.meta)).toBe(text)
  })

  it('offers to book nothing — no line invites a transaction (R16)', () => {
    for (const line of lines) {
      expect(/\b(book|booking|pay|checkout)\b/i.test(line)).toBe(false)
    }
  })

  it('scales its day lines to the trip length', () => {
    const long = planFor('culture', { ...REFERENCE, endDate: '2026-10-20', budget: 120000 })
    const dayLines = toPlainText(long, CATALOGUE.meta)
      .split('\n')
      .filter((line) => /^Day \d+ — /.test(line))
    expect(dayLines).toHaveLength(11)
  })

  it('puts a one-traveller party in the singular', () => {
    const solo = planFor('peace', { ...REFERENCE, travellers: 1 })
    const text1 = toPlainText(solo, CATALOGUE.meta)
    expect(text1).toContain('1 traveller ·')
    expect(text1).toMatch(/Total ₹[\d,]+ for 1 \(/)
    expect(text1).toContain('1 room')
  })
})

describe('dayLine', () => {
  const plan = planFor('beach')

  it('reads the arrival day as travel, then the stay, then what to do', () => {
    const first = plan.days[0]
    if (first === undefined) throw new Error('no first day')
    const line = dayLine(first)
    const items = (line.split(': ')[1] ?? '').split(' · ')
    expect(items[0]).toMatch(/^(Fly|Train|Drive) .+ → .+ \(\d/)
    expect(items[1]).toBe(`Check in, ${plan.stay.name}`)
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  it('reads the departure day as the check-out and the journey home', () => {
    const last = plan.days[plan.days.length - 1]
    if (last === undefined) throw new Error('no last day')
    const items = (dayLine(last).split(': ')[1] ?? '').split(' · ')
    expect(items[0]).toBe(`Check out, ${plan.stay.name}`)
    expect(items[items.length - 1]).toMatch(/^(Fly|Train|Drive) .+ → .+ \(\d/)
  })

  it('uses a comma where the screen uses an em dash, so a paste reads naturally', () => {
    const first = plan.days[0]
    if (first === undefined) throw new Error('no first day')
    expect(first.stayEntry?.label).toContain(' — ')
    expect(dayLine(first)).not.toContain(' — Check in')
  })
})
