/**
 * Pure domain types. Nothing in src/domain/ may import from ui/, app/, storage/ or
 * data/, or touch window, document, localStorage, fetch, Date.now, new Date,
 * Math.random, crypto or Intl. Enforced by the ESLint override in eslint.config.js
 * and guarded by tests/eslint-domain-purity.test.ts.
 *
 * Types are added here as the slices that need them land (docs/02-architecture.md §3).
 */

// ---------------------------------------------------------------- primitives

/** INTEGER rupees. Never a float, never paise (docs/02-architecture.md §0.3). */
export type Rupees = number

/** 'YYYY-MM-DD', UTC-interpreted, never a Date object. */
export type ISODate = string

/** docs/02-architecture.md §3 — the six vibes of R1. */
export type Vibe = 'mountains' | 'beach' | 'party' | 'honeymoon' | 'peace' | 'culture'

/** docs/02-architecture.md §4.2 — there is no router; the phase is the screen. */
export type Phase = 'vibe' | 'basics' | 'question' | 'generating' | 'plan'

export type Region = 'domestic' | 'international'

export type OriginCity =
  | 'Mumbai'
  | 'Delhi'
  | 'Bengaluru'
  | 'Chennai'
  | 'Kolkata'
  | 'Hyderabad'

export const ORIGIN_CITIES: readonly OriginCity[] = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Hyderabad',
]

export type StayTier = 'saver' | 'standard' | 'premium'

export const STAY_TIERS: readonly StayTier[] = ['saver', 'standard', 'premium']

/**
 * docs/02-architecture.md §3 lists thirteen tags. Six more are added here — the
 * geography the decision graph actually branches on (`Which coast are you drawn
 * to?` has three answers and none of them could be expressed with the original
 * list). Recorded in docs/02-architecture.md §12 Deviations.
 */
export type DestinationTag =
  | 'coast'
  | 'mountain'
  | 'city'
  | 'lively'
  | 'quiet'
  | 'nightlife'
  | 'romantic'
  | 'heritage'
  | 'food'
  | 'resort-comfort'
  | 'local-stays'
  | 'short-haul'
  | 'long-haul'
  | 'west-coast'
  | 'east-coast'
  | 'islands'
  | 'himalaya'
  | 'northeast'
  | 'backwater'

// ------------------------------------------------------------------ catalogue

export interface CatalogueMeta {
  /** '2026-08-01' — part of every plan ID (R13). */
  version: string
  /** Rendered in the provenance line (R16). */
  snapshotDate: ISODate
  currency: 'INR'
  destinationCount: number
}

export interface Fare {
  /** Return fare, both legs, per adult traveller. */
  perPerson: Rupees
  /** One-way duration; drives the long-haul / under-6-hours branch (R4). */
  hours: number
  mode: 'flight' | 'train' | 'road'
}

/**
 * R7 (amended, fix 9) — the town a plan is actually centred on. A destination is a
 * label; a base is a place with a hotel in it, and everything the plan schedules is
 * within `MAX_MINUTES_FROM_BASE` of it.
 */
export interface BaseTown {
  id: string
  /** 'Fort Kochi' — named in the plan header. */
  name: string
}

export interface Stay {
  id: string
  /** R7 requires the property to be named on screen. */
  name: string
  tier: StayTier
  pricePerRoomPerNight: Rupees
  /** A7: one room per two travellers, rounded up. */
  roomCapacity: 2
  /** Which of the destination's bases this property sits in (fix 9). */
  baseId: string
  tags: readonly DestinationTag[]
}

/**
 * 0 = Sunday … 6 = Saturday. Structured, so the scheduler can read it: the day of
 * the week used to live in the blurb prose, where nothing could enforce it (fix 1).
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Experience {
  id: string
  /** R7: every day block names at least one. */
  name: string
  /** One sentence, shown under the name. */
  blurb: string
  slot: 'morning' | 'afternoon' | 'evening'
  /** 0 is legal (a walk, a beach). */
  pricePerPerson: Rupees
  durationHours: number
  tags: readonly DestinationTag[]
  /** Low-priority filler, dealt last. Never dealt twice (fix 6). */
  repeatable: boolean
  /** The base town this sits in (fix 9). */
  baseId: string
  /** Travel time from that base. Over 90 and the plan will not schedule it. */
  minutesFromBase: number
  /** null = any day. Otherwise the ONLY weekday it may be scheduled on (fix 1). */
  fixedWeekday: Weekday | null
}

export type VibeAffinity = 0 | 1 | 2 | 3 | 4 | 5

export interface Destination {
  id: string
  name: string
  country: string
  region: Region
  /** One or more towns a plan can be based in. The stay picks one (fix 9). */
  bases: readonly BaseTown[]
  /** Integer only — floats break tie-breaks. */
  vibeAffinity: Readonly<Record<Vibe, VibeAffinity>>
  tags: readonly DestinationTag[]
  minNights: number
  maxNights: number
  /** Food + transfers, the fourth line item. */
  localAllowancePerPersonPerDay: Rupees
  /** All six origins, no optionals. */
  fares: Readonly<Record<OriginCity, Fare>>
  /** Exactly 3, one per tier. */
  stays: readonly Stay[]
  /** >= 10 non-repeatable + >= 2 repeatable (invariant C3). */
  experiences: readonly Experience[]
}

