import { createBookingProvider } from './bookingProvider'
import { createTravelpayoutsProvider } from './travelpayoutsProvider'
import type { LivePriceProvider } from './types'

export type {
  LiveFlightQuote,
  LiveHotelQuote,
  LivePriceProvider,
  LivePriceQuery,
} from './types'
export { liveQueryFor, type LivePriceSubject } from './query'

export interface LivePriceProviders {
  flights: LivePriceProvider | null
  hotels: LivePriceProvider | null
}

/**
 * The one entry point the UI layer calls. `null` for a leg means "not configured" —
 * the plan screen never renders a section for a provider that is `null`, and a
 * provider that IS configured still resolves `null` per-query on any failure (see
 * `LivePriceProvider`'s contract in `types.ts`). With neither
 * `VITE_TRAVELPAYOUTS_TOKEN`/`VITE_TRAVELPAYOUTS_MARKER` nor
 * `VITE_BOOKING_API_KEY`/`VITE_BOOKING_AFFILIATE_ID` set — the deployed default
 * today — this returns `{ flights: null, hotels: null }` and touches the network
 * not at all.
 */
export function resolveLivePriceProviders(): LivePriceProviders {
  const travelpayoutsToken = import.meta.env.VITE_TRAVELPAYOUTS_TOKEN
  const travelpayoutsMarker = import.meta.env.VITE_TRAVELPAYOUTS_MARKER
  const flightsConfigured =
    typeof travelpayoutsToken === 'string' &&
    travelpayoutsToken.length > 0 &&
    typeof travelpayoutsMarker === 'string' &&
    travelpayoutsMarker.length > 0

  const bookingKey = import.meta.env.VITE_BOOKING_API_KEY
  const bookingAffiliateId = import.meta.env.VITE_BOOKING_AFFILIATE_ID
  const hotelsConfigured =
    typeof bookingKey === 'string' &&
    bookingKey.length > 0 &&
    typeof bookingAffiliateId === 'string' &&
    bookingAffiliateId.length > 0

  return {
    flights: flightsConfigured ? createTravelpayoutsProvider() : null,
    hotels: hotelsConfigured ? createBookingProvider() : null,
  }
}
