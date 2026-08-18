/**
 * R26 (customer fix, refinement round 2) — exclude a destination before seeing any
 * plan. The "Anywhere except…" control on Trip basics (S2) writes to the same
 * `excluded` set R22's post-plan "Not this one — somewhere else" writes to
 * (docs/02-architecture.md §4.9, `SessionState.excluded`), so excluding "Goa" here
 * has the identical effect on the search as rejecting North Goa after seeing it.
 *
 * Matching is deliberately loose — a case-insensitive substring match — because the
 * catalogue's display names are not what a user types: "Goa" has to reach "North
 * Goa", the way Rohan actually said it.
 */

export interface NamedDestination {
  id: string
  name: string
}

/** Trims and lower-cases; an empty query never matches anything. */
export function matchDestinationsByName(
  destinations: readonly NamedDestination[],
  query: string,
): NamedDestination[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  return destinations.filter((destination) => destination.name.toLowerCase().includes(needle))
}

/**
 * R28 (customer fix 2) — a place name a user types can cover more named variants
 * than the one catalogue entry it resolves to: "Goa" is how people refer to the
 * coast, and the sample catalogue only carries "North Goa" as its own destination.
 * Excluding "North Goa" alone, with a chip that only ever says "North Goa", gives no
 * signal that the exclusion was ever meant to be broader than that one entry — which
 * is exactly the ambiguity that made Rohan distrust the control on a second use.
 *
 * This is a small, fixed table of known groupings rather than a heuristic: every
 * entry names every variant a reasonable person means by the query, whether or not
 * every variant is its own catalogue destination.
 */
const VARIANT_GROUPS: ReadonlyArray<{ readonly matches: (name: string) => boolean; readonly variants: readonly string[] }> = [
  { matches: (name) => name === 'North Goa', variants: ['North Goa', 'South Goa'] },
]

function variantGroupFor(destinationName: string): readonly string[] | null {
  const group = VARIANT_GROUPS.find((g) => g.matches(destinationName))
  return group === undefined ? null : group.variants
}

/**
 * `Goa (covers North Goa & South Goa)` for a destination that is part of a known
 * variant group, or the destination's own name otherwise. Used everywhere an
 * excluded destination's name is shown back to the user — the chip on Trip basics
 * (R26) and the "You turned these down" list (R22) — so a reject and a pre-plan
 * exclusion of the same place read identically.
 */
export function exclusionDisplayName(destinationName: string): string {
  const variants = variantGroupFor(destinationName)
  if (variants === null) return destinationName
  // "North Goa" -> "Goa": the group's short, colloquial name is the query most
  // people actually type, not the catalogue's own full name.
  const short = destinationName.replace(/^(North|South|East|West)\s+/, '')
  return `${short} (covers ${variants.join(' & ')})`
}
