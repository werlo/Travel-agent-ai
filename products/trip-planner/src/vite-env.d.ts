/// <reference types="vite/client" />

/**
 * The four live-price env vars (docs/02-architecture.md, "Live price check"
 * section). All optional — their absence is the deployed default today and is
 * what `src/data/livePrices/index.ts` gates on.
 */
interface ImportMetaEnv {
  readonly VITE_TRAVELPAYOUTS_TOKEN?: string
  readonly VITE_TRAVELPAYOUTS_MARKER?: string
  readonly VITE_BOOKING_API_KEY?: string
  readonly VITE_BOOKING_AFFILIATE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
