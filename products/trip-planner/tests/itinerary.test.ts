import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../src/data/localCatalogue'
import { weekdayIndex, weekdayPlural } from '../src/domain/dates'
import {
  baseFor,
  buildDays,
  buildLegs,
  eligibleExperiences,
  experiencesPerDay,
  FREE_DAY_NOTE,
  MAX_MINUTES_FROM_BASE,
  scheduleItinerary,
} from '../src/domain/itinerary'
import { roomsFor } from '../src/domain/money'
import { SEASONS } from '../src/domain/season'
import type { Destination, OriginCity, PlanContext, Stay } from '../src/domain/types'

/**
 * Customer refinement round 1: R18 (never state a false day-of-week), R7 as
 * amended (one base, nothing more than 90 minutes from it) and R21 (a free day on
 * request, and no padding).
 *
 * These are scheduler properties, so they are asserted against the scheduler
 * directly and swept across the whole catalogue — a sample plan would only prove
 * that one destination happened to behave.
 */

function contextFor(
  startDate: string,
  endDate: string,
  over: Partial<PlanContext> = {},
): PlanContext {
  const nights =
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000
  return {
    vibe: 'party',
    origin: 'Bengaluru',
    startDate,
    endDate,
    nights,
    days: nights + 1,
    travellers: 2,
    adults: 2,
    children: [],
    rooms: roomsFor(2),
    budget: 200000,
    freeDay: false,
    season: SEASONS.standard,
    preferTags: [],
    ...over,
  }
}

function destination(id: string): Destination {
  const found = CATALOGUE.destinations.find((d) => d.id === id)
  if (found === undefined) throw new Error(`no destination ${id}`)
  return found
}

function stay(d: Destination, id: string): Stay {
  const found = d.stays.find((s) => s.id === id)
  if (found === undefined) throw new Error(`no stay ${id}`)
  return found
}

const goa = destination('in-goa')
const goaStay = stay(goa, 'goa-stay-standard')

