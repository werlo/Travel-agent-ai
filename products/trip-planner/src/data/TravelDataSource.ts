import type { CatalogueSnapshot } from '../domain/types'

/**
 * The E1 seam (docs/01-prd.md E1, docs/02-architecture.md §4.1).
 *
 * No key-less aggregator API exists and this environment forbids live third-party
 * calls, so v1 is satisfied by a date-stamped snapshot compiled into the bundle.
 * The engine never learns where a fare came from: `generatePlanSet` takes a
 * `CatalogueSnapshot`, not a `TravelDataSource`, which is what lets `load()` become
 * async in a real aggregator adapter without the planner — or any of its tests —
 * changing at all.
 */
export interface TravelDataSource {
  /** Synchronous in v1 (bundled data). `Promise<CatalogueSnapshot>` in the adapter. */
  load(): CatalogueSnapshot
}

export type { CatalogueSnapshot }
