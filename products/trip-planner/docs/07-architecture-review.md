# Architecture Review — Compass (trip-planner)

**Author:** Tech Lead · **Reviews:** the code as built vs `02-architecture.md`
**Date:** 2026-08-18 · **Method:** read `src/` in full; ran `build`, `lint`, `test`,
`e2e` myself; instrumented the engine directly for every number below.

---

## Verdict

## NO-GO

The engine renders a sentence that is provably false on an ordinary input — *"No city
nightlife party trip fits ₹4,50,000 for 9"* while ten such trips fit and the cheapest
is ₹2,15,700 under budget — and the itinerary, which is the product's one deliverable,
goes blank for `days − 6` of every trip longer than five nights on 12 of 42 stays while
crediting the user with having asked for it.

I would not deploy this, so I am not going to sign it off. This is not a "polish it"
verdict: three independent things (QA's own gate, the panel's gate, and the house
stack's definition of runnable) all say the same thing, and the code agrees with them.

**What is true, and worth saying before the bad news:** the bones are right. The domain
is genuinely pure and mechanically kept that way; there is not one `any`, one
`@ts-ignore` or one silent `catch` in 8,065 lines; money is integer rupees end to end
and the breakdown ties exactly; the security posture is the strongest I have reviewed
(two runtime dependencies, zero production vulnerabilities, a real enforced CSP, no
network calls at all). Every defect below is a bounded fix inside a sound structure.
None of them requires re-architecting anything. That is why this is a NO-GO and not a
write-off — I estimate 3–4 days to a GO.

---

## Evidence — what I ran

From `products/trip-planner`, by me, this session:

| Command | Result |
|---|---|
| `npm run build` | **PASS**, exit 0. 79 modules, `index.js` 295.83 kB / **87.18 kB gzip**, CSS 23.25 kB / 4.72 kB gzip. Under the 200 KB gzip budget. |
| `npm run lint` | **PASS**, exit 0. ESLint at `--max-warnings=0` plus `tsc --noEmit`, no output. |
| `npm test` | **PASS**, exit 0. **438 tests in 25 files**, 24.0 s. |
| `npm run e2e` | **FAIL**, exit 1. **194 passed, 8 failed**, 4.9 min. |

The house stack's *definition of runnable* is
`npm install && npm run build && npm test && npm run e2e` completing **with zero
failures**. It does not. That alone is a gate, and it is not a formality — two of the
eight failures are the S2s below.

The eight failures reproduce QA's round-2 list exactly: 3 carried-over S3s (B1, B2,
B3), 3 instances of one S3 (B8, counted per width), and **B6 + B7, both S2**.

---

## Drift

Ordered by consequence, not by document section. `02-architecture.md` §12 already
carries 40 developer-recorded deviations and they are, almost without exception,
well-reasoned and correctly argued — that table is the best artefact in this product.
What follows is what §12 does **not** say.

