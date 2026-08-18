# Readiness Report — Compass (trip-planner)

**For:** the founder · **Date:** 2026-08-18 · **Author:** Release Manager

## Verdict

# NOT READY

Three independent gates failed and I reproduced all three myself:

- the automated test suite does not pass (`npm run e2e` exits 1 — 8 failures, two of them
  against the itinerary, which is the whole product);
- the customer panel scored **7.0 out of 10** against a gate of 8.0, with blockers open;
- the Tech Lead's sign-off is **NO-GO**.

And the thing that decides it for me, which I drove by hand at `http://localhost:4079`:
on an ordinary eight-day trip the itinerary prints a day with nothing on it and tells the
user *"Nothing scheduled — this day is yours"* — a choice they never made. On a fifteen-day
trip it does that **eight times**. Separately, the app renders the sentence *"No city
nightlife party trip fits ₹4,50,000 for 9"* and, one click below it on the same screen,
*"The cheapest city nightlife party trip for 9 over these dates is ₹2,34,300."* Both
sentences are on the page at once. A stranger would find that in a few minutes, and it is
the exact opposite of the honesty this product sells.

None of this is structural. The Tech Lead estimates **3–4 days** to a GO and I agree with
his list — the bones are unusually good. But it is not shippable today and I will not
round it up.

---

## Try it

```bash
./scripts/serve-product.sh trip-planner
```

Then open **http://localhost:4079** and do this — it takes under a minute:

1. Click **Beach**, then **Continue**.
2. On *Your trip basics* leave the defaults (10/10/2026 → 15/10/2026, ₹60,000, 2 adults,
   from Bengaluru) and click **Continue**.
3. On *Question 1 of 4* click **Plan my trip now** — skip the questions entirely.

You get **Kochi & Varkala, ₹56,600 total, ₹28,300 per person, ₹3,400 under your budget**,
a six-day itinerary with flights and a named hotel, a cost breakdown that sums exactly to
the total, and a plan ID (`KOCH-5N-2P-B60-…`) stamped with the catalogue date. Press
**Copy as text** and a 16-line plain-text version is on your clipboard, ready to paste into
WhatsApp. That last button is the single most-praised thing in the whole panel.

To see the problem in the same minute: go back, set the dates to **20/12/2026 → 27/12/2026**
and plan again. Day 4 reads *"Nothing scheduled — this day is yours"* with the *Leave one
day free* box unticked.

---

## What you have

A guided trip planner. You pick the kind of holiday you want, give it your dates, budget,
party size and departure city, answer up to four narrowing questions (or skip them), and it
returns one costed day-by-day trip: destination, flights, hotel, experiences per day, a
five-line cost breakdown that adds up, and how far you are under or over budget. It shows
its reasoning, offers a cheaper and a pricier alternative, lets you change any input and
re-price on the spot, and exports the whole thing as pasteable text.

It runs entirely in the browser. No account, no server, no network calls after the page
loads, nothing tracked. Same answers always give the same plan — that was your determinism
requirement and it holds.

**What it is not:** it does not book anything and every price is sample data, snapshot-dated
2026-08-01, labelled as such on every screen. That was escalated to you at the start of the
run (E1/E2) and decided in writing: live aggregator fares need paid, credential-gated APIs
the build environment cannot call, and live fares would have broken the determinism you also
asked for. The catalogue sits behind a `TravelDataSource` seam so a real feed can be plugged
in later without touching the planning engine — and the Tech Lead confirms that seam held.

---

## What is proven

Every row is a command I ran myself from `products/trip-planner`, this session.

