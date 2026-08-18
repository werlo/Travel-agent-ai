import type { Rupees } from './types'

/**
 * Integer rupee maths and Indian digit grouping.
 *
 * `Intl.NumberFormat('en-IN')` is deliberately NOT used: its output depends on the
 * runtime's ICU build, Vitest runs in Node and Playwright in Chromium, and R8/R9
 * assert on exact strings like `₹8,400` (docs/02-architecture.md §1). Twelve lines
 * of pure code removes a whole class of cross-runtime flake.
 */

export const RUPEE = '₹'

/** Indian grouping: last three digits, then pairs. 1234567 -> '12,34,567'. */
export function groupIndian(value: number): string {
  const negative = value < 0
  const digits = String(Math.abs(Math.trunc(value)))

  let grouped: string
  if (digits.length <= 3) {
    grouped = digits
  } else {
    const last3 = digits.slice(-3)
    let rest = digits.slice(0, -3)
    const pairs: string[] = []
    while (rest.length > 2) {
      pairs.unshift(rest.slice(-2))
      rest = rest.slice(0, -2)
    }
    if (rest.length > 0) pairs.unshift(rest)
    grouped = `${pairs.join(',')},${last3}`
  }

  return negative ? `-${grouped}` : grouped
}

/**
 * 60000 -> '₹60,000'; -9640 -> '−₹9,640' (B9). The sign sits outside the rupee
 * symbol, using the same minus glyph (U+2212) the season basis line already
 * uses for '−20%', rather than an ASCII hyphen wedged between ₹ and the digits.
 */
export function formatRupees(value: Rupees): string {
  const negative = value < 0
  return `${negative ? '−' : ''}${RUPEE}${groupIndian(Math.abs(value))}`
}

/** Always a non-negative integer count of rooms: one room per two travellers (A7). */
export function roomsFor(travellers: number): number {
  return Math.ceil(travellers / 2)
}

/**
 * The only rounded figure in the product (R8): the party total divided by the
 * number of travellers, rounded to the nearest ₹100. It deliberately does not
 * multiply back to the party total; the breakdown says so in words.
 */
export function perPersonRounded(partyTotal: Rupees, travellers: number): Rupees {
  return Math.round(partyTotal / travellers / 100) * 100
}

/** Whole rupees only — every catalogue figure and every line item is an integer. */
export function isWholeRupees(value: unknown): value is Rupees {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
