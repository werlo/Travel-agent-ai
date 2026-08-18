import type { CatalogueSnapshot } from '../domain/types'
import type { TravelDataSource } from './TravelDataSource'
import { CATALOGUE_META } from './catalogue/meta'
import { DOMESTIC_DESTINATIONS } from './catalogue/domestic'
import { INTERNATIONAL_DESTINATIONS } from './catalogue/international'

/**
 * The v1 `TravelDataSource`: the bundled snapshot, frozen so that nothing
 * downstream can mutate the catalogue by accident (a mutated catalogue would break
 * R13 in the least debuggable way possible).
 */

const SNAPSHOT: CatalogueSnapshot = Object.freeze({
  meta: CATALOGUE_META,
  destinations: Object.freeze([...DOMESTIC_DESTINATIONS, ...INTERNATIONAL_DESTINATIONS]),
})

export const localCatalogue: TravelDataSource = {
  load: () => SNAPSHOT,
}

/** Convenience for the UI and the tests: the snapshot itself. */
export const CATALOGUE: CatalogueSnapshot = SNAPSHOT
