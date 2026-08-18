import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { experiencesPerDay, scheduleItinerary } from '../src/domain/itinerary'
import { perPersonRounded, roomsFor } from '../src/domain/money'
import { childExperiencePrice, childFare } from '../src/domain/party'
import { priceCandidate } from '../src/domain/pricing'
import { SEASONS, seasonFor } from '../src/domain/season'
import type { PlanContext, Rupees } from '../src/domain/types'

/**
 * R8 — the line items sum exactly to the party total.
 *
 * This is asserted for EVERY (destination × tier × 1–12 travellers × 1/5/21
 * nights) combination — 1,512 of them — not for one sample plan. The guarantee is
 * arithmetic over integers, so if it ever fails it will be because someone
 * introduced a float, and that is exactly the day this test needs to fail.
 *
 * Refinement round 1 put a fifth line inside that sum (R23's seasonal loading) and
 * two new facts on every basis string (R20's tax position, R24's who-is-counted).
 */

const TRAVELLER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const NIGHT_COUNTS = [1, 5, 21]

function contextFor(
  nights: number,
  travellers: number,
  over: Partial<PlanContext> = {},
): PlanContext {
  const children = over.children ?? []
  return {
    vibe: 'beach',
    origin: 'Bengaluru',
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    nights,
    days: nights + 1,
    travellers,
    adults: travellers - children.length,
    children,
    rooms: roomsFor(travellers),
    budget: 100000,
    freeDay: false,
    season: SEASONS.standard,
    preferTags: [],
    ...over,
  }
}

describe('the cost breakdown adds up, for every combination', () => {
  it('sums exactly to partyTotal across 1,512 (destination × tier × travellers × nights) cases', () => {
    let cases = 0
    const failures: string[] = []

    for (const destination of CATALOGUE.destinations) {
      for (const nights of NIGHT_COUNTS) {
        for (const travellers of TRAVELLER_COUNTS) {
          const ctx = contextFor(nights, travellers)
          for (const stay of destination.stays) {
            const itinerary = scheduleItinerary(destination, stay, ctx)
            const cost = priceCandidate(destination, stay, itinerary.chosen, ctx)
            cases += 1
            const sum =
              cost.travel +
              cost.stay +
              cost.experiences +
              cost.localAllowance +
              cost.seasonal
            if (sum !== cost.partyTotal) {
              failures.push(
                `${destination.id}/${stay.tier}/${travellers}p/${nights}n: ${sum} !== ${cost.partyTotal}`,
              )
            }
            if (
              ![cost.travel, cost.stay, cost.experiences, cost.localAllowance].every(
                (value: Rupees) => Number.isInteger(value) && value >= 0,
              ) ||
              !Number.isInteger(cost.seasonal)
            ) {
              failures.push(`${destination.id}/${stay.tier}/${travellers}p/${nights}n: not integers`)
            }
            if (cost.perPerson !== perPersonRounded(cost.partyTotal, travellers)) {
              failures.push(`${destination.id}: per-person is not the rounded share`)
            }
          }
        }
      }
    }

    expect(cases).toBe(14 * 3 * 12 * 3)
    expect(failures).toEqual([])
  })

  it('rounds the per-person figure to the nearest ₹100 and says so in words', () => {
    const destination = CATALOGUE.destinations[0]!
    const stay = destination.stays[0]!
    const ctx = contextFor(5, 3)
    const cost = priceCandidate(
      destination,
      stay,
      scheduleItinerary(destination, stay, ctx).chosen,
      ctx,
    )
    expect(cost.perPerson % 100).toBe(0)
    expect(cost.basis.perPerson).toContain('rounded to the nearest ₹100')
  })

  it('scales the travel line by exactly the per-traveller fare (R8, third clause)', () => {
    for (const destination of CATALOGUE.destinations) {
      const fare = destination.fares.Bengaluru.perPerson
      const stay = destination.stays[1]!
      const two = contextFor(5, 2)
      const four = contextFor(5, 4)
      const costTwo = priceCandidate(
        destination,
        stay,
        scheduleItinerary(destination, stay, two).chosen,
        two,
      )
      const costFour = priceCandidate(
        destination,
        stay,
        scheduleItinerary(destination, stay, four).chosen,
        four,
      )
      expect(costFour.travel - costTwo.travel).toBe(fare * 2)
    }
  })

  it('prices the stay at one room per two travellers, rounded up (A7)', () => {
    const destination = CATALOGUE.destinations[0]!
    const stay = destination.stays[0]!
    const ctx = contextFor(5, 3)
    const cost = priceCandidate(destination, stay, [], ctx)
    expect(cost.stay).toBe(stay.pricePerRoomPerNight * 5 * 2)
    expect(cost.basis.stay).toContain('2 rooms')
  })

  it('states a basis in words for every line item', () => {
    const destination = CATALOGUE.destinations[0]!
    const stay = destination.stays[0]!
    const ctx = contextFor(5, 2)
    const cost = priceCandidate(
      destination,
      stay,
      scheduleItinerary(destination, stay, ctx).chosen,
      ctx,
    )
    for (const basis of Object.values(cost.basis)) {
      expect(basis.length).toBeGreaterThan(0)
    }
    expect(cost.basis.travel).toContain('per adult × 2')
    expect(cost.basis.localAllowance).toContain('per traveller per day')
  })
})

