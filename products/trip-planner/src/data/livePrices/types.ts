/**
 * The live-price overlay's own seam (docs/02-architecture.md §4.1's `TravelDataSource`
 * is the catalogue seam; this is a second, deliberately separate one for the
 * additive "live price check" on the plan screen).
 *
 * Nothing here is imported by `src/domain/**`, and nothing in this folder ever
 * feeds `generatePlanSet` or a `CatalogueSnapshot` — the engine's 511 unit tests,
 * its determinism guarantee (R13) and every plan ID stay exactly as they are
 * whether or not a live quote ever resolves. See `docs/02-architecture.md`
 * "Live price check (post-ship addition)" for the full picture.
 */

/** What a provider needs to look up one real quote. */
export interface LivePriceQuery {
  /** IATA-style origin code, e.g. `BLR`. */
  origin: string
  /** IATA-style destination code, e.g. `COK`. */
  destination: string
  /** 'YYYY-MM-DD'. */
  departDate: string
  /** 'YYYY-MM-DD'. Omitted for a one-way lookup. */
  returnDate?: string
  adults: number
}

export interface LiveFlightQuote {
  /** Integer minor units (paise), never a float rupee amount. */
  amountMinor: number
  /** ISO 4217, e.g. 'INR'. */
  currency: string
  /** ISO 8601 timestamp of when this quote was fetched. */
  asOf: string
  airline?: string
  /** Where "Compare on Travelpayouts" points. Never a transaction link (R16). */
  dealUrl: string
}

export interface LiveHotelQuote {
  /** Integer minor units (paise), never a float rupee amount. */
  amountMinor: number
  /** ISO 4217, e.g. 'INR'. */
  currency: string
  /** ISO 8601 timestamp of when this quote was fetched. */
  asOf: string
  /** Where "Compare on Booking.com" points. Never a transaction link (R16). */
  dealUrl: string
}

/**
 * Both methods MUST NEVER throw. Every implementation catches everything internally
 * — a missing key, a network error, a timeout, a response shape nobody expected —
 * and resolves `null` instead. The plan screen renders nothing on `null`; it never
 * shows an error state for a feature that was never promised in the first place.
 */
export interface LivePriceProvider {
  getFlightQuote(query: LivePriceQuery): Promise<LiveFlightQuote | null>
  getHotelQuote(query: LivePriceQuery): Promise<LiveHotelQuote | null>
}
