import {
  formatDateRange,
  formatDuration,
  nightsBetween,
  nightsLabel,
  parseDMY,
  weekdayPlural,
} from '../domain/dates'
import { formatRupees } from '../domain/money'
import { travellersFact } from '../domain/party'
import type { Experience, Plan, TravelLeg } from '../domain/types'
import type { RawBasics } from '../domain/validate'

/**
 * Presentation strings that are NOT asserted verbatim by R2/R8/R9 — those live in
 * the domain, next to the numbers they describe, so that a UI refactor cannot move
 * them by accident.
 */

const MODE_VERB = {
  flight: 'Fly',
  train: 'Train',
  road: 'Drive',
} as const

const MODE_DETAIL = {
  flight: 'in the air',
  train: 'on the train',
  road: 'on the road',
} as const

export function legLabel(leg: TravelLeg): string {
  return `${MODE_VERB[leg.mode]} ${leg.from} → ${leg.to}`
}

export function legDetail(leg: TravelLeg): string {
  return `${formatDuration(leg.hours)} ${MODE_DETAIL[leg.mode]} · ${formatRupees(leg.perPerson)} per traveller`
}

export function experienceDetail(experience: Experience): string {
  const price =
    experience.pricePerPerson === 0
      ? 'Free'
      : `${formatRupees(experience.pricePerPerson)} per person`
  const hours = experience.durationHours
  const parts = [price, `${hours} ${hours === 1 ? 'hr' : 'hrs'}`]
  // R18 — the day it runs is structured data, so it can be stated next to the
  // item and enforced by the scheduler rather than asserted in the blurb.
  const availability = experienceAvailability(experience)
  if (availability !== null) parts.push(availability)
  return parts.join(' · ')
}

/** 'Wednesdays only' — null when the experience runs any day (R18). */
export function experienceAvailability(experience: Experience): string | null {
  if (experience.fixedWeekday === null) return null
  return `${weekdayPlural(experience.fixedWeekday)} only`
}

/** `5 nights · Sat 10 – Thu 15 Oct 2026 · 2 travellers · from Bengaluru · based in Fort Kochi`. */
export function planFacts(plan: Plan): string {
  return [
    nightsLabel(plan.nights),
    formatDateRange(plan.startDate, plan.endDate),
    travellersFact(plan.adults, plan.children),
    `from ${plan.origin}`,
    `based in ${plan.baseName}`,
  ].join(' · ')
}

/** `Plan KOCH-5N-2P-B60-a41c · catalogue 2026-08-01`. */
export function planIdLine(plan: Plan, catalogueVersion: string): string {
  return `Plan ${plan.planId} · catalogue ${catalogueVersion}`
}

/** R5 — `3 questions answered for you`. */
export function defaultedLabel(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'} answered for you`
}

/**
 * The summary bar while the basics are still being typed (UX4): best effort, never
 * an error, because the bar is a running total and not a validator.
 */
export function draftSummaryFacts(raw: RawBasics): string[] {
  const start = parseDMY(raw.startDate)
  const end = parseDMY(raw.endDate)
  const nights = start === null || end === null ? Number.NaN : nightsBetween(start, end)
  const adults = Number(raw.travellers.trim())
  const children = (raw.childAges ?? []).filter((age) => age.trim() !== '').length
  const budget = Number(raw.budget.trim().replace(/,/g, ''))
  return [
    Number.isFinite(nights) && nights > 0 ? nightsLabel(nights) : 'Dates to confirm',
    Number.isFinite(adults) && adults > 0
      ? travellersFact(adults, children)
      : 'Travellers to confirm',
    `from ${raw.origin}`,
    Number.isFinite(budget) && budget > 0 ? formatRupees(budget) : 'Budget to confirm',
  ]
}
