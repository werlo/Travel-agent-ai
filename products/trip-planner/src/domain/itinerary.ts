import { addDays, formatDayLabel, nightsLabel, weekdayIndex, weekdayName, weekdayPlural } from './dates'
import { tagMatches } from './scoring'
import type {
  BaseTown,
  DayBlock,
  Destination,
  Experience,
  PlanContext,
  Stay,
  TravelLeg,
  UnscheduledNote,
} from './types'

/**
 * R7 — one costed day-by-day itinerary. `days = nights + 1`, labels `Day 1` …
 * `Day ${days}`, the first day carries the outbound leg and the last the return.
 *
 * Three rules were added by refinement round 1, and between them they replaced the
 * old "deal N experiences and repeat a filler when you run out" loop:
 *
 * - **One base (fix 9).** The stay picks a base town; only experiences in that town
 *   and within `MAX_MINUTES_FROM_BASE` of it can be scheduled. A day can no longer
 *   pair two places 170km apart, because nothing 170km away is ever in the pool.
 * - **Fixed days are data, not prose (fix 1).** An experience with a `fixedWeekday`
 *   is placed only on a date whose weekday matches. Where the dates contain no such
 *   day it is dropped and the plan says why, in `unscheduled`.
 * - **No padding, and a free day on request (fix 6).** Every experience is dealt at
 *   most once — a repeated morning was the product printing filler and calling it a
 *   plan. Where supply runs out the day says so, and `ctx.freeDay` empties exactly
 *   one middle day on purpose.
 *
 * Selection is still deterministic: experiences are sorted by
 * `(tagMatchScore desc, pricePerPerson asc, id asc)` — three keys and a unique id,
 * so no tie is possible — and dealt in that order.
 */

const SLOT_ORDER = { morning: 0, afternoon: 1, evening: 2 } as const

/** Nothing further than this from the booked base is ever scheduled (fix 9). */
export const MAX_MINUTES_FROM_BASE = 90

/** docs/03-design.md §4 S5 — a day with nothing on it says so, in words. */
export const FREE_DAY_NOTE = 'Nothing scheduled — this day is yours'

/** 1 on each travel day, 2 on the others for trips of a week or less, 1 beyond that. */
export function experiencesPerDay(ctx: PlanContext): number[] {
  const counts: number[] = []
  const middleTarget = ctx.nights <= 7 ? 2 : 1
  for (let day = 0; day < ctx.days; day += 1) {
    const isTravelDay = day === 0 || day === ctx.days - 1
    counts.push(isTravelDay ? 1 : middleTarget)
  }
  const free = freeDayIndex(ctx)
  if (free !== null) counts[free] = 0
  return counts
}

/**
 * R21 — which day is left empty when the user asks for one: the middle of the
 * trip, never a travel day. `null` when the trip is too short to have a middle.
 */
export function freeDayIndex(ctx: PlanContext): number | null {
  if (!ctx.freeDay || ctx.days < 3) return null
  return Math.floor((ctx.days - 1) / 2)
}

export function sortExperiences(
  experiences: readonly Experience[],
  ctx: PlanContext,
): Experience[] {
  return [...experiences].sort((a, b) => {
    // A filler is a filler: it is dealt only once and only after the real ones.
    if (a.repeatable !== b.repeatable) return a.repeatable ? 1 : -1
    const byTags = tagMatches(b.tags, ctx.preferTags) - tagMatches(a.tags, ctx.preferTags)
    if (byTags !== 0) return byTags
    const byPrice = a.pricePerPerson - b.pricePerPerson
    if (byPrice !== 0) return byPrice
    return a.id.localeCompare(b.id)
  })
}

/** The town this (destination × stay) pair actually books (fix 9). */
export function baseFor(destination: Destination, stay: Stay): BaseTown {
  const found = destination.bases.find((base) => base.id === stay.baseId)
  const fallback = destination.bases[0]
  if (found !== undefined) return found
  if (fallback !== undefined) return fallback
  return { id: stay.baseId, name: destination.name }
}

/** Everything in the booked town and inside 90 minutes of it. Nothing else. */
export function eligibleExperiences(
  destination: Destination,
  stay: Stay,
): Experience[] {
  const base = baseFor(destination, stay)
  return destination.experiences.filter(
    (experience) =>
      experience.baseId === base.id &&
      experience.minutesFromBase <= MAX_MINUTES_FROM_BASE,
  )
}

/** Day indices, spread evenly, when there is less to schedule than there are days. */
function spread(days: readonly number[], take: number): number[] {
  if (take >= days.length) return [...days]
  const out: number[] = []
  for (let i = 0; i < take; i += 1) {
    const index = days[Math.floor((i * days.length) / take)]
    if (index !== undefined) out.push(index)
  }
  return out
}

export interface Itinerary {
  base: BaseTown
  /** Every experience the plan includes, in day order — what pricing charges for. */
  chosen: readonly Experience[]
  /** One entry per day, already sorted morning → evening. */
  perDay: readonly (readonly Experience[])[]
  /** R18 — fixed-day experiences we refused to place on the wrong day. */
  unscheduled: readonly UnscheduledNote[]
}

function unscheduledLine(experience: Experience, weekday: number, reason: string): string {
  return `Not scheduled: ${experience.name} — runs ${weekdayPlural(weekday)} only, ${reason}`
}

