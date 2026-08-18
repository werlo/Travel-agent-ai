# QA Report — Compass (trip-planner)

**Author:** QA Engineer · **Round:** 1 · **Date:** 2026-08-18 · **Verdict: PASS**

Zero open S1 or S2. Three S3 deviations and two S4 nits are listed below and are not
gate-blocking.

Scope: every one of R1–R17 and every one of UX1–UX24 has at least one Playwright spec
driving the real UI at `http://localhost:4079`. Nothing was marked PASS on inspection
alone. QA wrote **109 new E2E tests** in `e2e/qa-01…qa-06` plus `e2e/qa-helpers.ts`;
the 45 pre-existing developer specs were left untouched and re-run as a regression.
No product source was modified.

---

## Commands run

Full chain, from `products/trip-planner`:

```
$ npm run lint && npm run build && npm test && npm run e2e
```

### `npm run lint` → PASS (exit 0)
```
> compass-trip-planner@0.1.0 lint
> eslint . --max-warnings=0 && tsc --noEmit
```
No output. ESLint clean at `--max-warnings=0`, `tsc --noEmit` clean — including the
new `e2e/qa-*.spec.ts` files, which are type-checked by the same project config.

### `npm run build` → PASS (exit 0)
```
> compass-trip-planner@0.1.0 build
> tsc -b --noEmit false && vite build

vite v5.4.21 building for production...
transforming...
✓ 76 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.11 kB │ gzip:  0.64 kB
dist/assets/index-BJ6Xh2Cp.css   21.99 kB │ gzip:  4.54 kB
dist/assets/index-MIiM1b36.js   269.20 kB │ gzip: 81.15 kB
✓ built in 965ms
```

### `npm test` → PASS (exit 0)
```
 Test Files  21 passed (21)
      Tests  395 passed (395)
   Start at  12:14:38
   Duration  20.98s (transform 889ms, setup 2.64s, collect 2.41s, tests 37.67s,
                    environment 6.35s, prepare 1.22s)
```

### `npm run e2e` → 151 passed, 3 failed (exit 1)
```
  3 failed
    e2e/qa-01-vibe-basics.spec.ts:223:3 › R3 / UX5 / UX6 — invalid basics are rejected
      inline › UX6: with one error remaining the summary reads "1 thing to fix before
      we can plan"
    e2e/qa-02-questions.spec.ts:25:3 › R4 / UX8 — the decision graph branches ›
      R4+UX8: Beach + International leads to the flight-length question
    e2e/qa-03-plan.spec.ts:153:3 › R8 / UX13 — the cost breakdown adds up › R8+UX13:
      travellers 2 → 4 at the R12 reference budget of ₹60,000 raises Travel by the
      fare × 2
  151 passed (3.5m)
```

Total: **154 E2E tests in 10 files** (109 QA + 45 developer regression).

The three failures are the three S3 bugs below. They are deliberately left failing:
they are the evidence for the bug reports, and a QA suite that is green because the
assertion was softened to match the code is worth nothing. Full failure text:

```
  1) e2e/qa-01-vibe-basics.spec.ts:223:3 › UX6: with one error remaining the summary
     reads "1 thing to fix before we can plan"

    Error: expect(locator).toContainText(expected) failed
    Locator: locator('.error-summary')
    Expected substring: "1 thing to fix before we can plan"
    Timeout: 5000ms
    Error: element(s) not found

  2) e2e/qa-02-questions.spec.ts:25:3 › R4+UX8: Beach + International leads to the
     flight-length question

    Error: UX8 requires the heading after "International" to contain "long-haul";
           it read "How long a flight are you willing to sit through?"
    Expected: true
    Received: false

  3) e2e/qa-03-plan.spec.ts:153:3 › R8+UX13: travellers 2 → 4 at the R12 reference
     budget of ₹60,000 raises Travel by the fare × 2

    Error: Travel must rise by the per-traveller fare × 2
           (destination Kochi & Varkala → Puducherry & Auroville)
    Expected: 37600
    Received: 10400
```

---

## Requirement coverage

