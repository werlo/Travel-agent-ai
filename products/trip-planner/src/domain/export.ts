import { formatDateRange, formatDuration, nightsLabel, travellersLabel } from './dates'
import { formatRupees } from './money'
import type { CatalogueMeta, DayBlock, Plan, TravelLeg } from './types'

/**
 * R17 — the plan as plain text (docs/02-architecture.md §4.10, docs/03-design.md §4 S6).
 *
 * Pure, like everything else under src/domain/: the dialog renders whatever this
 * returns into a read-only `<textarea>` and hands the same string to the clipboard,
 * so what is copied and what is on screen cannot disagree.
 *
 * The shape is the designer's, line for line: destination, dates, party total, one
 * line per day, the stay, the four line items, the plan ID and the honesty
 * sentence. R17 names the first four of those explicitly.
 */

const MODE_VERB = {
  flight: 'Fly',
  train: 'Train',
  road: 'Drive',
} as const

function legText(leg: TravelLeg): string {
  return `${MODE_VERB[leg.mode]} ${leg.from} → ${leg.to} (${formatDuration(leg.hours)})`
}

/**
 * `Check in — Brunton Boatyard` reads as `Check in, Brunton Boatyard` in the export:
 * the em dash is a layout device on screen and a comma is what survives a paste
 * into WhatsApp (docs/03-design.md §4 S6).
 */
function stayText(entry: NonNullable<DayBlock['stayEntry']>): string {
  return entry.label.replace(' — ', ', ')
}

/** `Day 1 — Sat 10 Oct: Fly … · Check in, … · Fort Kochi sunset walk`. */
export function dayLine(day: DayBlock): string {
  const outbound = day.legs.filter((leg) => leg.kind === 'outbound').map(legText)
  const inbound = day.legs.filter((leg) => leg.kind === 'return').map(legText)
  const stay = day.stayEntry === null ? [] : [stayText(day.stayEntry)]
  const experiences = day.experiences.map((experience) => experience.name)

  const items = [...outbound, ...stay, ...experiences, ...inbound]
  return `${day.label} — ${day.dateLabel}: ${items.join(' · ')}`
}

export function toPlainText(plan: Plan, meta: CatalogueMeta): string {
  const { cost } = plan

  const head = [
    `${plan.destinationName} — ${nightsLabel(plan.nights)}`,
    `${formatDateRange(plan.startDate, plan.endDate)} · ${travellersLabel(
      plan.travellers,
    )} · from ${plan.origin}`,
    `Total ${formatRupees(cost.partyTotal)} for ${plan.travellers} (${formatRupees(
      cost.perPerson,
    )} per person)`,
  ]

  const days = plan.days.map(dayLine)

  const tail = [
    `Stay: ${plan.stay.name}, ${nightsLabel(plan.stay.nights)}, ${plan.stay.rooms} ${
      plan.stay.rooms === 1 ? 'room' : 'rooms'
    }`,
    [
      `Travel ${formatRupees(cost.travel)}`,
      `Stay ${formatRupees(cost.stay)}`,
      `Experiences ${formatRupees(cost.experiences)}`,
      `Local allowance ${formatRupees(cost.localAllowance)}`,
    ].join(' · '),
  ]

  const stamp = [
    `Plan ${plan.planId} · Compass catalogue ${meta.version}`,
    'Prices are indicative sample data. Compass does not sell or reserve anything.',
  ]

  return [
    ...head,
    '',
    ...days,
    '',
    ...tail,
    '',
    ...stamp,
  ].join('\n')
}
