import type { OriginCity } from '../../domain/types'
import { airportCodeForDestination, airportCodeForOrigin } from './airports'
import type { LivePriceQuery } from './types'

/** The slice of a `Plan` the live-price overlay needs. Deliberately narrower than
 * `Plan` itself so this module never has to import the whole domain type. */
export interface LivePriceSubject {
  origin: OriginCity
  destinationId: string
  startDate: string
  endDate: string
  adults: number
}

export function liveQueryFor(subject: LivePriceSubject): LivePriceQuery {
  return {
    origin: airportCodeForOrigin(subject.origin),
    destination: airportCodeForDestination(subject.destinationId),
    departDate: subject.startDate,
    returnDate: subject.endDate,
    adults: Math.max(1, subject.adults),
  }
}