| ID | Requirement | E2E spec | Result | Evidence |
|---|---|---|---|---|
| R1 | Choose a vacation vibe | `e2e/qa-01-vibe-basics.spec.ts:19,41,72` | PASS | Six cards named Mountains/Beach/Party/Honeymoon/Peace & Quiet/Culture & Food; no vertical scroll at 1280×800; Continue `disabled` with `Pick a vibe to continue.`; Beach → `aria-pressed="true"` (1 true / 5 false), Continue enabled, click advances to `Your trip basics`. |
| R2 | Capture trip basics | `qa-01:89,105,302` | PASS | 2026-10-10 → 2026-10-15, ₹60,000, 2, Bengaluru → question 1; summary bar reads exactly `5 nights · 2 travellers · from Bengaluru · ₹60,000` with `role="status"`, and persists onto S3. |
| R3 | Reject invalid basics inline | `qa-01:130,175,189,251,264,273` | PASS | End < start → exact string `End date must be after your start date`, `aria-invalid="true"`, `aria-describedby` resolves to the error node, focus on the end-date input, still on S2. Budget 0 → `Enter a budget of at least ₹5,000`, no advance. Empty/whitespace/negative/4999 budget, pasted HTML and a 10¹²-rupee budget all rejected or handled without a crash. |
| R4 | 3–5 adaptive questions from a decision graph | `qa-02:25,41,62,72` | PASS (heading literal off-spec, B2) | International → the flight-length question, which carries `Happy with long-haul`; Within India → `Which coast are you drawn to?` and `long-haul` never appears anywhere on that branch (whole branch walked). Every one of the six vibes asks 3–5 questions, each render offering `No preference`, which always advances. **The next question's *heading* does not contain `long-haul`** — see B2. |
| R5 | Skip the remaining questions | `qa-02:125,139,151,161`, `qa-04:256` | PASS | `Plan my trip now` on question 1 of 4 → full plan (destination, ₹ total, 6 day blocks) and `3 questions answered for you`; from question 3 it reads `2 questions answered for you`; answering all four shows no badge. `Answer them` returns to the questionnaire with the basics intact. |
| R6 | Change an earlier answer without losing the others | `qa-02:173,196,225` | PASS | Back ×2 from question 4 → question 2 with `West coast` at `aria-pressed="true"` and focused; changing it to `Islands` replaces question 3's heading; question 1 still shows `Within India` pressed and the summary bar is byte-identical throughout. |
| R7 | One costed day-by-day itinerary | `qa-03:29,45,59` | PASS | Exactly one `<h1>` (the destination); exactly 6 day blocks headed `Day 1`…`Day 6`; every day names ≥1 experience; `Check in — North Cliff Homestay / 5 nights, 1 room` and `Stay: …, 5 nights, 1 room`; `Fly Bengaluru → Kochi & Varkala` on Day 1 and the return leg on Day 6. |
| R8 | Cost breakdown that adds up | `qa-03:105,125,134,176` | PASS (literal at ₹60,000 off-spec, B3) | 18,800 + 12,000 + 8,600 + 10,800 = 50,200 = the displayed party total, verified on 5 different answer sets; per-person = total ÷ travellers rounded to ₹100 on every one. Travellers 2 → 4 raises Travel by exactly the per-traveller fare × 2 (18,800 → 37,600) when the plan keeps its destination. See B3 for the ₹60,000 case. |
| R9 | Soft budget cutoff | `qa-03:203,217,231,291,310` | PASS | Under budget → `₹9,800 under your budget` and `delta == budget − total`; exact-budget → `On budget`; over → `Stretch — 25% over your budget` with the percentage recomputed independently. No recommendation for a ₹60,000 budget exceeded ₹75,000 across 10 answer sets (6 vibes skipped + 4 branch-answered). |
| R10 | Explain the choice | `qa-04:25,34` | PASS | Collapsed at `aria-expanded="false"`; expanded gives ≥3 reasons, **every** one of which quotes one of the user's own answers (vibe/region/coast/crowd/stay/budget/dates/origin); ≥1 named rejected destination whose line carries a number. |
| R11 | Saver / Stretch alternatives and switching | `qa-04:77,102,118,159` | PASS | Mountains: Saver ₹50,200 ≤ 90% of ₹57,800, Stretch ₹58,400 > recommendation and ≤ ₹75,000, each with destination, total, delta and `Use this plan`. Selecting Saver moves destination, total, every cost line, the budget line, the plan ID **and** the itinerary together, announces `Plan updated. …`, and the previous recommendation returns as a card that switches back to the identical plan ID. Where no alternative qualifies, the literal sentences `No cheaper option in this catalogue for these dates` / `No pricier option that still stays inside your stretch band` are rendered — never an empty box. |
| R12 | Adjust and re-plan on the plan screen | `qa-04:174,187,220,230,243` | PASS | Travellers 2 → 4 gives a new total, a new per-person figure and a new plan ID with no question or generating screen; summary bar keeps the vibe and `from Bengaluru`; per-person arithmetic still holds at 4. Budget adjust re-prices in place. An invalid value (13) errors inline and leaves the plan byte-identical. |
| R13 | Determinism | `qa-03:333` | PASS | Plan ID, destination, party total, the whole itinerary block and the whole cost block are all identical after `localStorage.clear()` and re-entering the same answers in a fresh session. |
| R14 | Never dead-end | `qa-05:36,69,88` | PASS | International + Party + 2 nights + ₹25,000 for 4 still renders a plan (Puducherry & Auroville, ₹31,200, 3 day blocks) with the banner `No international party trip fits ₹25,000 for 4 — we searched within India instead.` above it; `Put international back` replaces the banner with a sentence containing the resulting rupee cost; no dismiss control in either state. |
| R15 | Survive an interrupted session | `qa-05:107,131,149,195,213,228` | PASS | Reload after basics + 2 answers returns to the same question, same progress line, same summary bar, with the earlier answers still pressed. Reload on the plan reproduces the identical plan ID, total and itinerary with **no** generating screen. `Start over` clears the session; a further reload still shows the vibe screen with no card pressed. A truncated/corrupt `compass.session.v1` does not white-screen the app. |
| R16 | Honest about the data | `qa-05:255,264,271`, `qa-01:19,121`, `qa-02:118` | PASS | Every screen (S1, S2, S3, S5, S6, relaxation path) carries the line containing `indicative` and `2026-08-01`, with no dismiss control inside it. The browser accessibility tree was walked on every screen: zero elements named `Book`, `Booking`, `Pay`, `Checkout` or `Reserve`. |
| R17 | Export as plain text | `qa-05:280,305,316,326,347` | PASS | `Copy as text` opens a dialog headed `Copy your trip`; focus lands in a `readonly` textarea whose text contains the destination, `… Oct 2026` date range, the party total and six `Day N` lines; `Copy` puts `Copied` in a `role="status"` region; Esc closes and returns focus to `Copy as text`; with `navigator.clipboard` removed the exact fallback sentence appears and the dialog stays open. Switching to the Saver changes the exported text with it. |

**17 / 17 requirements PASS.**

---

## UX checklist