/**
 * The whole schedule in one pass: fixed-day experiences claim their weekday first,
 * then the rest are dealt round-robin so that every day gets one before any day
 * gets two.
 */
export function scheduleItinerary(
  destination: Destination,
  stay: Stay,
  ctx: PlanContext,
): Itinerary {
  const base = baseFor(destination, stay)
  const capacity = experiencesPerDay(ctx)
  const perDay: Experience[][] = capacity.map(() => [])
  const dates: string[] = []
  for (let i = 0; i < ctx.days; i += 1) dates.push(addDays(ctx.startDate, i))

  const pool = sortExperiences(eligibleExperiences(destination, stay), ctx)
  const placed = new Set<string>()
  const unscheduled: UnscheduledNote[] = []

  // ---- fixed-weekday experiences (R18). They are scarce, so they choose first.
  for (const experience of pool) {
    const weekday = experience.fixedWeekday
    if (weekday === null) continue
    const matching = dates
      .map((date, index) => ({ index, weekday: weekdayIndex(date) }))
      .filter((day) => day.weekday === weekday)

    if (matching.length === 0) {
      unscheduled.push({
        experienceId: experience.id,
        experienceName: experience.name,
        line: unscheduledLine(
          experience,
          weekday,
          `and your dates have no ${weekdayName(weekday)}`,
        ),
      })
      continue
    }

    const slot = matching.find((day) => (perDay[day.index]?.length ?? 0) < (capacity[day.index] ?? 0))
    if (slot === undefined) {
      unscheduled.push({
        experienceId: experience.id,
        experienceName: experience.name,
        line: unscheduledLine(
          experience,
          weekday,
          `and there was no room on your ${weekdayName(weekday)}`,
        ),
      })
      continue
    }
    perDay[slot.index]?.push(experience)
    placed.add(experience.id)
  }

  // ---- everything else, dealt round-robin and never twice (R21).
  // A fixed-day experience that could not claim its weekday is NOT eligible for a
  // general slot: putting it anywhere is exactly the false claim R18 exists to
  // stop. It is already recorded in `unscheduled` with the reason.
  const queue = pool.filter(
    (experience) => experience.fixedWeekday === null && !placed.has(experience.id),
  )
  let cursor = 0
  const maxCapacity = capacity.reduce((max, n) => Math.max(max, n), 0)
  for (let round = 0; round < maxCapacity; round += 1) {
    const open: number[] = []
    for (let index = 0; index < ctx.days; index += 1) {
      const day = perDay[index]
      if (day !== undefined && day.length === round && round < (capacity[index] ?? 0)) {
        open.push(index)
      }
    }
    const remaining = queue.length - cursor
    if (remaining <= 0) break
    for (const index of spread(open, Math.min(remaining, open.length))) {
      const experience = queue[cursor]
      if (experience === undefined) break
      cursor += 1
      perDay[index]?.push(experience)
    }
  }

  const sorted = perDay.map((day) =>
    [...day].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]),
  )

  return {
    base,
    perDay: sorted,
    chosen: sorted.flat(),
    unscheduled,
  }
}

export function buildLegs(
  destination: Destination,
  ctx: PlanContext,
): [TravelLeg, TravelLeg] {
  const fare = destination.fares[ctx.origin]
  const perLeg = Math.round(fare.perPerson / 2)
  // The leg names the destination, not the base town: you fly to Goa and drive to
  // Anjuna, and the header already says which town the plan books.
  const arrival = destination.name
  return [
    {
      kind: 'outbound',
      mode: fare.mode,
      hours: fare.hours,
      perPerson: perLeg,
      date: ctx.startDate,
      from: ctx.origin,
      to: arrival,
    },
    {
      kind: 'return',
      mode: fare.mode,
      hours: fare.hours,
      perPerson: fare.perPerson - perLeg,
      date: ctx.endDate,
      from: arrival,
      to: ctx.origin,
    },
  ]
}

export function buildDays(
  stay: Stay,
  itinerary: Itinerary,
  legs: readonly [TravelLeg, TravelLeg],
  ctx: PlanContext,
): DayBlock[] {
  const days: DayBlock[] = []
  const roomsWord = ctx.rooms === 1 ? '1 room' : `${ctx.rooms} rooms`

  for (let index = 0; index < ctx.days; index += 1) {
    const date = addDays(ctx.startDate, index)
    const isFirst = index === 0
    const isLast = index === ctx.days - 1

    const dayLegs: TravelLeg[] = []
    if (isFirst) dayLegs.push(legs[0])
    if (isLast) dayLegs.push(legs[1])

    const experiences = itinerary.perDay[index] ?? []

    days.push({
      day: index + 1,
      label: `Day ${index + 1}`,
      dateLabel: formatDayLabel(date),
      date,
      experiences,
      legs: dayLegs,
      stayEntry: isFirst
        ? { label: `Check in — ${stay.name}`, detail: `${nightsLabel(ctx.nights)}, ${roomsWord}` }
        : isLast
          ? { label: `Check out — ${stay.name}`, detail: '' }
          : null,
      note: experiences.length === 0 && !isFirst && !isLast ? FREE_DAY_NOTE : null,
    })
  }

  return days
}