| Claim | Command and real result |
|---|---|
| Lints and type-checks clean | `npm run lint` → **exit 0**, no output (ESLint at `--max-warnings=0` plus `tsc --noEmit`) |
| Builds clean | `npm run build` → **exit 0**, 79 modules, `index.js` 295.83 kB (**87.18 kB gzipped**), CSS 23.25 kB, built in 1.02s |
| Unit tests pass | `npm test` → **exit 0**, **438 passed / 438**, 25 files, 24.2s |
| Browser tests **do not** pass | `npm run e2e` → **exit 1**, **194 passed, 8 failed** of 202, 4.9 min |
| The demo path above works | Drove it in a real browser at `http://localhost:4079`: Kochi & Varkala, ₹56,600, 6 day blocks, plan ID `KOCH-5N-2P-B60-qurf`, **zero console errors**, plan on screen ~1.5s after the last click |
| One-click export works | Same session: clicked **Copy as text**, read back `navigator.clipboard` — 16 lines, destination, dates, total, per-person, one line per day, the hotel and the provenance footer |
| Same answers → same plan | `npm run e2e` — `plan-flow.spec.ts:296` "the same answers in a cleared session reproduce the same plan ID, destination and total" **passed** in my run |
| It talks to nobody | `npm run e2e` — `control-export.spec.ts:347` "no network request leaves localhost across the whole flow" **passed**; `:374` confirms the Content Security Policy on the page |
| The money adds up | `npm run e2e` — the R8/R9 breakdown and budget-band specs (`qa-03`) passed; the Tech Lead independently confirms integer-rupee arithmetic end to end |
| Supply chain is clean | Tech Lead ran `npm audit --omit=dev` → **0 vulnerabilities**; two runtime dependencies total (`react`, `react-dom`) |

My run agrees with the QA report exactly — same 8 failures, same files, same lines — and
with the Tech Lead's independent run. Nobody in this pipeline overstated their numbers.
Note the *earlier* QA round 1 in `docs/04-qa-report.md` records a PASS; that verdict was
superseded by round 2's **FAIL** after the customer-feedback changes landed. The live
verdict is FAIL.

---

## What customers said

Three judges, one per persona, each driving the live app with only their own real-world
goal. Round 2 (after one round of fixes): **mean 7.0 / 10 against a gate of 8.0 with zero
blockers. Gate not met.**

| Judge | Overall | Trust | Would pay? |
|---|---|---|---|
| Rohan — impatient designer, 5-day beach trip | **7** | 6 | No subscription; ₹200–300 per trip only if prices were real |
| Anita — chartered accountant, burned by a ₹1.2L→₹2.1L booking | **8** | 7 | ₹500/trip or ₹2,000/year **once prices are live** |
| Kabir — studio owner, 9-person offsite | **6** | 4 | ₹1,000/trip, "not at all until the budget lines stop contradicting themselves" |

All three completed their goal, and all three said they would use it again — Rohan in 45
seconds and 4 clicks, which is the fastest anyone has got a costed answer out of this
category. The praise is consistent and specific: the skip button, the pre-filled basics,
the itemised breakdown, and **Copy as text**, which all three named unprompted. Anita, the
sceptic, said the transparency "is not close — this wins" against her two real travel-agent
quotes.

The criticism is what stops the run:

- **Trust is the lowest sub-score on every card** (6 / 7 / 4). It is not the arithmetic —
  all three verified the maths and believed it. It is the sentences around the maths.
- Kabir filed **3 blockers**, all of the same kind: the app states things that are not true
  (*"You're telling me nothing fits ₹4.5 lakh and handing me something two lakh under it."*
  *"It disproved itself in one click. That's the bit I can't unsee."*), and changing his
  headcount silently threw away the destination he had chosen.
- Rohan filed no blockers but lost faith mid-session: he clicked **Beach** and, after five
  rerolls, was offered **Manali** and **Gangtok**. *"So it's just cycling a list."* He also
  had no way anywhere in the product to say "not Goa", and the first alternative it offered
  him was North Goa.
- Anita's headline finding — a peak-season surcharge that is all-or-nothing while its label
  reads like a date range, so two nights in the window is charged the same as seven — she
  described as *"precisely the shape of the supplement that cost me ₹90,000 last year"*. She
  did not file it as a blocker because it is disclosed and reproducible; it is a blocker in
  substance.

Round 1 was 6.7 with 9 blockers, so the one refinement round moved the score by 0.3 and
cleared most blockers while introducing two new defects. **The refinement budget is now
exhausted (1 of 1 rounds used).**

---

## What is knowingly missing

### Broken now — these are the reason for the verdict