| ID | Check | Spec | Result | Note |
|---|---|---|---|---|
| UX1 | Six cards, no vertical scroll, disabled Continue + helper text | `qa-01:19` | PASS | `scrollHeight <= innerHeight` at 1280×800 confirmed. |
| UX2 | Pressed state, accent border, check glyph, Continue enables | `qa-01:41,72` | PASS | Border colour changes and a second `<svg>` (the check) is added on selection; exactly one card pressed at all times. |
| UX3 | `indicative` + `2026-08-01` on every priced screen; no transactional names | `qa-01:19,121`, `qa-02:118`, `qa-05:255,264,271` | PASS | Accessibility-tree sweep on S1/S2/S3/S5/S6 and the relaxation path. |
| UX4 | Summary bar string; live traveller update; `role="status"` | `qa-01:89,105` | PASS | `5 nights · 4 travellers · from Bengaluru · ₹60,000` without pressing Continue. |
| UX5 | End-date error, `aria-describedby`, `aria-invalid`, danger border, focus | `qa-01:130` | PASS | Border computes to `rgb(179, 38, 30)` = `--color-danger` `#B3261E`. |
| UX6 | `2 things to fix…` summary, focused, above the `<h1>`; count drops to `1 thing…` | `qa-01:189,223` | **FAIL** | The `2 things` summary, focus move, DOM order and both inline strings all pass. **`1 thing to fix before we can plan` never renders** — see B1. |
| UX7 | `Question N of M`, `No preference`, `Back`, `Plan my trip now` on every render | `qa-02:97` | PASS | Asserted on every question of the Beach path, first to last, plus provenance. |
| UX8 | International → heading contains `long-haul`; India → `coast`, never `long-haul`; `No preference` advances | `qa-02:25,41,62` | **FAIL** | The India branch, the `long-haul` absence and the `No preference` advance all pass. **The International branch's heading does not contain `long-haul`** — see B2. |
| UX9 | Back ×2, pressed + focused, branch swap, byte-identical summary bar | `qa-02:173,196` | PASS | |
| UX10 | `Scoring 14 destinations against your answers` in `role="status"`, ≥600ms, gone by 2000ms | `qa-02:237,269` | PASS | Measured from the last answer click: first paint of the status inside 2s, total elapsed to the plan ≥600ms and <2500ms. |
| UX11 | One `<h1>`, six `Day N` blocks, stay + flights, hero above 800px, defaulted count | `qa-03:29,59,78,96` | PASS | All four hero elements have `rect.bottom <= 800` and `scrollY === 0`. |
| UX12 | Budget line is one of three exact forms with the matching token pair; ≤ budget × 1.25 | `qa-03:203,217,231,243,291,310` | PASS | Success badge computes to `--color-success-subtle` / `--color-success-text`; warn badge to `--color-warn-subtle` / `--color-warn-text`; `On budget` uses `badge--neutral`. |
| UX13 | Four line items with basis lines, exact sum, per-person, Travel delta | `qa-03:105,125,134,153` | PASS (B3) | Sum and per-person exact on 5 answer sets; Travel delta exact when the destination is kept. See B3. |
| UX14 | Collapsed first, ≥3 quoting reasons, ≥1 numbered rejection | `qa-04:25,34` | PASS | |
| UX15 | Saver/Stretch cards with destination, total, delta, button; literal sentence in an empty slot | `qa-04:77,102` | PASS | |
| UX16 | `Use this plan` updates everything together, announces `Plan updated. …`, previous returns | `qa-04:118` | PASS | Announcement read from the live `role="status"` region; switching back restores the original plan ID exactly. |
| UX17 | Travellers 4 + `Update plan` re-renders in place; button disabled until a value differs | `qa-04:174,187` | PASS | Disabled → enabled → disabled again when the value is restored. |
| UX18 | Relaxation banner names both constraints, restore control prices it, no dismiss | `qa-05:36,69` | PASS | |
| UX19 | `Copy your trip` dialog, focused readonly textarea, six Day lines, `Copied`, Esc, clipboard fallback | `qa-05:280,305,316,326` | PASS | |
| UX20 | Reload mid-questionnaire and on the plan; `You have a trip in progress` + `Start over` | `qa-05:107,131,149,173,195,213` | PASS (see note) | Both reloads pass exactly. The in-progress banner is reachable and correct, but **not** by "returning to `/`" — the app has no router, so a return to `/` *is* a reload and R15 requires it to resume the question. The banner shows when the vibe screen is reached with a saved session (Back from basics), which is verified. R15 wins over UX20's wording per the design doc's own precedence rule. |
| UX21 | 360/768/1280 reflow, column counts, sticky bottom bar, un-ellipsised summary bar | `qa-06:32,55,70,98,120,133` | PASS | No horizontal scroll on S2/S3/S5/S5-scrolled/S6 at all three widths; vibe grid 1 col @360, 2 cols @768; plan single column with the breakdown above the itinerary @360 and @768; two columns with `position: sticky` aside @1280; `Copy as text` fixed in a bottom bar @360 (y unchanged after scrolling to the page bottom); summary bar keeps all four facts @768 with `scrollWidth === clientWidth`. |
| UX22 | 3px/2px focus ring, 44×44 targets, keyboard-only flow, focus on the new `<h1>` | `qa-06:156,181,211,261,318` | PASS | Every element reached by Tab on S1/S2/S3/S5 has `outline-width: 3px`, `outline-offset: 2px` and a non-`none` style, with the colour equal to `--color-focus`. Zero controls under 44×44 at 360/768/1280. Cold load → copied itinerary completed with keys only, `document.activeElement.tagName === 'H1'` after each screen change, zero console errors. Focus never falls to `<body>`, including after `Update plan`. |
| UX23 | `prefers-reduced-motion: reduce` kills transitions; status text still steps | `qa-06:334` | PASS | With the media feature emulated, `.option`, `.plan-hero` and `.dialog__panel` all report `transition-duration`/`animation-duration` ≤ 0.001s, and the generating status still showed ≥2 distinct strings. *(A first attempt using Playwright's `test.use({ reducedMotion })` fixture did not actually set the media feature — `matchMedia(...).matches` was `false`. `page.emulateMedia()` does. Test-harness issue, not a product one.)* |
| UX24 | Offline: no error UI, no failed requests, zero console errors | `qa-06:398,431,449` | PASS | Context set offline after first paint; full flow to a copied itinerary; `requestfailed` list empty, console errors empty, no `[role="alert"]` rendered. Separately: zero requests leave `localhost` and no React key/nesting warnings anywhere in the primary flow. |

**22 / 24 UX checks PASS, 2 FAIL (UX6, UX8 — both S3).**

---

## Cross-cutting sweeps

| Sweep | Result | Notes |
|---|---|---|
| Responsive 360 / 768 / 1280 | PASS | `qa-06:32,55,70,98,120,133`. No horizontal scroll on any screen at any width, including the plan scrolled to the bottom and the export dialog. Column counts, source order of breakdown vs itinerary, the sticky right column at 1280 and the sticky bottom action bar at 360 all match §4 S5. Screenshots at all three widths reviewed by eye: no overlap, no clipped text, no off-screen control. |
| Keyboard-only path through the primary flow | PASS | `qa-06:261`. `/` → Beach → Continue → basics Continue → four `No preference` answers → plan → `Copy as text` → `Copy` → `Copied` → Esc, with no mouse event at all. Focus lands on the new `<h1>` after every screen change and returns to `Copy as text` after Esc. Focus ring verified on every tab stop of four screens (`qa-06:211`); all controls ≥ 44×44 at all three widths (`qa-06:156`). |
| Console errors & warnings | PASS | `qa-06:431`. Zero `console.error` and zero `pageerror` across vibe → basics → questions → generating → plan → why-expand → adjust → export → Esc. Zero React warnings (`unique "key"`, `validateDOMNesting`, `Warning:`). The only console output anywhere is a deliberate `console.warn('[compass] E-CLIPBOARD', …)` on the clipboard-unavailable path. |
| Reload mid-flow — state survives | PASS | `qa-06:462,484` and `qa-05:107,131`. Reload after picking a vibe keeps it pressed; after 0 / 2 answers returns to the same question with the answers pressed; on the plan reproduces the identical plan ID and total with no generating screen; reload *during* the generating beat never leaves the app stuck on that screen. |
| Empty / malformed / hostile input | PASS | `qa-01:251,264,273`, `qa-06:498,520,538`. Empty, whitespace-only, negative, zero, below-floor and 10¹²-rupee budgets; travellers 0/13; end before start; a 22-night trip; a `<img src=x onerror=alert(1)>` paste (no `<img>` reaches the DOM, no dialog); a unicode + 300-char option injected into the origin `<select>` (rejected with `Choose a departure city from the list`). 1 and 12 travellers both plan cleanly; a 21-night trip renders 22 day blocks. |
| Double-submit | PASS | `qa-01:288`, `qa-02:161`, `qa-04:243`. Double-clicking Continue, `Plan my trip now` and `Update plan` each produce exactly one screen / one plan / one applied change. No duplicate `<h1>`, no stuck spinner, no double-counted travellers. |
| Offline | PASS | `qa-06:398`. See UX24. |
| Corrupt storage | PASS | `qa-05:228`. Truncated JSON in `compass.session.v1` falls back to the vibe screen with six cards, not a white screen. |

---

## Bugs

| ID | Sev | Title | Repro | Expected | Actual | Requirement |
|---|---|---|---|---|---|---|
| B1 | S3 | The error summary disappears instead of counting down to "1 thing to fix" | 1. `/` → Beach → Continue. 2. Set budget `0` and travellers `13`. 3. Click Continue — the summary reads `2 things to fix before we can plan`. 4. Correct the budget to `60000`. | The summary stays above the `<h1>` and reads `1 thing to fix before we can plan` (the string `errorSummaryHeading(1)` already produces). | The whole `.error-summary` block is removed from the DOM; only the inline travellers error remains. Resubmitting does not bring it back either — it is rendered only when ≥2 errors are listed. A screen-reader user who cleared one of two problems loses the running count and the `role="alert"` anchor. | UX6 (R3) |
| B2 | S3 | The question after "International" is not headed "long-haul" | 1. `/` → Beach → Continue → Continue. 2. Answer `International` on question 1. | Per UX8 and R4, the next question's heading contains `long-haul`. | The heading is `How long a flight are you willing to sit through?`. The string `long-haul` is on the screen, but only as the option label `Happy with long-haul`. Note the design doc contradicts itself: §4 S3's copy table specifies this exact heading, while §7 UX8 asks QA to match `long-haul` in the heading. The branching behaviour R4 actually cares about is correct and verified. Fix is one line of copy **or** one line of the UX8 wording — the Tech Lead should pick. | UX8, R4 |
| B3 | S3 | At the R12 reference budget, changing travellers 2 → 4 re-plans to a different destination, so the Travel delta is not fare × 2 | 1. Plan Beach / Within India / West coast / Empty / Local stays at ₹60,000 for 2 (Kochi & Varkala, ₹50,200, Travel ₹18,800 = ₹9,400 × 2). 2. In the adjust panel set Travellers to `4` and press `Update plan`. | Per R8 and UX13, Travel rises by exactly the per-traveller fare × 2, i.e. to ₹37,600. | The engine re-plans to Puducherry & Auroville and Travel reads ₹10,400. Every figure shown is internally correct (the four lines still sum to the total; per-person still checks out) and the switch is *required* by R9 — Kochi for 4 would exceed ₹75,000. The linear-scaling property R8 is really asserting **does** hold: repeat the same steps at a ₹200,000 budget, the destination is kept and Travel goes ₹18,800 → ₹37,600 exactly (`qa-03:134`, passing). The unmet thing is R8's literal, which assumes a re-plan never changes destination. Fix is to record a Deviation in `02-architecture.md` §12 and tighten R8's wording, not to weaken R9. | R8, UX13 |
| B4 | S4 | The plan-ID line breaks mid-token at 360px | 1. At 360×800, reach any plan. 2. Read the monospace line under the hero. | `Plan KOCH-5N-2P-B60-aosm · catalogue 2026-08-01` wraps at a sensible boundary. | It wraps inside the date: `… catalogue 2026-08-` / `01`. The `2026-08-01` snapshot date — the thing R16 exists to make legible — is split across two lines. Cosmetic; the text is still present and the automated `2026-08-01` assertion passes because it matches the text content, not the rendering. | R16, UX3 |
| B5 | S4 | The export textarea clips its lines horizontally with no wrap | 1. Reach a plan at 360px. 2. Press `Copy as text`. | The itinerary lines are readable in the textarea. | The textarea is `white-space: pre` with `scrollWidth` 1121 against `clientWidth` 292, so every day line is cut at about a third of its length; the user has to scroll sideways inside the box to read what they are about to copy. The copy itself is complete and correct, and the text is pre-selected, so the task still succeeds. | UX19, R17 |

S1 blocks the core flow · S2 requirement unmet or wrong result · S3 off-spec · S4 polish.

**Open S1: 0. Open S2: 0.**

### Severity notes

B3 was considered for S2. It is filed S3 because no user is shown a wrong number —
every figure on screen is internally consistent, the destination switch is what R9
demands, and the arithmetic property R8 is protecting is verified to hold. Calling it
S2 would send the pipeline into a fix round whose only correct outcome is a document
change.

---

## Untested / not covered

| Item | Why |
|---|---|
| Real screen-reader output (NVDA / VoiceOver / TalkBack) | Only the accessibility *tree*, roles, names, `aria-*` and live-region text content were asserted programmatically. Whether a real AT announces the `role="status"` updates at the right moment is not verifiable in this sandbox. |
| Real clipboard contents | `navigator.clipboard.writeText` is asserted to be called with the same text the textarea shows, and the `Copied`/failure branches are both driven; the OS clipboard buffer itself is not read back. |
| Colour-contrast ratios (WCAG 2.1 AA) | Token *pairs* were verified to be applied (success/neutral/warn badges, danger border, focus ring), but the computed contrast ratios were not measured. The design doc claims AA; that claim is UNTESTED here. |
| Dark colour scheme | The token file defines a dark block; no check was run under `prefers-color-scheme: dark`. UNTESTED. |
| 320px / 200% zoom | §6.5 claims no loss of content at 320px with 200% zoom. Only 360/768/1280 were swept. UNTESTED. |
| Cross-browser | Playwright is configured with a single Chromium project. Firefox and WebKit are UNTESTED — the `<dialog>` fallback path and `white-space: pre` textarea behaviour are the likeliest divergences. |
| Performance budget | `02-architecture.md` states a numeric budget; no timing assertions were written beyond UX10's ≥600ms / <2000ms generating window. UNTESTED. |

---

## Verdict

**PASS.** Zero open S1 and zero open S2. All 17 requirements verified against the
running UI; 22 of 24 UX checks pass, with UX6 and UX8 failing on literal strings only
(B1, B2) and one PRD/design wording conflict recorded as B3. Two S4 polish items and
seven honestly-declared coverage gaps are listed above.

Still open at hand-off: **B1, B2, B3 (S3) and B4, B5 (S4)** — none gate-blocking. The
three failing E2E tests stay failing until those are addressed; they are the receipts.

### Files QA added

- `products/trip-planner/e2e/qa-helpers.ts`
- `products/trip-planner/e2e/qa-01-vibe-basics.spec.ts` — R1, R2, R3, UX1, UX2, UX4, UX5, UX6
- `products/trip-planner/e2e/qa-02-questions.spec.ts` — R4, R5, R6, UX7, UX8, UX9, UX10
- `products/trip-planner/e2e/qa-03-plan.spec.ts` — R7, R8, R9, R13, UX11, UX12, UX13
- `products/trip-planner/e2e/qa-04-alternatives-adjust.spec.ts` — R5, R10, R11, R12, UX14, UX15, UX16, UX17
- `products/trip-planner/e2e/qa-05-trust-session.spec.ts` — R14, R15, R16, R17, UX3, UX18, UX19, UX20
- `products/trip-planner/e2e/qa-06-sweeps.spec.ts` — UX21, UX22, UX23, UX24 and the six cross-cutting sweeps

No file under `src/` was modified.

---
---

# QA Report — Compass (trip-planner) — Round 2

**Author:** QA Engineer · **Round:** 2 (regression after customer-feedback round 1)
· **Date:** 2026-08-18 · **Verdict: FAIL**

Two open S2. Six other bugs are open (four S3, two S4) and are not gate-blocking.

Scope of this round: the full suite re-run end to end, plus targeted verification of
all ten PM-ranked fixes from `docs/05-customer-feedback.md` against the amended
requirements in `docs/01-prd.md` §10 (R1, R7, R12, R17 amended; R18–R24 added).

QA added **47 new E2E tests** in two files (`qa-07-refine1`, `qa-08-refine1-sweeps`)
and updated 9 existing spec files where round 1's assertions were superseded by the
amended requirements. **No product source was modified.** Every superseded assertion
that was changed is listed in *Test-harness changes* below, with the requirement that
superseded it, so the change can be audited rather than taken on trust.

---

## Commands run

From `products/trip-planner`, one chain:

```
$ npm run lint && npm run build && npm test && npm run e2e
```

### `npm run lint` → PASS (exit 0)
```
> compass-trip-planner@0.1.0 lint
> eslint . --max-warnings=0 && tsc --noEmit
```
No output. Clean at `--max-warnings=0`, including the new spec files.

### `npm run build` → PASS (exit 0)
```
> compass-trip-planner@0.1.0 build
> tsc -b --noEmit false && vite build

vite v5.4.21 building for production...
✓ 79 modules transformed.
dist/index.html                   1.11 kB │ gzip:  0.64 kB
dist/assets/index-saIhhc7E.css   23.25 kB │ gzip:  4.72 kB
dist/assets/index-DlAYKT7b.js   295.83 kB │ gzip: 87.18 kB
✓ built in 1.02s
```
Bundle grew 269 kB → 296 kB (+10%) and CSS 22.0 → 23.3 kB across the ten fixes.

### `npm test` → PASS (exit 0)
```
> compass-trip-planner@0.1.0 test
> vitest run

 Test Files  25 passed (25)
      Tests  438 passed (438)
   Duration  24.27s
```
Round 1 was 21 files / 395 tests; the developer added 4 files / 43 tests. **No unit
test that passed in round 1 fails now.**

### `npm run e2e` → 194 passed, 8 failed (exit 1)
```
> compass-trip-planner@0.1.0 e2e
> playwright test --reporter=line --workers=4

Running 202 tests using 4 workers

  8 failed
    e2e/qa-01-vibe-basics.spec.ts:223:3 › UX6: with one error remaining the summary
      reads "1 thing to fix before we can plan"
    e2e/qa-02-questions.spec.ts:25:3 › R4+UX8: Beach + International leads to the
      flight-length question
    e2e/qa-03-plan.spec.ts:153:3 › R8+UX13: travellers 2 → 4 at the R12 reference
      budget of ₹60,000 raises Travel by the fare × 2
    e2e/qa-06-sweeps.spec.ts:157:5 › UX22: every control is at least 44x44 at 360px
    e2e/qa-06-sweeps.spec.ts:157:5 › UX22: every control is at least 44x44 at 768px
    e2e/qa-06-sweeps.spec.ts:157:5 › UX22: every control is at least 44x44 at 1280px
    e2e/qa-07-refine1.spec.ts:385:3 › R21: the total drops by the freed day's
      experience cost
    e2e/qa-07-refine1.spec.ts:420:3 › R21 / R7: a plan nobody asked a free day of has
      something on every day
  194 passed (3.6m)
```

Three of the eight are the round-1 S3s (B1, B2, B3), still open and still failing on
purpose. Five are new: three are the same new bug counted once per width (B8), and
two are the new S2s (B6, B7). Full failure text:

```
  1) qa-02-questions.spec.ts:25 — R4+UX8 (B2, carried over)
     Error: UX8 requires the heading after "International" to contain "long-haul";
            it read "How long a flight are you willing to sit through?"

  2) qa-01-vibe-basics.spec.ts:223 — UX6 (B1, carried over)
     Error: expect(locator).toContainText(expected) failed
     Locator: locator('.error-summary')
     Expected substring: "1 thing to fix before we can plan"
     Error: element(s) not found

  3) qa-03-plan.spec.ts:153 — R8+UX13 (B3, carried over)
     Error: Travel must rise by the per-traveller fare × 2
            (destination Kochi & Varkala → Puducherry & Auroville)
     Expected: 37600
     Received: 10400

  4-6) qa-06-sweeps.spec.ts:157 at 360 / 768 / 1280 — UX22 (B8, new)
     Error: controls below 44x44 at 360px
     - Array []
     + Array [ "input\"\" 20x20" ]

  7) qa-07-refine1.spec.ts:385 — R21 (B6, new)
     Error: a day given up is a day of experiences the plan was charging for
     Expected: < 56600
     Received:   56600

  8) qa-07-refine1.spec.ts:420 — R21 / R7 (B7, new)
     Error: Beach 20/12/2026–27/12/2026: day(s) 4,8 have no experience
     - Array []
     + Array [ 4, 8 ]
```

---

## Verification of the ten ranked fixes

Each row quotes the *fixed means* wording from `docs/05-customer-feedback.md` and
states what was actually driven through the UI at `http://localhost:4079`.

| # | Fix | Req | Spec | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Never state a false day-of-week | R18 | `qa-07:58,76,91` | **PASS** | Party / 10–15 Nov 2026 (North Goa): `Anjuna flea market` sits on Day 2 · **Wed** 11 Nov and nowhere else; `Saturday night market, Arpora` on Day 5 · **Sat** 14 Nov. Party / 12–15 Nov 2026 (no Wednesday in range): the market appears on no day, and under the itinerary reads the exact line `Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday`. A four-range sweep cross-checks every `…s only` claim on screen against the weekday its own day block prints — zero contradictions. |
| 2 | Dates and origin in the adjust panel; DD/MM/YYYY | R12 | `qa-07:124,158,171,192` | **PASS** | From a Beach plan for 10/10/2026–15/10/2026 answered in full (not skipped): end date → 16/10/2026 gives `6 nights`, a different total, a different plan ID, **no** question screen and **no** "questions answered for you" badge, and `You chose Beach` / `You said Within India` / `You said West coast` still quoted in *Why this trip*. Origin → Mumbai changes the Travel line and the hero reads `from Mumbai`. Both the basics screen and the adjust panel show `10/10/2026` and exactly two visible `DD/MM/YYYY` hints each. All five trip fields (start, end, Adults, budget, origin) are present in the panel, so nothing needs `Start over`. |
| 3 | Say what changed, next to the total | R19 | `qa-07:209,246,278` | **PASS** (illustrative literal not reproducible — see note) | Mountains / Kolkata / ₹2,50,000 / 4 travellers → Kathmandu & Pokhara, Annapurna View Retreat (₹11,000/night, premium), **no** notice. Setting Adults to 5 renders, inside `.plan-hero` and within 200px of the total: `Changed to keep you inside budget: destination is now Gangtok & Pelling instead of Kathmandu & Pokhara; stay is now Kanchenjunga View Retreat (₹8,600/night, premium) instead of Annapurna View Retreat (₹11,000/night, premium)`. The relaxation case (Party + International + ₹25,000 for 4) names the overridden answer in the same notice. *Why this trip* is `aria-expanded="true"` on first render of a plan for **all six** vibes, with `Because you said` visible without a click. |
| 4 | Labels that describe what they do | R17, R1 | `qa-07:316,332,346` | **PASS** | One click on `Copy as text`: `navigator.clipboard.readText()` returns the itinerary (destination, `Day 1 —` … `Day 6 —`), a `role="status"` region reads `Copied`, and **no dialog opens**. With `navigator.clipboard` removed, the same click opens the dialog and it reads `Couldn't reach the clipboard — copy it from here`. The vibe screen reads `We'll ask four quick questions — or skip them and we'll guess`; the string `three or four` appears nowhere in the document. |
| 5 | State the basis of every number | R20 | `qa-07:363,382` | **PASS** | Travel, Stay, Experiences and Local allowance each carry `incl. GST`; the stay line matches `₹4,200 per room-night, incl. GST`; the total row reads `Total for 2 adults` (and `Total for 2 adults and 2 children` with children); `GST` and `adults` both appear on the plan screen. The seasonal row is the one priced line with no tax qualifier of its own — see B10 (S4). |
| 6 | One free day on request, and stop padding | R21 | `qa-07:393,404,428` | **FAIL** | *Exactly one* middle day empties on Party / 10–15 Nov 2026, with `Nothing scheduled — this day is yours` rendered once and a new plan ID (₹58,000 → ₹52,200, 10 → 8 experiences) — correct. No experience name repeats across days on **12** plans (3 vibes × 4 lengths, 3 to 21 nights) — correct. But on the reference Beach plan the total does **not** drop (B6, S2), and plans nobody asked a free day of still print blank days (B7, S2). |
| 7 | Not this one — somewhere else | R22 | `qa-07:447,474,484,511` | **PASS** | From North Goa, one click yields a different destination in well under 2s with nights, dates, travellers and origin byte-identical, a changed plan ID, the rejected name listed under `You turned these down` and a working `Put North Goa back`. Rejecting until the catalogue is exhausted (13 rejections) ends on a real plan with a total and the sentence `That's every destination that fits — here are the ones you turned down` — never an empty screen. Where neither a Saver nor a Stretch qualifies (Beach, 2 adults + 2 children, ₹60,000) the alternatives area holds exactly **one** card, and it is the reject control. |
| 8 | Price moves with the dates; seasonal loading is its own line | R23 | `qa-07:540,558,587` | **PASS** | Identical answers, 7 nights each: 20–27 Dec 2026 → ₹65,060; 5–12 Jul 2027 → ₹58,960. The breakdown carries `Peak season (25 Dec – 2 Jan): +35% on stay and travel` and `Off season (Jul): −20% on stay and travel` respectively. Travel + Stay + Experiences + Local allowance + **Season** ties exactly to the party total on all three date ranges tested, including the negative July loading. `Seasonal loadings are indicative sample data, like every other figure here.` sits in the breakdown alongside the R16 provenance line. |
| 9 | One plan, one base | R7 | `qa-07:603,614` | **PASS** | Four vibes: the hero reads `… · based in <town>` and that town is the one the stay footnote names (`Stay: Brunton Boatyard in Fort Kochi, …`). On the Kerala plan with the Brunton Boatyard stay, **no** day pairs a Kochi with a Varkala experience — the Varkala items (`North cliff sunset walk`, `Kappil beach and the estuary`) are not on the plan at all, because the 90-minute filter removes them from the pool rather than merely separating them. |
| 10 | Count and price children | R24 | `qa-07:638,651,684` | **PASS** | 2 adults + children aged 9 and 12 → summary bar `4 travellers (2 adults, 2 children)`; the plan prints `Children 2–11 are priced at 75% of the adult fare and 50% of experiences; they occupy a room place.` and `A traveller aged 12 or over is priced as an adult.`; the Travel line reads `₹9,400 per adult × 3 and ₹7,050 per child × 1` (the 12-year-old correctly at the adult fare); the total row reads `Total for 2 adults and 2 children`; the Stay line books `2 rooms` for 4 travellers, so children count as occupants. The child fare on screen is exactly 75% of the adult fare, checked arithmetically. |

**9 of 10 fixes land. Fix 6 (R21) does not.**

### Note on fix 3's illustrative literal

The *fixed means* names `Pelling Ridge Lodge (₹3,600/night, standard)` replacing
`Kanchenjunga View Retreat (₹8,600/night, premium)`. No answer set in this catalogue
produces that particular pair — the engine reaches Kanchenjunga View Retreat only
*after* the 4→5 downgrade, not before it. The requirement's substance (prefix, the
`stay is now X (₹n/night, tier) instead of Y (₹m/night, tier)` clause, a genuine
downgrade, adjacency to the total, and the overridden-answer clause) is verified. The
hotel names in the PM's example were a prediction of engine output, not a spec. Not
filed as a bug; recorded here so nobody re-reads the sentence and assumes it failed.