| # | Designed | Built | Impact | Accept or fix |
|---|---|---|---|---|
| D1 | §4.5: `vibe` is a `ConstraintSpec` at priority 3, "4th to drop", and dropping it fires the R14 banner. | **No vibe constraint exists.** `PRIORITY.vibe = 3` is declared in `constraints.ts` and referenced by nothing. Vibe enters only as `vibeAffinity × 20` inside `scoreCandidate`. | **High.** There is no affinity floor, so once better-matching destinations are excluded the engine recommends a destination rated **1 out of 5** for the chosen vibe, with no banner, because no constraint was dropped. This is the single root cause of two judges' trust complaints: Rohan's "it's offering me Manali. For a beach holiday" on reroll 5, and Kabir's Ella-at-1/5-for-Party. Trust scored **6** and **4**. | **Fix.** Build the spec §4.5 already specifies: `test: d => d.vibeAffinity[ctx.vibe] >= 3`, `priority: PRIORITY.vibe`, pushed into `specs` in `planner.ts`. The ladder and the banner machinery already exist and already say the right sentence. ~2 hours. |
| D2 | §4.5: the ladder drops a constraint and the R14 banner names it: *"No `<label>` `<vibe>` trip fits `<budget>` for `<n>`"*. | Built exactly as specified — **and the specification was wrong.** The banner makes a universal claim ("no X trip fits") from a local fact ("the full conjunction was empty and X was the first thing I dropped"). | **Critical.** Reproduced verbatim, see *Real bottleneck* §2. My §4.5 is the defect's origin: I wrote the sentence without writing the precondition that makes it true. | **Fix**, and the design is mine to correct. |
| D3 | §3 invariant C3: "≥ 10 non-repeatable + ≥ 2 repeatable experiences" **per destination**, sized so R7 can fill a 6-day trip. | C3 is still tested per destination (`tests/catalogue.test.ts:146`) and still passes. But refine-1's fix 9 made the scheduler's supply unit the **base town**, not the destination, and the matching per-base test (`tests/itinerary.test.ts:182`) asks only for `>= 4`. | **Critical.** The invariant was never re-based onto the new supply unit, so it went on passing while the thing it protected stopped being true. This is the direct cause of B7. See *Real bottleneck* §1. | **Fix.** C3 must read: for every `(destination × stay)`, `eligibleExperiences(d, s).length >= maxNights + 1`. It fails today on 12 of 42 pairs — which is the point. |
| D4 | §4.9 / R13: "what ends up on screen is still a function of the answers alone." `forceConstraints` is part of the canonical hash (`hash.ts:32`). | `forceConstraints` is passed to `generatePlanSet` in `SessionProvider.tsx:189` and **exists nowhere else**. `SessionState` has no field for it; `plannerRequest()` never sets it; `PersistedSession` never stores it. | **High.** After `Use the ₹X plan`, `state.planSet` is a plan the app can no longer derive from its own inputs. Consequences: (a) the next `adjust` or `reject` silently reverts to the machine's pick — Kabir's blocker 1, *"where did my Goa go? I changed one number"*; (b) the persisted plan ID is not reproducible from the persisted session, so R13's "clear storage, re-enter, get the identical plan" is unreachable for a restored plan. | **Fix.** Add `forcedConstraints: readonly ConstraintKey[]` to `SessionState` and to `PersistedSession` (schema 3), set it in `applyRestore`, read it in `plannerRequest`. ~3 hours. It is the same shape as `excluded`, which was done correctly and is the model to copy. |
| D5 | §5: every plan-replacing transition leaves the screen coherent. | `sessionReducer.ts:314` — `case 'applyRestore'` swaps `planSet` and does **not** clear `changeNotice`. Every other plan-replacing case (`adjust`, `rejectDestination`, `undoReject`, `selectVibe`, `restore`) sets or nulls it. | Medium. A notice reading *"destination is now Puducherry & Auroville instead of North Goa"* renders under an `<h1>` saying **North Goa**, directly beneath the price. Kabir's blocker 3. | **Fix.** One line: `changeNotice: null`. ~5 minutes. |
| D6 | §7: *"compute is not the bottleneck and will not be for two orders of magnitude"*, with `generatePlanSet` measured at 0.10 ms / 14 dests and 9.16 ms / 1,400. | Measured today: **1.01 ms / 14** and **56.19 ms / 1,400**. 10× and 6× worse than the document claims. | Medium at 1×, **High at 100×**: 56 ms is 3.4 frames on a server-class CPU and ~220 ms on a mid-range phone, on a path (Apply) with no loading beat to hide it. | **Accept the finding, fix the code later.** See *Real bottleneck* §3 — the fix is cheap and known. |
| D7 | §6: catalogue payload ≤ 20 KB gzip; the §7 model assumed the catalogue dominates the bundle. | Catalogue is 65.8 KB raw JSON (14 destinations, 42 stays, 168 experiences) inside an 87.18 kB gzip bundle. | None. Comfortably inside the 200 KB budget; the §7 payload story is directionally right. | **Accept.** |
| D8 (improvement) | §4.7: when unique experiences run out, "cycle the `repeatable: true` ones". | Refine-1 removed padding entirely: every experience is dealt at most once (R21). | **This was the right call** and I would have made it. Repeating the same morning on Day 6 and Day 7 was what Anita caught. The mistake was removing the padding without giving the scheduler anything honest to say in its place — see B7. | **Accept the decision, fix the gap.** |
| D9 (improvement) | §2: `data/catalogue/` holds JSON. | Typed TS modules. §12 argues a missing fare becomes a compile error rather than a runtime surprise. | Correct, and it is why C1/C4/C6 hold. | **Accept.** |
| D10 (improvement) | §4.8: rejections priced against all 14 destinations. | Same, plus `ConstraintSpec.rejectNote(d, ctx)`, so the constraint that excluded a destination is the thing that explains it. | Avoids a `switch` on constraint kind in `explain.ts`. Better than what I specified. | **Accept.** |
| D11 | §1: `Intl` banned; hand-written Indian grouping in `money.ts`. | Built exactly. `groupIndian` handles negatives by prefixing an ASCII `-` **inside** the format, so the R23 seasonal saving renders `₹-9,640`. | Cosmetic (QA B9), but it is the one place the deliberate no-`Intl` decision has a visible cost. | **Fix** with the S4s: sign outside the symbol, `−₹9,640`. ~15 minutes. |
| D12 | §8: *"A hostile session ends at the vibe screen, not in the reducer."* | `sessionStore.ts:143` — `narrowPlan` validates ~14 fields then `return value as unknown as Plan`. Everything nested below the checked fields is unvalidated and cast wholesale. | Low, but the claim is overstated. I drove it: a tampered `days[0].experiences[0].name = {}` **crashes the app into the ErrorBoundary** (`Objects are not valid as a React child`). It ends at the boundary, not the vibe screen. No XSS, no escalation, self-inflicted only. | **Accept for launch, fix after.** The boundary catches it and offers a working Start over, which is the designed degradation. Narrow `days[].experiences[]` properly: ~1 hour. |