/** R20 — the tax position, on every priced line. */
describe('every priced line names its tax position (R20)', () => {
  it('carries the GST qualifier on travel, stay, experiences and local allowance', () => {
    for (const destination of CATALOGUE.destinations) {
      for (const stay of destination.stays) {
        const ctx = contextFor(5, 4)
        const cost = priceCandidate(
          destination,
          stay,
          scheduleItinerary(destination, stay, ctx).chosen,
          ctx,
        )
        for (const line of [
          cost.basis.travel,
          cost.basis.stay,
          cost.basis.experiences,
          cost.basis.localAllowance,
        ]) {
          expect(line, `${destination.id}/${stay.id}`).toContain('incl. GST')
        }
        expect(cost.basis.stay).toContain('per room-night, incl. GST')
      }
    }
  })
})

/** R24 — children counted and priced at the published rate. */
describe('children are counted and priced at the published rate (R24)', () => {
  const destination = CATALOGUE.destinations[0]!
  const stay = destination.stays[1]!

  it('charges 75% of the fare and 50% of experiences for a child of 9', () => {
    const adultsOnly = contextFor(5, 2)
    const withChild = contextFor(5, 3, { children: [9] })

    const chosen = scheduleItinerary(destination, stay, withChild).chosen
    const cost = priceCandidate(destination, stay, chosen, withChild)
    const fare = destination.fares.Bengaluru.perPerson
    const perAdultExperiences = chosen.reduce((sum, e) => sum + e.pricePerPerson, 0)

    expect(cost.travel).toBe(fare * 2 + childFare(fare))
    expect(cost.experiences).toBe(
      perAdultExperiences * 2 + childExperiencePrice(perAdultExperiences),
    )
    expect(cost.basis.travel).toContain('per child × 1')
    // R24 — a child occupies a room place: 3 travellers is still 2 rooms.
    expect(cost.stay).toBe(stay.pricePerRoomPerNight * 5 * 2)
    expect(cost.travel).toBeLessThan(fare * 3)
    expect(adultsOnly.rooms).toBe(1)
  })

  it('prices a traveller of 12 or over at the adult fare', () => {
    const ctx = contextFor(5, 3, { children: [12] })
    const cost = priceCandidate(destination, stay, [], ctx)
    const fare = destination.fares.Bengaluru.perPerson
    expect(cost.travel).toBe(fare * 3)
    expect(cost.basis.travel).not.toContain('per child')
  })
})

/** R23 — the calendar is an input to the price. */
describe('the price moves with the travel dates (R23)', () => {
  const destination = CATALOGUE.destinations[0]!
  const stay = destination.stays[1]!

  it('names the season on its own line, inside the sum', () => {
    const peak = contextFor(7, 4, {
      startDate: '2026-12-20',
      endDate: '2026-12-27',
      season: seasonFor('2026-12-20', '2026-12-27'),
    })
    const off = contextFor(7, 4, {
      startDate: '2027-07-05',
      endDate: '2027-07-12',
      season: seasonFor('2027-07-05', '2027-07-12'),
    })

    const peakCost = priceCandidate(destination, stay, [], peak)
    const offCost = priceCandidate(destination, stay, [], off)

    expect(peakCost.partyTotal).not.toBe(offCost.partyTotal)
    // B10 — the seasonal basis now also carries its own tax position, like every
    // other priced line (R20).
    expect(peakCost.basis.seasonal).toBe(
      'Peak season (25 Dec – 2 Jan): +35% on stay and travel, no separate tax — it loads rates that already include GST',
    )
    expect(offCost.basis.seasonal).toBe(
      'Off season (Jul): −20% on stay and travel, no separate tax — it loads rates that already include GST',
    )
    expect(peakCost.seasonal).toBeGreaterThan(0)
    expect(offCost.seasonal).toBeLessThan(0)
    expect(
      peakCost.travel +
        peakCost.stay +
        peakCost.experiences +
        peakCost.localAllowance +
        peakCost.seasonal,
    ).toBe(peakCost.partyTotal)
  })

  it('loads stay and travel only, never the experiences or the allowance', () => {
    const ctx = contextFor(7, 4, {
      startDate: '2026-12-20',
      endDate: '2026-12-27',
      season: seasonFor('2026-12-20', '2026-12-27'),
    })
    const chosen = scheduleItinerary(destination, stay, ctx).chosen
    const cost = priceCandidate(destination, stay, chosen, ctx)
    expect(cost.seasonal).toBe(Math.round(((cost.travel + cost.stay) * 35) / 100))
  })
})

describe('experience selection fills the days it can (R7, R21)', () => {
  it('targets one experience on each travel day and two in between for short trips', () => {
    expect(experiencesPerDay(contextFor(5, 2))).toEqual([1, 2, 2, 2, 2, 1])
    expect(experiencesPerDay(contextFor(1, 2))).toEqual([1, 1])
    expect(experiencesPerDay(contextFor(21, 2))).toEqual(Array(22).fill(1))
  })

  it('never schedules more than the day capacity, and never more than the base holds', () => {
    for (const destination of CATALOGUE.destinations) {
      for (const stay of destination.stays) {
        for (const nights of [1, 5, 7, 14, 21]) {
          const ctx = contextFor(nights, 2)
          const capacity = experiencesPerDay(ctx).reduce((a, b) => a + b, 0)
          const itinerary = scheduleItinerary(destination, stay, ctx)
          expect(itinerary.chosen.length).toBeLessThanOrEqual(capacity)
        }
      }
    }
  })

  /** R21 — the padding is gone: an experience is dealt at most once, ever. */
  it('never deals the same experience twice, at any trip length', () => {
    for (const destination of CATALOGUE.destinations) {
      for (const stay of destination.stays) {
        const ctx = contextFor(21, 2)
        const chosen = scheduleItinerary(destination, stay, ctx).chosen
        const ids = chosen.map((experience) => experience.id)
        expect(new Set(ids).size, `${destination.id}/${stay.id}`).toBe(ids.length)
      }
    }
  })
})
