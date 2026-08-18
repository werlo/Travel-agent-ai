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
