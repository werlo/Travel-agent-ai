# Architecture Review — Compass (trip-planner)

**Author:** Tech Lead · **Reviews:** the code as built vs `02-architecture.md`
**Date:** 2026-08-18 (final pass, post F1–F4 and customer-feedback rounds 1–3)
**Method:** read `src/` in full (~9,000 lines); ran `build`, `lint`, `test`, `e2e`
myself from a clean checkout; instrumented the engine directly with a standalone
benchmark; wrote and ran a targeted reducer reproduction for a suspected gap in the
F2 state-coherence fix, not documented anywhere else in this product.

This is the second review of this codebase. The first (superseded by this one, its
findings folded into the drift table below) was a **NO-GO** on three correctness
defects: a relaxation banner that asserted a false universal, an itinerary that went
blank on long trips, and a missing vibe-affinity floor. Four fix rounds (F1–F4) and
three further customer-feedback rounds addressed all of it, per QA rounds 3 and 4
(both PASS, both independently re-verified rather than taken on the fix commits'
word). I re-checked every one of those claims myself rather than re-reading my own
prior verdict, and one of the fixes turns out to be **incomplete** — see *Real
bottleneck*.

---

## Verdict

## GO WITH RISK

The product is honest, well-tested, and the security posture is the strongest I have
reviewed in this pipeline: two runtime dependencies, zero production vulnerabilities,
a real enforced CSP, and zero network calls after load. `npm run build`, `npm run
lint`, `npm test` and `npm run e2e` all pass, clean, from this checkout — 511 unit
tests, 226 E2E tests, exit 0 across the board. The three correctness defects that
earned the previous NO-GO (the false relaxation banner, the blank-day itinerary, the
missing vibe floor) are genuinely fixed; I re-drove all three rather than trusting
the fix commits or QA's write-up.

It is not an unconditional GO because I found a fourth instance of the exact bug
class the previous review's D5 finding named, in the one code path nobody's
regression coverage happens to exercise: applying R14's "Put `<X>` back" restore
control leaves the R19 change-notice banner naming the pre-restore destination and
reasoning, while the `<h1>` and every other region of the screen show the restored
one. It is reproducible on a stock scenario, it is not caught by the test suite
(511 + 226 tests, zero of which drive this specific transition), and it is precisely
the "which one am I buying, the heading and the banner disagree" defect a customer
judge (Anita, round 2) already flagged and cost the product real trust once before.
It is a half-day fix with an obvious template two lines above it in the same file.
I am not blocking the release on it — it is narrow, cosmetic-adjacent to the actual
plan (which is correct throughout), and the founder should see the product as it
stands — but it should not ship silently, and it is exactly the kind of thing a
"PASS" verdict makes easy to miss.

---

## Evidence — what I ran

From `products/trip-planner`, by me, this session, on the current `HEAD`
(`591eab6`, `src/` clean):

| Command | Result |
|---|---|
| `npm run build` | **PASS**, exit 0. 80 modules, `index.js` 305.55 kB / **90.03 kB gzip**, CSS 24.13 kB / 4.83 kB gzip. Under the 200 KB gzip budget. |
| `npm run lint` | **PASS**, exit 0. ESLint at `--max-warnings=0` plus `tsc --noEmit`, no output. |
| `npm test` | **PASS**, exit 0. **511 tests in 27 files**, ~27 s. |
| `npm run e2e` | **PASS**, exit 0. **226 passed, 0 failed**, ~5.0 min. |

This is the house stack's own *definition of runnable*
(`npm install && npm run build && npm test && npm run e2e`, zero failures) and it is
met, for the first time in this product's history — the prior three QA rounds each
carried open failures (round 1: 3 known S3s left failing on purpose; round 2: those
3 plus 2 new S2s; round 3 and 4: fully green, matching what I got here independently).

Beyond the chain: `npm audit --omit=dev` → **0 vulnerabilities**. Grepped `src/` for
`dangerouslySetInnerHTML`, `: any`, `as any`, `@ts-ignore`, `@ts-expect-error`,
`@ts-nocheck` → **zero hits, all of them**. Every `catch` in `src/` (6 total) logs a
stable `[compass] E-*` code; none is empty.

---

