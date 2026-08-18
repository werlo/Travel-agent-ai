# Architecture — Compass

**Author:** Tech Lead · **Reviews:** `01-prd.md` · **Slug:** `trip-planner` · **Port:** 4079 · **Date:** 2026-08-18

---

## 0. The three decisions everything else follows from

1. **The planner is a pure function.** `generatePlanSet(input, catalogue) -> PlanSet`
   with no clock, no randomness, no network, no floating point. R13 is not a feature
   bolted on at the end; it is the reason the domain layer is allowed to import
   nothing. Every other requirement is either input to that function or a rendering
   of its output.
2. **The catalogue is data behind an interface, not a module the engine knows.**
   `TravelDataSource` is the seam the PRD's E1 promised. In the MVP it is satisfied by
   a date-stamped JSON snapshot compiled into the bundle. The engine never learns
   where a fare came from.
3. **Money is integer rupees, end to end.** No paise, no floats, no `toFixed`. R8
   demands four line items that sum *exactly* to the total; the cheapest way to
   guarantee that forever is to never introduce a value that can drift.

---

## 1. Stack

| Layer | Choice | Why | What we would use instead at 100× |
|---|---|---|---|
| Language | TypeScript 5.x, `strict: true`, `noUncheckedIndexedAccess: true` | House stack. The extra flag matters here: the itinerary builder indexes into experience arrays constantly and a silent `undefined` becomes a blank day block. | Same |
| UI | React 18 + Vite 5 | House stack. Vite serves 4079 with no config; Playwright drives it. | Same; add route-level code splitting |
| Routing | None — a phase enum in one reducer | Six screens, one linear flow, and R15 requires restoring a *phase*, not a URL. A router would add a second source of truth for "where am I" and a URL that leaks answers into history. | React Router once plans get shareable URLs |
| Styling | Plain CSS + custom properties, one `tokens.css` from the Designer | House stack. No build-time magic, no runtime cost, designer owns the tokens verbatim. | Same |
| State | One `useReducer` + context (`SessionProvider`) | Exactly one shared store. The house stack says Zustand past ~3 stores; we have 1. | Zustand if a second store (e.g. saved-plan history) appears |
| Persistence | `localStorage`, single versioned key | House stack, and A10. No accounts, no server, R15 satisfied by ~16 KB of JSON (measured, §7). | IndexedDB only if we start storing plan history |
| Data | Static JSON catalogue compiled in, behind `TravelDataSource` | E1: no key-less aggregator API exists and the sandbox forbids live third-party calls. | Fetch a sharded catalogue index over HTTP (§7) |
| Money formatting | Hand-written Indian digit grouping in `domain/money.ts` | **Deliberate deviation from the obvious choice.** `Intl.NumberFormat('en-IN')` output depends on the runtime's ICU build; Vitest runs in Node 22 and E2E runs in Chromium, and R13/R8 assert on *exact strings* like `₹8,400`. 12 lines of pure code removes a whole class of cross-runtime flake. | Same |
| Unit tests | Vitest + Testing Library + jsdom | House stack | Same |
| E2E | Playwright (Chromium), browsers preinstalled at `/opt/pw-browsers` | House stack. **Never run `npx playwright install`**; set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if npm tries. | Same |
| Server | None | Nothing needs one. A static bundle is the smallest thing that satisfies all 17 requirements. | A CDN + a versioned catalogue endpoint (§7) |

**Deviations from `docs/agency/house-stack.md`:** one, the money formatter above. The
five scripts are untouched.

### The five scripts (exact)

```jsonc
{
  "scripts": {
    "dev":   "vite --port 4079 --strictPort",
    "build": "tsc -b --noEmit false && vite build",
    "test":  "vitest run",
    "e2e":   "playwright test",
    "lint":  "eslint . --max-warnings=0 && tsc --noEmit"
  }
}
```

`playwright.config.ts` is the house config verbatim with two changes, both required:

```ts
const PORT = Number(process.env.PORT ?? 4079)          // the port in .agency/state.json
use: {
  baseURL: `http://localhost:${PORT}`,
  permissions: ['clipboard-read', 'clipboard-write'],   // R17 asserts "Copied"; without
  trace: 'retain-on-failure',                           // this the clipboard write rejects
  screenshot: 'only-on-failure',                        // in headless Chromium
}
webServer: { command: `npm run dev -- --port ${PORT}`, url: `http://localhost:${PORT}`,
             reuseExistingServer: true, timeout: 120_000 }