| Gap | What actually happens | Effort to fix |
|---|---|---|
| **The itinerary goes blank on longer trips, and blames the user** (QA B7, S2, R7) | I drove it: Beach, 20/12/2026–27/12/2026 → 8 day blocks, Day 4 reads *"Nothing scheduled — this day is yours"* with the checkbox **unticked**. Beach, 01/09/2026–15/09/2026 → 15 day blocks, **8** of them say it. Cause: 12 of the 42 hotel/destination pairs have only 4–8 reachable activities, and a trip over five nights runs out. | ~1.5 days: re-base the catalogue supply rule, cap trip length per base or add content for six thin bases, and give a supply gap its own honest sentence |
| **"Leave one day free" costs nothing on the product's own reference trip** (QA B6, S2, R21) | I drove it: reference Beach trip, total **₹56,600** before ticking the box and **₹56,600** after. The same six activities repack onto five days. On a data-rich plan (Goa) the price *does* drop ₹58,000 → ₹52,200. A control that moves the price only sometimes is worse than one that never does. | ~2 hours |
| **The "nothing fits" banner is provably false** (Tech Lead, S2) | I reproduced it verbatim through the UI: Party · Within India · A city · A proper city night · Local stays · 13–16 Nov 2026 · 9 adults · ₹4,50,000 · Delhi. Banner: *"No city nightlife party trip fits ₹4,50,000 for 9 — we included the coast."* Budget line: *"₹2,00,100 under your budget."* Restore control, one click later: *"The cheapest city nightlife party trip for 9 over these dates is ₹2,34,300 — ₹2,15,700 under your budget."* Both sentences on one screen. | 0.5 day |
| **The recommendation can ignore the vibe you clicked** (Tech Lead D1, S2) | I clicked **Beach** and rerolled: North Goa → Puducherry → Ella → **Manali & Solang** → **Gangtok & Pelling** → **Kathmandu & Pokhara**. There is no minimum "is this actually a beach place" floor in the engine — the architecture specifies one; it was never built. | 2 hours |
| **A hand-picked plan does not survive an edit** (Tech Lead D4/D5, S2/S3) | Switch to an alternative destination, then change any number, and the app silently reverts to its own pick. A stale amber notice naming a *different* destination can sit under the headline of the one you are looking at. | ~3 hours |

### Known and unfixed, not gate-blocking

| Gap | Detail |
|---|---|
| Seasonal loading is a switch, not a calculation (S3, panel) | Any trip touching 25 Dec – 2 Jan pays +35% on the **whole** stay and travel. Disclosed, but the label implies proration. Either prorate it or reword it. ~0.5 day. |
| No way to exclude a destination before you see it (panel) | Rohan's "not Goa" is unsayable anywhere in the flow. Rejection exists only after a plan is on screen. ~0.5 day. |
| Error summary stops counting down (QA B1, S3) | Fix one of two form errors and the "2 things to fix" summary vanishes instead of reading "1 thing to fix". Screen-reader users lose the anchor. ~1 hour. |
| A question heading misses a word the spec requires (QA B2, S3) | Copy versus spec conflict; the Tech Lead has already chosen the wording. ~10 minutes. |
| One S3 documentation conflict (QA B3) | At the ₹60,000 reference budget, raising the party from 2 to 4 re-plans to a cheaper destination, so a stated "travel cost doubles" rule does not hold literally. Every number shown is correct; the requirement's wording is what is wrong. Document change, ~1 hour. |
| The new "Leave one day free" checkbox is 20×20px (QA B8, S3) | The design commitment is 44×44 minimum for every control. It is the only control in the product that misses. Its label is clickable, so nothing is blocked. ~15 minutes. |
| Four polish items (QA B4, B5, B9, B10, S4) | A seasonal saving renders `₹-9,640` instead of `−₹9,640`; the plan ID line breaks mid-date at 360px; the fallback export box does not wrap; one cost line lacks a tax qualifier. ~1 hour total. |

### Never built, deliberately