## Drift

`02-architecture.md` §12 now carries ~60 developer-recorded deviations across four
slices and four fix rounds. The overwhelming majority are well-reasoned and
correctly argued in the moment — that table remains the best single artefact in this
product, and I am not going to re-litigate settled, well-documented calls. What
follows is what §12 does **not** say, or where my own prior review's "confirmed
fixed" turned out to need a caveat.

| # | Designed / previously reviewed | Built / found this pass | Impact | Accept or fix |
|---|---|---|---|---|
| D1 | Prior review (D5): "`applyRestore` swaps `planSet` and does not clear `changeNotice`. **Fix. One line: `changeNotice: null`.**" F2's commit message and QA round 3's table both claim this is fixed. | **Not fixed.** `sessionReducer.ts`'s `applyRestore` case (line 370) still does not touch `changeNotice` — I read the code, then wrote and ran a standalone reducer test to confirm live: after a relaxed plan sets `changeNotice = "Changed to keep you inside budget: you asked for international — nothing fits ₹25,000 for 4, so this is Puducherry & Auroville"` and the user clicks "Put international back", the screen shows **Bangkok & Ayutthaya** while the notice still names Puducherry. QA's round-3 regression test for "the change notice never names a destination other than the one in the `<h1>`" (`qa-09-round3.spec.ts:176`) exercises `selectVariant` + `adjust` (picking the Saver, then changing Adults) — a different pair of reducer cases, both of which *do* recompute `changeNotice` correctly. `applyRestore` was never independently covered. | **Medium.** The underlying plan is correct throughout — price, itinerary, destination all update together and correctly. Only the one sentence explaining *why* is stale, and only after the one specific control (R14's restore) that exists to reassure a user who just saw "nothing fits". That is close to worst-case placement for a trust bug: Anita's round-2 blocker ("the heading and the yellow box don't agree") was this exact failure mode via a different transition, and it is the sentence R19 exists to get right. | **Fix.** One line, following the pattern already correct in `adjust`, `rejectDestination`, `undoReject` and `restore`: recompute (or null) `changeNotice` in `applyRestore` using the same `changeNotice({ previous, next, planSet })` call the other cases use. ~30 minutes including a regression test that actually drives `requestRestore` → `applyRestore`, which is the gap that let this hide. |
| D2 (prior review, D1–D3) | NO-GO: false relaxation banner, blank-day itinerary from 6 nights, no vibe floor. | **Confirmed fixed**, independently re-driven, not taken on QA's word. Reproduced the prior review's own 9-adult repro (Party/city/9/₹4,50,000/Delhi): recommended total is now within budget×1.25 and the banner never claims falsely. Ran the full `npm test` suite, which includes the exhaustive `restore.costDelta < 0` sweep across every vibe×region×budget×traveller combination — passes. Drove the Beach 20–27 Dec 2026 case that previously left 2 of 8 days blank — all 8 days now carry ≥1 experience or an honestly-labelled supply-shortfall/free-day note. | — | **Accept.** This was the real work of F1/F2 and it holds. |
| D3 | §7's performance model: `generatePlanSet` "9.16 ms at 1,400 destinations" (original architecture), later measured at "56.19 ms" by the first review. | Measured this session, same method (synthetic catalogue expansion, same input shape): **1.21 ms at 14 destinations** (42 candidates), **8.02 ms at 140** (420), **81.66 ms at 1,400** (4,200). See *Real bottleneck* §2 — this is 46% worse than the first review's own number at 100×, four fix rounds later. | Medium at 1× (no visible effect — Apply is instant), **rising at 100×**: 82 ms is most of a frame on this machine and would be ~300 ms+ on a mid-range phone, on the one interaction (Adjust panel Apply) that has no loading state to hide it behind. | **Accept the finding, still not urgent.** Same fix the first review named — hoist the per-candidate `dates` array and weekday indices onto `PlanContext`, computed once — remains undone and remains cheap (~1 h). Each round of correctness fixes (R18's fixed-weekday matching, R25's floor, R27's reroll-honesty check) adds a small constant amount of per-candidate work, and the trend across two measurements is upward, not flat. Worth doing before the next feature round touches `buildCandidates` again, not before this release. |
| D4 | §8: "there is nowhere to put a secret" / two-package runtime surface. | Confirmed again. `package.json` dependencies: `react`, `react-dom` only. `npm audit --omit=dev`: 0 vulnerabilities. No `dangerouslySetInnerHTML`, no `eval`, `react/no-danger` still `'error'`. | — | **Accept.** Held through five rounds of feature work without erosion — worth naming because that is not the default outcome. |
| D5 | Prior review (D12): `narrowPlan` validates ~14 fields then casts the rest of the object wholesale (`value as unknown as Plan`). | Unchanged. Still the one gap in an otherwise careful untrusted-input boundary; still self-inflicted only (crashes into the `ErrorBoundary`, no escalation, no data exposure), still not worth blocking on. | Low. | **Accept for this release**, same as before. ~1 hour to close properly (narrow `days[].experiences[]` and `legs[]` element-wise) whenever `storage/` is next touched. |
| D6 (improvement) | §4.5 restore control: "re-runs the engine with that one key forced back on... selected by cheapest". | `restoreFor` now also threads `held` (everything the shown plan already honours) into the search, and F2's commit explains why: with two independently droppable constraint *kinds* live at once (the R25 vibe floor plus a graph answer), a naive "cheapest satisfying X" search could trade away a constraint the shown plan already held. This is a real, subtle correctness improvement over what I specified in §4.5, and it is unit-tested (`tests/relaxation.test.ts`, `tests/planner.test.ts`). | Better than the original spec. | **Accept.** |
| D7 (improvement) | Original architecture: the relaxation ladder drops "the most recent answer first, fixed order". | `survive()`/`stableSurvive()` now choose the drop set by minimum-violation search over the whole candidate set, with a monotone-convergence guarantee documented in the function's own comment and enforced by `tests/planner.test.ts`'s exhaustive sweep. This is the single most load-bearing piece of logic in the product and it is the best-commented function in the codebase — the comment explains *why* the naive version was wrong, not just what the code does. | Correct, and better than the original spec (§4.5) which is what caused the NO-GO. | **Accept, and note for future Tech Leads:** when a spec turns out to have a bug like this one did, the fix belongs in the architecture doc's own reasoning, not just the code — which is exactly what happened here. |

---

## Real bottleneck

Two things, not one, and neither is what a superficial re-read of the prior review
would predict.

### 1. A fix round's own regression coverage has a blind spot the size of one reducer case — reproducible today

This is the finding that keeps the verdict at GO WITH RISK rather than GO. I did not
predict it; I found it by re-deriving the previous review's D5 finding from first
principles (re-reading every plan-replacing `case` in `sessionReducer.ts` and asking
"does this one recompute `changeNotice`?") rather than trusting that F2's commit
message ("`changeNotice: null` set on every plan-replacing reducer case") was
complete. It was not.

Reproduced with a standalone reducer test (not committed — a throwaway repro,
deleted after confirming):

```
Party / International / no-preference×3 / ₹25,000 / 4 travellers / 10–12 Oct 2026

planReady:      changeNotice = "Changed to keep you inside budget: you asked for
                 international — nothing fits ₹25,000 for 4, so this is
                 Puducherry & Auroville"
                 <h1> = Puducherry & Auroville

requestRestore → applyRestore (forceConstraints: ['region'], the restored,
                 international plan):
                 <h1> = Bangkok & Ayutthaya
                 changeNotice = UNCHANGED — still names Puducherry & Auroville
                 and the reason it was chosen, which is no longer why anything
                 on screen is what it is.
```

Every other plan-replacing action — `adjust`, `rejectDestination`, `undoReject`,
`selectVibe`, `restore`, `planReady` — either recomputes `changeNotice` via the
`changeNotice()` function or explicitly nulls it. `applyRestore` is the one
exception, and it is the one action QA's round-3 regression coverage for this exact
class of bug (`qa-09-round3.spec.ts:176`, titled almost word-for-word after the
prior review's own D5 language) does not exercise — that test drives
`selectVariant` + `adjust`, a different pair of cases that happen to both be
correct.

**Why this is the real bottleneck and not the compute number below:** it is a live,
reachable, S2-class defect (a requirement — R19, "say what changed, where they are
already looking" — is unmet on a documented, exercised path) sitting inside a
product that just cleared a fully-green 737-test suite and two consecutive PASS
verdicts. The lesson is not "test more" in the abstract; it is that a fix scoped to
"every plan-replacing case" was verified against a *sample* of those cases chosen
because they were the ones the customer feedback happened to name, not by
enumerating the reducer's own `case` list. The same enumeration-vs-sample gap is
worth checking the next time any fix round claims a blanket property across a set
of `switch` cases.

**Fix.** `case 'applyRestore'` needs the same treatment as `adjust`:
```ts
case 'applyRestore': {
  const shown = state.planSet?.[state.selectedVariant] ?? state.planSet?.recommended ?? null
  const next = action.planSet.recommended
  return {
    ...state,
    planSet: action.planSet,
    selectedVariant: 'recommended',
    restoreRequested: false,
    pinnedDestinationId: null,
    changeNotice: changeNotice({ previous: shown, next, planSet: action.planSet }),
    announcement: `Showing the ${action.label} plan. ...`,
  }
}
```
Plus a regression test that actually drives `requestRestore` → `applyRestore` and
asserts the notice, the way `qa-09-round3.spec.ts:176` does for the adjust path.
~30 minutes total.

### 2. Compute at 100× catalogue growth — 82 ms, worsening across fix rounds, still not urgent at 1×

Measured this session with a standalone benchmark (synthetic catalogue expansion,
same 21-night/12-traveller worst-case input the original architecture doc used):

```
   14 destinations (   42 candidates):   1.21 ms  measured
  140 destinations (  420 candidates):   8.02 ms  measured
1,400 destinations (4,200 candidates):  81.66 ms  measured

§7 of 02-architecture.md originally claimed:    9.16 ms at 1,400
First review (post refine-1) measured:         56.19 ms at 1,400
This review (post F1–F4 + round-1 customer fixes): 81.66 ms at 1,400
```

The trend across three measurements of the same design decision — `buildCandidates`
calls `scheduleItinerary` and `priceCandidate` for every one of the 42 candidates on
every `generatePlanSet` call — is monotonically worse, because each correctness fix
(R18's fixed-weekday matching inside `scheduleItinerary`, R25's vibe floor as a
`ConstraintSpec` evaluated per candidate, R27's reroll-honesty check which calls
`buildCandidates` a second time over the *excluded* set) adds a small constant
amount of per-candidate work. None of it matters at the MVP's 14 destinations
(1.21 ms, invisible), and the Adjust-panel Apply path has no loading state, so this
would start to be felt only past ~10× catalogue growth. It is not urgent for this
release. It is worth flagging because "not urgent" has now been the correct answer
three times in a row while the number has grown 9×, and the fix identified two
reviews ago (hoist the per-candidate date array onto `PlanContext`, computed once)
is still a ~1 hour change that has not been made.

---

## Scale readiness

Static client-side app: an extra *user* costs one CDN hit and nothing else. Every
row below is about **catalogue growth**, the only axis that moves.

| Scale | Holds? | First thing to break | Fix | Effort |
|---|---|---|---|---|
| **1× (today)** | **Yes.** | Nothing observed in this pass. The three prior NO-GO defects are fixed and re-verified; the `applyRestore` notice bug above is real but narrow (one control, one sentence, correct data everywhere else) and does not block ordinary use. | Fix D1 above before the next release. | 30 min |
| **10×** — 140 destinations | Yes | Nothing. `generatePlanSet` 8.02 ms (measured); catalogue ~650 KB raw / ~100 KB gzip (reasoned from 14→140 linear scaling, unique-prose caveat as in the original doc); session storage unaffected (writes are O(1) in destination count). | None. Ship it. | — |
| **100×** — 1,400 destinations | No | Two things. **(a) Compute: 81.66 ms measured**, worsening each fix round (see *Real bottleneck* §2), on the Apply path which has no loading beat. **(b) Payload:** the catalogue is still compiled into the JS bundle; at 1,400 destinations this is multi-MB raw, ~1 MB+ gzip, minutes on a slow link before first paint. | (a) Hoist the per-candidate date array onto `PlanContext` (~1 h); defer full day-block construction to the ~3 plans actually rendered (~3 h). (b) The `TravelDataSource` split the architecture doc names in §7 still stands and is still unbuilt — ship a scoring index, lazy-fetch the few full records a plan needs. | (a) **half a day** · (b) **~1 day** — `generatePlanSet` still takes a `CatalogueSnapshot`, not a `TravelDataSource`, so this remains a `SessionProvider`-only change |
| **1000×** — 14,000 destinations, or live inventory | No | Same as every prior review: catalogue freshness has no delivery mechanism, and at this scale "compile it into the bundle" stops being a sentence anyone should say. This is a product threshold (every judge who said they'd pay conditioned it on real prices) as much as a technical one. | Versioned JSON API behind the same `TravelDataSource`; plan IDs already carry the snapshot version, so determinism survives by pinning the snapshot per plan ID. | **1–2 weeks**, and it introduces the first server this product has ever had. Everything above `TravelDataSource` — the engine, the graph, the pricing, all ~511 unit tests — survives unchanged, which remains the return on that seam. |

---

## Code health

| Area | Finding | Sev | Fix cost |
|---|---|---|---|
| **State coherence — `applyRestore`** | Stale `changeNotice` after the R14 restore control (D1 above); the one uncovered case in an otherwise-correct set of plan-replacing reducer transitions. | **S2** | 30 min |
| **Type escapes** | **Zero.** No `any`, `as any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` anywhere in `src/`. Confirmed by grep, not by trusting the prior review's count. | — | — |
| **Error handling** | Six `catch` blocks total, every one logs a stable `[compass] E-*` code (`E-CLIPBOARD` ×2, `E-STORAGE-READ`, `E-STORAGE-SCHEMA` ×2 sites, `E-STORAGE-WRITE`, `E-STORAGE-CLEAR`, `E-RENDER`). Nothing is swallowed silently. `generatePlanSet` is still deliberately unwrapped — a throw there is a bug, not a recoverable state, and the `ErrorBoundary` catches it with a working Start-over. | — | — |
| **Domain purity** | `tests/eslint-domain-purity.test.ts` still runs ESLint against a deliberate `window` reference inside `src/domain` and asserts it fails, then lints the real sources clean. Held through five rounds of feature work touching `domain/planner.ts`, `domain/constraints.ts`, `domain/exclusions.ts` and others. This remains the single highest-value line of process in the codebase. | — | — |
| **Coupling** | Unchanged and clean: `ui → app → domain`, `data`/`storage → domain` (types only), no reverse edges. `App.tsx` (230 lines) still runs the engine in click handlers and dispatches the resulting plan atomically with the new inputs — the same deliberate choice from slice 4, still correct. | — | — |
| **Duplication** | `countLabel` is still defined identically in `party.ts:58` and `pricing.ts:46`. No new duplication found elsewhere in a full read of `domain/`. | S4 | 10 min |
| **Dead code** | `money.isWholeRupees` and `constraints.keysOf` remain unreferenced exports, unchanged from the prior review. Everything else that looks unused on a grep is a `*Props` interface or an internal constant — idiomatic, not dead. | S4 | 15 min |
| **Test quality** | 511 unit + 226 E2E. I looked specifically for assertion-free tests and for the D1 finding's blind spot pattern elsewhere (a fix claimed against "every case in a set" verified against a subset) and found one soft spot repeated from the prior review: `qa-03-plan.spec.ts:292` still uses `test.skip(!line.startsWith('Stretch'), ...)`, silently disarming if the catalogue stops producing a Stretch case for that fixture. No other assertion-free or trivially-true test found in a full read of `tests/planner.test.ts`, `tests/relaxation.test.ts` and `tests/itinerary.test.ts` — the three files carrying the highest-stakes logic. | S3 | 1–2 h |
| **Coverage method gap** | Unchanged from the prior review: `playwright.config.ts`'s `webServer` still points at `npm run dev`, and `vite.config.ts` still relaxes CSP for `apply: 'serve'`. No automated test loads `dist/` under the shipped policy. I loaded it manually — clean, zero violations. Still a method gap, not a live defect. | S3 | 2 h |
| **Bundle** | 90.03 kB gzip against the 200 kB budget, up from 87.18 kB (round 3) as R27–R31 landed. Headroom is still comfortable (~55%). | — | — |

---

## Security

Reviewed by reading the code and re-attacking the running app. Unchanged in every
material respect from the prior review, re-verified rather than re-asserted.

| Surface | Finding |
|---|---|
| **XSS** | Clean. No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` anywhere in `src/`; `react/no-danger` is `'error'`. QA's hostile-input sweeps (four rounds of them) drive `<img src=x onerror=alert(1)>` through every text-entry surface added since the last review (the R26 "Anywhere except…" field, the R24 child-age fields) with the same clean result. |
| **Injection** | No SQL, no shell, no server, no query construction. Nothing to inject into. |
| **Stored data** | One `localStorage` key, `compass.session.v1`, schema 2. No names, email, phone, payment details, location or fingerprint. Vibe, basics (now including child ages), 3–5 answers, exclusions, a pinned destination id, and a computed plan. |
| **Network** | Zero requests after load, enforced by `connect-src 'none'` and re-verified by QA's offline sweep every round since round 1. |
| **CSP** | `default-src 'self'; connect-src 'none'; img-src 'self' data:`, asserted byte-for-byte in `tests/csp.test.ts`. Still missing `frame-ancestors`/`base-uri` (hygiene, not risk — no session, nothing to clickjack into). |
| **Untrusted input into the engine** | `localStorage` is parsed field-by-field; `__proto__`/`constructor`/`prototype` explicitly skipped in `narrowAnswers`. `narrowPlan`'s partial-cast gap (D5 above) is unchanged: a hand-tampered nested field still crashes into the `ErrorBoundary` rather than the vibe screen, self-inflicted denial of service only. |
| **Dependencies** | Two runtime dependencies (`react`, `react-dom`). `npm audit --omit=dev`: 0 vulnerabilities, confirmed this session. |
| **Secrets** | None, nowhere to put one. Grepped `src/` for anything credential-shaped; nothing found. |
| **Consumer protection (R16)** | Non-dismissable provenance line on every priced screen, unchanged. QA's accessibility-tree sweep (repeated every round, including on the five new R27–R31 surfaces) continues to find zero elements named Book/Pay/Checkout/Reserve. This requirement is still doing real, measured work — it is the single most-cited thing in the customer panel's trust scores across three rounds of judges. |

---

## What I would do next with a week

Ranked by what a founder reading this review would actually want fixed first.

1. **Close the `applyRestore` change-notice gap** *(30 min)* — the one thing keeping
   this at GO WITH RISK. It is a one-line fix with a working template two cases
   above it, plus a regression test that finally exercises `requestRestore` →
   `applyRestore` directly, which is the coverage gap that let it hide through two
   PASS verdicts.
2. **Audit every other "fixed in every case of a switch" claim in this codebase's
   history against the actual case list** *(2 h)* — not because I found a second
   instance, but because the process failure that produced D1 (verifying a claimed
   blanket property against the specific scenarios a customer named, rather than
   against the reducer's own enumeration) is exactly the kind of gap that produces a
   second one quietly. `sessionReducer.ts` has 24 cases; I read all of them this
   pass and found one gap. The next fix round should not have to.
3. **Take back the performance trend** *(half a day)* — hoist the per-candidate date
   array onto `PlanContext`. Cheap, well-understood, has been the correct
   recommendation for two reviews running, and the number keeps getting worse as
   correctness fixes land.
4. **Close the `dist/`-under-CSP method gap** *(2 h)* — a second Playwright project
   against a static build of `dist/`, so the artefact that ships is the artefact
   that is tested, not one manually spot-checked by whoever happens to review it.
5. **The small stuff** *(1 h total)* — dedupe `countLabel`, delete the two dead
   exports, replace `qa-03:292`'s `test.skip` with a fixture guaranteed to produce a
   Stretch case so the assertion cannot silently disarm.

**Not in the week, still deliberately:** the `TravelDataSource` index split for
100× catalogue growth. Fourteen destinations is still the binding constraint on
trust (per every customer judge who has ever run this panel), not architecture, and
the seam is built and waiting for the day content, not code, is the bottleneck.
