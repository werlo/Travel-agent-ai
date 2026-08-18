import type {
  Basics,
  OptionId,
  Phase,
  Plan,
  PlanSet,
  PlanVariant,
  QuestionId,
  Relaxation,
  Restore,
  Vibe,
} from '../domain/types'
import { SAVER_ABSENT_REASON, STRETCH_ABSENT_REASON } from '../domain/budget'
import { isISODate } from '../domain/dates'
import { isVibe } from '../domain/vibes'
import { ORIGIN_CITIES } from '../domain/types'

/**
 * R15 — one `localStorage` key, versioned schema (A10).
 *
 * `localStorage` is attacker-controllable by anyone with devtools, so the stored
 * blob is **parsed, not trusted** (docs/02-architecture.md §8): every field is
 * narrowed into a fresh object and anything unexpected returns `null` instead of
 * being spread into state. A hostile or stale session ends at the vibe screen, not
 * in the reducer, and nothing here ever throws.
 */

export const STORAGE_KEY = 'compass.session.v1'
/**
 * 2 — refinement round 1 added adults/children, the free day and the list of
 * rejected destinations. A v1 blob is dropped rather than migrated: it priced
 * every traveller as an adult and knew nothing about season, so re-deriving it is
 * both cheaper and more honest than guessing at the missing halves.
 */
export const SCHEMA_VERSION = 2

export interface PersistedSession {
  schema: typeof SCHEMA_VERSION
  catalogueVersion: string
  phase: Phase
  vibe: Vibe | null
  basics: Basics | null
  /** Includes answers now off-path: that is what makes R6's "change back" work. */
  answers: Record<QuestionId, OptionId>
  selectedVariant: PlanVariant
  planSet: PlanSet | null
  /** R22 — destination ids the user turned down, in the order they did. */
  excluded: readonly string[]
  /**
   * R11/R12 — the hand-picked destination (Saver/Stretch selected, or what
   * survived a reject), if any, so a reload restores the hand-picked plan
   * rather than the engine's default.
   */
  pinnedDestinationId: string | null
}

export interface ReadResult {
  session: PersistedSession | null
  /** False when the browser refuses us storage — the app says so on screen. */
  available: boolean
}

const PHASES: readonly Phase[] = ['vibe', 'basics', 'question', 'generating', 'plan']
const VARIANTS: readonly PlanVariant[] = ['recommended', 'saver', 'stretch']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function narrowBasics(value: unknown): Basics | null {
  if (!isRecord(value)) return null
  const startDate = str(value.startDate)
  const endDate = str(value.endDate)
  const budget = int(value.budget)
  const travellers = int(value.travellers)
  const origin = str(value.origin)
  if (startDate === null || !isISODate(startDate)) return null
  if (endDate === null || !isISODate(endDate)) return null
  if (budget === null || travellers === null) return null
  if (origin === null || !(ORIGIN_CITIES as readonly string[]).includes(origin)) return null
  const children = Array.isArray(value.children)
    ? value.children.filter((age): age is number => int(age) !== null)
    : []
  const adults = int(value.adults) ?? Math.max(1, travellers - children.length)
  return {
    startDate,
    endDate,
    budget,
    travellers: adults + children.length,
    adults,
    children,
    origin: origin as Basics['origin'],
    freeDay: value.freeDay === true,
  }
}

function narrowAnswers(value: unknown): Record<QuestionId, OptionId> {
  const answers: Record<QuestionId, OptionId> = {}
  if (!isRecord(value)) return answers
  for (const [key, raw] of Object.entries(value)) {
    // A parsed blob is never spread into state, so `__proto__` cannot survive.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const optionId = str(raw)
    if (optionId !== null) answers[key] = optionId
  }
  return answers
}

/**
 * A cached plan only has to be good enough to render — anything malformed is
 * dropped and the plan is recomputed, which R13 guarantees is identical anyway.
 */
function narrowPlan(value: unknown): Plan | null {
  if (!isRecord(value)) return null
  const required = ['planId', 'destinationName', 'startDate', 'endDate', 'origin']
  for (const key of required) if (str(value[key]) === null) return null
  if (int(value.nights) === null || int(value.travellers) === null) return null
  if (!isRecord(value.cost) || int((value.cost as Record<string, unknown>).partyTotal) === null) {
    return null
  }
  if (!isRecord(value.budget) || str((value.budget as Record<string, unknown>).label) === null) {
    return null
  }
  if (!isRecord(value.stay) || str((value.stay as Record<string, unknown>).name) === null) {
    return null
  }
  if (!Array.isArray(value.days) || value.days.length === 0) return null
  // Added in refinement round 1: a cached plan without them cannot be drawn.
  if (str(value.baseName) === null || !Array.isArray(value.unscheduled)) return null
  if (!Array.isArray(value.legs) || value.legs.length !== 2) return null
  // R10's two lists are rendered unguarded, so a plan without them is not a plan
  // we can draw — it is recomputed instead (R13 makes that free).
  if (!isRecord(value.why)) return null
  const why = value.why as Record<string, unknown>
  if (!Array.isArray(why.reasons) || why.reasons.length < 3) return null
  if (!Array.isArray(why.rejected) || why.rejected.length < 1) return null
  for (const day of value.days) {
    if (!isRecord(day)) return null
    if (str(day.label) === null || !Array.isArray(day.experiences)) return null
  }
  return value as unknown as Plan
}

