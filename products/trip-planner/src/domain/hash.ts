import type { PlanInput, PlanVariant, Rupees } from './types'

/**
 * Determinism (R13). The plan ID is a pure function of the normalised answers plus
 * the catalogue version — no clock, no randomness, no crypto. It is also the
 * product's correlation handle: a user quoting a plan ID has given a complete,
 * replayable bug report (docs/02-architecture.md §9).
 */

/** FNV-1a, 32-bit. Twelve lines, no dependencies, stable across runtimes. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    // hash *= 16777619, kept in 32-bit unsigned range without floats.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash >>> 0
}

/**
 * A fixed field order, ISO dates as strings, integers as integers, and answers as
 * on-path ordered pairs. Off-path answers are excluded, so R6's change-your-mind
 * path cannot leak into the ID.
 */
export function canonicalise(input: PlanInput, catalogueVersion: string): string {
  const { vibe, basics, answers } = input
  const answerPart = answers.map(([q, o]) => `${q}=${o}`).join(';')
  // Appended only when non-empty, so an ordinary plan's ID is unchanged by R14
  // existing at all — and a restored plan is genuinely a different plan.
  const forced = [...(input.forceConstraints ?? [])].sort()
  const forcedPart = forced.length === 0 ? '' : `|forced:${forced.join(',')}`
  return ([
    `v1`,
    `cat:${catalogueVersion}`,
    `vibe:${vibe}`,
    `start:${basics.startDate}`,
    `end:${basics.endDate}`,
    `budget:${basics.budget}`,
    `travellers:${basics.travellers}`,
    `origin:${basics.origin}`,
    `answers:${answerPart}`,
  ].join('|') + forcedPart)
}

/** Four base-36 characters of the hash — enough to distinguish, short enough to read. */
export function shortHash(canonical: string): string {
  return fnv1a32(canonical).toString(36).padStart(7, '0').slice(-4)
}

function destinationCode(destinationName: string): string {
  const letters = destinationName.toUpperCase().replace(/[^A-Z]/g, '')
  return (letters.length >= 4 ? letters.slice(0, 4) : letters.padEnd(4, 'X')) || 'XXXX'
}

export interface PlanIdParts {
  destinationName: string
  nights: number
  travellers: number
  budget: Rupees
}

/**
 * `KOCH-5N-2P-B60-a41c` — the format in docs/03-design.md §4 S5, verbatim.
 * The variant is inside the hash, so switching to the Saver plan (R11) or changing
 * travellers (R12) changes the ID, as both requirements demand.
 */
export function planId(
  canonical: string,
  variant: PlanVariant,
  parts: PlanIdParts,
): string {
  const budgetK = Math.round(parts.budget / 1000)
  return [
    destinationCode(parts.destinationName),
    `${parts.nights}N`,
    `${parts.travellers}P`,
    `B${budgetK}`,
    shortHash(`${canonical}|variant:${variant}`),
  ].join('-')
}
