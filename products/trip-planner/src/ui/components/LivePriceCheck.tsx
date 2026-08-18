import { useEffect, useState } from 'react'
import { liveQueryFor, resolveLivePriceProviders } from '../../data/livePrices'
import type { LiveFlightQuote, LiveHotelQuote } from '../../data/livePrices'
import { formatRupees } from '../../domain/money'
import type { Plan } from '../../domain/types'

/**
 * The live price check (post-ship addition — docs/02-architecture.md,
 * "Live price check").
 *
 * Additive and non-blocking: it never feeds `generatePlanSet`, never changes a
 * plan ID, and never replaces the deterministic estimate above it — it only ever
 * adds a second, clearly-labelled figure alongside it. With no provider configured
 * (today's deployed default, no keys yet) `resolveLivePriceProviders()` returns
 * `{ flights: null, hotels: null }` before any network call, and this component
 * renders nothing at all: not a placeholder, not a spinner, nothing in the DOM.
 *
 * R16 — the same honesty rule as the rest of the app: this links out to a
 * metasearch comparison, never a transaction, so the copy says "Compare on …",
 * never "Book"/"Pay"/"Checkout"/"Reserve".
 */

const providers = resolveLivePriceProviders()

function amountMinorToRupees(amountMinor: number): number {
  return Math.round(amountMinor / 100)
}

/** Only a quote actually priced in rupees is shown — the app formats currency as
 * ₹ everywhere else, and a mismatched currency would misrepresent the number. */
function inrOnly<T extends { currency: string }>(quote: T | null): T | null {
  return quote !== null && quote.currency.toUpperCase() === 'INR' ? quote : null
}

function FlightLine({ origin, destinationName, quote }: { origin: string; destinationName: string; quote: LiveFlightQuote }) {
  return (
    <li className="liveprice__line">
      {`Flight ${origin} → ${destinationName}: ${formatRupees(amountMinorToRupees(quote.amountMinor))} `}
      <a className="liveprice__link" href={quote.dealUrl} target="_blank" rel="noopener noreferrer">
        Compare on Travelpayouts ↗
      </a>
      {', checked just now'}
    </li>
  )
}

function HotelLine({ quote }: { quote: LiveHotelQuote }) {
  return (
    <li className="liveprice__line">
      {`Hotel: ${formatRupees(amountMinorToRupees(quote.amountMinor))}/night `}
      <a className="liveprice__link" href={quote.dealUrl} target="_blank" rel="noopener noreferrer">
        Compare on Booking.com ↗
      </a>
      {', checked just now'}
    </li>
  )
}

export interface LivePriceCheckProps {
  plan: Plan
}

export function LivePriceCheck({ plan }: LivePriceCheckProps) {
  const [flightQuote, setFlightQuote] = useState<LiveFlightQuote | null>(null)
  const [hotelQuote, setHotelQuote] = useState<LiveHotelQuote | null>(null)

  useEffect(() => {
    setFlightQuote(null)
    setHotelQuote(null)
    if (providers.flights === null && providers.hotels === null) return

    let cancelled = false
    const query = liveQueryFor({
      origin: plan.origin,
      destinationId: plan.destinationId,
      startDate: plan.startDate,
      endDate: plan.endDate,
      adults: plan.adults,
    })

    if (providers.flights !== null) {
      providers.flights
        .getFlightQuote(query)
        .then((quote) => {
          if (!cancelled) setFlightQuote(quote)
        })
        .catch(() => {
          // Belt-and-braces only — the provider contract forbids ever throwing.
          if (!cancelled) setFlightQuote(null)
        })
    }
    if (providers.hotels !== null) {
      providers.hotels
        .getHotelQuote(query)
        .then((quote) => {
          if (!cancelled) setHotelQuote(quote)
        })
        .catch(() => {
          if (!cancelled) setHotelQuote(null)
        })
    }

    return () => {
      cancelled = true
    }
    // `plan.planId` is the identity of the whole plan (docs/02-architecture.md
    // §9); re-running on anything narrower risks a stale quote surviving a
    // destination or party-size change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.planId])

  const inrFlight = inrOnly(flightQuote)
  const inrHotel = inrOnly(hotelQuote)
  if (inrFlight === null && inrHotel === null) return null

  return (
    <section className="plan-section plan-section--liveprice" aria-labelledby="plan-liveprice">
      <h2 id="plan-liveprice" className="plan-section__title">
        Live price check
      </h2>
      <ul className="liveprice__list">
        {inrFlight !== null ? (
          <FlightLine origin={plan.origin} destinationName={plan.destinationName} quote={inrFlight} />
        ) : null}
        {inrHotel !== null ? <HotelLine quote={inrHotel} /> : null}
      </ul>
      <p className="plan-section__footnote">
        Live figures fetched just now from a third party; they never change the plan above or
        its ID.
      </p>
    </section>
  )
}
