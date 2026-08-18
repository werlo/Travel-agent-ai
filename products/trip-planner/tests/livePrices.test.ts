import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTravelpayoutsSignature } from '../src/data/livePrices/signature'
import { md5 } from 'js-md5'

/**
 * The live price check overlay (docs/02-architecture.md, "Live price check").
 *
 * None of this touches `generatePlanSet`, a `CatalogueSnapshot` or anything the
 * planner's own 511 unit tests exercise — it is a separate, additive data seam.
 */

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MD5 (js-md5), the primitive the Travelpayouts signature needs', () => {
  it('matches the standard "abc" test vector', () => {
    // RFC 1321 / every MD5 implementation's canonical smoke test.
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })
})

describe('buildTravelpayoutsSignature', () => {
  it('is md5("token:marker:" + every value, sorted by key, recursively, joined with ":")', () => {
    const body = {
      marker: 'aff123',
      host: 'localhost',
      locale: 'en-us',
      trip_class: 'Y',
      passengers: { adults: 2, children: 0, infants: 0 },
      segments: [{ origin: 'BLR', destination: 'COK', date: '2026-10-10' }],
      currency: 'inr',
    }
    // Golden value computed independently with the same algorithm (see the build
    // summary): regression coverage against the algorithm silently changing, not
    // proof the algorithm matches Travelpayouts' server (untested without a key).
    expect(buildTravelpayoutsSignature('tok_test', 'aff123', body)).toBe(
      '664f15e41a34efec3f2e7b28c188a347',
    )
  })

  it('is deterministic and order-independent in how the object was authored', () => {
    const a = { z: 1, a: 2, nested: { b: 'x', a: 'y' } }
    const b = { a: 2, z: 1, nested: { a: 'y', b: 'x' } }
    expect(buildTravelpayoutsSignature('t', 'm', a)).toBe(buildTravelpayoutsSignature('t', 'm', b))
  })

  it('changes when any leaf value changes', () => {
    const base = buildTravelpayoutsSignature('t', 'm', { adults: 2 })
    const changed = buildTravelpayoutsSignature('t', 'm', { adults: 3 })
    expect(base).not.toBe(changed)
  })
})

describe('resolveLivePriceProviders — no keys configured (the deployed default)', () => {
  it('returns { flights: null, hotels: null } with no env vars set at all', async () => {
    const { resolveLivePriceProviders } = await import('../src/data/livePrices')
    expect(resolveLivePriceProviders()).toEqual({ flights: null, hotels: null })
  })

  it('leaves flights null with only the Travelpayouts token set (marker missing)', async () => {
    vi.stubEnv('VITE_TRAVELPAYOUTS_TOKEN', 'tok')
    const { resolveLivePriceProviders } = await import('../src/data/livePrices')
    expect(resolveLivePriceProviders().flights).toBeNull()
  })

  it('leaves hotels null with only the Booking affiliate id set (key missing)', async () => {
    vi.stubEnv('VITE_BOOKING_AFFILIATE_ID', 'aff')
    const { resolveLivePriceProviders } = await import('../src/data/livePrices')
    expect(resolveLivePriceProviders().hotels).toBeNull()
  })

  it('resolves both providers once every required var for each is set', async () => {
    vi.stubEnv('VITE_TRAVELPAYOUTS_TOKEN', 'tok')
    vi.stubEnv('VITE_TRAVELPAYOUTS_MARKER', 'mark')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'key')
    vi.stubEnv('VITE_BOOKING_AFFILIATE_ID', 'aff')
    const { resolveLivePriceProviders } = await import('../src/data/livePrices')
    const providers = resolveLivePriceProviders()
    expect(providers.flights).not.toBeNull()
    expect(providers.hotels).not.toBeNull()
  })
})