/**
 * What `generatePlanSet` is handed. It is deliberately the snapshot and not the
 * `TravelDataSource` that produced it: that one choice is what lets the source
 * become async later without the engine changing at all (docs/02-architecture.md §4.1).
 */
export interface CatalogueSnapshot {
  meta: CatalogueMeta
  destinations: readonly Destination[]
}

// ------------------------------------------------------------------- session

export interface Basics {
  startDate: ISODate
  endDate: ISODate
  budget: Rupees
  /** adults + children.length. Kept as the party size every requirement quotes. */
  travellers: number
  /** R24 (fix 10) — priced at the full adult rate. */
  adults: number
  /** R24 (fix 10) — ages, 2–11. One entry per child; they occupy a room place. */
  children: readonly number[]
  origin: OriginCity
  /** R21 (fix 6) — leave exactly one middle day with nothing scheduled. */
  freeDay: boolean
}

// ------------------------------------------------------------- question graph

export type QuestionId = string
export type OptionId = string

export interface QuestionOption {
  id: OptionId
  label: string
  description: string
  /** null => this option ends the questionnaire. */
  next: QuestionId | null
  /** [] for 'No preference'. */
  constraints: readonly ConstraintSpec[]
  /** Soft signal into scoring. */
  preferTags: readonly DestinationTag[]
}

export interface QuestionNode {
  id: QuestionId
  /** R4 asserts substrings: 'long-haul', 'coast'. */
  prompt: string
  /** MUST include an option with id 'no-preference'. */
  options: readonly QuestionOption[]
  /** What "Plan my trip now" fills in (R5). */
  defaultOptionId: OptionId
}

export interface QuestionGraph {
  /** The first adaptive question depends on the vibe. */
  entry: Readonly<Record<Vibe, QuestionId>>
  nodes: Readonly<Record<QuestionId, QuestionNode>>
}

export type Answers = Readonly<Record<QuestionId, OptionId>>

/** Effective, on-path answers, in path order. */
export type AnswerPairs = ReadonlyArray<readonly [QuestionId, OptionId]>

// ---------------------------------------------------------------- constraints

export type ConstraintKey =
  | 'budget'
  | 'dates'
  | 'travellers'
  | 'vibe'
  | 'region'
  | `q:${QuestionId}`

export interface ConstraintSpec {
  key: ConstraintKey
  /** 'international', 'under 6 hours in the air'. */
  label: string
  /** LOWER = more important = dropped LAST. */
  priority: number
  test: (d: Destination, ctx: PlanContext) => boolean
  /** The clause used in the R14 banner. */
  relaxNote: string
  /**
   * Why a destination this constraint excluded was rejected, in the user's terms
   * and ALWAYS carrying a numeral — R10 requires the rejected line to contain one
   * ('11h in the air, and you asked for under 6 hours').
   */
  rejectNote: (d: Destination, ctx: PlanContext) => string
}

/**
 * What re-applying the dropped constraint would cost (R14). `total` is the party
 * total of the best plan that honours it again; both are null when the catalogue
 * has nothing at all with the constraint back on.
 */
export interface Restore {
  key: ConstraintKey
  /** 'international' — the words the banner's button uses. */
  label: string
  /** Signed: positive = re-applying it costs more. */
  costDelta: Rupees | null
  total: Rupees | null
}

export interface Relaxation {
  droppedKeys: readonly ConstraintKey[]
  /** 'No international party trip fits ₹25,000 for 4 — we searched within India instead'. */
  banner: string
  restore: Restore
}

// -------------------------------------------------------------------- pricing

export interface PlanContext {
  vibe: Vibe
  origin: OriginCity
  startDate: ISODate
  endDate: ISODate
  nights: number
  /** nights + 1. */
  days: number
  travellers: number
  adults: number
  /** Ages, 2–11 (R24). */
  children: readonly number[]
  /** ceil(travellers / 2) — children occupy a room place (R24). */
  rooms: number
  budget: Rupees
  freeDay: boolean
  /** R23 (fix 8) — the calendar is an input to the price. */
  season: Season
  preferTags: readonly DestinationTag[]
}

// --------------------------------------------------------------------- season

export type SeasonId = 'peak' | 'off' | 'standard'

/** R23 — a named window with a signed percentage applied to stay and travel. */
export interface Season {
  id: SeasonId
  /** 'Peak season (25 Dec – 2 Jan)'. */
  label: string
  /** Signed integer percent: +35, -20, 0. */
  loadingPercent: number
  /** 'Peak season (25 Dec – 2 Jan): +35% on stay and travel'. */
  line: string
}

export interface CostBreakdown {
  travel: Rupees
  stay: Rupees
  experiences: Rupees
  localAllowance: Rupees
  /** R23 — signed seasonal loading on stay and travel. Its own visible line. */
  seasonal: Rupees
  /** The five lines, added — computed, never stored twice. */
  partyTotal: Rupees
  /** round(partyTotal / travellers / 100) * 100. */
  perPerson: Rupees
  /** A7: rendered as words next to each line, so nobody has to infer it. */
  basis: {
    travel: string
    stay: string
    experiences: string
    localAllowance: string
    seasonal: string
    perPerson: string
  }
}