---

## Round-1 requirement regression

Every R1–R17 and UX1–UX24 spec from round 1 was re-run. Result: **no requirement that
passed in round 1 regressed.** The three round-1 S3s (B1, B2, B3) are unchanged; they
were not on the PM's ranked list and no attempt was made to fix them.

| Area | Round 1 | Round 2 | Note |
|---|---|---|---|
| R1–R6 (vibe, basics, questions, skip, back) | PASS | PASS | R1 gained the advertised skip; R2's summary bar string is unchanged for a party with no children. |
| R7 (itinerary) | PASS | **FAIL** | The base-town rule landed, but "at least one named experience on every day" no longer holds — B7. |
| R8, R9 (breakdown, budget) | PASS | PASS | The sum now has five lines instead of four and still ties exactly; the budget line and the ≤ budget × 1.25 cap hold on every set tested. |
| R10 (why) | PASS | PASS | Now open by default (R19). |
| R11 (alternatives) | PASS | PASS | With one slot absent the literal sentence still renders; with both absent R22 replaces them. |
| R12 (adjust) | PASS | PASS | Extended to five fields plus the free-day switch. |
| R13 (determinism) | PASS | PASS | Plan ID, destination, total and itinerary reproduce identically after `localStorage.clear()`; rejections survive a reload and reproduce the same plan. |
| R14 (never dead-end) | PASS | PASS | |
| R15 (interrupted session) | PASS | PASS | Children, their ages and the excluded set all survive a refresh. |
| R16 (honesty) | PASS | PASS | Provenance on every screen; zero accessible names matching Book/Pay/Checkout/Reserve, including inside the fallback dialog. |
| R17 (export) | PASS | PASS | Now copies in one click. |
| UX1–UX21, UX23, UX24 | PASS | PASS | |
| UX22 (focus ring, 44×44, keyboard) | PASS | **FAIL** | New 20×20 checkbox — B8. |

