import type { LiveFlightQuote, LiveHotelQuote, LivePriceProvider, LivePriceQuery } from './types'

/**
 * Booking.com Demand API v3 adapter.
 *
 * Schema unverified — confirm against developers.booking.com Partner Hub docs once
 * partner access is approved, then adjust field mapping here. Their interactive
 * docs render client-side and could not be scraped for real field names while
 * building this. What IS confirmed: it is a JSON REST API, POST requests,
 * authenticated via an `Authorization: Bearer {token}` header plus an
 * `X-Affiliate-Id` header — that wiring is real. The request body shape and the
 * response parsing below are a best-effort guess, deliberately defensive: every
 * field access is wrapped, and anything unexpected resolves `null` rather than
 * throwing or fabricating a number.
 *
 * `getHotelQuote` returns `null` with **zero network calls** when
 * `VITE_BOOKING_API_KEY` or `VITE_BOOKING_AFFILIATE_ID` is unset, matching the
 * Travelpayouts provider's no-key-no-network rule.
 */

// Path unverified — the Demand API's actual search endpoint has not been seen.
const SEARCH_URL = 'https://demandapi.booking.com/3.1/accommodations/search'
const TIMEOUT_MS = 6000

interface ParsedHotelPrice {
  price: number
  currency: string
  url?: string
}

function isParsedHotelPrice(node: unknown): node is ParsedHotelPrice {
  if (typeof node !== 'object' || node === null) return false
  const record = node as Record<string, unknown>
  return typeof record.price === 'number' && typeof record.currency === 'string'
}

/** Same defensive recursive walk as the Travelpayouts results parser: the actual
 * nesting of Booking.com's response is unverified, so this looks for the first
 * object shaped like a price anywhere in the payload rather than assuming a path. */
function findPricedNode(node: unknown, depth = 0): ParsedHotelPrice | null {
  if (depth > 8 || node === null || typeof node !== 'object') return null
  if (isParsedHotelPrice(node)) return node
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findPricedNode(item, depth + 1)
      if (found !== null) return found
    }
    return null
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findPricedNode(value, depth + 1)
    if (found !== null) return found
  }
  return null
}

function parseHotelResponse(json: unknown): LiveHotelQuote | null {
  try {
    const found = findPricedNode(json)
    if (found === null) return null
    return {
      amountMinor: Math.round(found.price * 100),
      currency: found.currency.toUpperCase(),
      asOf: new Date().toISOString(),
      dealUrl: typeof found.url === 'string' && found.url.length > 0 ? found.url : 'https://www.booking.com/',
    }
  } catch (error) {
    console.warn('[compass] E-LIVEPRICE-HOTEL-PARSE', error)
    return null
  }
}

async function searchHotel(
  apiKey: string,
  affiliateId: string,
  query: LivePriceQuery,
  signal: AbortSignal,
): Promise<LiveHotelQuote | null> {
  // Request body shape unverified — best-effort field names pending real docs.
  const body = {
    checkin: query.departDate,
    checkout: query.returnDate ?? query.departDate,
    destination: query.destination,
    occupancy: [{ adults: query.adults }],
  }

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Affiliate-Id': affiliateId,
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) return null

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }
  return parseHotelResponse(json)
}

export function createBookingProvider(): LivePriceProvider {
  const apiKey = import.meta.env.VITE_BOOKING_API_KEY
  const affiliateId = import.meta.env.VITE_BOOKING_AFFILIATE_ID
  const configured =
    typeof apiKey === 'string' && apiKey.length > 0 && typeof affiliateId === 'string' && affiliateId.length > 0

  return {
    // Booking.com's Demand API is accommodation-only; it has no flight product.
    async getFlightQuote(): Promise<LiveFlightQuote | null> {
      return null
    },

    async getHotelQuote(query: LivePriceQuery): Promise<LiveHotelQuote | null> {
      if (!configured) return null
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        return await searchHotel(apiKey as string, affiliateId as string, query, controller.signal)
      } catch (error) {
        console.warn('[compass] E-LIVEPRICE-HOTEL', error)
        return null
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
