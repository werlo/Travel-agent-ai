import type { Vibe } from './types'

/**
 * The six vibes of R1, in the order they are presented (docs/01-prd.md R1,
 * docs/03-design.md §4 S1). The order is part of the contract: the grid reads
 * Mountains, Beach, Party / Honeymoon, Peace & Quiet, Culture & Food.
 *
 * Labels live in the domain because later slices quote them back to the user
 * ("You chose Beach — …", docs/02-architecture.md §4.8 rule 7).
 */
export const VIBE_LABELS: Readonly<Record<Vibe, string>> = {
  mountains: 'Mountains',
  beach: 'Beach',
  party: 'Party',
  honeymoon: 'Honeymoon',
  peace: 'Peace & Quiet',
  culture: 'Culture & Food',
}

export const VIBE_ORDER: readonly Vibe[] = [
  'mountains',
  'beach',
  'party',
  'honeymoon',
  'peace',
  'culture',
]

export function vibeLabel(vibe: Vibe): string {
  return VIBE_LABELS[vibe]
}

export function isVibe(value: unknown): value is Vibe {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(VIBE_LABELS, value)
}