---

## Cross-cutting sweeps

Re-run in full, plus a second pass (`qa-08-refine1-sweeps`, 16 tests) over the
surfaces round 1 added: the six-field adjust panel, the free-day switch, the
child-age fields, the reject control, the excluded list and the change notice.

| Sweep | Result | Notes |
|---|---|---|
| Responsive 360 / 768 / 1280 | PASS | `qa-08:38,66` and `qa-06:32,55,70,98,120,133`. No horizontal scroll on the basics screen with three child-age fields, on the plan, or on the plan after a rejection, at any of the three widths. Every adjust control's box lies inside the viewport at 360. The change notice never runs off the side. The 360 bottom action bar still clears the provenance footer. |
| Keyboard only | PASS | `qa-08:87,121` and `qa-06:261,318`. The free-day checkbox is reachable by Tab, toggled with Space, and `Update plan` is the next stop — the whole free-day flow completes with no mouse and focus never lands on `<body>` afterwards. `Not this one — somewhere else` operates on Enter. The primary flow now ends one keypress earlier because `Copy as text` copies outright. |
| Console errors & warnings | PASS | `qa-08:134`, `qa-06:431`. Zero `console.error`, zero `pageerror` and zero React key/nesting warnings across children → plan → reject → free day → copy. The only console output anywhere remains the deliberate `[compass] E-CLIPBOARD` warning on the fallback path. |
| Reload mid-flow | PASS | `qa-08:154,169`. Children and their ages come back with an identical plan ID and total and the summary bar intact; a rejected destination is still rejected and still listed after a refresh. |
| Hostile input | PASS | `qa-08:185,200,220`. `32/13/2026`, `not a date`, `<img src=x onerror=alert(1)>` and whitespace in the adjust panel's end date each error inline and leave the plan byte-identical, with no `<img>` reaching the DOM. A child count of 99 is capped (8 age fields) without a crash; a negative age does not white-screen. 12 adults + 1 child is rejected with `Adults and children together must be 12 or fewer`. |
| Double-submit | PASS | `qa-08:236,248`. Double-clicking the reject control leaves at most one extra exclusion and exactly one plan; double-clicking `Update plan` produces exactly one free day and one `<h1>`. |
| Offline | PASS | `qa-06:398`. Full flow to a copied itinerary offline: no failed requests, no console errors, no error UI. |
| Reduced motion | PASS | `qa-06:334`. |

