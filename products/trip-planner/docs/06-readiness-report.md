# Readiness Report — Compass (trip-planner)

**For:** the founder · **Verdict:** READY WITH CAVEATS

## What you have

A web app that turns a mood ("beach", "peace and quiet"), some dates, a budget and a
headcount into one specific, costed, day-by-day trip — destination picked for you,
with the full price breakdown and the reasoning shown. It does not book anything and
says so on every screen; the flight/hotel/activity prices are a labelled sample
catalogue (14 destinations), not live inventory, because no key-less aggregator API
exists and the brief also asked for deterministic output, which live fares would
break.

## Try it

```bash
./scripts/serve-product.sh trip-planner
```

Then open **http://localhost:4079** and do this:

1. Click a vibe card (e.g. **Beach**) → **Continue**. The next screen is already
   pre-filled with plausible dates, budget and traveller count — change what's wrong.
2. On the first question, click **"Plan my trip now"** to skip straight to a plan
   (or answer 3–4 quick questions first).
3. Read the result: one destination, a day-by-day itinerary, a cost breakdown that
   sums to the total, and a "Why this trip" section naming a rejected runner-up.
   Try **"Not this one — somewhere else"** and **"Copy as text"**.

## What is proven

| Claim | Evidence |
|---|---|
| Builds clean | `npm run lint && npm run build` — run by me from `products/trip-planner`, both exit 0, no warnings, no `tsc` errors |
| 511 unit tests pass | `npm test` — run by me, `27 files passed, 511 tests passed`, exit 0 |
| Full E2E suite passes | `npm run e2e -- --reporter=line --workers=4` — run by me, `226 passed, 0 failed`, exit 0 |
| `src/` is unmodified by QA's own testing process | `git status --short src/` — run by me, empty output |
| Zero open S1/S2 defects | QA report round 4 (`docs/04-qa-report.md`), corroborated by my own clean `e2e` run — the ten bugs found across earlier rounds are closed or explicitly documented as accepted (B3, B10, both S3/S4 cosmetic) |
| Security posture is strong | Tech Lead's independent re-check (`docs/07-architecture-review.md`): two runtime dependencies, `npm audit --omit=dev` → 0 vulnerabilities, zero network calls after load, no `dangerouslySetInnerHTML`/`eval`/`as any` anywhere in `src/` |
| A known trust bug survives in the shipped code, contradicting an earlier "fixed" claim | Tech Lead's own reducer test (`docs/07-architecture-review.md`, finding D1): clicking "Put `<X>` back" after a relaxed plan restores the correct destination and price, but the explanatory banner next to the total still names the *previous* destination and reasoning. QA's round-3 report had marked this "confirmed fixed"; the Tech Lead re-drove it directly and found it is not. |
| 3-judge customer panel did not clear the release gate | `docs/05-customer-feedback.md` — mean score ≈7/10 against an 8.0-with-zero-blockers gate, two blockers open on the final round, both from the same judge (Anita, the trust-sensitive persona) |

Every command above was run by me this session, from `products/trip-planner`, on the
current checkout — not copied from an earlier QA round's report.

## What customers said

Two of three judges (Rohan, Kabir) reached a costed plan fast, trusted the
arithmetic, and would use it again; the panel's mean is dragged down by Anita (the
budget-sceptic persona), who hit two blockers in the same session on the "reroll to
a different destination" path: it produced a plan and, in the very next screen,
displayed a banner claiming "nothing within India fits your budget" while the
in-budget, within-India plan she had just been looking at was still one click away,
listed on the same page as a rejected option. She also caught the reroll silently
dropping her "within India" preference without asking, despite the control's own
label promising to "keep every answer." Her verdict: she would not recommend it to
family until a banner never contradicts something visible on the same screen.

## What is knowingly missing

