/**
 * Pure domain types. Nothing in src/domain/ may import from ui/, app/, storage/ or
 * data/, or touch window, document, localStorage, fetch, Date.now, new Date,
 * Math.random, crypto or Intl. Enforced by the ESLint override in eslint.config.js
 * and guarded by tests/eslint-domain-purity.test.ts.
 *
 * Types are added here as the slices that need them land (docs/02-architecture.md §3).
 */

/** docs/02-architecture.md §3 — the six vibes of R1. */
export type Vibe = 'mountains' | 'beach' | 'party' | 'honeymoon' | 'peace' | 'culture'

/** docs/02-architecture.md §4.2 — there is no router; the phase is the screen. */
export type Phase = 'vibe' | 'basics' | 'question' | 'generating' | 'plan'
