import type { CatalogueMeta } from '../../domain/types'

/**
 * The snapshot stamp. `version` is part of every plan ID (R13) and `snapshotDate`
 * is the date rendered in the provenance line on every screen that shows a price
 * (R16). Changing either invalidates cached plans in saved sessions on purpose —
 * an old plan ID against a new catalogue would be a lie
 * (docs/02-architecture.md §5).
 */
export const CATALOGUE_META: CatalogueMeta = {
  version: '2026-08-01',
  snapshotDate: '2026-08-01',
  currency: 'INR',
  destinationCount: 14,
}