---

## Real bottleneck

I predicted in §7 that the payload would break first, at 100×, and that compute was
safe for two orders of magnitude. **Both predictions were wrong in the same direction:
I modelled the system I designed, not the one that got built, and I benchmarked the
loop I had in mind rather than the loop in the file.** The three things that actually
break, in the order they break:

### 1. Catalogue supply per base — breaks at **6 nights**, today, at 1× scale

Not a scaling limit. Already crossed.

Refine-1's fix 9 gave every stay a base town and made `eligibleExperiences` return only
what is in that town and within `MAX_MINUTES_FROM_BASE = 90`. That is correct and it is
what Rohan asked for. It also cut the pool the scheduler draws from, and nothing was
re-sized to match.

`experiencesPerDay` asks for `2 × nights` experiences on trips of ≤ 7 nights and
`nights + 1` beyond that. Measured supply, by `(destination × stay)` pair:

```
12 of 42 pairs have fewer than 10 reachable experiences:
  Kochi & Varkala      / all 3 stays   6      Gangtok & Pelling / all 3 stays   6
  Kathmandu & Pokhara  / all 3 stays   8      Ella & south coast / Ella x2      8
  Ella & the south coast / Mirissa Headland Villas    4
```

With a pool of 6, an experience is dealt to a day and never repeated, so:

**blank days = trip days − 6.** Measured on the recommended plan, `freeDay` unchecked:

| Trip | Days | Empty days | Labelled *"Nothing scheduled — this day is yours"* |
|---|---|---|---|
| 10–15 Oct 2026 | 6 | 0 | 0 |
| 20–27 Dec 2026 | 8 | **2** (days 4, 8) | 1 |
| 5–12 Jul 2027 | 8 | **2** | 1 |
| 1–10 Nov 2026 | 10 | **4** | 3 |
| 1–15 Sep 2026 | 15 | **9** | 8 |

**60% of a fifteen-day itinerary is blank, and eight of those nine blank days tell the
user they asked for it.** That sentence is R21's feature copy, rendered
unconditionally by `itinerary.ts` (`note: experiences.length === 0 && !isFirst &&
!isLast ? FREE_DAY_NOTE : null`) with no reference to `ctx.freeDay`. R7 — "one costed
day-by-day itinerary", the entire product — fails on any trip over five nights to
roughly a quarter of the catalogue.

The same shortfall is the whole of B6: ticking *Leave one day free* on the reference
Beach trip removes one day of capacity from a pool that was already short, so nothing
is dropped, six experiences repack onto five days, and **the total does not move**
(₹56,600 → ₹56,600, measured). On a supply-rich plan it does move (₹58,000 → ₹52,200).
A price that responds to a control only when the data happens to be dense is worse than
one that never responds, because the user cannot learn the rule.