describe('Travelpayouts provider — never throws, never calls the network with no key', () => {
  it('getFlightQuote resolves null immediately, with zero fetch calls, when unconfigured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { createTravelpayoutsProvider } = await import('../src/data/livePrices/travelpayoutsProvider')
    const provider = createTravelpayoutsProvider()
    const quote = await provider.getFlightQuote({
      origin: 'BLR',
      destination: 'COK',
      departDate: '2026-10-10',
      returnDate: '2026-10-15',
      adults: 2,
    })
    expect(quote).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('getHotelQuote resolves null — Travelpayouts has no hotel product here', async () => {
    const { createTravelpayoutsProvider } = await import('../src/data/livePrices/travelpayoutsProvider')
    const provider = createTravelpayoutsProvider()
    const quote = await provider.getHotelQuote({
      origin: 'BLR',
      destination: 'COK',
      departDate: '2026-10-10',
      adults: 2,
    })
    expect(quote).toBeNull()
  })

  it('getFlightQuote resolves null, not a rejection, when configured but the network fails', async () => {
    vi.stubEnv('VITE_TRAVELPAYOUTS_TOKEN', 'tok')
    vi.stubEnv('VITE_TRAVELPAYOUTS_MARKER', 'mark')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('simulated network failure')),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { createTravelpayoutsProvider } = await import('../src/data/livePrices/travelpayoutsProvider')
    const provider = createTravelpayoutsProvider()

    await expect(
      provider.getFlightQuote({
        origin: 'BLR',
        destination: 'COK',
        departDate: '2026-10-10',
        returnDate: '2026-10-15',
        adults: 2,
      }),
    ).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('getFlightQuote resolves null when the search POST itself is not ok (e.g. 401)', async () => {
    vi.stubEnv('VITE_TRAVELPAYOUTS_TOKEN', 'tok')
    vi.stubEnv('VITE_TRAVELPAYOUTS_MARKER', 'mark')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    const { createTravelpayoutsProvider } = await import('../src/data/livePrices/travelpayoutsProvider')
    const provider = createTravelpayoutsProvider()
    await expect(
      provider.getFlightQuote({
        origin: 'BLR',
        destination: 'COK',
        departDate: '2026-10-10',
        adults: 1,
      }),
    ).resolves.toBeNull()
  })

  it('getFlightQuote resolves null when the search response carries no search id/uuid', async () => {
    vi.stubEnv('VITE_TRAVELPAYOUTS_TOKEN', 'tok')
    vi.stubEnv('VITE_TRAVELPAYOUTS_MARKER', 'mark')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nothing: 'useful' }) }),
    )
    const { createTravelpayoutsProvider } = await import('../src/data/livePrices/travelpayoutsProvider')
    const provider = createTravelpayoutsProvider()
    await expect(
      provider.getFlightQuote({
        origin: 'BLR',
        destination: 'COK',
        departDate: '2026-10-10',
        adults: 1,
      }),
    ).resolves.toBeNull()
  })
})

describe('Booking provider — never throws, never calls the network with no key', () => {
  it('getHotelQuote resolves null immediately, with zero fetch calls, when unconfigured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { createBookingProvider } = await import('../src/data/livePrices/bookingProvider')
    const provider = createBookingProvider()
    const quote = await provider.getHotelQuote({
      origin: 'BLR',
      destination: 'COK',
      departDate: '2026-10-10',
      adults: 2,
    })
    expect(quote).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('getFlightQuote resolves null — the Demand API has no flight product', async () => {
    const { createBookingProvider } = await import('../src/data/livePrices/bookingProvider')
    const provider = createBookingProvider()
    const quote = await provider.getFlightQuote({
      origin: 'BLR',
      destination: 'COK',
      departDate: '2026-10-10',
      adults: 2,
    })
    expect(quote).toBeNull()
  })

  it('getHotelQuote resolves null, not a rejection, when configured but the network fails', async () => {
    vi.stubEnv('VITE_BOOKING_API_KEY', 'key')
    vi.stubEnv('VITE_BOOKING_AFFILIATE_ID', 'aff')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('simulated network failure')))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { createBookingProvider } = await import('../src/data/livePrices/bookingProvider')
    const provider = createBookingProvider()
    await expect(
      provider.getHotelQuote({
        origin: 'BLR',
        destination: 'COK',
        departDate: '2026-10-10',
        adults: 2,
      }),
    ).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('getHotelQuote resolves null on a response with no price-shaped field anywhere', async () => {
    vi.stubEnv('VITE_BOOKING_API_KEY', 'key')
    vi.stubEnv('VITE_BOOKING_AFFILIATE_ID', 'aff')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', results: [] }) }),
    )
    const { createBookingProvider } = await import('../src/data/livePrices/bookingProvider')
    const provider = createBookingProvider()
    await expect(
      provider.getHotelQuote({
        origin: 'BLR',
        destination: 'COK',
        departDate: '2026-10-10',
        adults: 2,
      }),
    ).resolves.toBeNull()
  })
})

describe('query.ts — deriving a LivePriceQuery from a plan, without touching the engine', () => {
  it('maps origin cities and known destination ids to airport codes', async () => {
    const { liveQueryFor } = await import('../src/data/livePrices/query')
    const query = liveQueryFor({
      origin: 'Bengaluru',
      destinationId: 'in-goa',
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      adults: 2,
    })
    expect(query).toEqual({
      origin: 'BLR',
      destination: 'GOI',
      departDate: '2026-10-10',
      returnDate: '2026-10-15',
      adults: 2,
    })
  })

  it('never lets adults drop below 1', async () => {
    const { liveQueryFor } = await import('../src/data/livePrices/query')
    const query = liveQueryFor({
      origin: 'Mumbai',
      destinationId: 'int-dubai',
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      adults: 0,
    })
    expect(query.adults).toBe(1)
  })
})
