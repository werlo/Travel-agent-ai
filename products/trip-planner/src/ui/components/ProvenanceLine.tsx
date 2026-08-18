/**
 * R16 — the non-dismissable provenance line. There is deliberately no close control
 * and no prop that can hide it: docs/03-design.md §3 lists it as "static,
 * non-dismissable", and R16 is a consumer-protection requirement, not a UX nicety.
 *
 * The string is docs/03-design.md §4, verbatim, with the designer's two U+2011
 * non-breaking hyphens in the date written as ASCII hyphens so that the snapshot
 * date reads as `2026-08-01` (UX3 and R16 both match on that literal).
 * Recorded in docs/02-architecture.md §12 Deviations.
 */

export const CATALOGUE_SNAPSHOT_DATE = '2026-08-01'

export const PROVENANCE_TEXT =
  `Prices are indicative sample data from the Compass catalogue, snapshot ${CATALOGUE_SNAPSHOT_DATE}. ` +
  `Compass does not sell or reserve anything.`

export function ProvenanceLine() {
  return (
    <footer className="provenance">
      <p className="provenance__text">{PROVENANCE_TEXT}</p>
    </footer>
  )
}