function narrowRestore(value: unknown): Restore | null {
  if (!isRecord(value)) return null
  const key = str(value.key)
  const label = str(value.label)
  if (key === null || label === null) return null
  return {
    key: key as Restore['key'],
    label,
    costDelta: int(value.costDelta),
    total: int(value.total),
  }
}

function narrowRelaxation(value: unknown): Relaxation | null {
  if (!isRecord(value)) return null
  const banner = str(value.banner)
  if (banner === null || !Array.isArray(value.droppedKeys)) return null
  const restore = narrowRestore(value.restore)
  if (restore === null) return null
  const droppedKeys = value.droppedKeys.filter((key): key is string => typeof key === 'string')
  return { droppedKeys: droppedKeys as Relaxation['droppedKeys'], banner, restore }
}

function narrowPlanSet(value: unknown, catalogueVersion: string): PlanSet | null {
  if (!isRecord(value)) return null
  // An old plan ID against a new catalogue would be a lie (docs/02-architecture.md §5).
  if (str(value.catalogueVersion) !== catalogueVersion) return null
  const recommended = narrowPlan(value.recommended)
  if (recommended === null) return null
  const defaulted = int(value.defaultedQuestions) ?? 0
  const saver = narrowPlan(value.saver)
  const stretch = narrowPlan(value.stretch)
  return {
    recommended,
    saver,
    stretch,
    // An alternative we could not narrow leaves its slot with a sentence rather
    // than the empty box R11 explicitly forbids.
    saverAbsentReason:
      saver === null ? (str(value.saverAbsentReason) ?? SAVER_ABSENT_REASON) : null,
    stretchAbsentReason:
      stretch === null ? (str(value.stretchAbsentReason) ?? STRETCH_ABSENT_REASON) : null,
    relaxation: narrowRelaxation(value.relaxation),
    defaultedQuestions: defaulted,
    catalogueVersion,
    snapshotDate: str(value.snapshotDate) ?? '',
    candidatesEvaluated: int(value.candidatesEvaluated) ?? 0,
    excluded: Array.isArray(value.excluded)
      ? value.excluded.flatMap((entry) => {
          if (!isRecord(entry)) return []
          const id = str(entry.id)
          const name = str(entry.name)
          return id === null || name === null ? [] : [{ id, name }]
        })
      : [],
  }
}

export function readSession(catalogueVersion: string): ReadResult {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[compass] E-STORAGE-READ', error)
    return { session: null, available: false }
  }
  if (raw === null) return { session: null, available: true }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.warn('[compass] E-STORAGE-SCHEMA', error)
    clearSession()
    return { session: null, available: true }
  }

  if (!isRecord(parsed) || parsed.schema !== SCHEMA_VERSION) {
    console.warn('[compass] E-STORAGE-SCHEMA', 'unexpected schema')
    clearSession()
    return { session: null, available: true }
  }

  const phase = str(parsed.phase)
  const vibe = parsed.vibe
  const variant = str(parsed.selectedVariant)

  const session: PersistedSession = {
    schema: SCHEMA_VERSION,
    catalogueVersion: str(parsed.catalogueVersion) ?? '',
    phase: phase !== null && (PHASES as readonly string[]).includes(phase) ? (phase as Phase) : 'vibe',
    vibe: isVibe(vibe) ? vibe : null,
    basics: narrowBasics(parsed.basics),
    answers: narrowAnswers(parsed.answers),
    selectedVariant:
      variant !== null && (VARIANTS as readonly string[]).includes(variant)
        ? (variant as PlanVariant)
        : 'recommended',
    planSet: narrowPlanSet(parsed.planSet, catalogueVersion),
    excluded: Array.isArray(parsed.excluded)
      ? parsed.excluded.filter((id): id is string => typeof id === 'string')
      : [],
    pinnedDestinationId: str(parsed.pinnedDestinationId),
  }

  // A pin that names a destination not actually in this session's plan set is
  // untrustworthy (tampering, or a plan that failed to narrow) — dropped rather
  // than risking a pin pointing at nothing.
  if (session.pinnedDestinationId !== null) {
    const known = session.planSet === null
      ? []
      : [
          session.planSet.recommended.destinationId,
          session.planSet.saver?.destinationId,
          session.planSet.stretch?.destinationId,
        ]
    if (!known.includes(session.pinnedDestinationId)) session.pinnedDestinationId = null
  }

  // A phase that its own data cannot support is walked back rather than rendered.
  if (session.vibe === null) return { session: null, available: true }
  if (session.basics === null && session.phase !== 'vibe') session.phase = 'basics'
  // A plan we could not trust is recomputed, not thrown away: R13 guarantees
  // the recomputation is identical whenever the catalogue version still matches.
  if (session.planSet === null && session.phase === 'plan') session.phase = 'generating'

  return { session, available: true }
}

export function writeSession(session: PersistedSession): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch (error) {
    console.warn('[compass] E-STORAGE-WRITE', error)
    return false
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[compass] E-STORAGE-CLEAR', error)
  }
}
