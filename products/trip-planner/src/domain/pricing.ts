import { nightsLabel } from './dates'
import { formatRupees, perPersonRounded } from './money'
import { childExperiencePrice, childFare, partyLabel, splitByAge } from './party'
import { seasonalLoading } from './season'
import type {
  CostBreakdown,
  Destination,
  Experience,
  PlanContext,
  Stay,
} from './types'

/**
 * R8 — the exact-sum guarantee.
 *
 * Every input is an integer number of rupees, so "the line items sum exactly to the
 * party total" is arithmetic rather than a rounding policy. `partyTotal` is derived
 * by addition at the point of construction and never recomputed elsewhere; the UI
 * reads the field.
 *
 * `perPerson` is the only rounded value. It is a *display* figure and deliberately
 * does not multiply back to `partyTotal` — the breakdown says so in words (A7).
 *
 * Refinement round 1 added three things to every basis string, because an
 * immaculate arithmetic with unstated assumptions is what a chartered accountant
 * calls an unusable number:
 *
 * - the **tax position** on every priced line (R20) — the one assumption that
 *   turned a ₹1.2 lakh quote into ₹2.1 lakh;
 * - **who is counted** (R24) — adults and children, at a published rate;
 * - the **season** (R23) — its own signed line, inside the sum that ties.
 */

const MODE_WORDS = {
  flight: 'Return flights',
  train: 'Return train fares',
  road: 'Return road transfers',
} as const

/** R20 — every priced line names its tax position. */
export const TAX_QUALIFIER = 'incl. GST'

export const TAX_NOTE =
  'Every rate here includes GST at the rates in this sample catalogue; nothing is added later.'

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** '₹17,600 per adult × 2 and ₹13,200 per child × 2' — or just the adults. */
function perHeadBasis(
  adultPrice: number,
  childPrice: number,
  adults: number,
  children: number,
  adultWord: string,
  childWord: string,
): string {
  const adultPart = `${formatRupees(adultPrice)} ${adultWord} × ${adults}`
  if (children <= 0) return adultPart
  return `${adultPart} and ${formatRupees(childPrice)} ${childWord} × ${children}`
}

export function priceCandidate(
  destination: Destination,
  stay: Stay,
  chosen: readonly Experience[],
  ctx: PlanContext,
): CostBreakdown {
  const fare = destination.fares[ctx.origin]
  // Who is counted, and at what rate: a child of 12 is a traveller at the adult
  // fare, and the rule that says so is printed on the plan (R24, A12).
  const { fullFare: adults, childRate: children } = splitByAge(ctx.adults, ctx.children)

  const childFarePerPerson = childFare(fare.perPerson)
  const travel = fare.perPerson * adults + childFarePerPerson * children

  const stayCost = stay.pricePerRoomPerNight * ctx.nights * ctx.rooms

  const experiencesPerAdult = chosen.reduce((sum, e) => sum + e.pricePerPerson, 0)
  const experiencesPerChild = childExperiencePrice(experiencesPerAdult)
  const experiences = experiencesPerAdult * adults + experiencesPerChild * children

  const localAllowance =
    destination.localAllowancePerPersonPerDay * ctx.days * ctx.travellers

  const seasonal = seasonalLoading(travel, stayCost, ctx.season)

  const partyTotal = travel + stayCost + experiences + localAllowance + seasonal
  const perPerson = perPersonRounded(partyTotal, ctx.travellers)

  return {
    travel,
    stay: stayCost,
    experiences,
    localAllowance,
    seasonal,
    partyTotal,
    perPerson,
    basis: {
      travel: `${MODE_WORDS[fare.mode]}, ${perHeadBasis(
        fare.perPerson,
        childFarePerPerson,
        adults,
        children,
        'per adult',
        'per child',
      )}, ${TAX_QUALIFIER}`,
      stay: `${stay.name}, ${nightsLabel(ctx.nights)} × ${countLabel(
        ctx.rooms,
        'room',
        'rooms',
      )} at ${formatRupees(stay.pricePerRoomPerNight)} per room-night, ${TAX_QUALIFIER}`,
      experiences: `${countLabel(
        chosen.length,
        'included experience',
        'included experiences',
      )}, ${perHeadBasis(
        experiencesPerAdult,
        experiencesPerChild,
        adults,
        children,
        'per adult',
        'per child',
      )}, ${TAX_QUALIFIER}`,
      localAllowance: `Food and local transport, ${formatRupees(
        destination.localAllowancePerPersonPerDay,
      )} per traveller per day × ${ctx.travellers} × ${countLabel(
        ctx.days,
        'day',
        'days',
      )}, ${TAX_QUALIFIER}`,
      seasonal: ctx.season.line,
      perPerson: `${formatRupees(partyTotal)} ÷ ${ctx.travellers}, rounded to the nearest ₹100`,
    },
  }
}

/** 'Total for 2 adults and 2 children' — R20's "who is counted". */
export function totalLabel(adults: number, children: number): string {
  return `Total for ${partyLabel(adults, children)}`
}