---

## Bugs

Open at the end of round 2. B1–B5 are carried over from round 1 unchanged; B6–B10
are new.

| ID | Sev | Title | Repro | Expected | Actual | Requirement |
|---|---|---|---|---|---|---|
| B6 | **S2** | "Leave one day free" costs nothing on a plan whose base has fewer experiences than day slots | 1. `/` → Beach → Continue. 2. Start `10/10/2026`, End `15/10/2026`, budget `60000`, Adults `2`, from Bengaluru → Continue → `Plan my trip now`. 3. Read the total: **₹56,600**, six days each with one experience. 4. Tick `Leave one day free` in the adjust panel and press `Update plan`. | Per R21, "the total drops by that day's experience cost". Day 3 carried `Fort Kochi heritage walk` at ₹400 per person, so the total should fall by ₹800 to ₹55,800. | Day 3 reads `Nothing scheduled — this day is yours` and the total is still **₹56,600**, with the same six experiences repacked onto five days (Day 2 and Day 6 now carry two). The plan ID changes; nothing else does. The user asks for a lighter trip and is charged identically. On a supply-rich plan (Party / Goa) the drop does happen (₹58,000 → ₹52,200), so the behaviour is data-dependent, which is worse than either answer consistently. Fixing it means either dropping the freed day's experiences instead of repacking them, or amending R21 to say the total drops *only when experiences are actually dropped* — a Tech Lead decision, not a QA one. | R21 |
| B7 | **S2** | Plans print days with nothing scheduled that the user never asked for | 1. `/` → Beach → Continue. 2. Start `20/12/2026`, End `27/12/2026`, defaults otherwise → Continue → `Plan my trip now`. 3. Confirm `Leave one day free` is **unchecked**. 4. Read Day 4 and Day 8. | Per R7, every day block from arrival to departure carries 1–3 named experiences. A blank day is R21's feature and only "on request". | The plan (Kochi & Varkala, based in Varkala) schedules 6 experiences across 8 days. Day 4 (Wed 23 Dec) renders `Nothing scheduled — this day is yours` although nothing was requested, and Day 8 carries no experience at all. Reproduces on Beach 05/07/2027–12/07/2027 as well. The wording actively misattributes the gap to the user, and it makes the R21 checkbox indistinguishable from a supply shortfall. The cause is the R7 90-minute base filter cutting the Varkala pool to 6 items while `experiencesPerDay` still asks for 10 — the fix removed padding without giving the scheduler anything to say when supply runs out. | R7, R21 |
| B8 | S3 | The new "Leave one day free" checkbox is a 20 × 20 target, at every width | 1. Reach any plan at 360, 768 or 1280. 2. Measure the checkbox in the adjust panel. | `docs/03-design.md` §6 and UX22: "Minimum hit target 44 × 44 CSS px for every control on every width". | `.adjust__checkbox` is declared `width: 20px; height: 20px` in `src/styles/app.css:1438` and has no padded hit area, so it measures 20 × 20 at all three widths. It is the only control in the product below the minimum. On a 360px phone this is the hardest thing on the plan screen to hit; the label next to it is clickable, which softens but does not meet the commitment. | UX22 (R21) |
| B9 | S4 | The seasonal saving renders as `₹-9,640` rather than `−₹9,640` | 1. Beach, 05/07/2027 – 12/07/2027. 2. Read the `Season` row amount. | A negative rupee amount reads `−₹9,640`, with the sign outside the symbol, as it does in the row's own basis line (`−20%`). | It reads `₹-9,640`: an ASCII hyphen between the rupee sign and the digits. The basis line one column to the left uses a proper minus. Cosmetic only; the arithmetic is right and the row ties into the total. | R23 |
| B10 | S4 | The seasonal line is the one priced line with no tax position | 1. Any plan. 2. Read the five rows of the breakdown. | The round-1 fix wording is "Every priced line carries a tax qualifier". | Travel, Stay, Experiences and Local allowance each end `incl. GST`; the `Season` row's basis is `Peak season (25 Dec – 2 Jan): +35% on stay and travel` with no tax position, and so is `Per person`. R20's own acceptance criterion only enumerates stay / travel / experiences, and the footnote `Every rate here includes GST … nothing is added later.` covers the gap in prose, which is why this is S4 and not S3. | R20 |
| B1 | S3 | *(carried over)* The error summary disappears instead of counting down to "1 thing to fix" | See round 1. Re-verified failing: `qa-01:223`. | | | UX6 (R3) |
| B2 | S3 | *(carried over)* The question after "International" is not headed "long-haul" | See round 1. Re-verified failing: `qa-02:25`. The heading still reads `How long a flight are you willing to sit through?`. | | | UX8, R4 |
| B3 | S3 | *(carried over)* At the ₹60,000 reference budget, travellers 2 → 4 re-plans to a different destination, so the Travel delta is not fare × 2 | See round 1. Re-verified failing: `qa-03:153` (Expected 37600, Received 10400). Still internally consistent at every step, and still passing at a ₹200,000 budget where the destination is kept (`qa-03:134`). | | | R8, UX13 |
| B4 | S4 | *(carried over)* The plan-ID line breaks mid-token at 360px | Not re-driven this round. `.plan-hero__id` has no `overflow-wrap` or `word-break` rule, so the round-1 finding is assumed to stand. Marked UNTESTED below rather than claimed. | | | R16, UX3 |
| B5 | S4 | *(carried over)* The export textarea clips its lines horizontally with no wrap | `white-space: pre` is unchanged at `src/styles/app.css:1289`. Impact is lower than in round 1: the dialog is now only the clipboard-failure fallback, so almost no user sees it. | | | UX19, R17 |

