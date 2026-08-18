import { describe, expect, it } from 'vitest'
import { CATALOGUE, localCatalogue } from '../src/data/localCatalogue'
import { scheduleItinerary } from '../src/domain/itinerary'
import { SEASONS } from '../src/domain/season'
import { priceCandidate } from '../src/domain/pricing'
import { VIBE_ORDER } from '../src/domain/vibes'
import {
  ORIGIN_CITIES,
  STAY_TIERS,
  type Destination,
  type PlanContext,
  type Region,
  type Rupees,
  type StayTier,
  type Vibe,
} from '../src/domain/types'

/**
 * Catalogue invariants C1–C6 (docs/02-architecture.md §3). Each one is a test that
 * fails if the data drifts, not a comment nobody reads. A destination missing a
 * fare is a build error here rather than a blank day block in production.
 */

const destinations = CATALOGUE.destinations

/** The reference trip every band is measured against: 5 nights, 2 people, Bengaluru. */
function referenceContext(budget: Rupees): PlanContext {
  return {
    vibe: 'beach',
    origin: 'Bengaluru',
    startDate: '2026-10-10',
    endDate: '2026-10-15',
    nights: 5,
    days: 6,
    travellers: 2,
    adults: 2,
    children: [],
    rooms: 1,
    budget,
    freeDay: false,
    season: SEASONS.standard,
    preferTags: [],
  }
}

function referenceTotal(destination: Destination, tier: StayTier): Rupees {
  const ctx = referenceContext(100000)
  const stay = destination.stays.find((s) => s.tier === tier)
  if (stay === undefined) throw new Error(`${destination.id} has no ${tier} stay`)
  const chosen = scheduleItinerary(destination, stay, ctx).chosen
  return priceCandidate(destination, stay, chosen, ctx).partyTotal
}

/**
 * C2's budget bands. They are per region because a budget means something different
 * for a domestic and an international trip: ₹60,000 is a generous week in Kerala and
 * does not cover two return fares to Bali. Each figure is a whole-party budget for
 * the reference trip above.
 */
const BUDGET_BANDS: Record<Region, readonly Rupees[]> = {
  domestic: [60000, 120000, 250000],
  international: [110000, 200000, 350000],
}

const AFFINITY_THRESHOLD = 3

describe('C1 — the catalogue is 14 destinations, 6 domestic and 8 international', () => {
  it('has exactly 14 destinations', () => {
    expect(destinations).toHaveLength(14)
    expect(CATALOGUE.meta.destinationCount).toBe(14)
  })

  it('splits 6 domestic / 8 international', () => {
    expect(destinations.filter((d) => d.region === 'domestic')).toHaveLength(6)
    expect(destinations.filter((d) => d.region === 'international')).toHaveLength(8)
  })

  it('has unique destination ids and names', () => {
    expect(new Set(destinations.map((d) => d.id)).size).toBe(14)
    expect(new Set(destinations.map((d) => d.name)).size).toBe(14)
  })

  it('is served through the TravelDataSource seam', () => {
    expect(localCatalogue.load()).toBe(CATALOGUE)
    expect(CATALOGUE.meta.currency).toBe('INR')
  })
})