```

---

## 2. Module map

```
products/trip-planner/
├── e2e/                          # QA territory. Never imported by src.
├── src/
│   ├── main.tsx                  # mount only
│   ├── App.tsx                   # phase switch + persistent chrome (SummaryBar, ProvenanceLine)
│   ├── app/                      # impure edges: clock, storage wiring, React plumbing
│   │   ├── sessionReducer.ts     # the ONE store
│   │   ├── SessionProvider.tsx   # context + persistence effect + clock injection
│   │   └── selectors.ts          # derived view state (effective answers, path, progress)
│   ├── domain/                   # PURE. The whole product's intelligence.
│   │   ├── types.ts              # every type in §3/§4
│   │   ├── money.ts              # Rupees maths + Indian grouping
│   │   ├── dates.ts              # UTC-only ISO date maths
│   │   ├── hash.ts               # FNV-1a 32-bit -> plan ID
│   │   ├── validate.ts           # basics validation (R3)
│   │   ├── questions/
│   │   │   ├── graph.ts          # the decision graph, as data (R4)
│   │   │   └── path.ts           # derivePath / projectedLength / effectiveAnswers (R4, R6)
│   │   ├── constraints.ts        # answers -> constraints + relaxation order (R14)
│   │   ├── pricing.ts            # the four line items (R8)
│   │   ├── scoring.ts            # destination fit score
│   │   ├── itinerary.ts          # day blocks, stay, legs (R7)
│   │   ├── explain.ts            # why + rejected runners-up (R10)
│   │   ├── budget.ts             # budget line + Saver/Stretch selection (R9, R11)
│   │   ├── export.ts             # plan -> plain text (R17)
│   │   └── planner.ts            # generatePlanSet: the entry point
│   ├── data/
│   │   ├── TravelDataSource.ts   # the interface (E1 seam)
│   │   ├── localCatalogue.ts     # implements it from the JSON snapshot
│   │   └── catalogue/            # destinations.json, fares.json, meta.json
│   ├── storage/sessionStore.ts   # localStorage read/write/clear, schema-versioned
│   ├── ui/
│   │   ├── screens/              # VibeScreen, BasicsScreen, QuestionScreen,
│   │   │                         # GeneratingScreen, PlanScreen, ExportDialog
│   │   ├── components/           # SummaryBar, ProvenanceLine, CostBreakdown, DayBlock,
│   │   │                         # WhyThisTrip, Alternatives, AdjustPanel, RelaxBanner,
│   │   │                         # FieldError, Card
│   │   └── format.ts             # presentation strings that are NOT asserted by R2/R8/R9
│   └── styles/tokens.css         # Designer's tokens, verbatim
└── tests/                        # unit + integration (Vitest)
```

**Dependency direction:** `ui → app → domain`, `data → domain` (types only),
`storage → domain` (types only). Arrows never reverse.

**The one rule that must not be broken:** *nothing under `src/domain/` may import from
`ui/`, `app/`, `storage/` or `data/`, and may not reference `window`, `document`,
`localStorage`, `fetch`, `Date.now`, `new Date()`, `Math.random`, `crypto` or `Intl`.*
The catalogue is passed **in** as an argument, never imported. Enforced mechanically,
not by trust — an ESLint override on `src/domain/**`:

```js
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: ['**/ui/**','**/app/**','**/storage/**','**/data/**','react*'] }],
    'no-restricted-globals': ['error','window','document','localStorage','fetch','Intl','crypto'],
    'no-restricted-properties': ['error',
      { object: 'Date', property: 'now' }, { object: 'Math', property: 'random' }],
    'no-restricted-syntax': ['error',
      { selector: "NewExpression[callee.name='Date']", message: 'domain/ is pure: pass dates in as ISO strings' }]
  }
}
```

If that override is ever deleted to make something compile, R13 is dead and nobody
will notice for three slices. It is the single highest-value line in this document.

---

## 3. Data model

Everything at rest is either (a) the catalogue, compiled into the bundle and read-only,
or (b) one `localStorage` key. There is no third place.

```ts
// ---------- primitives ----------
export type Rupees = number          // INTEGER rupees. Never a float, never paise.
export type ISODate = string         // 'YYYY-MM-DD', UTC-interpreted, never a Date object
export type Vibe = 'mountains' | 'beach' | 'party' | 'honeymoon' | 'peace' | 'culture'
export type Region = 'domestic' | 'international'
export type OriginCity = 'Mumbai' | 'Delhi' | 'Bengaluru' | 'Chennai' | 'Kolkata' | 'Hyderabad'
export type StayTier = 'saver' | 'standard' | 'premium'
export type DestinationTag =
  | 'coast' | 'mountain' | 'city' | 'lively' | 'quiet' | 'nightlife' | 'romantic'
  | 'heritage' | 'food' | 'resort-comfort' | 'local-stays' | 'short-haul' | 'long-haul'

// ---------- catalogue (read-only, versioned, at rest in src/data/catalogue/*.json) ----------
export interface CatalogueMeta {
  version: string          // '2026-08-01' — part of every plan ID (R13)
  snapshotDate: ISODate    // rendered in the provenance line (R16)
  currency: 'INR'
  destinationCount: number
}

export interface Fare {
  perPerson: Rupees        // return fare, both legs, per adult traveller
  hours: number            // one-way duration; drives the long-haul / <6h branch (R4)
  mode: 'flight' | 'train' | 'road'
}

export interface Stay {
  id: string
  name: string             // R7 requires the property to be named on screen
  tier: StayTier
  pricePerRoomPerNight: Rupees
  roomCapacity: 2          // A7: one room per two travellers, rounded up
  tags: DestinationTag[]
}

export interface Experience {
  id: string
  name: string             // R7: every day block names at least one
  blurb: string            // one sentence, shown under the name
  slot: 'morning' | 'afternoon' | 'evening'
  pricePerPerson: Rupees   // 0 is legal (a walk, a beach)
  durationHours: number
  tags: DestinationTag[]
  repeatable: boolean      // fillers for long trips; see itinerary rule in §4
}

export interface Destination {
  id: string                                  // 'in-varkala'
  name: string                                // 'Kochi & Varkala'
  country: string
  region: Region
  vibeAffinity: Record<Vibe, 0|1|2|3|4|5>     // integer only — floats break tie-breaks
  tags: DestinationTag[]
  minNights: number
  maxNights: number
  localAllowancePerPersonPerDay: Rupees       // food + transfers, the 4th line item
  fares: Record<OriginCity, Fare>             // all six origins, no optionals
  stays: Stay[]                               // exactly 3, one per tier
  experiences: Experience[]                   // >= 10 unique + >= 2 repeatable (see §4)
}
```

**Catalogue invariants** (each is a unit test in slice 2, not a comment):

| # | Invariant | Why |
|---|---|---|
| C1 | 14 destinations: 6 `domestic`, 8 `international` | A1 |
| C2 | Every `vibe × region × budget-band` cell is served by ≥ 2 destinations | PRD risk: "it always sends me to Goa" |
| C3 | Every destination has all 6 origins in `fares`, 3 stays (one per tier), ≥ 10 non-repeatable and ≥ 2 repeatable experiences | R7 must fill 2 experiences/day for a 6-day trip = 10 |
| C4 | `minNights ≤ maxNights`, `1 ≤ minNights`, `maxNights ≤ 21` | R3 caps the trip at 21 nights |
| C5 | No string anywhere in the catalogue matches `/\b(book\|pay\|checkout\|reserve)\b/i` | R16 bans those accessible names; an experience called "Bookshop crawl" would fail QA and nobody would guess why |
| C6 | All `Rupees` fields are non-negative integers | The exact-sum guarantee in R8 |

**Session at rest** — one key, `compass.session.v1`:

```ts
export interface PersistedSession {
  schema: 1                       // mismatch => clear and restart at the vibe screen (A10)
  catalogueVersion: string        // mismatch => discard the cached plan, keep the answers
  phase: Phase
  vibe: Vibe | null
  basics: Basics | null
  answers: Record<QuestionId, OptionId>   // INCLUDING answers now off-path (see R6 below)
  selectedVariant: PlanVariant
  planSet: PlanSet | null         // cached so a reload re-renders, never regenerates (R15)
}
```

Note `answers` keeps off-path answers. That is the R6 mechanism: an answer the user
gave, then orphaned by changing question 2, is remembered so that changing back
restores it — but it is excluded from `effectiveAnswers`, from planning and from the
plan ID. Storage remembers more than the engine sees, on purpose.

---

## 4. Contracts

The developer implements against these signatures. Where the acceptance criterion
asserts an exact string, the string is given here.

### 4.1 The data seam (E1)

```ts
// src/data/TravelDataSource.ts
export interface CatalogueSnapshot {
  meta: CatalogueMeta
  destinations: readonly Destination[]
}

export interface TravelDataSource {
  /** Synchronous in v1 (bundled JSON). Async in the aggregator adapter — see §7. */
  load(): CatalogueSnapshot
}
```

`generatePlanSet` takes a `CatalogueSnapshot`, never a `TravelDataSource`. That one
choice is what lets the source become async later without the engine changing at all.

### 4.2 Session state machine

```ts
export type Phase = 'vibe' | 'basics' | 'question' | 'generating' | 'plan'

export interface Basics {
  startDate: ISODate; endDate: ISODate
  budget: Rupees; travellers: number; origin: OriginCity
}

export type SessionAction =
  | { type: 'selectVibe'; vibe: Vibe }
  | { type: 'submitBasics'; basics: Basics }        // pre-validated by the screen
  | { type: 'answerQuestion'; questionId: QuestionId; optionId: OptionId }
  | { type: 'back' }
  | { type: 'skipToplan' }                          // R5
  | { type: 'planReady'; planSet: PlanSet }
  | { type: 'selectVariant'; variant: PlanVariant } // R11
  | { type: 'adjust'; budget: Rupees; travellers: number } // R12
  | { type: 'toggleRelaxedConstraint'; key: ConstraintKey } // R14
  | { type: 'restore'; session: PersistedSession }  // R15
  | { type: 'startOver' }                           // R15

export interface SessionState extends Omit<PersistedSession, 'schema' | 'catalogueVersion'> {
  errors: Record<string, string>   // field name -> message, basics only (R3)
}
```

The reducer is pure and unit-tested directly. `SessionProvider` owns the only two
impure things in the app: reading `new Date()` once for the basics defaults, and the
`useEffect` that writes `PersistedSession` to `localStorage`.

### 4.3 Validation (R3)

```ts
export type BasicsErrors = Partial<Record<keyof Basics, string>>
export function validateBasics(b: Partial<Basics>, today: ISODate): BasicsErrors
```

Exact messages — the acceptance criteria quote two of them:

| Condition | Field | Message |
|---|---|---|
| `endDate <= startDate` | `endDate` | `End date must be after your start date` |
| nights > 21 | `endDate` | `Trips longer than 21 nights are out of scope for now` |
| budget non-numeric or < 5000 | `budget` | `Enter a budget of at least ₹5,000` |
| travellers < 1 or > 12 | `travellers` | `Enter between 1 and 12 travellers` |
| origin not in the six | `origin` | `Choose a departure city from the list` |

Each error renders in an element whose `id` is `${field}-error` and the input carries
`aria-describedby="${field}-error"` **only while the error is present** (R3). Validation
runs on submit and on blur — never on keystroke (see §7, render path).

### 4.4 The question graph (R4, R5, R6)

Data, not code. Branching lives in `option.next`, so a path is a walk, and re-deriving
after an edit is the same walk with no special case.

```ts
export type QuestionId = string
export type OptionId = string

export interface QuestionOption {
  id: OptionId
  label: string
  next: QuestionId | null              // null => this option ends the questionnaire
  constraints: ConstraintSpec[]        // [] for 'No preference'
  preferTags?: DestinationTag[]        // soft signal into scoring
}

export interface QuestionNode {
  id: QuestionId
  prompt: string                       // R4 asserts substrings: 'long-haul', 'coast'
  options: QuestionOption[]            // MUST include an option with id 'no-preference'
  defaultOptionId: OptionId            // what "Plan my trip now" fills in (R5)
}

export interface QuestionGraph {
  entry: Record<Vibe, QuestionId>      // the first adaptive question depends on the vibe
  nodes: Record<QuestionId, QuestionNode>
}