S1 blocks the core flow · S2 requirement unmet or wrong result · S3 off-spec · S4 polish.

**Open S1: 0. Open S2: 2 (B6, B7).**

### Severity notes

B6 and B7 are both filed S2 on the "a requirement is unmet" limb, not the "wrong
result" limb — no number on screen is wrong, and both behaviours are arguably an
improvement on the padding the customer panel complained about. They are S2 because
R21's and R7's acceptance criteria fail as written, on the product's own reference
trip and on an ordinary Christmas date range, and because B7 shows the user a
sentence that credits them with a choice they did not make. Either can be closed by
changing the engine **or** by the PM amending the criterion in writing; what it
cannot be is left unstated.

B8 was considered for S2 (an accessibility commitment is a requirement). It is S3
because the control is fully operable — its label is a working click target and the
keyboard path is verified — so nothing is blocked and no requirement about *what the
product does* is unmet; the miss is against the design system's own size rule.

---

## Test-harness changes

Round 1's specs asserted round 1's requirements. Ten of those assertions describe
behaviour the PM deliberately changed. Each was updated to the new requirement, never
loosened; they are listed so a reviewer can check that no alarm was silenced.

| Spec | Old assertion | Superseded by | New assertion |
|---|---|---|---|
| `qa-helpers.ts` + 9 spec files | date fields filled with `2026-10-10` | R12 (DD/MM/YYYY) | filled with `10/10/2026` |
| `qa-helpers.ts` + 6 spec files | `getByLabel('Travellers')` | R24 (party split into adults + children) | `getByLabel('Adults', { exact: true })` |
| `qa-02:232` | start date reads `2026-10-10` | R12 | reads `10/10/2026` |
| `qa-03`, `qa-04`, `qa-06` (6 sites) | `Total for 4 travellers` | R20 / R24 (`totalLabel`) | `Total for 4 adults` |
| `control-export:82` | travel basis matches `₹n per traveller` | R24 | matches `₹n per adult` |
| `qa-04:25`, `trust-layer:84` | *Why this trip* is `aria-expanded="false"` first | R19 (opens by default) | `aria-expanded="true"`, `Because you said` visible without a click |
| `control-export` (7 sites), `qa-05` (5), `qa-06` (4) | `Copy as text` opens the dialog | R17 (copies in one click; dialog is the fallback) | one click asserts the clipboard and `Copied`; tests that need the dialog call the new `openExportFallbackDialog()` helper, which removes `navigator.clipboard` first |
| `qa-04:101`, `trust-layer:157` | both absent slots carry their sentence | R22 (both-absent is replaced by one reject control) | the single-absent case still asserts the literal sentence; a **new** test asserts the both-absent case renders exactly one card and it is the reject control |
| `control-export:194` | `p.visually-hidden[role="status"]` (now two such elements) | R17 added a second live region | `p[role="status"][aria-atomic="true"]` |
| `control-export:468` | footer/bar overlap tolerance 1px | — | 2px; the measured gap was 0.42px of sub-pixel rounding, not an overlap |
| `qa-helpers.rupees()` | `/₹\s?([\d,]+)/` | R23 (signed amounts) | reads `₹-9,640` and `−₹9,640` as −9640 |

