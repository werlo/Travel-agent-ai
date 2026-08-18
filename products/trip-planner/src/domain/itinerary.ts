import { addDays, formatDayLabel, nightsLabel } from './dates'
import { tagMatches } from './scoring'
import type {
  DayBlock,
  Destination,
  Experience,
  PlanContext,
  Stay,
  TravelLeg,
} from './types'

/**
 * R7 — one costed day-by-day itinerary. `days = nights + 1`, labels `Day 1` …
 * `Day ${days}`, the first day carries the outbound leg and the last the return.
 *
 * Selection is deterministic: experiences are sorted by
 * `(tagMatchScore desc, pricePerPerson asc, id asc)` — three keys and a unique id,
 * so no tie is possible — and dealt in that order. When the unique ones run out
 * (only possible past ~10 days) the `repeatable` ones cycle: they are priced ₹0 and
 * named honestly, so a long trip never invents paid activities that do not exist.
 */

const SLOT_ORDER = { morning: 0, afternoon: 1, evening: 2 } as const

/** 1 on each travel day, 2 on the others for trips of a week or less, 1 beyond that. */
export function experiencesPerDay(ctx: PlanContext): number[] {
  const counts: number[] = []
  const middleTarget = ctx.nights <= 7 ? 2 : 1
  for (let day = 0; day < ctx.days; day += 1) {
    const isTravelDay = day === 0 || day === ctx.days - 1
    counts.push(isTravelDay ? 1 : middleTarget)
  }
  return counts
}

export function sortExperiences(
  experiences: readonly Experience[],
  ctx: PlanContext,
): Experience[] {
  return [...experiences].sort((a, b) => {
    const byTags = tagMatches(b.tags, ctx.preferTags) - tagMatches(a.tags, ctx.preferTags)
    if (byTags !== 0) return byTags
    const byPrice = a.pricePerPerson - b.pricePerPerson
    if (byPrice !== 0) return byPrice
    return a.id.localeCompare(b.id)
  })
}

/** The flat deal order: every experience the trip includes, longest trips included. */
export function chooseExperiences(
  destination: Destination,
  ctx: PlanContext,
): Experience[] {
  const needed = experiencesPerDay(ctx).reduce((sum, n) => sum + n, 0)
  const unique = sortExperiences(
    destination.experiences.filter((e) => !e.repeatable),
    ctx,
  )
  const fillers = sortExperiences(
    destination.experiences.filter((e) => e.repeatable),
    ctx,
  )

  const chosen: Experience[] = unique.slice(0, needed)
  if (fillers.length > 0) {
    let i = 0
    while (chosen.length < needed) {
      const filler = fillers[i % fillers.length]
      if (filler === undefined) break
      chosen.push(filler)
      i += 1
    }
  }
  return chosen
}

export function buildLegs(
  destination: Destination,
  ctx: PlanContext,
): [TravelLeg, TravelLeg] {
  const fare = destination.fares[ctx.origin]
  const perLeg = Math.round(fare.perPerson / 2)
  return [
    {
      kind: 'outbound',
      mode: fare.mode,
      hours: fare.hours,
      perPerson: perLeg,
      date: ctx.startDate,
      from: ctx.origin,
      to: destination.name,
    },
    {
      kind: 'return',
      mode: fare.mode,
      hours: fare.hours,
      perPerson: fare.perPerson - perLeg,
      date: ctx.endDate,
      from: destination.name,
      to: ctx.origin,
    },
  ]
}

export function buildDays(
  stay: Stay,
  chosen: readonly Experience[],
  legs: readonly [TravelLeg, TravelLeg],
  ctx: PlanContext,
): DayBlock[] {
  const counts = experiencesPerDay(ctx)
  const days: DayBlock[] = []
  const roomsWord = ctx.rooms === 1 ? '1 room' : `${ctx.rooms} rooms`
  let cursor = 0

  for (let index = 0; index < ctx.days; index += 1) {
    const count = counts[index] ?? 1
    const slice = chosen.slice(cursor, cursor + count)
    cursor += count

    const date = addDays(ctx.startDate, index)
    const isFirst = index === 0
    const isLast = index === ctx.days - 1

    const dayLegs: TravelLeg[] = []
    if (isFirst) dayLegs.push(legs[0])
    if (isLast) dayLegs.push(legs[1])

    const experiences = [...slice].sort(
      (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot],
    )

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
    })
  }

  return days
}