**Why the tests did not catch it, which is the part I own.** Invariant C3 still measures
per destination and still passes; the per-base test asks for `>= 4`, a floor chosen to
pass rather than derived from what the scheduler demands. And the R21 unit tests
(`tests/itinerary.test.ts`) use the Goa fixture — the supply-rich case where the
behaviour works — while the product's own reference trip is Kochi, where it does not.
The suite is green on the fixture that agrees with it.

**Fix.** Three parts, none of them large:
1. Re-base C3: `eligibleExperiences(d, s).length >= d.maxNights + 1` for all 42 pairs.
   It fails today; make the catalogue satisfy it (~1 day of content for ~6 thin bases,
   or cap `maxNights` per base, which is free and honest).
2. Separate the two sentences: `FREE_DAY_NOTE` only when `ctx.freeDay` put the day
   there. A gap the catalogue caused needs its own words — *"Nothing scheduled here —
   this base has six things to do and you have eight days"* is honest and is in the
   spirit of R16. ~1 hour.
3. Make R21 subtract experiences rather than capacity, so the total always moves. ~2 hours.

### 2. The relaxation ladder makes a claim it never tests — reproduced exactly

Kabir's blocker 2, and I reproduced it byte for byte, including his numbers, by
driving the engine directly (Party · Within India · A city · A proper city night ·
Local stays · 13–16 Nov 2026 · 9 adults · ₹4,50,000 · from Delhi):

```
Recommended: Puducherry & Auroville  ₹2,49,900
Budget line: "₹2,00,100 under your budget"
Banner:      "No city nightlife party trip fits ₹4,50,000 for 9 — we included the coast."
Restore:     key=q:party-scene  total=₹2,34,300  costDelta = −₹15,600

Candidates that DO hold "city nightlife" and fit the budget: 10
  cheapest: North Goa  ₹2,34,300   (budget ₹4,50,000)
  => the banner sentence is FALSE
```

`survive()` drops the most recent answer first and stops at the first non-empty pool.
The conjunction was empty because of `q:party-domestic` ("a city"), which the ladder
**kept**; it dropped `q:party-scene` ("city nightlife"), which was never the problem.
The banner then asserts a universal — *no such trip fits* — that the engine has not
tested and that is false for **10 of 42 candidates**.

The engine already holds the disproof: `restore.costDelta` is **negative**. Putting a
constraint *back* made the trip ₹15,600 cheaper, which is arithmetically impossible if
the ladder's premise held. The product disproves itself one click below the banner —
which is precisely what Kabir did, and why Trust scored 4.

This is a defect in **my** §4.5, not in the developer's reading of it. The
implementation is faithful; the specification omitted the precondition that makes the
sentence true.

**Fix**, cheapest first:
- **Guard (30 minutes, ships today):** before emitting the banner, test whether any
  candidate satisfies the dropped spec plus the never-dropped specs within the ceiling.
  If one does, the sentence must not claim nothing fits. `restore.costDelta < 0` is a
  one-line assertion that must never be true and belongs in the unit suite now.
- **Correct (half a day):** choose the drop set by search rather than by order — try
  each droppable spec singly, prefer the drop that leaves the lowest-priority-number
  constraint standing, and only then go to pairs. `n ≤ 8`, so the exhaustive walk is 255
  filter passes over 42 candidates: microseconds. The ladder's fixed order was an
  optimisation for a cost that does not exist.

### 3. Compute at 100× — 56 ms, six times my published figure

Measured this session on this machine, real engine, real catalogue, synthesised at
scale:

```
                                    generatePlanSet   of which buildCandidates
  14 dests (  42 candidates)            1.01 ms            0.70 ms   (69%)
 140 dests ( 420 candidates)            3.95 ms            3.21 ms   (81%)
1400 dests (4200 candidates)           56.19 ms           54.17 ms   (96%)

§7 of 02-architecture.md claimed:       9.16 ms at 1,400
```

The gap is one line of refine-1: `buildCandidates` now calls `scheduleItinerary` for
**every** candidate, because fix 9 made the schedule depend on the stay. My §7 benchmark
modelled pricing only. Per-candidate breakdown, 42 candidates:

```
                  5 nights   21 nights
scheduleItinerary   0.256 ms   0.495 ms      <- dominant, and grows with trip length
priceCandidate      0.075 ms   0.083 ms
```

And inside `scheduleItinerary` the dominant term is not the algorithm — it is
`for (i < ctx.days) dates.push(addDays(ctx.startDate, i))`, **rebuilt from scratch for
every one of the 42 candidates**. `addDays` costs 0.61 µs; 42 × 22 = 924 calls =
**0.567 ms**, which accounts for essentially the entire 21-night scheduling cost.