Booking, payment or any link to an OTA; live aggregator prices; accounts and cross-device
sync; a free-text chat agent; multi-city trips; flexible dates ("sometime in October");
currencies other than INR and origins outside six Indian metros; maps, photos, weather,
visa advice; PDF, email or share-by-link; saved plan history. The reasoning for each is in
`docs/01-prd.md` §3. The one that matters commercially: **both judges who said they would
pay said they would only pay for real prices.** That is your evidence on whether E1 must be
solved for real.

### Claimed but never tested

Real screen-reader output (only the accessibility tree was asserted); measured WCAG
contrast ratios — the design doc claims AA and nobody verified the numbers; the dark colour
scheme; 320px width at 200% zoom; **Firefox and Safari — every browser test ran on Chromium
only**; the numeric performance budget; child ages 0–1; season boundaries other than the
December and July windows. Also, no automated test ever loads the *production build* — the
test server runs the development build, so what ships is not quite what is tested. The Tech
Lead loaded `dist/` by hand and found it clean, but that is one person once, not a gate.

---

## Scale and cost

Running it costs almost nothing: it is a single static bundle (**87 kB gzipped**, well under
its 200 kB budget) with two runtime dependencies and zero network calls after load, so an
extra user is one CDN hit and there is no server, no database and no per-user cost at all.
Security is the strongest part of the product — no secrets, nothing stored but one 17.5 kB
browser key holding no personal data, a real enforced content-security policy, and 0
production vulnerabilities. The only axis that moves is the **catalogue**, and it is thin:
14 destinations, 42 hotels, 168 activities. At 10× (140 destinations) nothing breaks — the
engine measures 3.95 ms and storage has 285× headroom. At 100× two things go: the planning
loop takes 56 ms (≈220 ms on a mid-range phone, on a click with no loading indicator) and
the catalogue becomes ~1 MB gzipped in the bundle — about a day and a half of work, already
scoped. At 1000×, or with live prices, you need a server for the first time: 1–2 weeks, and
everything above the data seam survives unchanged. **But none of that is today's
constraint.** Today's constraint is that 14 destinations is too few — it is why one judge
was told he had "one of 1 destination in this catalogue", and it is why the itineraries run
out of things to do. Content is cheaper than architecture here.

---

## If you want to keep going

Ranked by what moves the verdict. Total to a defensible GO: **3–4 days**, per the Tech Lead
and consistent with what I saw.

1. **Make the app stop saying false things** — *0.5 day.* Fix the "nothing fits" banner so
   it only claims what the engine actually tested; the engine already holds its own
   disproof. This is first because honesty is the entire differentiator and it cost the
   lowest score on the panel.
2. **Give the planner enough to schedule, and stop crediting the user with blank days** —
   *1.5 days.* Fill or cap the six thin destinations, split the "you asked for a free day"
   sentence from "we ran out of things to do", and make the free-day control actually reduce
   the price. This closes both S2 bugs and reopens the QA gate.
3. **Add the "is this actually a beach place" floor the architecture already specifies** —
   *2 hours.* One rule, already designed, never wired in. It stops Manali being offered for
   a beach holiday, and the banner it fires ("no beach trip fits, so we widened the search")
   is a feature, not an apology. Best trust-per-hour on the list.

Then: re-run the gates until `npm run e2e` exits 0 (0.5 day), make a hand-picked plan
survive an edit (0.5 day), and clear the polish list (1 hour). After that, re-run the panel —
the two judges below the gate are the ones whose blockers these fixes close.

**One process fact you should know:** the run had a budget of two fix rounds and used
**zero**. The two S2 bugs were found by QA in the final regression pass and the run ended
without anyone being given a round to fix them. That is why this report lands on your desk
with known-broken items rather than a fixed build — the loop ran out of *refinement* rounds
(1 of 1) before it ran out of defects, and the fix budget was never spent. If you want, the
cheapest next action is to spend it.

---

**Files:** `docs/01-prd.md` (requirements), `docs/02-architecture.md` (design and its 40
recorded deviations), `docs/03-design.md`, `docs/04-qa-report.md` (both QA rounds, all 10
bugs), `docs/05-customer-feedback.md` (both panel rounds, verbatim),
`docs/07-architecture-review.md` (the NO-GO and its measurements).
