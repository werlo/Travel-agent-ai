import { buildTravelpayoutsSignature } from './signature'
import type { LiveFlightQuote, LiveHotelQuote, LivePriceProvider, LivePriceQuery } from './types'

/**
 * Travelpayouts real-time flight search (travelpayouts.github.io/slate), the
 * verified half of the two providers.
 *
 * `getFlightQuote` returns `null` with **zero network calls** when
 * `VITE_TRAVELPAYOUTS_TOKEN` or `VITE_TRAVELPAYOUTS_MARKER` is unset — this is what
 * keeps `e2e/control-export.spec.ts`'s "the app talks to nobody" assertion true in
 * the deployed default (no keys yet).
 *
 * Neither method ever throws: every failure mode (missing key, network error,
 * timeout, unexpected response shape) resolves `null`.
 */

const SEARCH_URL = 'https://api.travelpayouts.com/v1/flight_search'
const RESULTS_URL = 'https://api.travelpayouts.com/v1/flight_search_results'
const POLL_ATTEMPTS = 3
const POLL_INTERVAL_MS = 1500
const OVERALL_TIMEOUT_MS = 6000

interface RawProposal {
  price: number
  currency: string
  departure_time?: number
  arrival_time?: number
  operating_carrier?: string
  url?: string
}

function isRawProposal(node: unknown): node is RawProposal {
  if (typeof node !== 'object' || node === null) return false
  const record = node as Record<string, unknown>
  return typeof record.price === 'number' && typeof record.currency === 'string'
}

/**
 * Walks whatever shape the results endpoint actually returns and collects every
 * object that looks like a priced proposal. The response schema for
 * `flight_search_results` polling is not pinned down beyond "carries price,
 * currency, times, carrier and a booking url" (see the task brief) — a recursive,
 * defensive walk survives it being nested under `chunks`, `proposals`, or anything
 * else Travelpayouts has changed it to since this was written.
 */
function findProposals(node: unknown, acc: RawProposal[], depth = 0): void {
  if (depth > 8 || node === null || typeof node !== 'object') return
  if (isRawProposal(node)) {
    acc.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) findProposals(item, acc, depth + 1)
    return
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    findProposals(value, acc, depth + 1)
  }
}

function cheapestOf(proposals: readonly RawProposal[]): RawProposal | null {
  let best: RawProposal | null = null
  for (const proposal of proposals) {
    if (best === null || proposal.price < best.price) best = proposal
  }
  return best
}

function extractSearchId(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const record = json as Record<string, unknown>
  const id = record.search_id ?? record.uuid
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * The `url` field is documented as a relative booking link; the exact join with
 * a host is not verified. `https://www.aviasales.com{url}` is Travelpayouts' own
 * front end and a reasonable fallback, but this is an assumption, not a confirmed
 * contract — flagged in the build summary rather than guessed at silently.
 */
function buildDealUrl(rawUrl: unknown, marker: string): string {
  if (typeof rawUrl === 'string' && rawUrl.length > 0) {
    return rawUrl.startsWith('http') ? rawUrl : `https://www.aviasales.com${rawUrl}`
  }
  return `https://www.aviasales.com/?marker=${encodeURIComponent(marker)}`
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      },
      { once: true },
    )
  })
}

function buildSegments(query: LivePriceQuery): Array<{ origin: string; destination: string; date: string }> {
  const segments = [{ origin: query.origin, destination: query.destination, date: query.departDate }]
  if (query.returnDate !== undefined) {
    segments.push({ origin: query.destination, destination: query.origin, date: query.returnDate })
  }
  return segments
}

async function searchFlight(
  token: string,
  marker: string,
  query: LivePriceQuery,
  signal: AbortSignal,
): Promise<LiveFlightQuote | null> {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  // `user_ip` is deliberately omitted: Travelpayouts' own docs say it is computed
  // server-side from the request when absent. Untested against a live key — if
  // that turns out to be wrong, this is the first thing to add back.
  const body: Record<string, unknown> = {
    marker,
    host,
    locale: 'en-us',
    trip_class: 'Y',
    passengers: { adults: query.adults, children: 0, infants: 0 },
    segments: buildSegments(query),
    currency: 'inr',
  }
  const signature = buildTravelpayoutsSignature(token, marker, body)
  const requestBody = { ...body, signature }

  const searchRes = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  })
  if (!searchRes.ok) return null
  const searchJson: unknown = await searchRes.json()
  const searchId = extractSearchId(searchJson)
  if (searchId === null) return null

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(POLL_INTERVAL_MS, signal)
    const resultsRes = await fetch(`${RESULTS_URL}?uuid=${encodeURIComponent(searchId)}`, { signal })
    if (!resultsRes.ok) continue
    const resultsJson: unknown = await resultsRes.json()
    const proposals: RawProposal[] = []
    findProposals(resultsJson, proposals)
    const best = cheapestOf(proposals)
    if (best !== null) {
      const quote: LiveFlightQuote = {
        amountMinor: Math.round(best.price * 100),
        currency: best.currency.toUpperCase(),
        asOf: new Date().toISOString(),
        dealUrl: buildDealUrl(best.url, marker),
      }
      return best.operating_carrier !== undefined ? { ...quote, airline: best.operating_carrier } : quote
    }
  }
  return null
}

export function createTravelpayoutsProvider(): LivePriceProvider {
  const token = import.meta.env.VITE_TRAVELPAYOUTS_TOKEN
  const marker = import.meta.env.VITE_TRAVELPAYOUTS_MARKER
  const configured =
    typeof token === 'string' && token.length > 0 && typeof marker === 'string' && marker.length > 0

  return {
    async getFlightQuote(query: LivePriceQuery): Promise<LiveFlightQuote | null> {
      if (!configured) return null
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS)
      try {
        return await searchFlight(token as string, marker as string, query, controller.signal)
      } catch (error) {
        console.warn('[compass] E-LIVEPRICE-FLIGHT', error)
        return null
      } finally {
        clearTimeout(timer)
      }
    },

    // Travelpayouts' real-time search product is flights only; it has no hotel
    // inventory to quote here.
    async getHotelQuote(): Promise<LiveHotelQuote | null> {
      return null
    },
  }
}