describe('C2 — every vibe × region × budget band is served by at least two destinations', () => {
  for (const vibe of VIBE_ORDER) {
    for (const region of ['domestic', 'international'] as const) {
      for (const budget of BUDGET_BANDS[region]) {
        it(`${vibe} · ${region} · ₹${budget}`, () => {
          const served = destinations.filter(
            (d) =>
              d.region === region &&
              d.vibeAffinity[vibe] >= AFFINITY_THRESHOLD &&
              STAY_TIERS.some((tier) => referenceTotal(d, tier) <= budget),
          )
          expect(
            served.map((d) => d.id),
            `only ${served.length} destination(s) serve ${vibe}/${region} at ₹${budget}`,
          ).toHaveLength(Math.max(2, served.length))
          expect(served.length).toBeGreaterThanOrEqual(2)
        })
      }
    }
  }

  it('never leaves a vibe with fewer than two options in either region', () => {
    for (const vibe of VIBE_ORDER) {
      for (const region of ['domestic', 'international'] as const) {
        const affine = destinations.filter(
          (d) => d.region === region && d.vibeAffinity[vibe] >= AFFINITY_THRESHOLD,
        )
        expect(affine.length, `${vibe}/${region}`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('C3 — every destination is completely specified', () => {
  for (const destination of destinations) {
    describe(destination.id, () => {
      it('prices all six origins', () => {
        for (const origin of ORIGIN_CITIES) {
          const fare = destination.fares[origin]
          expect(fare, `${destination.id} has no fare from ${origin}`).toBeDefined()
          expect(fare.perPerson).toBeGreaterThan(0)
          expect(fare.hours).toBeGreaterThan(0)
          expect(['flight', 'train', 'road']).toContain(fare.mode)
        }
      })

      it('has exactly three stays, one per tier', () => {
        expect(destination.stays).toHaveLength(3)
        expect(destination.stays.map((s) => s.tier).sort()).toEqual(
          [...STAY_TIERS].sort(),
        )
        for (const stay of destination.stays) expect(stay.roomCapacity).toBe(2)
      })

      it('has at least 10 unique experiences and at least 2 repeatable ones', () => {
        const unique = destination.experiences.filter((e) => !e.repeatable)
        const repeatable = destination.experiences.filter((e) => e.repeatable)
        expect(unique.length).toBeGreaterThanOrEqual(10)
        expect(repeatable.length).toBeGreaterThanOrEqual(2)
      })

      it('gives every experience a name, a blurb and a slot', () => {
        for (const experience of destination.experiences) {
          expect(experience.name.length).toBeGreaterThan(0)
          expect(experience.blurb.length).toBeGreaterThan(0)
          expect(['morning', 'afternoon', 'evening']).toContain(experience.slot)
        }
      })

      it('uses unique ids inside itself', () => {
        const ids = [
          ...destination.stays.map((s) => s.id),
          ...destination.experiences.map((e) => e.id),
        ]
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('scores every vibe with an integer 0–5', () => {
        for (const vibe of VIBE_ORDER) {
          const affinity: number = destination.vibeAffinity[vibe as Vibe]
          expect(Number.isInteger(affinity)).toBe(true)
          expect(affinity).toBeGreaterThanOrEqual(0)
          expect(affinity).toBeLessThanOrEqual(5)
        }
      })
    })
  }
})

describe('C4 — trip length windows are sane', () => {
  for (const destination of destinations) {
    it(`${destination.id} 1 <= minNights <= maxNights <= 21`, () => {
      expect(destination.minNights).toBeGreaterThanOrEqual(1)
      expect(destination.minNights).toBeLessThanOrEqual(destination.maxNights)
      expect(destination.maxNights).toBeLessThanOrEqual(21)
    })
  }
})

describe('C5 — nothing in the catalogue reads as a transaction (R16)', () => {
  const banned = /\b(book|booking|pay|checkout|reserve)\b/i

  it('has no banned vocabulary in any string', () => {
    const offenders: string[] = []
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (banned.test(value)) offenders.push(`${path}: ${value}`)
        return
      }
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`))
        return
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
      }
    }
    walk(destinations, 'catalogue')
    expect(offenders).toEqual([])
  })
})

describe('C6 — every rupee figure is a non-negative integer', () => {
  it('holds across fares, stays, experiences and allowances', () => {
    const offenders: string[] = []
    const check = (value: number, path: string): void => {
      if (!Number.isInteger(value) || value < 0) offenders.push(`${path} = ${value}`)
    }
    for (const destination of destinations) {
      check(destination.localAllowancePerPersonPerDay, `${destination.id}.localAllowance`)
      for (const origin of ORIGIN_CITIES) {
        check(destination.fares[origin].perPerson, `${destination.id}.fares.${origin}`)
      }
      for (const stay of destination.stays) {
        check(stay.pricePerRoomPerNight, `${destination.id}.${stay.id}`)
      }
      for (const experience of destination.experiences) {
        check(experience.pricePerPerson, `${destination.id}.${experience.id}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('prices every repeatable filler at zero, so long trips invent nothing', () => {
    for (const destination of destinations) {
      for (const experience of destination.experiences) {
        if (experience.repeatable) expect(experience.pricePerPerson).toBe(0)
      }
    }
  })
})