// path.ts — all pure, all trivially unit-testable
export function derivePath(graph: QuestionGraph, vibe: Vibe, answers: Record<QuestionId, OptionId>): QuestionId[]
export function projectedLength(graph: QuestionGraph, vibe: Vibe, answers: Record<QuestionId, OptionId>): number
export function effectiveAnswers(path: QuestionId[], answers: Record<QuestionId, OptionId>): Array<[QuestionId, OptionId]>
export function defaultedCount(graph: QuestionGraph, vibe: Vibe, answers: Record<QuestionId, OptionId>): number
```

- `derivePath` walks `entry[vibe]` → `answers[q]` → `option.next`, stopping at the first
  unanswered question or at `next === null`. The last element is the question on screen.
- `projectedLength` continues the walk past the current question using each node's
  `defaultOptionId`. This is the denominator in "Question 2 of 4" (R4). It can change
  when the user picks a branch of a different depth; that is correct behaviour, not a bug.
- `defaultedCount` = `projectedLength - answeredOnPath`, which is the number in
  "3 questions answered for you" (R5).
- **R6 falls out for free:** change question 2's answer, `derivePath` re-walks, question 3
  is whatever the new branch says. Question 1 is upstream of the change and untouched.

**Graph invariant (unit test, slice 2):** for every vibe, every complete root-to-leaf
path has length between 3 and 5, every node has a `no-preference` option whose
`constraints` is `[]`, and `defaultOptionId` resolves. A5 and R4 are then structurally
guaranteed rather than spot-checked.

### 4.5 Constraints and the relaxation ladder (R14)

```ts
export type ConstraintKey =
  | 'budget' | 'dates' | 'travellers' | 'vibe' | 'region' | `q:${QuestionId}`

export interface ConstraintSpec {
  key: ConstraintKey
  label: string                        // 'international', 'under 6 hours in the air'
  priority: number                     // LOWER = more important = dropped LAST
  test: (d: Destination, ctx: PlanContext) => boolean
  relaxNote: string                    // the clause used in the R14 banner
}
```

Priority order is fixed and documented (A9), lowest number first:

| Priority | Key | Dropped? |
|---|---|---|
| 0 | `budget` (the ≤ budget × 1.25 ceiling) | Never — R9 forbids it |
| 1 | `dates` / nights within `[minNights, maxNights]` | Never in the MVP; dropping it would produce an itinerary the destination cannot support |
| 2 | `travellers` (room capacity) | Never — it is arithmetic, not a preference |
| 3 | `vibe` | 4th to drop |
| 4 | `region` | 3rd to drop |
| 5..n | `q:<questionId>`, n increasing with graph depth | **Dropped first, most recent first** |

```ts
export interface Relaxation {
  droppedKeys: ConstraintKey[]
  banner: string     // 'No international party trip fits ₹25,000 for 4 — we searched within India instead'
  restore: { key: ConstraintKey; label: string; costDelta: Rupees | null }
  // costDelta null => re-applying it yields nothing at all in this catalogue
}
```

The ladder: filter → if empty, drop the highest-priority-number constraint → refilter →
repeat. At most `n` iterations, `n ≤ 8`. The `restore` control (R14) re-runs the engine
with that one key forced back on and reports the cost difference in rupees, or says
plainly that nothing exists with it applied.

### 4.6 Pricing (R8) — the exact-sum guarantee

```ts
export interface CostBreakdown {
  travel: Rupees          // fare.perPerson * travellers          (both legs)
  stay: Rupees            // pricePerRoomPerNight * nights * rooms; rooms = ceil(travellers/2)
  experiences: Rupees     // sum(chosen.pricePerPerson) * travellers
  localAllowance: Rupees  // localAllowancePerPersonPerDay * days * travellers; days = nights+1
  partyTotal: Rupees      // travel + stay + experiences + localAllowance — computed, never stored twice
  perPerson: Rupees       // round(partyTotal / travellers / 100) * 100
  basis: {                // A7: rendered as words next to each line, so nobody has to infer it
    travel: string        // 'Return fare × 2 travellers'
    stay: string          // '1 room × 5 nights (1 room per 2 travellers)'
    experiences: string   // '7 experiences × 2 travellers'
    localAllowance: string// 'Food and local transport, ₹1,400 per person per day × 6 days'
  }
}
export function priceCandidate(d: Destination, stay: Stay, chosen: readonly Experience[], ctx: PlanContext): CostBreakdown
```

`partyTotal` is derived by addition at the point of construction and never recomputed
elsewhere; the UI reads the field. Because every input is an integer, R8's "sum exactly"
is arithmetic, not a rounding policy. `perPerson` is the only rounded value and it is
rounded to ₹100 exactly as R8 states — it is a *display* figure and deliberately does
not multiply back to `partyTotal`; the breakdown says so in words.

R8's third clause is satisfied structurally: `travel` is `perPerson × travellers`, so
2 → 4 travellers adds exactly `2 × perPersonFare`.

### 4.7 Itinerary (R7)

```ts
export interface TravelLeg { kind: 'outbound' | 'return'; mode: Fare['mode']; hours: number; perPerson: Rupees; date: ISODate }
export interface DayBlock { day: number; label: string; date: ISODate; experiences: Experience[]; legs: TravelLeg[] }
```

`days = nights + 1`, labels `Day 1` … `Day ${days}`. Day 1 carries the outbound leg,
the last day carries the return leg. Selection is deterministic:

1. Sort experiences by `(tagMatchScore desc, pricePerPerson asc, id asc)` — three keys,
   total order, no ties possible because `id` is unique.
2. Target per day: 1 on the two travel days, 2 on the others when `nights ≤ 7`,
   1 otherwise (a 14-day itinerary of 2 activities a day is a forced march, not a holiday).
3. Deal non-repeatable experiences in sorted order. When they run out — only possible
   past ~10 days — cycle the `repeatable: true` ones in order. Repeatables are priced
   ₹0 and named honestly ("An unplanned morning on the cliff"), so a long trip does not
   invent paid activities that do not exist.

Every day block therefore has ≥ 1 named experience for any trip from 1 to 21 nights,
which is what R7 asserts.

### 4.8 The engine entry point (R9, R10, R11, R13, R14)

```ts
export type PlanVariant = 'recommended' | 'saver' | 'stretch'
export type BudgetStatus = 'within' | 'on-budget' | 'stretch' | 'no-fit'

export interface BudgetLine {
  status: BudgetStatus
  delta: Rupees          // signed: positive = under budget
  label: string          // '₹8,400 under your budget' | 'On budget'
                         // | 'Stretch — 10% over your budget'
                         // | 'Nothing in this catalogue fits ₹25,000 — the closest is ₹41,300'
}

export interface Reason { text: string; quotes: string }   // quotes = the user's own answer label
export interface Rejection { destinationName: string; line: string }  // MUST contain a numeral (R10)

export interface Plan {
  planId: string                 // 'CMP-' + base36 FNV-1a — visible on screen (R13)
  variant: PlanVariant
  destinationId: string
  destinationName: string
  country: string
  region: Region
  startDate: ISODate; endDate: ISODate; nights: number; travellers: number; origin: OriginCity
  stay: { id: string; name: string; tier: StayTier; nights: number; rooms: number }
  legs: [TravelLeg, TravelLeg]
  days: DayBlock[]
  cost: CostBreakdown
  budget: BudgetLine
  why: { reasons: Reason[]; rejected: Rejection[] }   // reasons.length >= 3, rejected.length >= 1
  score: number
}

export interface PlanSet {
  recommended: Plan
  saver: Plan | null
  stretch: Plan | null
  saverAbsentReason: string | null   // 'No cheaper option in this catalogue for these dates'
  stretchAbsentReason: string | null // 'No richer option in this catalogue within your budget'
  relaxation: Relaxation | null
  defaultedQuestions: number         // R5: '3 questions answered for you'
  catalogueVersion: string
  snapshotDate: ISODate
}

export interface PlanInput {
  vibe: Vibe
  basics: Basics
  answers: ReadonlyArray<readonly [QuestionId, OptionId]>  // effective, on-path, sorted by path order
  forceConstraints?: ConstraintKey[]                       // R14 restore control
}

