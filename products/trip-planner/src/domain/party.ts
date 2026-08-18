import type { Rupees } from './types'

/**
 * R24 (customer fix 10) — children, counted and priced at a published rate.
 *
 * A12: publish an explicit rule rather than refuse the input. "Priced per adult
 * traveller" was a disclosure of a gap, not a solution — the whole catalogue is
 * labelled sample data, and a stated rule is honest where silence is not.
 *
 * The rule is one string, defined once, printed on the plan and used by the
 * pricing arithmetic, so what the screen promises and what the engine charges
 * cannot drift apart.
 */

export const CHILD_MIN_AGE = 2
export const CHILD_MAX_AGE = 11

/** What the age field will accept. Anyone older is a traveller at the adult fare. */
export const CHILD_INPUT_MIN_AGE = 0
export const CHILD_INPUT_MAX_AGE = 17

/** Percent of the adult fare a child pays. */
export const CHILD_FARE_PERCENT = 75
/** Percent of the adult experience price a child pays. */
export const CHILD_EXPERIENCE_PERCENT = 50

export const CHILD_RULE =
  `Children ${CHILD_MIN_AGE}–${CHILD_MAX_AGE} are priced at ${CHILD_FARE_PERCENT}% of the adult fare ` +
  `and ${CHILD_EXPERIENCE_PERCENT}% of experiences; they occupy a room place.`

/** The one sentence that stops the rule being a surprise on the plan screen. */
export const ADULT_AGE_NOTE = `A traveller aged ${CHILD_MAX_AGE + 1} or over is priced as an adult.`

export const CHILD_AGE_HINT =
  `Ages ${CHILD_INPUT_MIN_AGE}–${CHILD_INPUT_MAX_AGE}. ${ADULT_AGE_NOTE}`

export interface PartySplit {
  /** Everyone paying the full fare: the adults, plus any child aged 12 or over. */
  fullFare: number
  /** Everyone paying the published child rate: ages 0–11. */
  childRate: number
}

/** Who pays what, by age (R24). The counts on screen stay as the user typed them. */
export function splitByAge(adults: number, children: readonly number[]): PartySplit {
  const childRate = children.filter((age) => age <= CHILD_MAX_AGE).length
  return { fullFare: adults + (children.length - childRate), childRate }
}

export function childFare(adultFare: Rupees): Rupees {
  return Math.round((adultFare * CHILD_FARE_PERCENT) / 100)
}

export function childExperiencePrice(adultPrice: Rupees): Rupees {
  return Math.round((adultPrice * CHILD_EXPERIENCE_PERCENT) / 100)
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** '4 adults' / '2 adults and 2 children' — what the party total is a total *for*. */
export function partyLabel(adults: number, children: number): string {
  const adultPart = countLabel(adults, 'adult', 'adults')
  if (children <= 0) return adultPart
  if (adults <= 0) return countLabel(children, 'child', 'children')
  return `${adultPart} and ${countLabel(children, 'child', 'children')}`
}

/** '4 travellers (2 adults, 2 children)' — the summary bar fact (R24). */
export function travellersFact(adults: number, children: number): string {
  const total = adults + children
  const travellers = countLabel(total, 'traveller', 'travellers')
  if (children <= 0) return travellers
  return `${travellers} (${countLabel(adults, 'adult', 'adults')}, ${countLabel(
    children,
    'child',
    'children',
  )})`
}
