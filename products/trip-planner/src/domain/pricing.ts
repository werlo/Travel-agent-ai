import { nightsLabel, travellersLabel } from './dates'
import { formatRupees, perPersonRounded } from './money'
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
 * Every input is an integer number of rupees, so "the four line items sum exactly to
 * the party total" is arithmetic rather than a rounding policy. `partyTotal` is
 * derived by addition at the point of construction and never recomputed elsewhere;
 * the UI reads the field.
 *
 * `perPerson` is the only rounded value. It is a *display* figure and deliberately
 * does not multiply back to `partyTotal` — the breakdown says so in words (A7).
 */

const MODE_WORDS = {
  flight: 'Return flights',
  train: 'Return train fares',
  road: 'Return road transfers',
} as const

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function priceCandidate(
  destination: Destination,
  stay: Stay,
  chosen: readonly Experience[],
  ctx: PlanContext,
): CostBreakdown {
  const fare = destination.fares[ctx.origin]

  const travel = fare.perPerson * ctx.travellers
  const stayCost = stay.pricePerRoomPerNight * ctx.nights * ctx.rooms
  const experiencesPerPerson = chosen.reduce((sum, e) => sum + e.pricePerPerson, 0)
  const experiences = experiencesPerPerson * ctx.travellers
  const localAllowance =
    destination.localAllowancePerPersonPerDay * ctx.days * ctx.travellers

  const partyTotal = travel + stayCost + experiences + localAllowance
  const perPerson = perPersonRounded(partyTotal, ctx.travellers)

  return {
    travel,
    stay: stayCost,
    experiences,
    localAllowance,
    partyTotal,
    perPerson,
    basis: {
      travel: `${MODE_WORDS[fare.mode]}, ${formatRupees(fare.perPerson)} per traveller × ${ctx.travellers}`,
      stay: `${stay.name}, ${formatRupees(stay.pricePerRoomPerNight)} per room-night × ${nightsLabel(ctx.nights)} × ${countLabel(ctx.rooms, 'room', 'rooms')}`,
      experiences: `${countLabel(chosen.length, 'included experience', 'included experiences')} for ${travellersLabel(ctx.travellers)}`,
      localAllowance: `Food and local transport, ${formatRupees(destination.localAllowancePerPersonPerDay)} per traveller per day × ${ctx.travellers} × ${countLabel(ctx.days, 'day', 'days')}`,
      perPerson: `${formatRupees(partyTotal)} ÷ ${ctx.travellers}, rounded to the nearest ₹100`,
    },
  }
}