export function generatePlanSet(input: PlanInput, catalogue: CatalogueSnapshot): PlanSet
```

**Selection rules, in order:**

1. Candidates = every `(destination × stayTier)` = 42 in the MVP. Price each.
2. Hard filter: nights in range, room capacity, all active constraints, and
   `total ≤ budget × 1.25`.
3. If empty → relaxation ladder (§4.5). If the ladder exhausts and still nothing is
   within `budget × 1.25`, emit `status: 'no-fit'`: the globally cheapest plan is still
   rendered — never a dead end (R14, and the PRD's "over budget everywhere" branch) —
   but it is labelled as not fitting, with the gap in rupees and the specific change
   that would close it. **This is the only path on which a plan above `budget × 1.25`
   reaches the screen, and it is never labelled "recommended".** R9's guarantee holds
   for every `within` / `on-budget` / `stretch` plan, which is every plan a user with a
   sane budget will ever see. Flagged in §11 as an interpretation.
4. `recommended` = max by `(score desc, total asc, destinationId asc)` — total order.
5. `saver` = highest-scoring candidate with `total ≤ floor(recommended.total × 0.90)`,
   different destination. Otherwise `null` + `saverAbsentReason`.
6. `stretch` = highest-scoring candidate with
   `recommended.total < total ≤ budget × 1.25`, different destination. Otherwise `null`
   + `stretchAbsentReason`.
7. `why.reasons` always has ≥ 3: vibe fit, budget position and trip length are always
   available, plus one per matched adaptive answer (R10).
8. `why.rejected` is computed against **all 14 destinations**, not just survivors, so it
   is never empty. Preference order for the named rejection: (a) highest-scoring
   destination excluded on price → `Bali — ₹18,200 over budget`; (b) excluded by a
   constraint → `Bali — 11 hours in the air, you asked for under 6`; (c) the runner-up
   → `Bali — ₹12,300 more than Varkala`. Every form carries a numeral, as R10 requires.

### 4.9 Determinism (R13)

```ts
export function fnv1a32(s: string): number          // pure, 12 lines, no crypto
export function canonicalise(input: PlanInput, catalogueVersion: string): string
export function planId(input: PlanInput, catalogueVersion: string, variant: PlanVariant): string
// => 'CMP-' + fnv1a32(canonical).toString(36).toUpperCase().padStart(7, '0')
```

`canonicalise` emits a fixed field order, ISO dates as strings, integers as integers,
and answers as on-path ordered pairs. Off-path answers are excluded, so R6's
change-your-mind path cannot leak into the ID. `variant` is in the hash, so R11
(switch to Saver) and R12 (change travellers) both change the plan ID as required.

The full determinism contract, testable in one unit test: **`generatePlanSet` called
twice with deep-equal inputs returns deep-equal output, and contains no `Date`,
`Math.random`, `Intl` or float division.** The ESLint override in §2 is what keeps that
true after the fourth developer touches it.

### 4.10 Export (R17)

```ts
export function toPlainText(plan: Plan, meta: CatalogueMeta): string
```

Destination, date range, party total, one line per day, plus the provenance sentence.
The dialog renders it in a `<textarea readOnly>` and attempts
`navigator.clipboard.writeText`. On resolve, an `aria-live="polite"` region announces
`Copied`. On reject (permission denied, insecure context) it announces
`Select the text above and copy` — the text is on screen either way, so the feature
degrades rather than fails. Playwright grants the permission, so R17's `Copied` is
deterministic in E2E.

---

## 5. Error handling

The rule: nothing is swallowed. Every recovery path is visible either to the user or in
the console with a stable code.

| Failure | Detected where | User sees | System does |
|---|---|---|---|
| Invalid basics (R3) | `validateBasics`, on submit/blur | Inline message next to the field, `aria-describedby` linked, focus moves to the first bad field, screen does not advance | Reducer rejects `submitBasics`; phase unchanged |
| `localStorage` unreadable / quota / private mode | `sessionStore.read()` try-catch | Nothing; the app starts at the vibe screen | `console.warn('[compass] E-STORAGE-READ', err)`; sets `persistenceAvailable=false`; a one-line note appears on the plan screen: "This browser is not saving your session" |
| Stored JSON corrupt or `schema !== 1` | `sessionStore.read()` | Fresh start at the vibe screen | Clears the key, `console.warn('[compass] E-STORAGE-SCHEMA')`. **Never throws** — A10 |
| `catalogueVersion` changed since the session was saved | `SessionProvider` on restore | Answers restored; the plan is recomputed and the plan ID may differ | Discards `planSet`, keeps `answers`. Honest: an old plan ID against a new catalogue would be a lie |
| Answer refers to a `questionId`/`optionId` no longer in the graph | `derivePath` | The questionnaire resumes at the first question it can still reach | Drops the unknown key, `console.warn('[compass] E-GRAPH-ORPHAN', id)` |
| No candidate passes the filters | `planner` | R14 banner naming the dropped constraint + a restore control | Runs the relaxation ladder |
| Nothing fits even after relaxation | `planner` | `no-fit` budget line: cheapest plan, the gap in rupees, and the change that would close it | Renders anyway. **There is no empty state in this product** |
| Catalogue invariant violated (a destination missing a fare) | Build-time unit test (C1–C6) | — | `npm test` fails. This is a build error, not a runtime branch |
| Clipboard write rejected | `ExportDialog` | "Select the text above and copy" in the live region | Text stays on screen |
| Unexpected render throw | `<ErrorBoundary>` around `App` | "Something went wrong. Start over" with a working Start-over button | Logs `[compass] E-RENDER`, offers to clear storage. Prevents a corrupt session from bricking the app permanently |

Two things we deliberately do **not** do: no `catch {}` without a `console.warn` and a
code, and no `try/catch` around `generatePlanSet` — if the pure engine throws, that is a
bug that must be loud, and the boundary above will show it.

---

## 6. Performance budget

| Metric | Budget | Measured how |
|---|---|---|
| First contentful paint (vibe screen, localhost) | ≤ 800 ms | Playwright: `performance.getEntriesByType('paint')` in the slice-1 E2E |
| `generatePlanSet` worst case (21 nights, 12 travellers, full relaxation ladder) | ≤ 20 ms | Vitest, `performance.now()` around 200 iterations; **measured at 0.10 ms today** (§7) |
| Landing → plan on screen, "Plan my trip now" path | ≤ 45 s human time (M1) | Playwright timed run |
| Generating screen duration | 400 ms fixed, ≤ 2 s hard cap | It is an honest beat, not a fake spinner; the work takes < 1 ms |
| Re-plan after Apply (R12) | ≤ 100 ms to painted | Playwright: click → `expect(planId).not.toBe(old)` |
| JS bundle | ≤ 200 KB gzip | `gzip -c dist/assets/*.js \| wc -c` in a test script |
| Catalogue payload | ≤ 20 KB gzip | **Measured: 12.2 KB gzip / 79 KB raw** for a full-fidelity 14-destination catalogue |
| Persisted session | ≤ 32 KB | **Measured: 16.1 KB** (5 nights, 3 variants), **20.4 KB** (21 nights) |
| Console errors, any screen | 0 | QA's console-error check |

---

## 7. Scalability plan

All numbers below are **measured** on this machine unless labelled reasoned. Method:
a generated catalogue of the exact shape in §3 with unique prose in every string
(repeated strings flatter gzip by 10×, which is how people accidentally publish
optimistic payload numbers), and a benchmark loop of the exact shape of
`generatePlanSet` — 3 candidates per destination, four line items priced across
`nights + 1` days, then a full 8-rung relaxation ladder.

```
                       raw        gzip     brotli    JSON.parse
14 destinations      79 KB     12.2 KB    10.7 KB        < 1 ms
1,400 destinations  7.95 MB    1.06 MB     485 KB          61 ms   (measured, Node 22)

generatePlanSet, worst case (main pass + 8-rung ladder):
   14 destinations (   42 candidates):  0.10 ms   measured
  140 destinations (  420 candidates):  0.79 ms   measured
1,400 destinations (4,200 candidates):  9.16 ms   measured
MVP worst case, 14 dests / 21 nights / 12 travellers, single pass: 0.009 ms  measured
```

**The headline, and it is not what a "scale plan" usually says:** compute is not the
bottleneck and will not be for two orders of magnitude. Scoring is O(destinations ×
tiers) with a small constant; even at 1,400 destinations a full re-plan with the entire
relaxation ladder is 9 ms, comfortably inside one frame. Nothing in this design goes
quadratic — the only nested loop is candidates × days, both bounded (4,200 × 22).
**What breaks is the payload, and it breaks on catalogue growth, not user growth**,
because this is a static client-side app where an extra user costs one CDN hit.

| Scale | What breaks first | Why | Fix | Cost of the fix |
|---|---|---|---|---|
| **10×** — 140 destinations, 10× users | Nothing. | Catalogue 790 KB raw / ~120 KB gzip, parsed in ~6 ms; plan generation 0.79 ms; session storage unchanged at ~16 KB against a 5 MB quota (**257× headroom, measured**). Users are free: a static bundle on a CDN. | None. Ship it. | — |
| **100×** — 1,400 destinations | **The catalogue is in the JS bundle.** 1.06 MB gzip added to first load. On a 1.6 Mbps effective 4G link that is ~5.3 s of transfer before anything renders (reasoned from the measured 1.06 MB), plus 61 ms `JSON.parse` measured on this server-class CPU — call it **250–350 ms on a mid-range Android** (reasoned, 4–6× CPU factor). FCP goes from ~0.8 s to ~6 s. Compute is still only 9 ms. | Split the catalogue behind the existing `TravelDataSource`: ship a scoring **index** (id, region, vibeAffinity, tags, minFare per origin ≈ 110 bytes/destination = **154 KB raw / ~25 KB gzip at 1,400**, reasoned from the measured field sizes), score against the index, then lazy-fetch the ~5 full destination records the plan and its alternatives actually need (~5 × 5.7 KB = 29 KB). First load drops back under 200 KB gzip. | ~1 day. The real cost is that `load()` becomes `Promise<CatalogueSnapshot>` and the plan phase gains a genuine async state. **This is exactly why `generatePlanSet` takes a `CatalogueSnapshot` and not a `TravelDataSource`** — the engine, all its tests and R13 are untouched; only `SessionProvider` and the generating screen change. |
| **100×** — second thing to break | **"Why this trip" prices every destination.** R10's rejected-runner-up line needs a rupee delta for destinations that were *filtered out*, so `explain.ts` prices the full set, not just survivors. At 1,400 that is the 4,200-candidate pass again — measured inside the 9.16 ms above, so it is affordable, but it forces the *whole* catalogue into memory even after the index split above. | Compute rejections from the index's `minFare` (a lower bound) and hydrate only the single destination that gets named. | ~2 hours, but it must be done *with* the index split or the split buys nothing. |
| **1000×** — 14,000 destinations, or a live aggregator | **Catalogue freshness has no delivery mechanism.** Every price change is a full site redeploy, and every user holds a stale bundle until their cache expires. At 1,000× the catalogue is also 79 MB raw — past the point where "compile it in" is a sentence anyone should say. Also the honest one: at this scale the product is no longer a static catalogue, it is a query against real inventory, and E2's determinism guarantee has to be re-earned by pinning a fare snapshot per plan ID rather than re-querying (the PRD already commits to this). | Move the catalogue to a versioned JSON API behind the same `TravelDataSource`, with `Cache-Control: stale-while-revalidate` and the version in the URL; the index becomes a server-side query returning the top ~50 candidates and the client prices those. Plan IDs incorporate the snapshot version, which they already do. | ~1–2 weeks and it introduces the first server this product has ever had, with the operational cost that implies. Everything above the `TravelDataSource` interface — the engine, the graph, the pricing, all the tests — survives unchanged. That is the whole return on the seam. |

### The render path, specifically

Three places where a naive implementation re-runs work on every keystroke, and the
rule for each:

1. **AdjustPanel (R12).** Budget and travellers are **uncontrolled inputs behind an
   Apply button.** Re-planning on `onChange` would run the engine on every digit of
   `60000` — 5 runs, harmless at 0.10 ms today, **46 ms of jank at 1,400 destinations**
   (reasoned from the 9.16 ms measurement, allowing for React's re-render of ~120 DOM
   nodes on top). R12's wording ("sets travellers to 4 and applies") sanctions this.
2. **BasicsScreen (R3).** Validation runs on submit and blur, not on keystroke. Typing
   a date should not flash an error at you mid-entry, and it keeps the reducer out of
   the input path entirely.
3. **PlanScreen.** `useMemo(() => generatePlanSet(input, catalogue), [planKey])` where
   `planKey` is the canonical hash string from §4.9. Because the key *is* the
   determinism hash, the memo can never be stale and never wrongly hit — the same
   property that makes R13 true makes the cache correct.

---

## 8. Security & privacy

**What data exists:** a vibe, five basics fields, three to five multiple-choice answers,
and a computed plan. That is the entire corpus.

**Where it goes:** one `localStorage` key on the user's own device. It is never
transmitted, because there is nothing to transmit it to — the app makes **zero network
requests after load**. No analytics, no fonts from a CDN, no error reporter, no
telemetry. This should be verified, not asserted: an E2E test asserts
`page.on('request')` sees no requests to any origin other than localhost.

**What is never collected:** names, email, phone, payment details, precise location,
IP-derived anything, device fingerprints. There is no account and no server log.

**What an attacker gets:** physical or XSS access to the browser yields "someone was
thinking about Goa in October for ₹60,000". Low value, and worth stating plainly rather
than pretending a threat model exists that does not.

| Surface | Posture |
|---|---|
| XSS | All user input is rendered as React text children. **`dangerouslySetInnerHTML` is banned** — an ESLint rule (`react/no-danger`) makes it an error, not a convention. The export dialog is a `<textarea>` (text, never parsed as markup). No `eval`, no `new Function`, no template-driven HTML. |
| Injection | No SQL, no shell, no server, no query construction of any kind. Catalogue lookups are object property reads on a frozen literal. |
| Untrusted input into the engine | `localStorage` is attacker-controllable by anyone with devtools. It is therefore **parsed, not trusted**: `sessionStore.read()` validates `schema`, narrows every field, and returns `null` on anything unexpected rather than spreading a blob into state. A hostile session ends at the vibe screen, not in the reducer. |
| Prototype pollution | The stored session is validated field-by-field into a fresh object; `__proto__` never survives, because we never `Object.assign` a parsed blob into state. |
| Secrets | **There are none, and there is nowhere to put one.** No API keys, no tokens, no `.env`. If a future reviewer finds an env var in this product, something has gone badly wrong. |
| Dependency risk | Runtime dependencies: `react`, `react-dom`. Nothing else ships to the browser. Everything else (vite, vitest, playwright, eslint, typescript) is a devDependency and never reaches a user. A two-package runtime surface is the strongest supply-chain position available and it is worth defending in review. |
| Content Security Policy | A meta CSP of `default-src 'self'; connect-src 'none'; img-src 'self' data:` is achievable because we genuinely need nothing external. Slice 4. |
| Consumer protection | R16 is a safety requirement, not a UX one. The provenance line is non-dismissable, and catalogue invariant C5 plus an E2E accessible-name audit make "Book/Pay/Checkout/Reserve" a test failure. |

---

## 9. Observability

There is no server, so "observability" means: what can QA, a customer judge, or a
founder reproducing a complaint actually see?

1. **The plan ID is the correlation handle.** It is on screen (R13), in the export text
   (R17), and derived from the inputs — so "I got CMP-4K2P9QX and the total was wrong"
   is a complete, replayable bug report. This is the single most useful observability
   decision in the document and it costs nothing because R13 already requires it.
2. **A diagnostics object**, `window.__compass`, populated in all builds:
   `{ catalogueVersion, snapshotDate, phase, planId, lastGenerateMs, candidatesEvaluated,
   relaxedKeys, persistenceAvailable }`. Playwright reads it to assert the performance
   budget and the relaxation behaviour without scraping the DOM. It is read-only and
   contains nothing private (see §8 — there is nothing private).
3. **Stable log codes.** Every recovered failure in §5 logs
   `console.warn('[compass] E-<AREA>-<CAUSE>', detail)`. Codes are greppable and stable
   across releases.
4. **`console.error` is reserved for real bugs.** QA's console-error check therefore
   means something: zero errors is a genuine signal, not a suppressed one.
5. **What would tell us it is broken:** a plan ID that changes across two identical
   sessions (R13 E2E), line items that stop summing (R8 E2E, run against every
   destination in a unit test, not just one plan), a `no-fit` rate above ~0 on the
   personas' inputs, or `lastGenerateMs` climbing past 20 ms as the catalogue grows.

---

## 10. Work breakdown

Four slices. Slice 2 is deliberately the largest: the questionnaire and the plan are one
irreducible vertical — a questionnaire that ends in nothing is placeholder content on a
path the PRD covers, which the playbook forbids. Slices 3 and 4 are then genuinely
additive, and the app is usable end to end from the close of slice 2.

| # (slice id) | Slice | Requirements | Done when |
|---|---|---|---|
| **1** (`slice-1`) | **Scaffold + the vibe screen.** Vite + React + TS strict; the five npm scripts exactly as in §1; Vitest + Testing Library + jsdom; Playwright config on port 4079 with clipboard permissions; ESLint with the `src/domain/**` purity override (§2) and `react/no-danger`; the Designer's `tokens.css` wired in; `App` shell with the phase enum, `ErrorBoundary`, `ProvenanceLine` and the empty `SummaryBar` slot; `S1 Vibe` built for real — six cards, `aria-pressed`, disabled Continue, keyboard operable. | **R1**, **R16** (provenance line present on S1) | `npm run build && npm test && npm run lint && npm run e2e` all pass from a clean `npm install`. E2E asserts: exactly six named vibe cards, Continue disabled on load, selecting Beach sets `aria-pressed="true"` and enables Continue. A unit test proves the ESLint purity override fails a deliberate `window` reference in `src/domain` (guard the guard). Zero console errors. |
| **2** (`slice-2`) | **The engine and the core plan.** `domain/` in full: types, money, dates, hash, validate, question graph + path, constraints, pricing, scoring, itinerary, planner. `data/` catalogue with all 14 destinations and invariants C1–C6 as tests. `S2 Basics` with inline validation, `S3 Question` with No preference / Back / Plan my trip now, `S4 Generating`, `S5 Plan` showing destination, day blocks, stay, legs, cost breakdown, budget line and plan ID. `SummaryBar`. `storage/sessionStore` + restore + Start over. | **R2, R3, R4, R5, R6, R7, R8, R9, R13, R15, R16** | Build/test/lint/e2e green. Unit tests: every catalogue invariant; graph paths are 3–5 long for all six vibes; `validateBasics` produces the exact strings in §4.3; breakdown sums to `partyTotal` for **every** (destination × tier × 1–12 travellers × 1/5/21 nights) combination — not one sample; `generatePlanSet` is deep-equal across two calls. E2E: the R2 summary bar string exactly; both R3 errors with `aria-describedby`; the R4 Beach→International→long-haul vs Beach→Within India→coast fork; "Plan my trip now" from Q1 renders a full plan with "3 questions answered for you"; Back twice preserves and re-derives (R6); reload restores question and plan (R15); clear storage + re-enter → identical plan ID (R13). |
| **3** (`slice-3`) | **The trust layer.** `explain.ts`: "Why this trip" with ≥ 3 answer-quoting reasons and ≥ 1 numeric rejection. `budget.ts` alternatives: Saver ≤ 90% of recommendation, Stretch ≤ budget × 1.25, switching rewires itinerary, breakdown, budget line and plan ID; explicit sentences where a slot is empty. Relaxation ladder surfaced: the R14 banner and the restore control with its rupee cost. | **R10, R11, R14** | Build/test/lint/e2e green. Unit: every one of the 14 destinations, at every tier, produces ≥ 3 reasons and ≥ 1 rejection matching `/\d/`; the ladder drops keys in exactly the §4.5 order; forcing the PRD's own dead-end case (International + Party + 2 nights + ₹25,000 for 4) returns a plan with a non-null `relaxation`. E2E: Saver card is ≥ 10% below and selecting it updates all four regions including the plan ID; the absent-alternative sentence renders where no candidate qualifies; the R14 banner names the dropped constraint and the restore control states the cost. |
| **4** (`slice-4`) | **Control, export and the audit.** `AdjustPanel` (uncontrolled + Apply, per §7) re-planning in place. `S6 Export dialog` with the read-only textarea, clipboard write and live region. CSP meta tag. Accessibility and responsive pass at 360/768/1280, focus order, keyboard-only path end to end. The R16 audit test. | **R12, R17, R16** (full audit), regression on **R8, R13** | Build/test/lint/e2e green, full suite. E2E: travellers 2→4 + Apply updates total, per-person and plan ID with the questionnaire never shown and the summary bar's vibe and answers unchanged, and the travel line rises by exactly the per-person fare × 2 (R8's third clause); "Copy as text" shows the textarea containing destination, dates, party total and one line per day, and announces "Copied"; an accessible-name sweep over every screen finds zero elements named Book/Pay/Checkout/Reserve; the provenance line contains "indicative" and the snapshot date on every screen showing a price; no network request leaves localhost; keyboard-only run reaches a plan. |

Every requirement R1–R17 is claimed by exactly one slice, and each slice leaves the app
runnable and demonstrable.

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **The `no-fit` interpretation of R9.** R9 says no plan above budget × 1.25 is ever "the recommendation"; R14 says never dead-end. For ₹5,000 and 12 travellers both cannot be literally true. I resolved it as §4.8 rule 3: render the cheapest plan, labelled `no-fit`, never as a recommendation. | Certain (it is a design decision) | Medium — a judge could read it as R9 violated | Written here, in the PRD's own "over budget everywhere" failure branch, and given a distinct `BudgetStatus` so QA tests it as its own case rather than as an R9 failure |
| Domain purity erodes — someone imports the catalogue directly or calls `new Date()` in `pricing.ts` | Medium | **High — R13 dies silently** | The ESLint override in §2, plus slice 1's guard-the-guard test, plus the deep-equality determinism test |
| Catalogue too thin: two judges with different answers land on the same destination and conclude the questions are theatre | Medium-high | High — it is the PRD's own top risk | Invariant C2 (≥ 2 destinations per vibe × region × budget-band cell) as a failing test; R10's rejected runner-up must be genuine |
| Question graph authored with a path shorter than 3 or longer than 5 | Medium | Medium — A5/R4 violated | The graph invariant test in slice 2 enumerates every root-to-leaf path for every vibe |
| `Intl`-formatted rupees differ between Node (Vitest) and Chromium (Playwright), so `₹8,400` passes unit tests and fails E2E | Low-medium | Medium — costs a confusing debugging day | Hand-written grouping in `domain/money.ts` with exact-string unit tests (§1) |
| Clipboard permission denied in headless Chromium, so R17's "Copied" never appears | Medium | Medium — a false QA failure | `permissions: ['clipboard-read','clipboard-write']` in the Playwright config, and a degraded announcement so the product is still honest without it |
| "Question 2 of 4" changes to "of 5" when the user picks a deeper branch | Medium | Low, but it looks like a bug | `projectedLength` is documented as branch-dependent; the Designer should prefer "Question 2" + a progress bar if it tests badly |
| Long trips (14–21 nights) exhaust unique experiences and repeat | Medium | Low | `repeatable` experiences, priced ₹0 and honestly named; C3 requires ≥ 10 unique + ≥ 2 repeatable |
| A judge (P2) rejects the product outright because the prices are sample data | Medium | High for the panel score, but **it is a legitimate verdict** | Do not design around it. Report it as evidence about E1, per the PRD |
| Slice 2 is large enough to overrun | Medium | Medium | The domain is pure and testable without any UI, so it can be built and proven first; if the slice must be split, the natural cut is `domain/` + unit tests, then the four screens |

---

## 12. Deviations *(appended during build)*

| Slice | Spec said | Built instead | Why |
|---|---|---|---|
| 1 | `03-design.md` §4: the provenance string renders the snapshot date as `2026‑08‑01` — the two hyphens are U+2011 NON-BREAKING HYPHEN in the source document. | The same sentence with ASCII hyphens: `… snapshot 2026-08-01. …` (`src/ui/components/ProvenanceLine.tsx`). | R16 and UX3 both assert on the literal `2026-08-01`. With U+2011 the shipped text would fail those checks while looking identical on screen — a confusing failure to debug. Everything else in the sentence is verbatim. |
| 1 | R1: "clicking Continue advances to the Trip basics screen." S2 is built in slice 2. | `NextUpScreen` — an honest interim screen headed `Trip basics are next`, stating that this part is not built yet, keeping the chosen vibe and offering `Change your vibe`. | Slice 1 must leave the app runnable without shipping half of S2. It is not placeholder content dressed up as the real screen: it names its own absence. Deleted when `BasicsScreen` lands in slice 2; the `Phase` switch in `App.tsx` is the only place it is referenced. |
| 1 | `03-design.md` §6.4: a vibe card's "accessible name is the label text only", but the description "is inside the button … and included". Those two clauses conflict. | `aria-labelledby` points at the label span (name = `Beach`), `aria-describedby` at the description span (still announced). | Both intentions are satisfied, and R1's `aria-pressed` assertions can locate a card by an exact name. |
| 1 | House stack: `@playwright/test` at the current version. | Pinned exactly to `1.56.1`. | The preinstalled bundle at `/opt/pw-browsers` is Chromium build 1194 = Playwright 1.56.1, and `npx playwright install` is forbidden in this environment. A caret range resolves to a version whose browser is not on disk and every E2E test fails to launch. Re-pin only when the sandbox image changes. |
| 1 | `03-design.md` §3: the SummaryBar is "shown from S2 onwards". | `SummaryBar` renders **nothing at all** (no element, no accent strip) when it has no facts; `App` passes `facts={null}` on the vibe phase. | An empty 44px accent bar on S1 would be decoration, and a `role="status"` region with no content is noise for a screen reader. The component and its contract are real and unit-tested; slice 2 passes it the R2 facts. |
| 2 | §4.3: the error strings `Trips longer than 21 nights are out of scope for now` and `Enter between 1 and 12 travellers`. | The designer's strings from `03-design.md` §4 S2: `Trips longer than 21 nights aren't supported yet` and `Travellers must be between 1 and 12`, plus that table's `Enter a budget as a number, digits only` and `Enter how many people are travelling`. Two further messages were needed for a blank date (`Enter a start date` / `Enter an end date`). | The two documents disagree and UX6 asserts the designer's strings verbatim. The two strings R3 itself quotes are identical in both and are unchanged. |
| 2 | §4.3: `validateBasics(b: Partial<Basics>, today: ISODate): BasicsErrors`. | `validateBasics(raw: RawBasics): { errors, basics }`, where `RawBasics` is the five form values as strings. | "Budget non-numeric" (R3) cannot be expressed once the value has been narrowed to a `number`, so a `Partial<Basics>` cannot carry the case the requirement names. `today` was dropped because no rule in R3 or the design uses it; adding a past-date rule would have invented a requirement. |
| 2 | §4.9: the plan ID is `'CMP-' + fnv1a32(...).toString(36)`. | The designer's visible format, `KOCH-5N-2P-B60-hx4w` (`03-design.md` §4 S5), still ending in four base-36 characters of the same FNV-1a hash of the canonical string plus the variant. | The ID is user-facing copy and the design gives it literally; no acceptance criterion names the `CMP-` prefix. Determinism is unaffected — the hash input is unchanged. |
| 2 | §4.4: `projectedLength` continues the walk using each node's `defaultOptionId`. | `projectedLength` = answers already on the path + the **longest** remaining root-to-leaf run. `defaultWalk` (the neutral walk) is what fills answers for "Plan my trip now". | Only this split makes both quoted strings true at once: R5 and UX11 require "Question 1 of 4" *and* "3 questions answered for you" on the same screen, and the neutral branch of the Beach graph is three questions long. |
| 2 | §3: `DestinationTag` has thirteen values. | Six geography values added: `west-coast`, `east-coast`, `islands`, `himalaya`, `northeast`, `backwater`. | The graph branches the design specifies (`Which coast are you drawn to?` with West / East / Islands) cannot be expressed with the original list. Additive only. |
| 2 | §2: `data/catalogue/` holds `destinations.json`, `fares.json`, `meta.json`. | The same data as typed TypeScript modules (`domestic.ts`, `international.ts`, `meta.ts`) behind the same `TravelDataSource`. | 168 experiences and 84 fares authored by hand: as TS a missing fare or a mistyped tier is a compile error, as JSON it is a runtime surprise. The seam, the payload and invariants C1–C6 are unchanged. |
| 2 | §3 invariant C2: every `vibe × region × budget-band` cell is served by ≥ 2 destinations, with the band a property of the destination. | The same test with the band expressed as **the user's budget**, per region (domestic ₹60k/₹1.2L/₹2.5L, international ₹1.1L/₹2L/₹3.5L for the reference 5-night, 2-traveller trip from Bengaluru): for each cell, ≥ 2 distinct destinations with affinity ≥ 3 price inside that budget. | C2 as literally written is unsatisfiable at 14 destinations — 36 cells × 2 needs a destination in several bands at once, and a destination has one price. The version built tests the risk C2 exists for ("it always sends me to Goa") and fails if the catalogue drifts. 36 cells are asserted individually in `tests/catalogue.test.ts`. |
| 2 | §4.5: a `travellers` constraint at priority 2. | No such `ConstraintSpec`. Rooms are `ceil(travellers / 2)` and every stay is a 2-capacity room, so the constraint is satisfied by construction for 1–12 travellers. | A constraint that can never fail is a test that can never fail. The arithmetic it stood for is asserted in `tests/pricing.test.ts`. |
| 2 | §4.8 / §4.5: `PlanSet` carries `saver`, `stretch`, the absent-slot sentences and `Relaxation.restore`; `Plan` carries `why`. | Those fields are not in the types yet. `Relaxation` (dropped keys + the R14 banner sentence) **is** computed by the engine and persisted; nothing renders it yet. | They belong to R10, R11 and R14, which `§10` assigns to slice 3. Shipping empty fields now would be the placeholder content the playbook forbids. Slice 3 adds the fields, the tests and the UI together. |
| 2 | `03-design.md` §3: the SummaryBar shows the trip facts; R12 also expects the vibe to be visible "in the summary". | The bar carries exactly the four R2 facts — `5 nights · 2 travellers · from Bengaluru · ₹60,000` — and no vibe. | R2 and UX4 both assert that string exactly, on S2 and on the first question. Adding a fifth fact would break the only assertion the PRD spells out. **Slice 4 note:** UX17's "summary bar's vibe substring" needs re-basing onto the plan hero, which does name the trip. |
| 2 | `03-design.md` §4 S5: the local-allowance basis reads `₹550 per traveller per day × 2 × 5`. | `… × 2 × 6 days` — the allowance covers `nights + 1` days, per §4.6. | The two documents disagree on the multiplier; the architecture's is the one the engine computes and the one that makes the four line items sum to the total (R8). |
| 2 | `03-design.md` §4 S5: itinerary legs read `06:55–08:15, IndiGo, 1h 20m`. | `Fly Bengaluru → Kochi & Varkala` with `1h 18m in the air · ₹4,700 per traveller`. | The catalogue has no schedules or carriers, and inventing them would put fabricated departure times on a screen that already carries indicative prices. R7 asks for the legs, not for a timetable. |
| 2 | `03-design.md` §4 S1: the resume banner offers `Resume` when a saved session exists. | The session restores its own phase on load — a reload lands on the exact question or the exact plan. The banner appears when the user walks *back* to the vibe screen with a trip in progress. | R15's acceptance criterion requires the reload itself to return the user to where they were; a banner that had to be clicked first would fail it. The banner is still built, and still clears the session with `Start over`. |
| 2 | `03-design.md` §4 S3: the Beach `Islands` answer leads to `Lively beach or empty beach?` like the other coasts. | `Islands` goes straight to `Resort comfort or local stays?` (a 3-question path, still inside A5's 3–5). | Every island in the catalogue is the quiet answer, so the question would be theatre — and it is what makes R6/UX9 demonstrable: changing question 2 to `Islands` genuinely replaces question 3. No new question or option text was introduced. |
| 2 | — (bug found while building) | Every field on S2 reserves the line its error would occupy (`FieldMessage`), and the ErrorSummary is a snapshot taken on submit rather than on blur. | Validation runs on blur, so clicking `Continue` from inside an invalid field made the error appear *between* mousedown and mouseup; the action row moved out from under the pointer and the click never landed — Continue silently did nothing. Found by the R3 E2E, fixed at the cause. |
| 2 | Slice 1 deviation: `NextUpScreen` stands in for S2. | Deleted, as that entry promised. | `BasicsScreen` is real now. |
| 3 | §4.8: `PlanSet.stretchAbsentReason` is `No richer option in this catalogue within your budget`. | `03-design.md` §4 S5's string: `No pricier option that still stays inside your stretch band`. | The two documents disagree and UX15 asserts the designer's verbatim. The Saver sentence is identical in both and is unchanged. |
| 3 | `03-design.md` §4 S5 gives "Why this trip" as four named reasons and three named rejections for one specific reference plan (`Varkala's cliff beaches score highest…`, `Goa — rates 4 out of 5 for nightlife, against your "empty beach" answer.`). | The same shapes, generated from catalogue facts for whatever plan is on screen: `You chose Beach — Kochi & Varkala rates 5 out of 5 for that in this catalogue.`, `Havelock & Neil, Andaman — ₹35,800 over your budget for 2.` | Those strings are prose about one destination, not templates; shipping them literally would put a claim about Varkala on a plan for Manali. Every sentence built instead is derived from a number the user can check — an affinity out of five, a rupee gap, a flight duration, a night range — which is what R10 asks for and what P2 will audit. |
| 3 | `03-design.md` §4 S5, restore banner: ghost button `Keep the ₹25,000 plan`, where ₹25,000 is also the reference budget. | The **current plan's** total is interpolated: `Keep the ₹31,200 plan`. | The button keeps the plan that is on screen, so it has to name that plan's price. Interpolating the budget would label the control with a number the user cannot find anywhere else on the page. |
| 3 | `03-design.md` §4 S5 layout table, 1280 row: the relaxation banner is listed inside the left column. | Above the hero at every width. | The same section's copy block says "above the hero at every width, not dismissable" and the 768 row orders it before the hero. Two of the three statements agree; the third is followed. |
| 3 | §4.5: `Relaxation.restore` is `{ key, label, costDelta }`. | Plus `total` — the party total of the plan with the constraint back on. | The banner's sentence quotes an absolute figure (`… is ₹1,29,200 — ₹1,04,200 over your budget`) and the button that accepts it is labelled `Use the ₹1,29,200 plan`. Deriving that from `costDelta` in the UI would put the same arithmetic in two places. |
| 3 | §4.5: `ConstraintSpec` is `{ key, label, priority, test, relaxNote }`. | Plus `rejectNote(destination, ctx)`. | R10 requires every rejected line to contain a numeral. A constraint is the only thing that knows *why* a destination failed and what number to quote (`11h in the air, and you asked for under 6 hours`); computing it in `explain.ts` would mean a `switch` on constraint kind, which is the thing the spec object exists to avoid. |
| 3 | §4.8 rule 6: the Stretch is any higher-priced survivor other than the recommendation. | Also excludes the Saver's destination. | Otherwise two of the three cards name the same place at two stay tiers, which is one idea shown twice and reads as a bug. Asserted in `tests/alternatives.test.ts`. |
| 3 | §4.5: the restore control "re-runs the engine with that one key forced back on". | It does, and with a key forced the winner is selected by **cheapest** rather than by score. | The banner quotes `The cheapest … is ₹X` before the user commits, and `Use the ₹X plan` must hand them that exact plan. Selecting by score there would put a figure on screen that the plan behind the button does not match. `restoreFor` and `generatePlanSet(..., forceConstraints)` share one selection function so they cannot drift; `tests/relaxation.test.ts` asserts the two agree. |
| 3 | §4.8 rule 3: when nothing fits, "the globally cheapest plan is still rendered". | The cheapest plan that still honours the never-dropped constraints (nights) and anything R14 has forced back on; only if *that* is empty does it fall back to the cheapest of everything. | Unchanged for an ordinary no-fit (the slice-2 case still renders and is still labelled `no-fit`). It matters for R14: without it, `Put international back` could answer with a domestic plan, which would be a lie told by the control that exists to be honest. |
| 3 | §4.2 / R15: the persisted `planSet` is narrowed field by field. | `narrowPlan` now also requires `why.reasons.length >= 3` and `why.rejected.length >= 1`, and an alternative that fails narrowing takes its absent-slot sentence. | S5 renders both lists unguarded, so a stored plan without them is not a plan we can draw. R13 makes recomputing free, and R11 forbids an empty slot — so the recovery is to recompute, never to render a hole. |
| 4 | §4.2: `SessionAction` includes `{ type: 'adjust'; budget: Rupees; travellers: number }`. | `{ type: 'adjust'; basics: Basics; planSet: PlanSet }`, with the engine run by the caller (`SessionProvider.replan`). | The design's success state requires hero, breakdown, budget line, itinerary and plan ID to update **together** — "never a half-updated screen". A reducer that changed the basics and left the recompute to an effect would render one frame with the new party size against the old plan. Carrying both in one action makes the swap atomic by construction rather than by two handlers agreeing. |
| 4 | `03-design.md` §4 S5, Adjust panel: `Update plan` is "disabled while both values match the current plan"; the Success state says "Focus stays on `Update plan`". | Both cannot hold: a `disabled` button cannot keep focus. The button still disables itself, and focus returns to the **field the user just edited**. | §6.1 says focus is "never lost to `<body>`", which is what leaving it on a control that is about to be disabled would do. Returning it to the field keeps focus inside the panel, one keystroke from a second adjustment, instead of throwing the keyboard user back to the top of the page. Asserted in `tests/adjust.test.tsx` and the keyboard-only E2E. |
| 4 | `03-design.md` §4 S5 hero: `Actions: primary Copy as text · ghost Start over`. | The hero carries `Copy as text` only; `Start over` stays in the AppBar at every width. | The same section's keyboard path is explicit — `AppBar Start over → Copy as text → …` — and lists no second `Start over`. Two controls with the identical accessible name on one screen is also an ambiguity R16's audit and every `getByRole` in the suite would have to work around. At 360 the AppBar is sticky, so `Start over` is still one reach away. |
| 4 | `03-design.md` §4 S5 at 360: the primary action sits in a **sticky** bottom action bar. | `position: fixed` at ≤599px, with a reserved strip on `.app--plan` so it never covers the provenance footer. | `position: sticky` inside the ~200px hero stops being visible as soon as the itinerary scrolls past — precisely when the action is wanted. Asserted at the bottom of a scrolled 360px plan in the slice-4 E2E. |
| 4 | `03-design.md` §4 S6: the export text's day lines carry clock times (`Fly Bengaluru 06:55 → Kochi 08:15`) and the final day reads `Check out`. | `Fly Bengaluru → Kochi & Varkala (1h 18m)` and `Check out, Brunton Boatyard`. | The same reason as the slice-2 itinerary deviation: the catalogue has no schedules, and inventing them would put fabricated departure times into a text the user pastes elsewhere. The property name is kept on the last day because a pasted plan is read without the screen next to it. |
| 4 | §8: "A meta CSP of `default-src 'self'; connect-src 'none'; img-src 'self' data:`". | Exactly that, in `index.html` and therefore in `dist/index.html`. A `vite.config.ts` plugin with `apply: 'serve'` relaxes `connect-src`, `script-src` and `style-src` **for the dev server only**. | Vite's dev server needs its HMR WebSocket, inlines the react-refresh preamble into the HTML and injects styles as inline `<style>` elements; the shipped policy blocks all three, so `npm run dev` would be a wall of CSP violations. The production bundle needs none of them — verified by loading `dist` under the strict policy with zero console errors. `tests/csp.test.ts` asserts the shipped string byte for byte so a dev relaxation cannot leak into it. |
| 4 | `03-design.md` §4 S6: the dialog opens with `showModal()`. | It does, where the method exists; where it does not, the `open` attribute is set instead and Esc is still handled through the platform `cancel` event. | jsdom implements no `HTMLDialogElement`, and so does any browser predating the element. The fallback is three lines and it is a real degradation path, not test scaffolding. The dialog's `close` event is deliberately **not** wired back to the parent: it also fires when the component's own cleanup closes the dialog, which under StrictMode's double-invoked effects made the dialog close itself the instant it opened. |
| 4 | Slice-2 note on `03-design.md` §3 / R12: "UX17's summary bar's vibe substring needs re-basing onto the plan hero". | Re-based onto the plan itself: after an apply the E2E asserts the destination heading is unchanged, the summary bar differs only in the party size, and the `You chose …` / `You said …` lines in "Why this trip" are byte-identical. | The bar carries the four R2 facts and no vibe, as slice 2 recorded. The claim R12 actually makes — that the vibe and the adaptive answers survive a re-plan — is asserted where those answers are visible. |
