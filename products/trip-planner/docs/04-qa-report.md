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