// ------------------------------------------------------------------ itinerary

export interface TravelLeg {
  kind: 'outbound' | 'return'
  mode: Fare['mode']
  hours: number
  perPerson: Rupees
  date: ISODate
  from: string
  to: string
}

export interface DayBlock {
  day: number
  /** 'Day 1'. */
  label: string
  /** 'Sat 10 Oct'. */
  dateLabel: string
  date: ISODate
  experiences: readonly Experience[]
  legs: readonly TravelLeg[]
  /** 'Check in — Brunton Boatyard' / '5 nights, 1 room' on the first and last day. */
  stayEntry: { label: string; detail: string } | null
  /** R21 — 'Nothing scheduled — this day is yours' on a day with no experiences. */
  note: string | null
}

/**
 * R18 (fix 1) — an experience the plan could not place honestly, and why. Rendered
 * under the itinerary, never silently swallowed.
 */
export interface UnscheduledNote {
  experienceId: string
  experienceName: string
  /** 'Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday'. */
  line: string
}

// --------------------------------------------------------------------- plans

export type PlanVariant = 'recommended' | 'saver' | 'stretch'

export type BudgetStatus = 'within' | 'on-budget' | 'stretch' | 'no-fit'

export interface BudgetLine {
  status: BudgetStatus
  /** Signed: positive = under budget. */
  delta: Rupees
  label: string
}

/** R10 — one reason, quoting one of the user's own answers back at them. */
export interface Reason {
  text: string
  /** The user's own answer label, so the UI can prove the quote is theirs. */
  quotes: string
  /**
   * R19 — false when this plan could NOT honour the answer it quotes. That is the
   * fact the change notice names on the headline instead of leaving it three
   * scrolls down (customer fix 3).
   */
  held: boolean
}

/** R10 — a named runner-up. `line` MUST contain a numeral. */
export interface Rejection {
  destinationName: string
  line: string
}

export interface Why {
  /** Always >= 3 (docs/02-architecture.md §4.8 rule 7). */
  reasons: readonly Reason[]
  /** Always >= 1, computed against all 14 destinations, not just the survivors. */
  rejected: readonly Rejection[]
}

export interface Plan {
  /** Visible on screen (R13). */
  planId: string
  variant: PlanVariant
  destinationId: string
  destinationName: string
  country: string
  region: Region
  startDate: ISODate
  endDate: ISODate
  nights: number
  travellers: number
  adults: number
  /** Count of children, ages 2–11 (R24). */
  children: number
  origin: OriginCity
  /** The town this plan books and schedules around (R7 amended). */
  baseName: string
  stay: {
    id: string
    name: string
    tier: StayTier
    nights: number
    rooms: number
    pricePerRoomPerNight: Rupees
    baseName: string
  }
  legs: readonly [TravelLeg, TravelLeg]
  days: readonly DayBlock[]
  /** R18 — what we would not put on a day that contradicts it. */
  unscheduled: readonly UnscheduledNote[]
  cost: CostBreakdown
  budget: BudgetLine
  why: Why
  score: number
}

export interface PlanSet {
  recommended: Plan
  /** R11 — total <= 90% of the recommendation, or null with a sentence instead. */
  saver: Plan | null
  /** R11 — dearer than the recommendation but inside budget x 1.25. */
  stretch: Plan | null
  /** 'No cheaper option in this catalogue for these dates' when `saver` is null. */
  saverAbsentReason: string | null
  /** 'No pricier option that still stays inside your stretch band'. */
  stretchAbsentReason: string | null
  relaxation: Relaxation | null
  /** R5: '3 questions answered for you'. */
  defaultedQuestions: number
  catalogueVersion: string
  snapshotDate: ISODate
  candidatesEvaluated: number
  /** R22 (fix 7) — destinations the user turned down, in the order they did. */
  excluded: readonly { id: string; name: string }[]
}

export interface PlanInput {
  vibe: Vibe
  basics: Basics
  /** Effective, on-path, in path order. */
  answers: AnswerPairs
  /**
   * R14's restore control: keys the relaxation ladder is forbidden to drop. Part of
   * the plan ID hash, so a restored plan is a different plan and says so.
   */
  forceConstraints?: readonly ConstraintKey[]
  /**
   * R22 — destinations the user has rejected. Part of the plan ID hash, so
   * 'somewhere else' is genuinely a different plan.
   */
  excludeDestinationIds?: readonly string[]
  /**
   * R11/R12 — a destination the user hand-picked (by choosing the Saver/Stretch
   * alternative, or by what survived a "Not this one" reject). When it can still
   * be scheduled, it is what `recommended` names — never silently replaced by
   * whatever the unconstrained engine would otherwise pick. Part of the plan ID
   * hash, so two different hand-picked plans with the same answers are two
   * different plan IDs.
   */
  pinnedDestinationId?: string
}
