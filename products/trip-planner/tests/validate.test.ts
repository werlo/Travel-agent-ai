import { describe, expect, it } from 'vitest'
import {
  errorSummaryHeading,
  orderedErrors,
  validateBasics,
  type RawBasics,
} from '../src/domain/validate'

/**
 * R3 — the exact strings. These are quoted by the acceptance criteria and by the
 * designer's error table (docs/03-design.md §4 S2); if one of them changes, this
 * test is the thing that says so rather than a judge reading a different sentence
 * from the one the PRD promised.
 */

const VALID: RawBasics = {
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  budget: '60000',
  travellers: '2',
  origin: 'Bengaluru',
}

function errorsFor(overrides: Partial<RawBasics>) {
  return validateBasics({ ...VALID, ...overrides }).errors
}

describe('validateBasics', () => {
  it('accepts the screen defaults and narrows them', () => {
    const result = validateBasics(VALID)
    expect(result.errors).toEqual({})
    expect(result.basics).toEqual({
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      budget: 60000,
      travellers: 2,
      adults: 2,
      children: [],
      origin: 'Bengaluru',
      freeDay: false,
    })
  })

  it('rejects an end date on or before the start date', () => {
    expect(errorsFor({ endDate: '2026-10-09' }).endDate).toBe(
      'End date must be after your start date',
    )
    expect(errorsFor({ endDate: '2026-10-10' }).endDate).toBe(
      'End date must be after your start date',
    )
  })

  it('rejects trips longer than 21 nights and accepts exactly 21', () => {
    expect(errorsFor({ endDate: '2026-11-01' }).endDate).toBe(
      "Trips longer than 21 nights aren't supported yet",
    )
    expect(errorsFor({ endDate: '2026-10-31' }).endDate).toBeUndefined()
  })

  it('rejects a budget below ₹5,000 and accepts exactly ₹5,000', () => {
    expect(errorsFor({ budget: '0' }).budget).toBe('Enter a budget of at least ₹5,000')
    expect(errorsFor({ budget: '4999' }).budget).toBe('Enter a budget of at least ₹5,000')
    expect(errorsFor({ budget: '5000' }).budget).toBeUndefined()
  })

  it('rejects a non-numeric or blank budget with its own message', () => {
    expect(errorsFor({ budget: 'lots' }).budget).toBe('Enter a budget as a number, digits only')
    expect(errorsFor({ budget: '' }).budget).toBe('Enter a budget as a number, digits only')
    expect(errorsFor({ budget: '60000.5' }).budget).toBe(
      'Enter a budget as a number, digits only',
    )
  })

  it('accepts a grouped budget the user pasted back in', () => {
    expect(validateBasics({ ...VALID, budget: '60,000' }).basics?.budget).toBe(60000)
  })

  it('rejects travellers outside 1–12 and accepts both ends', () => {
    expect(errorsFor({ travellers: '0' }).travellers).toBe('Travellers must be between 1 and 12')
    expect(errorsFor({ travellers: '13' }).travellers).toBe('Travellers must be between 1 and 12')
    expect(errorsFor({ travellers: '1' }).travellers).toBeUndefined()
    expect(errorsFor({ travellers: '12' }).travellers).toBeUndefined()
  })

  it('has a separate message for no travellers at all', () => {
    expect(errorsFor({ travellers: '' }).travellers).toBe('Enter how many people are travelling')
  })

  it('rejects a departure city that is not one of the six', () => {
    expect(errorsFor({ origin: 'Pune' }).origin).toBe('Choose a departure city from the list')
  })

  it('rejects missing dates', () => {
    expect(errorsFor({ startDate: '' }).startDate).toBe('Enter a start date')
    expect(errorsFor({ endDate: '' }).endDate).toBe('Enter an end date')
  })

  it('never returns basics while any error stands', () => {
    expect(validateBasics({ ...VALID, budget: '0' }).basics).toBeNull()
  })

  it('reports several problems at once, in field order', () => {
    const errors = errorsFor({ budget: '0', travellers: '13' })
    expect(orderedErrors(errors).map(([field]) => field)).toEqual(['budget', 'travellers'])
    expect(errorSummaryHeading(2)).toBe('2 things to fix before we can plan')
    expect(errorSummaryHeading(1)).toBe('1 thing to fix before we can plan')
  })
})
