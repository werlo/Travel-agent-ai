import { nightsBetween, parseISO } from './dates'
import { ORIGIN_CITIES, type Basics, type OriginCity } from './types'

/**
 * R3 — the basics are rejected inline, without advancing. Every string below is
 * the designer's, verbatim (docs/03-design.md §4 S2, "Error strings — verbatim,
 * one per rule"). Two of them are also quoted by R3's acceptance criterion.
 *
 * Validation takes the raw form values rather than a `Partial<Basics>`, because
 * "budget non-numeric" is not expressible once the value has been narrowed to a
 * number (docs/02-architecture.md §12 Deviations).
 */

export type BasicsField = 'startDate' | 'endDate' | 'budget' | 'travellers' | 'origin'

export const BASICS_FIELD_ORDER: readonly BasicsField[] = [
  'startDate',
  'endDate',
  'budget',
  'travellers',
  'origin',
]

export type BasicsErrors = Partial<Record<BasicsField, string>>

export interface RawBasics {
  startDate: string
  endDate: string
  budget: string
  travellers: string
  origin: string
}

export const MAX_NIGHTS = 21
export const MIN_BUDGET = 5000
export const MIN_TRAVELLERS = 1
export const MAX_TRAVELLERS = 12

export const MESSAGES = {
  startMissing: 'Enter a start date',
  endMissing: 'Enter an end date',
  endBeforeStart: 'End date must be after your start date',
  tooLong: "Trips longer than 21 nights aren't supported yet",
  budgetNotANumber: 'Enter a budget as a number, digits only',
  budgetTooLow: 'Enter a budget of at least ₹5,000',
  travellersMissing: 'Enter how many people are travelling',
  travellersOutOfRange: 'Travellers must be between 1 and 12',
  originUnknown: 'Choose a departure city from the list',
} as const

const DIGITS_ONLY = /^\d+$/

function isOrigin(value: string): value is OriginCity {
  return (ORIGIN_CITIES as readonly string[]).includes(value)
}

export interface ValidationResult {
  errors: BasicsErrors
  /** Non-null only when `errors` is empty. */
  basics: Basics | null
}

export function validateBasics(raw: RawBasics): ValidationResult {
  const errors: BasicsErrors = {}

  const start = parseISO(raw.startDate.trim())
  const end = parseISO(raw.endDate.trim())

  if (start === null) errors.startDate = MESSAGES.startMissing
  if (end === null) errors.endDate = MESSAGES.endMissing

  let nights = Number.NaN
  if (start !== null && end !== null) {
    nights = nightsBetween(raw.startDate.trim(), raw.endDate.trim())
    if (nights <= 0) errors.endDate = MESSAGES.endBeforeStart
    else if (nights > MAX_NIGHTS) errors.endDate = MESSAGES.tooLong
  }

  const budgetText = raw.budget.trim().replace(/,/g, '')
  let budget = Number.NaN
  if (budgetText === '' || !DIGITS_ONLY.test(budgetText)) {
    errors.budget = MESSAGES.budgetNotANumber
  } else {
    budget = Number(budgetText)
    if (budget < MIN_BUDGET) errors.budget = MESSAGES.budgetTooLow
  }

  const travellersText = raw.travellers.trim()
  let travellers = Number.NaN
  if (travellersText === '') {
    errors.travellers = MESSAGES.travellersMissing
  } else if (!DIGITS_ONLY.test(travellersText)) {
    errors.travellers = MESSAGES.travellersOutOfRange
  } else {
    travellers = Number(travellersText)
    if (travellers < MIN_TRAVELLERS || travellers > MAX_TRAVELLERS) {
      errors.travellers = MESSAGES.travellersOutOfRange
    }
  }

  const origin = raw.origin.trim()
  if (!isOrigin(origin)) errors.origin = MESSAGES.originUnknown

  const clean = Object.keys(errors).length === 0
  if (!clean || start === null || end === null || !isOrigin(origin)) {
    return { errors, basics: null }
  }

  return {
    errors,
    basics: {
      startDate: raw.startDate.trim(),
      endDate: raw.endDate.trim(),
      budget,
      travellers,
      origin,
    },
  }
}

/** The ErrorSummary heading (docs/03-design.md §4 S2) — the number is the live count. */
export function errorSummaryHeading(count: number): string {
  return count === 1
    ? '1 thing to fix before we can plan'
    : `${count} things to fix before we can plan`
}

/** Errors in field order, so the summary and the focus move agree. */
export function orderedErrors(errors: BasicsErrors): Array<[BasicsField, string]> {
  const out: Array<[BasicsField, string]> = []
  for (const field of BASICS_FIELD_ORDER) {
    const message = errors[field]
    if (message !== undefined) out.push([field, message])
  }
  return out
}