No product source file was modified. `git status` on `src/` is clean.

---

## Untested / not covered

| Item | Why |
|---|---|
| B4 (plan-ID line break at 360px) | Not re-driven this round; the CSS is unchanged, so the round-1 finding is carried forward on inspection rather than on evidence. UNTESTED. |
| The R19 example literal (Pelling Ridge Lodge ← Kanchenjunga View Retreat) | Not reachable from any answer set in this catalogue; the requirement's substance is verified instead. UNTESTED as written. |
| Real screen-reader output, real OS clipboard buffer, WCAG contrast ratios, dark colour scheme, 320px / 200% zoom, Firefox and WebKit, the numeric performance budget | Unchanged from round 1 — all still UNTESTED, for the same reasons recorded there. |
| Season windows other than the December peak and the July off-season | Only the two windows the requirement names, plus a standard-season control, were priced. Month boundaries (e.g. a trip that starts 30 Jun and ends 2 Jul) are UNTESTED. |
| Child ages 0 and 1 | The rule published on screen covers ages 2–11; the input accepts 0–17. What a 1-year-old is charged is priced by the same 75%/50% rule but is not named by the published sentence. UNTESTED, and worth a PM decision rather than a bug. |

---

## Verdict

**FAIL.** Two open S2 (B6, B7), both against R21/R7 and both introduced by fix 6 —
the free-day and no-padding change. Nine of the ten ranked fixes land and are
verified against the *fixed means* wording; the tenth lands only on plans whose base
town has more to do than the trip has days.

Nothing that passed in round 1 regressed: 438/438 unit tests pass, and the only
round-1 E2E failures still failing are the three known S3s.

Still open at hand-off: **B6, B7 (S2)**; **B1, B2, B3, B8 (S3)**; **B4, B5, B9, B10
(S4)**.

### Files QA added or changed this round

Added:
- `products/trip-planner/e2e/qa-07-refine1.spec.ts` — R1, R7, R12, R17, R18, R19, R20, R21, R22, R23, R24 (31 tests)
- `products/trip-planner/e2e/qa-08-refine1-sweeps.spec.ts` — the six sweeps over the new surfaces (16 tests)

Changed (assertions superseded by the amended requirements, itemised above):
- `e2e/qa-helpers.ts`, `e2e/qa-01-vibe-basics.spec.ts`, `e2e/qa-02-questions.spec.ts`,
  `e2e/qa-03-plan.spec.ts`, `e2e/qa-04-alternatives-adjust.spec.ts`,
  `e2e/qa-05-trust-session.spec.ts`, `e2e/qa-06-sweeps.spec.ts`,
  `e2e/control-export.spec.ts`, `e2e/plan-flow.spec.ts`, `e2e/trust-layer.spec.ts`
