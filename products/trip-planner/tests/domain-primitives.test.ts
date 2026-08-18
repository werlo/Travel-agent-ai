import { describe, expect, it } from 'vitest'
import {
  addDays,
  civilFromDays,
  daysFromCivil,
  firstOfNextMonth,
  formatDateRange,
  formatDayLabel,
  formatDuration,
  isISODate,
  nightsBetween,
  nightsLabel,
  parseISO,
  travellersLabel,
  weekdayShort,
} from '../src/domain/dates'
import { formatRupees, groupIndian, perPersonRounded, roomsFor } from '../src/domain/money'
import { canonicalise, fnv1a32, planId, shortHash } from '../src/domain/hash'
import type { PlanInput } from '../src/domain/types'

/**
 * The primitives R8, R9 and R13 are built on. The money formatter is hand-written
 * precisely so these strings are identical in Node and in Chromium
 * (docs/02-architecture.md §1) — an `Intl` implementation would make this file pass
 * and the E2E suite fail.
 */

describe('Indian digit grouping', () => {
  const cases: Array<[number, string]> = [
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1,000'],
    [8400, '8,400'],
    [60000, '60,000'],
    [99999, '99,999'],
    [100000, '1,00,000'],
    [251600, '2,51,600'],
    [1234567, '12,34,567'],
    [12345678, '1,23,45,678'],
  ]

  for (const [value, expected] of cases) {
    it(`${value} -> ${expected}`, () => {
      expect(groupIndian(value)).toBe(expected)
    })
  }

  it('prefixes the rupee sign', () => {
    expect(formatRupees(60000)).toBe('₹60,000')
    expect(formatRupees(8400)).toBe('₹8,400')
  })

  it('keeps negatives readable', () => {
    expect(groupIndian(-1200)).toBe('-1,200')
  })
})

describe('rooms and per-person rounding (A7, R8)', () => {
  it('is one room per two travellers, rounded up', () => {
    expect([1, 2, 3, 4, 9, 12].map(roomsFor)).toEqual([1, 1, 2, 2, 5, 6])
  })

  it('rounds the per-person figure to the nearest ₹100', () => {
    expect(perPersonRounded(51600, 2)).toBe(25800)
    expect(perPersonRounded(51649, 2)).toBe(25800)
    expect(perPersonRounded(100000, 3)).toBe(33300)
  })
})

describe('UTC-only date maths', () => {
  it('round-trips civil dates through the epoch day count', () => {
    for (const iso of ['1970-01-01', '2026-10-10', '2024-02-29', '2100-03-01']) {
      const civil = parseISO(iso)
      expect(civil).not.toBeNull()
      expect(civilFromDays(daysFromCivil(civil!))).toEqual(civil)
    }
  })

  it('knows the weekday without a Date object', () => {
    expect(weekdayShort('1970-01-01')).toBe('Thu')
    expect(weekdayShort('2026-10-10')).toBe('Sat')
    expect(weekdayShort('2026-10-15')).toBe('Thu')
  })

  it('counts nights and rejects nonsense', () => {
    expect(nightsBetween('2026-10-10', '2026-10-15')).toBe(5)
    expect(nightsBetween('2026-10-15', '2026-10-10')).toBe(-5)
    expect(Number.isNaN(nightsBetween('nope', '2026-10-10'))).toBe(true)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2024-02-29')).toBe(true)
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-10', 5)).toBe('2026-10-15')
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('finds the first of next month for the S2 default', () => {
    expect(firstOfNextMonth('2026-08-18')).toBe('2026-09-01')
    expect(firstOfNextMonth('2026-12-05')).toBe('2027-01-01')
  })

  it('formats the labels the plan screen uses', () => {
    expect(formatDayLabel('2026-10-10')).toBe('Sat 10 Oct')
    expect(formatDateRange('2026-10-10', '2026-10-15')).toBe('Sat 10 – Thu 15 Oct 2026')
    expect(formatDateRange('2026-11-30', '2026-12-03')).toBe('Mon 30 Nov – Thu 3 Dec 2026')
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe(
      'Wed 30 Dec 2026 – Sat 2 Jan 2027',
    )
    expect(formatDuration(1.333)).toBe('1h 20m')
    expect(formatDuration(3)).toBe('3h')
    expect(nightsLabel(1)).toBe('1 night')
    expect(travellersLabel(1)).toBe('1 traveller')
  })
})

describe('plan identity (R13)', () => {
  const input: PlanInput = {
    vibe: 'beach',
    basics: {
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      budget: 60000,
      travellers: 2,
      origin: 'Bengaluru',
    },
    answers: [
      ['beach-region', 'within-india'],
      ['beach-coast', 'west-coast'],
    ],
  }

  it('hashes deterministically', () => {
    expect(fnv1a32('compass')).toBe(fnv1a32('compass'))
    expect(fnv1a32('compass')).not.toBe(fnv1a32('compasses'))
    expect(shortHash('a')).toHaveLength(4)
  })

  it('canonicalises answers in path order and nothing else', () => {
    const canonical = canonicalise(input, '2026-08-01')
    expect(canonical).toContain('cat:2026-08-01')
    expect(canonical).toContain('answers:beach-region=within-india;beach-coast=west-coast')
    expect(canonicalise(input, '2026-08-01')).toBe(canonical)
  })

  it('changes when any input changes', () => {
    const base = canonicalise(input, '2026-08-01')
    expect(canonicalise(input, '2026-09-01')).not.toBe(base)
    expect(
      canonicalise({ ...input, basics: { ...input.basics, travellers: 4 } }, '2026-08-01'),
    ).not.toBe(base)
    expect(canonicalise({ ...input, answers: [] }, '2026-08-01')).not.toBe(base)
  })

  it('renders the designer’s plan-ID shape and varies with the variant', () => {
    const canonical = canonicalise(input, '2026-08-01')
    const parts = { destinationName: 'Kochi & Varkala', nights: 5, travellers: 2, budget: 60000 }
    const id = planId(canonical, 'recommended', parts)
    expect(id).toMatch(/^KOCH-5N-2P-B60-[0-9a-z]{4}$/)
    expect(planId(canonical, 'recommended', parts)).toBe(id)
    expect(planId(canonical, 'saver', parts)).not.toBe(id)
  })
})