**Fix: hoist `dates` and their weekday indices onto `PlanContext`, computed once.**
They are identical for every candidate by construction. ~1 hour, removes the majority
of the scheduling cost at every scale, and takes 100× back under one frame. A second,
larger win is available later: pricing needs only the *set* of chosen experiences, not
the per-day placement, so the full day-by-day build can be deferred to the ~3 plans
actually rendered.

Compute is still not the *first* thing to break. It is just no longer the non-issue I
told you it was, and the number in §7 should not be trusted by whoever plans the next
catalogue expansion.

---

## Scale readiness

Static client-side app: an extra *user* costs one CDN hit and nothing else. Every row
below is about **catalogue growth**, which is the only axis that moves.

| Scale | Holds? | First thing to break | Fix | Effort |
|---|---|---|---|---|
| **1× (today)** | **No** | Itinerary supply per base. `blank days = days − 6` on 12 of 42 stays from 6 nights up; the free-day control is a no-op on those plans; the relaxation banner is false on ordinary inputs. | Bottleneck §1 and §2 above. | **3–4 days**, and it is the launch blocker |
| **10×** — 140 destinations | Yes, once 1× is fixed | Nothing. `generatePlanSet` 3.95 ms (measured); catalogue ~650 KB raw / ~100 KB gzip; session 17.5 KB against a 5 MB quota (**285× headroom, measured**); persistence write 0.045 ms per dispatch (measured), negligible. | None. Ship it. | — |
| **100×** — 1,400 destinations | No | Two things, in this order. **(a) Compute: 56.19 ms measured**, 96% in `buildCandidates`, on the Apply path which has no loading beat — ~220 ms on a mid-range phone (reasoned, 4× CPU factor). **(b) Payload: 6.48 MB raw / ~1 MB gzip measured**, in the JS bundle, ~5 s of transfer on a 1.6 Mbps link before first paint. | (a) Hoist `dates` onto `PlanContext` (~1 h) and defer day-block construction to the rendered plans (~3 h) — together these take it back under a frame. (b) The `TravelDataSource` split from §7 still stands and is still the right answer: ship a scoring index, lazy-fetch the ~5 full records the plan needs. | (a) **half a day** · (b) **~1 day**, and it is genuinely why `generatePlanSet` takes a `CatalogueSnapshot` and not a `TravelDataSource` — the engine, its tests and R13 do not change |
| **1000×** — 14,000 destinations, or live inventory | No | Catalogue freshness has no delivery mechanism: every price change is a full redeploy. At 79 MB raw, "compile it in" stops being a sentence anyone should say. Both judges who would pay said they would only pay for real prices, so this is a *product* threshold as much as a technical one. | Versioned JSON API behind the same `TravelDataSource`; the index becomes a server-side query returning the top ~50 candidates. Plan IDs already carry the snapshot version, so E2's determinism survives by pinning the snapshot per plan ID. | **1–2 weeks**, and it introduces the first server this product has ever had. Everything above `TravelDataSource` survives unchanged — that is the return on the seam, and the seam held |

---

## Code health