| Gap | Why it was cut / why it's open | What it takes |
|---|---|---|
| Live, bookable prices | No key-less API exists for Google Flights/Skyscanper/etc., and the sandbox forbids live third-party calls. Every price is a labelled, date-stamped sample catalogue. | Weeks — a paid aggregator credential and a server, both outside this environment. The `TravelDataSource` seam is built so this is a swap, not a rewrite. |
| Restore control shows a stale "why" banner | `applyRestore` in `sessionReducer.ts` is the one plan-replacing action that never recomputes `changeNotice`; every other action (adjust, reject, undo, select-variant) does. Not caught by the 226-test E2E suite because no test drives that exact transition. | ~30 minutes — one line, following the pattern already correct two cases above it in the same file — plus a regression test that actually exercises `requestRestore → applyRestore`. |
| Customer panel gate not met | Mean ≈7/10 vs the 8.0/zero-blockers bar; the one refinement round available for this run has been used. Two blockers open, both on the reroll-honesty path (see above). | A further fix + re-panel round, scoped at roughly a day (the Tech Lead's review shows this is the same bug *class* as the applyRestore issue above — a plan-replacing code path that doesn't recompute its own explanatory text). |
| Single vibe only ("Party *and* Peace & Quiet" not expressible) | Two vibes make the affinity score ambiguous (best-of vs. average); deliberately rejected in PRD A8. A mixed-mood trip is approximated by the "leave one day free" control inside one vibe. | Product-shape decision, not a bug fix — would need its own scoring model. |
| No per-person flight-time control ("no 3am departure") | The sample catalogue models fares and durations, not schedules; inventing clock times would be fabricating a fact the catalogue doesn't have. A later fix (R30) added indicative departure/arrival times to the itinerary, but there is still no way to *filter* on them. | Requires the same paid-inventory problem as live prices. |
| Compute at 100× catalogue growth (1,400 destinations) | `generatePlanSet` measured at 81.7 ms by the Tech Lead — worsening across every fix round (56 ms → 82 ms) as correctness fixes each add per-candidate work, on the one interaction (Adjust panel Apply) with no loading state. Invisible today at 14 destinations (1.2 ms). | ~half a day — hoist the per-candidate date/weekday arrays onto `PlanContext`, computed once instead of per candidate. |
| Two small S4 polish items left open by design, not oversight | B3 (changing travellers can switch destination rather than scaling the fare linearly — R9's budget ceiling correctly overrides R8's literal) and B10 (the seasonal cost line has no explicit tax qualifier, though a footnote covers it) | Both are documented, accepted trade-offs in the QA report, not defects. |

## Scale and cost

As a static client-side app, an extra user costs nothing but a CDN hit. The only
axis that matters is catalogue size. At today's 14 destinations, everything is
instant (1.2 ms to generate a plan) and the whole app is 90 kB gzipped — well inside
budget. At 10× (140 destinations) nothing breaks. At 100× (1,400 destinations), two
things do: the plan-generation compute rises to ~82 ms — most of a frame, felt on a
mid-range phone, on the one action with no loading spinner to hide it — and the
catalogue is still compiled directly into the JS bundle, which becomes a multi-MB
download. Both are known, scoped fixes (half a day and about a day respectively;
the `TravelDataSource` interface named in the architecture doc is the seam for the
second one and is already built, just unused). At 1,000×, or with live inventory,
the product needs its first server — a versioned JSON API behind that same
interface, 1–2 weeks of work — but the planning engine, the question graph and all
511 unit tests survive that change unchanged, which is the return on having built
the seam early.

## If you want to keep going

1. **Fix the `applyRestore` stale-banner bug and re-run the customer panel.**
   Highest leverage: it's a 30-minute code fix that plausibly closes both of
   Anita's blockers (the reroll-honesty issue is the same code pattern — a
   plan-replacing action that doesn't recompute its own explanatory text — that the
   Tech Lead found in a sibling function). One more panel round is the real gate to
   clear; everything else already passes.
2. **Audit every other "fixed for every case in a switch statement" claim against
   the reducer's own case list**, not against the specific scenarios a customer or
   test happened to name. This is exactly the process gap that let the restore bug
   ship twice — the Tech Lead recommends this explicitly and estimates ~2 hours.
3. **Take back the performance trend before the next feature round touches the
   scoring engine again** — hoist the per-candidate date/weekday computation onto
   shared context (~half a day). Cheap now, and the number has gotten worse three
   reviews running as correctness fixes piled up.
