import type { ISODate } from './types'

/**
 * UTC-only ISO date maths. No `Date` object is ever constructed here — the domain
 * is pure and the ESLint override forbids it — so the civil-date conversions are
 * implemented directly (Howard Hinnant's days-from-civil algorithm). That also
 * removes every timezone question: '2026-10-10' means the tenth, everywhere.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export interface CivilDate {
  year: number
  month: number
  day: number
}

const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return lengths[month - 1] ?? 0
}

export function parseISO(value: string): CivilDate | null {
  if (!ISO_SHAPE.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && parseISO(value) !== null
}

export function toISO(date: CivilDate): ISODate {
  const y = String(date.year).padStart(4, '0')
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Days since 1970-01-01. Pure integer arithmetic, valid for any civil date. */
export function daysFromCivil({ year, month, day }: CivilDate): number {
  const y = year - (month <= 2 ? 1 : 0)
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function civilFromDays(z: number): CivilDate {
  const shifted = z + 719468
  const era = Math.floor(shifted / 146097)
  const doe = shifted - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp + (mp < 10 ? 3 : -9)
  return { year: y + (month <= 2 ? 1 : 0), month, day }
}

/** Nights between two ISO dates. Negative when end precedes start. */
export function nightsBetween(start: ISODate, end: ISODate): number {
  const a = parseISO(start)
  const b = parseISO(end)
  if (a === null || b === null) return Number.NaN
  return daysFromCivil(b) - daysFromCivil(a)
}

export function addDays(date: ISODate, days: number): ISODate {
  const civil = parseISO(date)
  if (civil === null) return date
  return toISO(civilFromDays(daysFromCivil(civil) + days))
}

/** First day of the month after the given date — the S2 start-date default. */
export function firstOfNextMonth(from: ISODate): ISODate {
  const civil = parseISO(from)
  if (civil === null) return from
  const month = civil.month === 12 ? 1 : civil.month + 1
  const year = civil.month === 12 ? civil.year + 1 : civil.year
  return toISO({ year, month, day: 1 })
}

export function weekdayShort(date: ISODate): string {
  const civil = parseISO(date)
  if (civil === null) return ''
  const index = ((daysFromCivil(civil) % 7) + 11) % 7
  return WEEKDAYS[index] ?? ''
}

export function monthShort(month: number): string {
  return MONTHS[month - 1] ?? ''
}

/** 'Sat 10 Oct' — the DayBlock heading (docs/03-design.md §4 S5). */
export function formatDayLabel(date: ISODate): string {
  const civil = parseISO(date)
  if (civil === null) return date
  return `${weekdayShort(date)} ${civil.day} ${monthShort(civil.month)}`
}

/**
 * 'Sat 10 – Thu 15 Oct 2026' when the month and year match at both ends,
 * 'Sat 30 Nov – Tue 3 Dec 2026' across a month boundary, and both years when the
 * trip crosses new year. The en dash is the designer's (docs/03-design.md §4 S5).
 */
export function formatDateRange(start: ISODate, end: ISODate): string {
  const a = parseISO(start)
  const b = parseISO(end)
  if (a === null || b === null) return `${start} – ${end}`

  const left = `${weekdayShort(start)} ${a.day}`
  const right = `${weekdayShort(end)} ${b.day}`

  if (a.year === b.year && a.month === b.month) {
    return `${left} – ${right} ${monthShort(b.month)} ${b.year}`
  }
  if (a.year === b.year) {
    return `${left} ${monthShort(a.month)} – ${right} ${monthShort(b.month)} ${b.year}`
  }
  return `${left} ${monthShort(a.month)} ${a.year} – ${right} ${monthShort(b.month)} ${b.year}`
}

/** '1h 20m' from a decimal hour count. */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** '5 nights' / '1 night'. */
export function nightsLabel(nights: number): string {
  return `${nights} ${nights === 1 ? 'night' : 'nights'}`
}

/** '2 travellers' / '1 traveller'. */
export function travellersLabel(travellers: number): string {
  return `${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}`
}