| Area | Finding | Sev | Fix cost |
|---|---|---|---|
| **Correctness — relaxation** | The banner asserts a universal the engine never tested; false on 10/42 candidates for an ordinary input. `restore.costDelta < 0` is a live self-disproof. | **S2** | 0.5 h guard / 4 h correct |
| **Correctness — itinerary** | `days − 6` blank days from 6 nights on 12/42 stays (B7); free-day control is a no-op on those plans (B6). | **S2** | ~1 day + content |
| **Correctness — vibe floor** | No affinity floor anywhere; a 1/5 destination can be recommended silently (D1). | **S2** | 2 h |
| **State coherence** | `forceConstraints` lives only in a `useMemo` argument; a restored plan is underivable from persisted state (D4). `applyRestore` leaves a stale `changeNotice` (D5). | S2 / S3 | 3 h / 5 min |
| **Type escapes** | **Zero `any`. Zero `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`** in `src/`, `tests/` and `e2e/`. Two casts total: `window as unknown as {__compass}` (correct, deliberate) and `narrowPlan`'s `value as unknown as Plan` (D12). | S4 | 1 h |
| **Error handling** | Six `catch` blocks, **all six log a stable `[compass] E-*` code**. Nothing is swallowed. `generatePlanSet` is deliberately not wrapped, exactly as §5 required. `console.error` is genuinely reserved, so QA's zero-console-errors check means something. | — | — |
| **Domain purity** | Enforced mechanically, not by trust. `tests/eslint-domain-purity.test.ts` runs ESLint on a deliberate `window` reference and asserts it fails, then asserts the real sources are clean — the guard is guarded. **This is the highest-value thing in the codebase and it held through two refinement rounds.** | — | — |
| **Coupling** | Clean and one-directional: `ui → app → domain`, `data/storage → domain` (types only). No reverse edges. `App.tsx` runs the engine in click handlers and hands the reducer both new inputs and the resulting plan in one action — deliberate (§12 slice 4) and correct: it is what makes the plan swap atomic. | — | — |
| **Duplication** | `countLabel` is defined identically in `party.ts:58` and `pricing.ts:46`. That is the whole list. | S4 | 10 min |
| **Dead code** | Two genuinely unreferenced exports: `money.isWholeRupees` (written for invariant C6, which is enforced by an inline check instead) and `constraints.keysOf`. ~60 other "unused" exports are `*Props` interfaces and internal constants — idiomatic, not dead. | S4 | 15 min |
| **Test quality** | **Strong.** 438 unit + 202 E2E. I looked for assertion-free tests and found none — every apparent hit was `expect.poll` or `test.use`. Two soft spots: `qa-03:279` uses `test.skip(!line.startsWith('Stretch'))`, so the warn-badge token assertion silently disarms if the catalogue stops producing a stretch case; and the R21 unit tests use the supply-rich Goa fixture while the product's reference trip is supply-poor Kochi, which is how B6/B7 shipped green. | S3 | 2 h |
| **Coverage method gap** | `playwright.config.ts` points `webServer` at `npm run dev`, and `vite.config.ts` relaxes CSP for `apply: 'serve'`. **No automated test ever loads `dist/`.** I loaded it manually under the shipped policy — clean, zero violations, the one inline `style` attribute (`QuestionScreen.tsx:84`) applies correctly — so this is a gap in method, not a live defect. Worth one E2E project against a static server. | S3 | 2 h |
| **Bundle** | 87.18 kB gzip against a 200 kB budget. Catalogue 65.8 KB raw. No code splitting needed yet. | — | — |

---

## Security

Reviewed by reading the code and then by attacking the running app at
`http://localhost:4079`. **This is the strongest part of the product** and none of it
is on the critical path for the verdict.

| Surface | Finding |
|---|---|
| **XSS** | **Clean, and I tested it rather than asserting it.** No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no `new Function` anywhere in `src/`; `react/no-danger` is `'error'` in `eslint.config.js:47`. I injected `<img src=x onerror=alert(1)>` into `cost.partyTotal` in `localStorage` and reloaded: rendered as inert text, no `<img>` in the DOM, no dialog. QA independently drove the same payload through the basics and adjust forms. |
| **Injection** | No SQL, no shell, no server, no query construction of any kind. Catalogue lookups are property reads on frozen literals. Nothing to inject into. |
| **Stored data** | Exactly one key, `compass.session.v1`, 17.5 KB measured: a vibe, five basics fields, 3–5 multiple-choice answers, child ages, and a computed plan. No names, no email, no phone, no payment details, no location, no fingerprint. There is no account and no server log because there is no server. |
| **Network** | **Zero requests after load** — architecturally, not by policy. Verified by QA's offline sweep (full flow to a copied itinerary with an empty `requestfailed` list) and enforced by `connect-src 'none'`. |
| **CSP** | `default-src 'self'; connect-src 'none'; img-src 'self' data:` in `index.html` and in `dist/index.html`; `tests/csp.test.ts` asserts the shipped string byte for byte so the dev relaxation cannot leak. I served `dist/` under it and walked to the question screen: **zero violations, zero page errors.** Missing `frame-ancestors` and `base-uri` — no session, no auth, nothing to clickjack into, so this is hygiene not risk. One line. |
| **Untrusted input into the engine** | `localStorage` is parsed field by field, never spread. `narrowAnswers` explicitly skips `__proto__`, `constructor` and `prototype`; the session is built into a fresh object literal, so prototype pollution has no path. **Partial gap:** `narrowPlan` validates ~14 fields then casts the whole object (D12). A tampered nested field crashes into the `ErrorBoundary` with a working Start over — self-inflicted denial of service only, no escalation, no data exposure. `int()` also accepts floats, zero and negatives, so a tampered `travellers: 0` renders "0 travellers" rather than being rejected. |
| **Dependencies** | **Two runtime dependencies: `react`, `react-dom`. `npm audit --omit=dev`: 0 vulnerabilities.** Nothing else reaches a browser. This is the strongest supply-chain position available and it was defended through two refinement rounds. |
| **Dev dependencies** | 5 advisories (1 critical, 1 high) in `vitest`/`vite`/`esbuild`/`launch-editor` — Vitest UI arbitrary file read, Vite dev-server path traversal, mostly Windows-specific. **None ships.** They are a developer-workstation and CI concern, not a user one. Bump vite/vitest at the next convenient moment; not gate-blocking. |
| **Secrets** | **None, and nowhere to put one.** No API keys, no tokens, no `.env`, no config file with a credential shape. I grepped. |
| **Consumer protection (R16)** | Non-dismissable provenance line on every priced screen; QA walked the accessibility tree on every screen and found zero elements named Book/Pay/Checkout/Reserve. Anita — the judge burned by a real ₹1.2L→₹2.1L booking — named the footer as the single thing that most lowered her guard. This requirement is doing real work. |

