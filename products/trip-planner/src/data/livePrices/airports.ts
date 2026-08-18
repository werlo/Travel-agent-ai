import type { OriginCity } from '../../domain/types'

/**
 * Best-effort IATA codes for the six origin cities and the fourteen catalogue
 * destinations. The catalogue itself carries no airport codes (it prices routes as
 * flat return fares, not flight segments — docs/02-architecture.md §3), so this is
 * new, small, hand-authored data that exists only to build a `LivePriceQuery`. It is
 * never read by `generatePlanSet` or anything under `src/domain/`.
 *
 * Where a destination has no commercial airport of its own (Ella has none; the
 * nearest is Colombo), the code is the nearest airport actually used to reach it —
 * not a fabricated one.
 */
const ORIGIN_IATA: Readonly<Record<OriginCity, string>> = {
  Mumbai: 'BOM',
  Delhi: 'DEL',
  Bengaluru: 'BLR',
  Chennai: 'MAA',
  Kolkata: 'CCU',
  Hyderabad: 'HYD',
}

const DESTINATION_IATA: Readonly<Record<string, string>> = {
  'in-varkala': 'TRV', // Trivandrum — nearest airport to Kochi/Varkala
  'in-goa': 'GOI',
  'in-andaman': 'IXZ', // Port Blair
  'in-manali': 'KUU', // Kullu-Manali (Bhuntar)
  'in-gangtok': 'IXB', // Bagdogra — nearest serviced airport to Gangtok
  'in-puducherry': 'PNY',
  'int-bali': 'DPS', // Denpasar
  'int-bangkok': 'BKK',
  'int-phuket': 'HKT',
  'int-pokhara': 'PKR',
  'int-ella': 'CMB', // Colombo — Ella has no airport
  'int-maldives': 'MLE', // Male
  'int-hanoi': 'HAN',
  'int-dubai': 'DXB',
}

export function airportCodeForOrigin(origin: OriginCity): string {
  return ORIGIN_IATA[origin]
}

/** Falls back to a 3-letter guess derived from the id for any destination this
 * table has not been kept in sync with — never throws, never blocks the query. */
export function airportCodeForDestination(destinationId: string): string {
  return DESTINATION_IATA[destinationId] ?? destinationId.replace(/^\w+-/, '').slice(0, 3).toUpperCase()
}
