import { addDays, parseISO } from './dates'
import type { ISODate, Season, SeasonId } from './types'

/**
 * R23 (customer fix 8) — the calendar is an input to the price.
 *
 * Before this module, pricing was a pure function of (destination, party, nights)
 * and the header printed the user's Christmas dates beside an average-week number.
 * Now every trip is stamped with exactly one season, the loading is applied to
 * stay and travel, and it is rendered as its own line inside the sum that ties to
 * the total — never folded into the rates, where nobody could see it.
 *
 * The windows are indicative sample data, like every other figure in the
 * catalogue, and the plan says so next to the R16 provenance line.
 */

export const SEASON_BASIS_NOTE =
  'Seasonal loadings are indicative sample data, like every other figure here.'

const PEAK: Season = {
  id: 'peak',
  label: 'Peak season (25 Dec – 2 Jan)',
  loadingPercent: 35,
  line: 'Peak season (25 Dec – 2 Jan): +35% on stay and travel',
}

const OFF: Season = {
  id: 'off',
  label: 'Off season (Jul)',
  loadingPercent: -20,
  line: 'Off season (Jul): −20% on stay and travel',
}

const STANDARD: Season = {
  id: 'standard',
  label: 'Standard season',
  loadingPercent: 0,
  line: 'Standard season: no loading on stay and travel',
}

export const SEASONS: Readonly<Record<SeasonId, Season>> = {
  peak: PEAK,
  off: OFF,
  standard: STANDARD,
}

/** Every date the trip touches, first day to last, capped so a bad range is cheap. */
const MAX_DAYS_SCANNED = 40

function seasonOfDay(date: ISODate): SeasonId {
  const civil = parseISO(date)
  if (civil === null) return 'standard'
  if (civil.month === 12 && civil.day >= 25) return 'peak'
  if (civil.month === 1 && civil.day <= 2) return 'peak'
  if (civil.month === 7) return 'off'
  return 'standard'
}

/**
 * The season of a trip is the strongest one it touches: a 20–27 December trip is
 * a Christmas trip even though five of its nights fall before the window, because
 * that is how the rate the traveller will actually be quoted works.
 */
export function seasonFor(start: ISODate, end: ISODate): Season {
  if (parseISO(start) === null || parseISO(end) === null) return STANDARD
  let sawOff = false
  let cursor = start
  for (let i = 0; i < MAX_DAYS_SCANNED; i += 1) {
    const id = seasonOfDay(cursor)
    if (id === 'peak') return PEAK
    if (id === 'off') sawOff = true
    if (cursor === end) break
    cursor = addDays(cursor, 1)
  }
  return sawOff ? OFF : STANDARD
}

/** Signed, integer rupees. Applied to stay and travel only — never to experiences. */
export function seasonalLoading(
  travel: number,
  stay: number,
  season: Season,
): number {
  if (season.loadingPercent === 0) return 0
  const base = travel + stay
  const signed = Math.round((base * Math.abs(season.loadingPercent)) / 100)
  return season.loadingPercent > 0 ? signed : -signed
}