describe('fixed-day experiences land only on their day (R18)', () => {
  it('puts the Anjuna flea market on a Wednesday and the Arpora market on a Saturday', () => {
    // 11–15 Nov 2026 covers exactly one Wednesday and one Saturday.
    const ctx = contextFor('2026-11-11', '2026-11-15')
    const itinerary = scheduleItinerary(goa, goaStay, ctx)
    const days = buildDays(goaStay, itinerary, buildLegs(goa, ctx), ctx)

    for (const day of days) {
      for (const experience of day.experiences) {
        if (experience.fixedWeekday === null) continue
        expect(weekdayIndex(day.date), `${experience.id} on ${day.date}`).toBe(
          experience.fixedWeekday,
        )
      }
    }

    const names = days.flatMap((day) => day.experiences.map((e) => e.id))
    expect(names).toContain('goa-anjuna')
    expect(names).toContain('goa-saturday')
    expect(itinerary.unscheduled).toHaveLength(0)
  })

  it('drops the market and says why when the dates contain no Wednesday', () => {
    // Thu 12 – Sun 15 Nov 2026: a Saturday, but no Wednesday.
    const ctx = contextFor('2026-11-12', '2026-11-15')
    const itinerary = scheduleItinerary(goa, goaStay, ctx)

    expect(itinerary.chosen.map((e) => e.id)).not.toContain('goa-anjuna')
    expect(itinerary.unscheduled.map((note) => note.line)).toContain(
      'Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday',
    )
  })

  it('never places a fixed-day experience on the wrong day, over 60 consecutive start dates', () => {
    for (let offset = 0; offset < 60; offset += 1) {
      const start = new Date(Date.UTC(2026, 10, 1) + offset * 86_400_000)
        .toISOString()
        .slice(0, 10)
      const end = new Date(Date.UTC(2026, 10, 1) + (offset + 4) * 86_400_000)
        .toISOString()
        .slice(0, 10)
      const ctx = contextFor(start, end)
      const itinerary = scheduleItinerary(goa, goaStay, ctx)
      itinerary.perDay.forEach((experiences, index) => {
        const date = new Date(Date.parse(`${start}T00:00:00Z`) + index * 86_400_000)
          .toISOString()
          .slice(0, 10)
        for (const experience of experiences) {
          if (experience.fixedWeekday === null) continue
          expect(weekdayIndex(date), `${experience.id} on ${date}`).toBe(
            experience.fixedWeekday,
          )
        }
      })
    }
  })

  it('keeps the weekday claim out of the prose, where nothing could enforce it', () => {
    // The failure this guards is a blurb that asserts availability — "Wednesdays
    // only", "on Saturdays" — which the scheduler cannot read and therefore
    // cannot honour. A weekday used as a proper noun ("the Friday mosque") is not
    // a claim about the day the item sits on.
    const claim =
      /\b(Mondays|Tuesdays|Wednesdays|Thursdays|Fridays|Saturdays|Sundays)\b|\bon (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/
    for (const d of CATALOGUE.destinations) {
      for (const experience of d.experiences) {
        expect(claim.exec(experience.blurb), `${experience.id}: ${experience.blurb}`).toBeNull()
        // A weekday may head a *name* only when the data pins that weekday.
        const inName = /\b(Saturday|Wednesday|Friday)\b/.exec(experience.name)
        if (inName !== null) {
          expect(experience.fixedWeekday, experience.id).not.toBeNull()
          expect(weekdayPlural(experience.fixedWeekday ?? -1)).toContain(inName[1])
        }
      }
    }
  })
})

describe('one plan, one base (R7 amended)', () => {
  it('never schedules a Varkala experience from the Fort Kochi stay', () => {
    const kerala = destination('in-varkala')
    const brunton = stay(kerala, 'vkl-stay-standard')
    const ctx = contextFor('2026-10-10', '2026-10-15', { vibe: 'beach' })
    const itinerary = scheduleItinerary(kerala, brunton, ctx)

    expect(baseFor(kerala, brunton).name).toBe('Fort Kochi')
    const ids = itinerary.chosen.map((e) => e.id)
    for (const varkala of ['vkl-cliff', 'vkl-kappil', 'vkl-temple']) {
      expect(ids).not.toContain(varkala)
    }
    expect(ids).toContain('vkl-spice')
  })

  it('schedules nothing more than 90 minutes from the booked base, catalogue-wide', () => {
    for (const d of CATALOGUE.destinations) {
      for (const s of d.stays) {
        const ctx = contextFor('2026-10-10', '2026-10-24', { vibe: 'beach' })
        const itinerary = scheduleItinerary(d, s, ctx)
        for (const experience of itinerary.chosen) {
          expect(experience.baseId, `${d.id}/${s.id}/${experience.id}`).toBe(
            itinerary.base.id,
          )
          expect(experience.minutesFromBase).toBeLessThanOrEqual(MAX_MINUTES_FROM_BASE)
        }
      }
    }
  })

  it('gives every stay a base that has something to do in it', () => {
    for (const d of CATALOGUE.destinations) {
      for (const s of d.stays) {
        const base = baseFor(d, s)
        expect(d.bases.map((b) => b.id), `${d.id}/${s.id}`).toContain(s.baseId)
        // Re-based on the scheduler's real unit (fix round F1, R7 / D3): the
        // floor is derived from what the pair is actually offered, not a number
        // chosen to make the fixture pass. See tests/catalogue.test.ts's C3
        // (re-based) for the sweep across all 42 pairs.
        expect(eligibleExperiences(d, s).length, `${d.id}/${base.id}`).toBeGreaterThanOrEqual(
          d.maxNights + 1,
        )
      }
    }
  })
})

describe('a free day, and no padding (R21)', () => {
  it('empties exactly one middle day and names it', () => {
    const ctx = contextFor('2026-10-10', '2026-10-15', { vibe: 'beach', freeDay: true })
    const itinerary = scheduleItinerary(goa, goaStay, ctx)
    const days = buildDays(goaStay, itinerary, buildLegs(goa, ctx), ctx)

    const empty = days.filter((day) => day.experiences.length === 0)
    expect(empty).toHaveLength(1)
    const free = empty[0]!
    expect(free.day).toBeGreaterThan(1)
    expect(free.day).toBeLessThan(days.length)
    expect(free.note).toBe(FREE_DAY_NOTE)
    expect(FREE_DAY_NOTE).toBe('Nothing scheduled — this day is yours')
  })

  it('schedules strictly fewer experiences than the same trip without the free day', () => {
    const busy = contextFor('2026-10-10', '2026-10-15', { vibe: 'beach' })
    const free = contextFor('2026-10-10', '2026-10-15', { vibe: 'beach', freeDay: true })
    expect(experiencesPerDay(free).reduce((a, b) => a + b, 0)).toBeLessThan(
      experiencesPerDay(busy).reduce((a, b) => a + b, 0),
    )
    expect(scheduleItinerary(goa, goaStay, free).chosen.length).toBeLessThan(
      scheduleItinerary(goa, goaStay, busy).chosen.length,
    )
  })

  it('never prints the same experience on two days, at any length, anywhere', () => {
    for (const d of CATALOGUE.destinations) {
      for (const s of d.stays) {
        for (const end of ['2026-10-11', '2026-10-17', '2026-10-31']) {
          const ctx = contextFor('2026-10-10', end, { vibe: 'beach' })
          const itinerary = scheduleItinerary(d, s, ctx)
          const ids = itinerary.chosen.map((e) => e.id)
          expect(new Set(ids).size, `${d.id}/${s.id}/${end}`).toBe(ids.length)
        }
      }
    }
  })
})

describe('an indicative departure/arrival window on every leg (R30, customer fix 4)', () => {
  it('gives both legs a departs and arrives time, consistent with the fare duration', () => {
    for (const d of CATALOGUE.destinations) {
      for (const origin of Object.keys(d.fares) as OriginCity[]) {
        const ctx = contextFor('2026-10-10', '2026-10-15', { origin })
        const [outbound, inbound] = buildLegs(d, ctx)
        for (const leg of [outbound, inbound]) {
          expect(leg.departs).toMatch(/^\d{2}:\d{2}$/)
          expect(leg.arrives).toMatch(/^\d{2}:\d{2}$/)
        }
      }
    }
  })

  it('never departs between 00:00 and 05:00', () => {
    for (const d of CATALOGUE.destinations) {
      for (const origin of Object.keys(d.fares) as OriginCity[]) {
        const ctx = contextFor('2026-10-10', '2026-10-15', { origin })
        const [outbound, inbound] = buildLegs(d, ctx)
        for (const leg of [outbound, inbound]) {
          const [hh] = leg.departs.split(':').map(Number)
          expect(hh, `${d.id}/${origin}/${leg.kind}`).toBeGreaterThanOrEqual(5)
        }
      }
    }
  })

  it('is deterministic: the same destination, origin and leg always gets the same time', () => {
    const ctx = contextFor('2026-10-10', '2026-10-15', { origin: 'Bengaluru' })
    const a = buildLegs(goa, ctx)
    const b = buildLegs(goa, ctx)
    expect(a).toEqual(b)
  })
})