---

## What I would do next with a week

Ranked by what moves the verdict, then by what moves the panel score.

1. **Make the relaxation banner true** *(0.5 day)* — bottleneck §2. Ship the cheap guard
   plus the `restore.costDelta < 0` assertion immediately; do the search-based ladder
   in the same change. This is first because it is the one defect that makes the
   product actively dishonest, R16 is the product's whole differentiator, and it cost
   the lowest score on the panel (Trust 4).
2. **Give the scheduler enough to schedule, and stop mislabelling the gap** *(1.5 days)*
   — bottleneck §1. Re-base invariant C3 onto `(destination × stay)` and let it fail;
   fill or cap the six thin bases; split `FREE_DAY_NOTE` from the supply-shortfall
   sentence; make R21 drop experiences rather than capacity. Closes B6 and B7, which is
   the QA gate.
3. **Add the vibe floor the architecture already specifies** *(2 hours)* — D1. One
   `ConstraintSpec`, into `specs`, done. It closes Rohan's "Manali for a beach holiday"
   and Kabir's 1/5-for-Party in a single change, and the banner it fires is a *feature*:
   *"No beach trip fits, so we widened the search"* is exactly the honesty this product
   sells. Best trust-per-hour in the list.
4. **Make a restored plan a first-class state** *(0.5 day)* — D4 + D5. `forcedConstraints`
   into `SessionState` and `PersistedSession` (schema 3), `changeNotice: null` in
   `applyRestore`. Closes two of Kabir's three blockers and restores the invariant that
   the screen is a function of the session.
5. **Re-run the gates** *(0.5 day)*. `npm run e2e` must exit 0. Then close B1/B2/B8 —
   B2 is a one-line copy decision that is mine to make: **change the heading to
   "How long a flight? (long-haul is fine)"** rather than weaken UX8, because the word
   is what QA is checking for and the heading is where a user looks.
6. **Take back the performance I lost** *(0.5 day)* — bottleneck §3. Hoist `dates` and
   weekday indices onto `PlanContext`; add a Vitest assertion that `generatePlanSet`
   stays under 5 ms at 140 destinations, so §7's numbers stop being folklore.
7. **Close the method gap** *(0.5 day)*. A second Playwright project against a static
   `dist/` server, so the artefact we ship is the artefact we test. Then the S4s: the
   `₹-9,640` sign, `overflow-wrap` on the plan ID, the 44×44 checkbox, the duplicated
   `countLabel`.

**Not in the week, and deliberately:** the `TravelDataSource` index split. It is the
right fix for 100× and it is not the constraint today — 14 destinations is. Rohan's
*"one of 1 destination in this catalogue"* and Kabir's *"₹1.5 lakh apart, no
explanation"* are both catalogue-thinness symptoms, and content is cheaper than
architecture here. The seam is built and it will still be there when it is needed;
that was the point of building it.
