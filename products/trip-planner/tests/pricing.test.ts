import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { chooseExperiences, experiencesPerDay } from '../src/domain/itinerary'
import { perPersonRounded, roomsFor } from '../src/domain/money'
import { priceCandidate } from '../src/domain/pricing'
import type { PlanContext, Rupees } from '../src/domain/types'

/**
 * R8 — the four line items sum exactly to the party total.
 *
 * This is asserted for EVERY (destination × tier × 1–12 travellers × 1/5/21
 * nights) combination — 1,512 of them — not for one sample plan. The guarantee is
 * arithmetic over integers, so if it ever fails it will be because someone
 * introduced a float, and that is exactly the day this test needs to fail.
 */

const TRAVELLER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const NIGHT_COUNTS = [1, 5, 21]

function contextFor(nights: number, travellers: number): PlanContext {
  return {
    vibe: 'beach',
    origin: 'Bengaluru',
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    nights,
    days: nights + 1,
    travellers,
    rooms: roomsFor(travellers),
    budget: 100000,
    preferTags: [],
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
          const experiences = chooseExperiences(destination, ctx)
          for (const stay of destination.stays) {
            const cost = priceCandidate(destination, stay, experiences, ctx)
            cases += 1
            const sum =
              cost.travel + cost.stay + cost.experiences + cost.localAllowance
            if (sum !== cost.partyTotal) {
              failures.push(
                `${destination.id}/${stay.tier}/${travellers}p/${nights}n: ${sum} !== ${cost.partyTotal}`,
              )
            }
            if (
              ![cost.travel, cost.stay, cost.experiences, cost.localAllowance].every(
                (value: Rupees) => Number.isInteger(value) && value >= 0,
              )
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
    const cost = priceCandidate(destination, stay, chooseExperiences(destination, ctx), ctx)
    expect(cost.perPerson % 100).toBe(0)
    expect(cost.basis.perPerson).toContain('rounded to the nearest ₹100')
  })

  it('scales the travel line by exactly the per-traveller fare (R8, third clause)', () => {
    for (const destination of CATALOGUE.destinations) {
      const fare = destination.fares.Bengaluru.perPerson
      const stay = destination.stays[1]!
      const two = contextFor(5, 2)
      const four = contextFor(5, 4)
      const costTwo = priceCandidate(destination, stay, chooseExperiences(destination, two), two)
      const costFour = priceCandidate(
        destination,
        stay,
        chooseExperiences(destination, four),
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
    const ctx = contextFor(5, 2)
    const cost = priceCandidate(
      destination,
      destination.stays[0]!,
      chooseExperiences(destination, ctx),
      ctx,
    )
    for (const basis of Object.values(cost.basis)) {
      expect(basis.length).toBeGreaterThan(0)
    }
    expect(cost.basis.travel).toMatch(/per traveller × 2$/)
    expect(cost.basis.localAllowance).toContain('per traveller per day')
  })
})

describe('experience selection fills every day (R7)', () => {
  it('targets one experience on each travel day and two in between for short trips', () => {
    expect(experiencesPerDay(contextFor(5, 2))).toEqual([1, 2, 2, 2, 2, 1])
    expect(experiencesPerDay(contextFor(1, 2))).toEqual([1, 1])
    expect(experiencesPerDay(contextFor(21, 2))).toEqual(Array(22).fill(1))
  })

  it('always has enough experiences for the days, at 1 and at 21 nights', () => {
    for (const destination of CATALOGUE.destinations) {
      for (const nights of [1, 5, 7, 14, 21]) {
        const ctx = contextFor(nights, 2)
        const needed = experiencesPerDay(ctx).reduce((a, b) => a + b, 0)
        expect(chooseExperiences(destination, ctx)).toHaveLength(needed)
      }
    }
  })

  it('only repeats experiences that are marked repeatable and priced at zero', () => {
    for (const destination of CATALOGUE.destinations) {
      const ctx = contextFor(21, 2)
      const chosen = chooseExperiences(destination, ctx)
      const seen = new Map<string, number>()
      for (const experience of chosen) {
        seen.set(experience.id, (seen.get(experience.id) ?? 0) + 1)
      }
      for (const [id, count] of seen) {
        if (count > 1) {
          const experience = destination.experiences.find((e) => e.id === id)!
          expect(experience.repeatable, `${destination.id}/${id}`).toBe(true)
          expect(experience.pricePerPerson).toBe(0)
        }
      }
    }
  })
})
