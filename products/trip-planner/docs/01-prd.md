# PRD — Compass

**Slug:** `trip-planner` · **Author:** Product Manager · **Status:** Draft · **Date:** 2026-08-18

---

## 0. Escalations to the founder

Two items are escalated per the playbook. **The run continues** — each has a decision
attached and is built as decided. The founder should read these before believing any
price on screen.

**E1 — Live aggregator data needs credentials and a paid service the sandbox cannot have.**
The brief asks to fetch flight, hotel and experience data from Google Flights,
Skyscanner and "other open aggregators". None of these have a free, key-less,
server-to-server API; Google Flights has no public API at all, Skyscanner's is
partner-gated, and the build environment forbids live third-party calls
(`docs/agency/house-stack.md`). **Decision:** ship a versioned, date-stamped local
catalogue behind a single `TravelDataSource` interface, so a real aggregator adapter
can be dropped in later without touching the planning engine. Every price on screen
is labelled as indicative sample data with its snapshot date, and nothing in the
product claims to book.

**E2 — "Fetches live aggregator data" and "must be somewhat deterministic" contradict each other.**
Live fare data changes minute to minute; the same answers would produce a different
trip on Tuesday than on Monday, and the founder's determinism requirement would be
unmeetable. **Decision:** determinism wins for the MVP. The planning engine is a
pure function of (answers + catalogue version) and shows a stable plan ID, which is
also what makes it testable. When a live adapter is added later, determinism is
preserved by pinning a fare snapshot per plan ID rather than re-querying — that
design constraint is recorded here so the Tech Lead honours it.

---

## 1. Problem

Someone with a free week, a rough budget and a vague feeling ("somewhere with
mountains", "somewhere quiet") cannot get from that feeling to a costed plan without
doing the work themselves. Today they open six tabs — MakeMyTrip for flights,
Booking.com for hotels, three "10 best places for a beach holiday" listicles and a
YouTube vlog — and manually reconcile them. The listicles do not know their budget;
the booking sites do not know what kind of holiday they want and demand a destination
before they will show anything. The gap between "I want a quiet 5-night trip for two
under ₹60,000" and "here is where to go, for how much" is filled by two evenings of
tab-juggling, a spreadsheet, or a friend who happens to travel a lot.

The cost is not just time. Most people abandon halfway and default to the place they
went last year, or to whatever a travel agent pushes. Search engines answer *"how
much is a flight to Goa"*; nobody answers *"where should I go, given this money, these
dates and this mood, and what will the whole thing actually cost."*

**Who has it:** working adults planning a 2–14 night leisure trip 2–20 weeks out, with
a fixed-ish budget and a soft destination preference. Groups of 1–12.

---

## 2. The one job

**Turn a handful of answers about mood, dates, budget and headcount into one specific,
costed, day-by-day trip — destination chosen for you, with the total priced against
your budget and the reasoning shown.**

Not booking. Not comparing every option on the market. Not chatting. One job:
*vague feeling in → one costed itinerary out, and you can see why.*

The second centre of gravity in the brief — actually fetching and transacting against
live aggregators — is deliberately cut (see E1, and Out of scope). A planner that
confidently produces one good costed trip is worth coming back to; a half-wired
booking funnel that shows stale fares is worth nothing and is a consumer-protection
problem besides.

---

## 3. Scope

### In scope

| ID | Requirement | Acceptance criterion (Given / When / Then) |
|---|---|---|
| R1 | **Choose a vacation vibe on the landing screen.** Six named vibes — Mountains, Beach, Party, Honeymoon, Peace & Quiet, Culture & Food — presented as selectable cards on the first screen, no scrolling required at 1280×800. | **Given** a first-time visitor on `/`, **When** the page loads, **Then** exactly six vibe cards are visible with those labels and a disabled "Continue" button; **When** they select "Beach", **Then** that card is marked selected (`aria-pressed="true"`), "Continue" becomes enabled, and clicking it advances to the Trip basics screen. |
| R2 | **Capture trip basics:** start date, end date, total budget (INR, whole party), number of travellers (1–12), departure city from a fixed list of six Indian metros. | **Given** the Trip basics screen, **When** the user enters start 2026-10-10, end 2026-10-15, budget 60000, travellers 2, departure "Bengaluru" and continues, **Then** the app advances to the first adaptive question and a persistent summary bar shows "5 nights · 2 travellers · from Bengaluru · ₹60,000". |
| R3 | **Reject invalid basics inline, without advancing.** End date on or before start; trip longer than 21 nights; budget below ₹5,000 or non-numeric; travellers outside 1–12. | **Given** the Trip basics screen, **When** the user sets end date before start date and clicks Continue, **Then** the screen does not change, an error message "End date must be after your start date" is shown next to the end-date field and is linked to it via `aria-describedby`; **And** when the same is done with budget `0`, the error "Enter a budget of at least ₹5,000" appears and Continue still does not advance. |
| R4 | **Ask adaptive follow-up questions from a decision graph** — between 3 and 5 questions, where the *next* question is determined by the previous answers, not a fixed list. Each question shows position ("Question 2 of 4") and offers a "No preference" option. | **Given** vibe = Beach, **When** the user answers "International" to the first adaptive question, **Then** the next question asks about flight length (contains "long-haul"); **Given** the same start but the answer "Within India", **Then** the next question is a different one (contains "coast") and the long-haul question is never shown. **And** every adaptive question screen offers a "No preference" choice that advances to the next question. |
| R5 | **Skip the remaining questions at any point.** A "Plan my trip now" control is present on every adaptive question; taking it fills unanswered questions with neutral defaults and goes straight to a plan. | **Given** the user is on adaptive question 1 of 4, **When** they click "Plan my trip now", **Then** a complete plan screen is rendered with a destination, a total price and a day-by-day list — **And** the plan screen states which questions were defaulted ("3 questions answered for you"). |
| R6 | **Change an earlier answer without losing the others.** A Back control on every question screen; changing an answer that invalidates later branches re-derives the remaining questions and keeps still-valid answers. | **Given** the user has answered questions 1–3, **When** they click Back twice, **Then** question 2 is shown with the user's previous answer still selected; **When** they change question 2's answer to one that leads down a different branch, **Then** question 3 is replaced by the new branch's question and question 1's answer is unchanged in the summary. |
| R7 | **Produce one costed day-by-day itinerary:** a named destination, an outbound and return travel leg, one stay for the whole trip, and 1–3 named experiences on every day from arrival to departure. | **Given** completed answers for a 5-night trip, **When** the plan screen renders, **Then** it shows one destination name, exactly 6 day blocks labelled "Day 1"…"Day 6", each day block containing at least one named experience, one stay entry naming the property and the number of nights, and travel legs for arrival and departure. |
| R8 | **Show a cost breakdown that adds up.** Line items for travel, stay, experiences and a local-costs allowance, each with a per-unit basis, plus a total for the party and a per-person figure. | **Given** any rendered plan, **When** the cost breakdown is read, **Then** the four line-item amounts sum exactly to the displayed party total, **And** the per-person figure equals the party total divided by the number of travellers rounded to the nearest ₹100, **And** changing travellers from 2 to 4 (R12) increases the travel line item by exactly the per-person fare × 2. |
| R9 | **Price against the budget with a soft cutoff.** The plan states its position relative to budget: "₹8,400 under your budget", "On budget", or "Stretch — 12% over". Plans above budget × 1.25 are never recommended. | **Given** budget ₹60,000, **When** the recommended plan totals ₹51,600, **Then** the screen shows a budget line reading "₹8,400 under your budget"; **Given** a set of answers for which the cheapest possible plan is ₹66,000, **Then** the plan is shown and labelled "Stretch — 10% over your budget"; **And** no plan whose total exceeds ₹75,000 is ever presented as the recommendation for that budget. |
| R10 | **Explain the choice.** A "Why this trip" section names the specific answers that selected this destination over the runners-up, and names at least one destination that was rejected and why. | **Given** a rendered plan, **When** the "Why this trip" section is opened, **Then** it lists at least three reasons, each quoting one of the user's own answers (vibe, destination type, budget, dates or an adaptive answer), **And** it names at least one rejected destination with a one-line reason containing a number (e.g. "Bali — ₹18,200 over budget"). |
| R11 | **Offer a Saver and a Stretch alternative, and let the user switch.** Each alternative shows destination, total and the delta versus the recommendation; selecting one makes it the displayed plan. | **Given** a rendered plan, **When** the alternatives section renders, **Then** up to two alternative cards are shown, a Saver card with a total at least 10% below the recommendation and a Stretch card with a higher total within budget × 1.25; **When** the Saver card is selected, **Then** the main itinerary, cost breakdown, budget line and plan ID all update to the Saver plan; **And** where no qualifying alternative exists, an explicit message is shown in its place ("No cheaper option in this catalogue for these dates") rather than an empty slot. |
| R12 | **Adjust budget and travellers on the plan screen and re-plan, without re-answering questions.** | **Given** a rendered plan for 2 travellers at ₹60,000, **When** the user sets travellers to 4 and applies, **Then** the plan screen re-renders with an updated total, an updated per-person figure and an updated plan ID, the questionnaire is not shown again, and the vibe and adaptive answers are unchanged in the summary bar. |
| R13 | **Determinism: the same answers always produce the same plan.** Every plan displays a plan ID derived from the normalised answers plus the catalogue version. | **Given** a completed set of answers, **When** the plan ID and destination are recorded, the browser storage is cleared, and the identical answers are entered again in a fresh session, **Then** the plan ID, destination, every itinerary line and the party total are identical. |
| R14 | **Never dead-end: relax the least important constraint instead of showing nothing.** | **Given** answers with no exact match in the catalogue (e.g. International + Party + 2 nights + ₹25,000 for 4 travellers), **When** the plan is generated, **Then** a plan is still shown, a banner names the constraint that was relaxed and why ("No international party trip fits ₹25,000 for 4 — we searched within India instead"), and a control re-applies the dropped constraint and explains the resulting cost. |
| R15 | **Survive an interrupted session.** Answers and the current plan persist locally; returning to the app offers to resume. | **Given** a user has answered the basics and two adaptive questions, **When** the browser is reloaded, **Then** the app returns to the same question with all prior answers intact; **And given** a rendered plan, **When** the browser is reloaded, **Then** the identical plan is shown without regenerating; **And** a "Start over" control clears the saved session and returns to the vibe screen. |
| R16 | **Be honest about the data.** A persistent, non-dismissable provenance line states the data is an indicative sample catalogue with its snapshot date, and no screen offers to book or take payment. | **Given** any screen that displays a price, **When** it is rendered, **Then** a provenance line is visible containing the words "indicative" and the catalogue snapshot date, **And** no element in the application has the accessible name "Book", "Pay", "Checkout" or "Reserve". |
| R17 | **Export the itinerary as plain text.** | **Given** a rendered plan, **When** the user clicks "Copy as text", **Then** a read-only text area appears containing the destination, the dates, the party total and one line per day, **And** a confirmation "Copied" is announced in a live region. |

### Out of scope (and why)

| Cut | Why it can wait |
|---|---|
| Live aggregator queries (Google Flights, Skyscanner, Booking.com) | No key-less API exists, the environment forbids live third-party calls, and live fares break determinism (E1, E2). The `TravelDataSource` interface is the seam that makes this a later swap, not a rewrite. |
| Booking, payment, checkout, deep links to an OTA | The moment the product takes money or sends a user to pay, stale sample prices become a consumer-protection problem. Nothing to add until prices are live. |
| Accounts, login, sync across devices | The whole flow is under five minutes and `localStorage` covers the interrupted-session case (R15). Accounts add auth, storage and privacy surface for zero improvement to the one job. |
| Free-text chat / LLM travel agent | No model is available offline, and a chat box would make the product non-deterministic in exactly the way the founder said it must not be. The question graph is the deterministic form of the same idea. |
| Multi-city and multi-leg trips ("Rome then Florence") | Doubles the itinerary model and the pricing model to serve a minority of trips. One destination first. |
| Per-traveller detail: ages, child fares, room-sharing preferences, dietary needs | Real (persona P2 arrives with two children) but it multiplies the pricing matrix. MVP prices per adult traveller and says so on the breakdown. |
| Flexible dates ("sometime in October, 5 nights") | Requires searching a date space rather than pricing a fixed one. Fixed dates first; flexible dates is the obvious second release. |
| Currency other than INR; departure cities outside the six listed | Keeps the catalogue coherent and the national/international branch meaningful. Pure data, trivially extended. |
| Maps, photo galleries, weather, visa and vaccination guidance | Presentation and advice layers on top of a plan that does not exist yet. Visa/health advice also carries a duty-of-accuracy the MVP cannot honour. |
| Sharing a plan via URL or link, PDF export, email | The text export (R17) covers the real need — getting it into Slack or WhatsApp — with none of the server or rendering cost. |
| Saved plan history / comparing past plans | Nobody has a second plan yet. Revisit once people return. |

---

## 4. Primary user flow

**Entry — the vibe screen (`/`)**

1. The user arrives at a single screen: the question "What kind of trip do you want?"
   and six vibe cards. No sign-up, no modal, no tour. If a saved session exists, a
   banner at the top offers "Resume your Goa plan" and "Start over" (R15).
2. They pick one vibe. Continue enables. *(≈8 seconds in.)*

**Basics**

3. One screen, five fields: dates, budget, travellers, departure city. Sensible
   defaults are pre-filled (next month, 5 nights, ₹60,000, 2 travellers) so the screen
   is never blank and the impatient user can press Continue immediately (R2).
4. **Bad data branch:** invalid entries produce inline errors and the screen does not
   advance (R3). The user is never bounced to a different screen to fix a typo.

**Adaptive questions**

5. Three to five one-question screens, each derived from the answers so far (R4).
   Example path for Beach: *Within India or international?* → (International) *Are you
   happy with a long-haul flight, or under 6 hours?* → *Lively beach or empty beach?*
   → *Resort comfort or local stays?*
6. Every screen carries "No preference" (R4), Back (R6) and "Plan my trip now" (R5).
   The escape hatch is always one click away — the questionnaire is never a wall.
7. **Changed-mind branch:** going Back and changing an answer re-derives the questions
   that follow it and keeps the ones that are still valid (R6).

**Generating**

8. On the last answer (or on "Plan my trip now"), a brief generating state names what
   it is doing — "Scoring 14 destinations against your answers" — and resolves to the
   plan. It is a pure local computation, so this is under a second; it is a state, not
   a spinner-for-show, and it never blocks longer than 2 seconds.

**The moment of value — the plan screen**

9. **This is the point the product has paid for itself:** one destination, one total
   price against their budget, and a day-by-day itinerary they could act on — reached
   in under 90 seconds from a cold landing, without having named a destination
   themselves. "Kochi & Varkala, 5 nights, ₹51,600 for 2 — ₹8,400 under your budget."
10. Below it: the cost breakdown that adds up (R8), "Why this trip" naming their own
    answers and a rejected runner-up (R10), the Saver and Stretch alternatives (R11),
    and the adjust panel for budget and headcount (R12).
11. They change headcount from 2 to 4, or drag the budget, and the plan re-costs in
    place without re-asking anything (R12). They switch to the Saver alternative and
    the whole screen follows (R11).
12. They click "Copy as text" and paste the itinerary into WhatsApp or Slack (R17).

**Failure branches**

- **No data / no exact match** (P3's "party *and* peace, international, tiny budget"):
  the engine drops the lowest-priority constraint by a fixed, documented priority
  order, shows a plan anyway, and names what it dropped and why, with a control to put
  it back (R14). The user never sees an empty result.
- **Bad data:** caught at the basics screen inline (R3). Adaptive questions cannot
  produce invalid data — they are all closed choices.
- **Interrupted session:** a reload, a closed tab or a dead battery returns the user to
  the exact question or the exact plan they left, from local storage (R15). "Start
  over" is always available and clears everything.
- **Over budget everywhere:** if even the cheapest plan exceeds budget × 1.25, the plan
  is shown clearly labelled as a stretch with the gap in rupees, alongside the specific
  change that would close it ("2 nights fewer brings this to ₹58,900") — never a blank
  "no results" page.
- **Nothing to compare against:** where no Saver or Stretch alternative qualifies, the
  slot carries an explicit sentence, not an empty card (R11).

---

## 5. Screen inventory

| Screen | Purpose | Requirements served |
|---|---|---|
| **S1 — Vibe** (`/`) | First screen. Six vibe cards, resume banner if a session exists, provenance line. | R1, R15, R16 |
| **S2 — Trip basics** | Dates, budget, travellers, departure city, an "Anywhere except…" exclusion control, with inline validation and a running summary bar. | R2, R3, R16, R26 |
| **S3 — Adaptive question** (one component, 3–5 renders) | One question at a time from the decision graph, with progress, "No preference", Back and "Plan my trip now". | R4, R5, R6, R15 |
| **S4 — Generating** | Named, honest transient state between the last answer and the plan; ≤2s. | R7 |
| **S5 — Plan** | The itinerary, cost breakdown, budget line, "Why this trip", alternatives, adjust panel, relaxation banner, reject control, provenance. | R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R22, R25 |
| **S6 — Export dialog** | Plain-text itinerary in a read-only text area with a copy control and live-region confirmation. | R17 |

---

## 6. Personas for the customer panel

These three will not agree. P1 wants fewer screens; P2 wants more explanation and more
numbers, which means *more* screen; P3 wants controls and an escape hatch that neither
of the others would ever touch. If a change pleases all three, check it is real.

### P1 — Rohan Mehta · *The Impatient Pragmatist*
**Identity:** 29, product designer in Bengaluru. Planning a break between two meetings,
on his laptop, with a Slack thread open in the next tab.
**Goal, in his words:** *"I've got October 10th to 15th free and about ₹60k for two.
Just tell me where to go and roughly what it costs. I'll decide in five minutes — I am
not filling in a form about my travel personality."*
**The input he arrives with:** "Oct 10–15 (could stretch to the 16th), 2 people, ~60k
all-in, from Bengaluru, somewhere with a beach — but not Goa, we did Goa last year."
He will not read the provenance line and will not open "Why this trip" unless the price
surprises him.
**What he uses today:** Googles "beach destinations from Bangalore under 60k", opens
MakeMyTrip, gives up, asks a friend on WhatsApp.
**Abandons when:** he is more than about six clicks from the landing page and still has
not seen a destination and a number; or a question has no skip; or the first plan is a
place he explicitly ruled out and there is no fast way to get a different one.

### P2 — Anita Fernandes · *The Sceptic*
**Identity:** 47, chartered accountant in Mumbai. Last year she booked a "₹1.2 lakh
family package" that arrived at ₹2.1 lakh after taxes, transfers and a "peak season
supplement". She has not trusted a travel site since.
**Goal, in her words:** *"Give me one complete number for four people over Christmas
week, including flights, and show me exactly what makes up that number. If I reload
the page and the price has moved, or I can't tell where a figure came from, I'm gone."*
**The input she arrives with:** Dec 20–27 (peak week), 4 people — "2 adults, 2 kids,
9 and 12" — budget "₹2.5 lakh, maybe 3 if it's genuinely worth it", from Mumbai,
"somewhere peaceful, absolutely not a party place, and I don't want a 3am flight."
Note her input is richer than the product models: it has child ages and a flight-time
preference the MVP does not support. She will find that.
**What she uses today:** a spreadsheet of quotes from two local agents, cross-checked
against Booking.com.
**Abandons when:** a number appears with no explanation of its basis; the total changes
between two views of the same plan; the site implies she can book something at that
price; or "per person" turns out to mean something different from what she assumed.

### P3 — Kabir Sandhu · *The Power User with the messy input*
**Identity:** 34, runs a nine-person design studio in Delhi. Organising the annual
studio offsite, which he has done three times and which has changed headcount three
times each year.
**Goal, in his words:** *"One plan I can paste straight into Slack for nine people over
a long weekend, under ₹4.5 lakh total. It needs one proper night out and one day where
nobody has to do anything. And two people always drop out, so I need to change it to
seven without starting again."*
**The input he arrives with:** 9 travellers (which he will change to 7, then to 12 to
see what breaks), Nov 13–16, ₹4,50,000, from Delhi, and two contradictory vibes — he
wants **Party** *and* **Peace & Quiet** in the same trip. He will also try
"International" with a budget that cannot support it for twelve people, purely to see
whether the product lies to him or admits it.
**What he uses today:** a Google Sheet with a tab per destination, plus a WhatsApp
group that argues for two weeks.
**Abandons when:** changing the headcount means re-answering the questionnaire; the
product returns "no results" instead of the nearest workable thing; or he cannot get
the itinerary out of the app as text he can paste.

---

## 7. Success metrics

Measurable inside a single judged session — no analytics backend required.

| # | Metric | Target |
|---|---|---|
| M1 | Time from landing on `/` to a first fully costed plan on screen, unassisted | ≤ 90 seconds; ≤ 45 seconds on the "Plan my trip now" path |
| M2 | Interactions from landing to first plan on the shortest path | ≤ 8 (1 vibe + 1 continue + basics + skip) |
| M3 | Judges reaching a costed itinerary without help | 3 of 3 |
| M4 | Cost breakdown line items summing to the displayed total | 100% of plans (QA-asserted, R8) |
| M5 | Identical answers producing an identical plan ID and total across fresh sessions | 100% (QA-asserted, R13) |
| M6 | Judges who change a parameter on the plan screen and get an updated plan without re-answering | ≥ 2 of 3 |
| M7 | Plans presented as the recommendation above budget × 1.25 | 0 |
| M8 | Dead-end / "no results" screens encountered by any judge | 0 |
| M9 | Mean overall judge score | ≥ 8, with zero blockers |
| M10 | Trust sub-score from the sceptic persona (P2) | ≥ 7 — the honest-data requirements (R8, R10, R13, R16) exist for this number |

---

## 8. Assumptions decided

| # | Ambiguity | Decision | Reversible? |
|---|---|---|---|
| A1 | "Fetches flight, hotel and experience data from aggregators" — impossible in this environment (E1). | A versioned local catalogue behind a `TravelDataSource` interface: 14 destinations (6 in India, 8 international), each with 3 stays, ≥8 experiences, and fares from all 6 origin cities. Snapshot-dated and labelled indicative. | Yes — swap the adapter; the engine does not change. |
| A2 | "AI travel agent" with no model available offline. | The intelligence is a deterministic scoring engine over an explicit question graph. The UI never claims to be an AI or a human agent; it calls itself a guided planner. Determinism was the founder's own requirement, so this serves the brief rather than dodging it. | Yes, but reversing it costs the determinism guarantee (E2). |
| A3 | Origin market and currency unspecified. | Six Indian metro origins (Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad); all prices INR. This makes the brief's "international vs national" branch concrete and the budget bands realistic. | Yes — pure catalogue data. |
| A4 | "Around the budget but without a strict cutoff." | Soft band: recommend the best-matching plan at or below budget; if none exists, recommend the closest above and label it "Stretch — N% over". Never recommend above budget × 1.25. Saver alternative is ≥10% below the recommendation. | Yes — the multipliers are configuration. |
| A5 | How many adaptive questions before the plan. | Between 3 and 5, always with "No preference" and always with a "Plan my trip now" escape (R4, R5). Below 3 the graph is decoration; above 5 P1 leaves. | Yes. |
| A6 | Whether the trip length is fixed or searched. | Fixed dates only; nights are derived from start and end. Flexible-date search is out of scope. | Yes, but it is a new search dimension, not a tweak. |
| A7 | Group composition — children, room sharing, dietary needs (P2 arrives with two children). | Priced per adult traveller; stays priced at one room per two travellers, rounded up. The breakdown states this basis in words so nobody has to infer it. | Yes — a pricing-matrix change. |
| A8 | Contradictory answers (P3 wants Party *and* Peace). | Vibe is single-select; the adaptive graph then offers a "one lively night, otherwise quiet" style branch where the vibe supports it. Contradictions never produce an error — they resolve through the relaxation rule (R14). | Yes. |
| A9 | What happens when nothing matches. | Fixed, documented constraint-priority order — budget band > dates > travellers > vibe > national/international > later graph answers, dropped most-recent-first — and the dropped constraint is named on screen (R14). | Yes. |
| A10 | Persistence mechanism. | `localStorage`, single key, versioned schema; a version mismatch clears it and returns to the vibe screen rather than crashing. No accounts. | Yes. |
| A11 | What "somewhat deterministic" means precisely. | Plan output is a pure function of normalised answers + catalogue version, surfaced as a visible plan ID. No randomness, no time-of-day dependence, no shuffling of results. | No — this is the product's trust claim and R13 tests it. |
| A12 | Product name (the brief gives none). | **Compass.** One word, describes the job, not tied to India or to a vibe. | Yes. |
| A13 | Whether to show the trip on a map. | No. A map implies the app knows more geography than it does and costs a tile provider or a bundled asset set. Text and structure only. | Yes. |
| A14 | Scale — the founder asked for "scalable in future". | Handled as an architecture constraint, not an MVP feature: the catalogue is data, the engine is pure, and the scoring is O(destinations). The Tech Lead owns the 10×/100×/1000× answer in `02-architecture.md`. | N/A — a constraint passed on, not a decision to reverse. |

---

## 9. Risks

- **The catalogue is too thin to feel intelligent.** With 14 destinations, two judges
  with different answers may land on the same place and conclude the questions were
  theatre. Mitigation: the vibe × national/international × budget-band matrix must have
  no cell served by fewer than two destinations, and "Why this trip" (R10) has to name
  a genuine rejected runner-up. If the panel says "it always sends me to Goa", the
  catalogue is the fix, not the engine.
- **The questionnaire feels like a quiz that delays the payoff.** This is the single
  most likely way P1 abandons. R5 exists specifically to defuse it; if judges still
  hesitate at question 2, the answer is fewer questions, not a better progress bar.
- **Sample prices poison trust.** P2 may treat indicative data as disqualifying no
  matter how honestly it is labelled. That is a legitimate verdict and should be
  reported to the founder as evidence about E1, not designed around.
- **Determinism reads as rigidity.** A user who re-runs the same answers expecting a
  fresh suggestion gets the identical plan. Mitigation: the alternatives (R11) and the
  adjust panel (R12) are the sanctioned ways to see something else; there is
  deliberately no "surprise me" button, because that would be the randomness R13 forbids.
- **Even done perfectly, the plan is not bookable.** Someone who loves the itinerary
  still has to go and buy it elsewhere. The MVP's claim is that choosing *where and for
  how much* is the expensive part; if the panel says the plan is worthless without a
  booking link, that is the finding that decides whether E1 must be solved for real.

---

## 10. Refinement round 1 — amended and added requirements

Source: `docs/05-customer-feedback.md` (3 judges, mean 6.7, 9 blockers). Triage and
ranking are in that file under *Ranked fixes*. Everything below is failable in the same
way as R1–R17; QA extends the E2E suite to cover it.

### Amended

| ID | Amendment | Acceptance criterion (Given / When / Then) |
|---|---|---|
| R1 | The landing screen must advertise the escape hatch, not hide it until question 1. | **Given** a first-time visitor on `/`, **When** the page loads, **Then** visible text on the vibe screen states both that there are four quick questions and that they can be skipped (contains "skip" and offers no more than "four"), **And** the phrase "three or four" no longer appears. |
| R7 | One plan books one base. No itinerary day may pair two places more than 90 minutes apart, and the plan names the base town it actually books. | **Given** any generated plan, **When** the itinerary renders, **Then** every scheduled experience is within 90 minutes of the chosen stay's base, **And** the plan header names that base town, **And** for the domestic Kerala destination with the `Brunton Boatyard` stay no day contains both a Varkala experience (`vkl-cliff`, `vkl-kappil`) and a Kochi experience (`vkl-spice`, `vkl-fort`). |
| R12 | The adjust-and-re-plan panel carries start date, end date and departure city alongside travellers and budget. Nothing about a trip requires "Start over". Date fields read and write DD/MM/YYYY. | **Given** a rendered plan for 10/10/2026–15/10/2026 from Bengaluru, **When** the user changes the end date to 16/10/2026 in the adjust panel and applies, **Then** the plan re-renders with 6 nights, a new total and a new plan ID, the questionnaire is not shown, and the vibe and adaptive answers are unchanged; **And** changing departure city to Mumbai re-prices the travel line; **And** every date field on every screen displays `10/10/2026` for 10 October 2026 with a visible `DD/MM/YYYY` hint. |
| R17 | "Copy as text" writes to the clipboard in the same click, with the dialog as a fallback, not as the first step. | **Given** a rendered plan in a browser with clipboard permission, **When** the user clicks "Copy as text", **Then** `navigator.clipboard.readText()` returns the itinerary text, **And** a live region announces "Copied"; **Given** clipboard access is denied or unavailable, **When** the same button is clicked, **Then** the read-only text dialog opens and the message names the failure ("Couldn't reach the clipboard — copy it from here"). |

### Added

| ID | Requirement | Acceptance criterion (Given / When / Then) |
|---|---|---|
| R18 | **Never state a false day-of-week.** Fixed-day experiences carry structured weekday availability; the scheduler only places them on a matching date, and says so when it cannot. | **Given** a Goa plan covering Sat 14 – Sun 15 Nov 2026, **When** the itinerary renders, **Then** "Anjuna flea market" appears only on a Wednesday and "Saturday night market, Arpora" only on a Saturday; **And given** a plan whose dates contain no Wednesday, **Then** the Anjuna market is absent from every day and a line under the itinerary reads "Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday"; **And** no experience blurb asserts a weekday that the day it sits on contradicts. |
| R19 | **Disclose every substitution on the headline.** When a re-plan changes the stay, the comfort tier, the destination, or overrides an answer the user gave, the plan says so where the user is already looking — and "Why this trip" is open by default. | **Given** a plan for 4 travellers staying at Kanchenjunga View Retreat (premium), **When** travellers is set to 5 and applied, **Then** a change notice adjacent to the total reads "Changed to keep you inside budget: stay is now Pelling Ridge Lodge (₹3,600/night, standard) instead of Kanchenjunga View Retreat (₹8,600/night, premium)"; **And given** the user answered "International" and R14 relaxed it, **Then** the same notice names the overridden answer ("You asked for international — nothing fits ₹80,000 for 12, so this is within India"); **And** on first render of any plan the "Why this trip" section is expanded without a click. |
| R20 | **State the basis of every money line.** Every priced line names its tax position and its unit; the party total names what it covers. | **Given** any cost breakdown, **When** it renders, **Then** the stay line reads "₹8,600 per room-night, incl. GST" (or "excl. GST"), the travel and experience lines carry the same tax qualifier, **And** the total is labelled with the party it covers ("Total for 4 adults"), **And** the words "GST" and "adults" each appear at least once on the plan screen. |
| R21 | **A day with nothing scheduled, on request, and no padding to fill days.** The user can ask for one unscheduled day; the planner never repeats the same experience on two days to pad. | **Given** the adjust panel with "Leave one day free" unchecked, **When** the user checks it and applies, **Then** exactly one middle day renders with zero experiences and the words "Nothing scheduled — this day is yours", the total drops by that day's experience cost, and the plan ID changes; **And given** any plan of any length, **Then** no experience name appears on two different days. |
| R22 | **Reject a destination and get the next one, keeping the whole trip.** | **Given** a rendered North Goa plan, **When** the user clicks "Not this one — somewhere else", **Then** a different destination is shown within 2 seconds with the same dates, budget, travellers, origin and answers, the rejected destination is listed as excluded with an "undo" control, and the plan ID changes; **And** repeating until the catalogue is exhausted shows "That's every destination that fits — here are the ones you turned down" rather than an empty screen; **And** where neither a Saver nor a Stretch alternative exists, the alternatives area renders one "Not this one — somewhere else" control instead of two empty slots. |
| R23 | **Price responds to the travel dates, with the seasonal loading shown as its own line.** | **Given** identical answers priced for 20–27 Dec 2026 and for 5–12 Jul 2027, **When** both plans render, **Then** the party totals differ, **And** each breakdown carries a line naming the season and the loading applied ("Peak season (25 Dec – 2 Jan): +35% on stay and travel" / "Off season (Jul): −20% on stay and travel"), **And** the seasonal line is included in the four-line sum that ties to the total, **And** the season basis is stated as indicative sample data alongside the R16 provenance line. |
| R24 | **Children counted and priced, at a published rate.** Travellers splits into adults and children with ages; the child rate is stated on screen. | **Given** the basics screen, **When** the user enters 2 adults and 2 children aged 9 and 12, **Then** the summary bar reads "4 travellers (2 adults, 2 children)"; **And** the plan totals price each child's travel and experiences at the published child rate shown on the plan ("Children 2–11 are priced at 75% of the adult fare and 50% of experiences; they occupy a room place"), **And** the breakdown lines show the adult and child counts separately, **And** room capacity counts children as occupants. |

### Assumptions decided in this round

| # | Ambiguity | Decision | Reversible |
|---|---|---|---|
| A12 | The catalogue has no child rates and inventing one is fabricating data. | Publish an explicit, visible child-rate rule (75% travel, 50% experiences, full room occupancy, ages 2–11) rather than refuse the input. It is sample data, labelled as such by R16, and a stated rule is honest; silence about children is not. | Yes — one constant. |
| A13 | Seasonality could be modelled per destination per date, or as a coarse band. | Month-band multipliers per destination (peak / shoulder / off, plus a named festive window), applied to stay and travel and shown as its own breakdown line. Per-date curves need real inventory. | Yes. |
| A14 | Rejecting a destination could randomise or could walk the ranked list. | It walks the deterministic ranked list and records the exclusion set in the plan ID, so R13 still holds: the same answers plus the same rejections give the same plan. | No — this is the determinism claim. |
| A15 | Kabir asked to edit or swap individual activities. | Refused. Pinning one free day (R21) is in; a general itinerary editor is not — it turns a decision engine into a document editor and breaks R13. | Yes, but it is a product-shape decision, not a detail. |

---

## 11. Refinement round 2 — gap closure (founder direction, priority order)

Source: `docs/06-readiness-report.md` (NOT READY), `docs/07-architecture-review.md`
(NO-GO, drift D1–D5), `docs/04-qa-report.md` round 2 (FAIL, B1–B10) and the founder's
own priority list. No escalation applies here — nothing in this round needs a
credential, contradicts another requirement, or turns on a legal/safety question; it
is bounded engineering the Tech Lead has already scoped at 3–4 days. Requirement IDs
are unchanged; existing IDs are amended in place and two genuinely new capabilities
get new numbers (R25, R26). QA extends the E2E suite to cover every row below, and
`npm run e2e` exiting 0 is the gate for this round, not a target.

### Amended

| ID | Amendment | Acceptance criterion (Given / When / Then) |
|---|---|---|
| R14 | The relaxation banner may only assert what the engine actually tested, and must never share a screen with a plan the engine itself shows as at-or-under budget. Choosing which constraint to drop is a search over the droppable set, not a fixed drop-most-recent-first order. | **Given** any answer set for which the ladder considers dropping a constraint, **When** the plan renders, **Then** the banner naming "no `<label>` `<vibe/answer>` trip fits `<budget>` for `<n>`" is shown **only if** no candidate in the full catalogue satisfies the dropped constraint plus every constraint that was *not* dropped, within budget × 1.25 — equivalently, the restore control's `costDelta` for that banner is never negative; **And given** the Party / Within India / A city / A proper city night / Local stays / 13–16 Nov 2026 / 9 adults / ₹4,50,000 answer set from the architecture review, **Then** the banner does not read "No city nightlife party trip fits ₹4,50,000 for 9" (ten cheaper candidates satisfy it), and the engine instead recommends the cheapest candidate that does satisfy the full, undropped conjunction; **And** a unit test asserts `restore.costDelta < 0` never occurs for any banner shown in the reference answer-set fixture. |
| R7 | A destination-and-stay pair may only be offered for trip lengths its own experience supply can fill. No day renders "Nothing scheduled" unless the user's own free-day choice (R21) put it there. | **Given** any `(destination × stay)` pair in the catalogue, **When** the pair's maximum offered trip length is read, **Then** `eligibleExperiences(destination, stay).length >= maxNightsOffered + 1` holds for all 42 pairs — pairs that do not clear this are either backed with enough additional named experiences or capped to a shorter maximum trip length, and the cap is enforced by the planner (a longer trip is never scheduled against a pair that cannot fill it); **And given** a Beach plan for 20/12/2026–27/12/2026 with "Leave one day free" unchecked, **Then** every one of the 8 day blocks names at least one experience — zero blank days on a request nobody made. |
| R8 | The line-item sum and the per-person figure hold for every rendered plan; the fare-doubles-on-headcount property holds specifically when a re-plan keeps the same destination, and is stated that way. | **Given** any rendered plan, **When** the breakdown is read, **Then** the priced line items sum exactly to the party total and the per-person figure is exact, as before; **And given** travellers is changed and the resulting plan keeps the same destination, **Then** the travel line rises by exactly the per-traveller fare × the traveller delta; **And given** the resulting plan changes destination because the prior one would exceed budget × 1.25 (R9), **Then** the change notice (R19) names the destination change and the linear-fare property is not asserted for that transition — R9 (never recommend over the stretch ceiling) takes precedence over R8's fare-scaling literal when the two would conflict. |
| R11 | A plan the user hand-picked — a Saver, a Stretch, or the result of "Not this one — somewhere else" (R22) — is what any later adjust or reload returns to; it never silently reverts to the engine's own top-ranked candidate. | **Given** the user has selected the Saver alternative or rejected the recommended destination, **When** they then change travellers or budget in the adjust panel and apply, **Then** the re-priced plan is drawn from the same hand-picked candidate (or, if that candidate can no longer be scheduled at all, an explicit notice says so and names what replaced it, per R19) — **and** it is never silently replaced by the plan the unconstrained engine would have picked; **And given** the same hand-picked state, **When** the browser is reloaded, **Then** the restored plan is the hand-picked one, not the engine's default, and its plan ID is re-derivable from the persisted session alone (answers + the persisted choice), satisfying R13's determinism claim for restored plans too. |
| R12 | The adjust-and-re-plan panel's own state (forced destination/alternative choice, if any) is carried in the same session snapshot as travellers, budget, dates and origin, so no adjust action can desynchronise the screen from what is actually being priced. | **Given** a rendered plan that resulted from a hand-picked selection, **When** the user applies any adjust-panel change, **Then** the screen never shows a change notice naming a destination that is not the one in the `<h1>` — i.e. a plan-replacing action always clears or updates any prior change notice in the same step, and the two are never inconsistent on screen. |
| R21 | "Nothing scheduled — this day is yours" renders only for a day the user's own free-day choice removed. A day that is empty because the base ran out of supply gets its own, differently worded line that does not credit the user with a choice, and ticking "Leave one day free" always removes priced experiences (never just repacks them), so the total always drops. | **Given** "Leave one day free" is ticked and applied, **When** the plan re-renders, **Then** exactly one day reads "Nothing scheduled — this day is yours", the total is strictly lower than before by the removed day's dropped experience cost, and no other day gains an experience it did not already have (no repacking); **And given** a plan where "Leave one day free" is unchecked but the base town's supply cannot fill every day, **Then** any resulting empty day instead reads a supply-shortfall line ("Nothing scheduled here — `<base>` has `<n>` things to do and this trip is `<m>` days") and never the free-day sentence; **And** the two sentences never appear for the same day for the same reason. |
| R17 | (No change to the acceptance criterion from round 1 — restated here because the founder named it explicitly.) "Copy as text" copies to the clipboard in the same click; the dialog is the fallback only. | Unchanged from the round-1 amendment (§10). QA round 2 (`qa-07:316`) already verifies this passes against the running app; this round's job is to hold the regression, not to build anything new — `npm run e2e` must keep this test green. |

### Added

| ID | Requirement | Acceptance criterion (Given / When / Then) |
|---|---|---|
| R25 | **A vibe-affinity floor: the recommended plan, both alternatives, and every reroll must actually suit the chosen vibe.** | **Given** the vibe "Beach" is selected, **When** any plan is recommended, offered as Saver/Stretch, or produced by "Not this one — somewhere else" (R22), **Then** its `vibeAffinity['Beach']` rating is at least 3 out of 5 for every destination shown; **And given** an answer set for which no destination clears that floor within the other active constraints, **Then** the vibe constraint is the one the relaxation ladder drops, and the R14 banner names it by vibe ("No beach trip fits `<budget>` for `<n>` — we widened the search") rather than silently substituting a low-affinity destination with no banner at all; **And** rerolling five times from "Beach" never surfaces a destination rated 1 or 2 for Beach (reproduces the architecture review's Manali/Gangtok finding as a regression test). |
| R26 | **Exclude a destination before seeing any plan.** A control on the Trip basics screen (or the screen immediately after it) lets the user name one or more destinations from the catalogue that must never be shown, before the engine generates anything. | **Given** the Trip basics screen, **When** the user adds "Goa" via an "Anywhere except…" control and continues, **Then** no plan screen for that session ever shows Goa as the recommendation, as a Saver or Stretch alternative, or as a reroll result via "Not this one — somewhere else" (R22) — Goa may still be named as a rejected runner-up in "Why this trip" (R10), since naming why it lost is honest, not an offer; **And** the excluded set supports more than one entry, is shown with a per-entry "undo" control, persists across a reload (R15) and across every adjust action, and is included in the plan ID's determinism inputs (R13) so the same answers plus the same exclusions reproduce the same plan; **And** this pre-plan control and the post-plan "Not this one — somewhere else" (R22) write to the same excluded set — excluding Goa here has the identical effect to rejecting it after seeing it. |

### Assumptions decided in this round

| # | Ambiguity | Decision | Reversible |
|---|---|---|---|
| A16 | The founder's item 6 ("make Copy as text actually copy") describes a defect that QA's round-2 regression already shows fixed (`qa-07:316`, R17). | Treated as a regression guard, not new work: keep the existing R17 acceptance criterion and make sure the gate-blocking E2E run includes it and stays green. If a fresh manual check in this round finds it broken again, that is a P0 regression, not a scoping question. | N/A — verification, not a design decision. |
| A17 | Where the "exclude a destination" control (R26) lives — its own screen, or a field on Trip basics. | On Trip basics (S2), as an optional field next to departure city, so it costs zero extra screens and is visible before the first question, which is exactly where Rohan looked for it and did not find it. | Yes — could move to its own micro-screen later if the field crowds S2 at 360px. |
| A18 | Whether the vibe-affinity floor (R25) is a hard cut or a soft penalty. | Hard cut at affinity ≥ 3/5, matching the architecture's own §4.5 design (`test: d => d.vibeAffinity[ctx.vibe] >= 3`) — the code already contains the constant, it was simply never wired into `specs`. A soft penalty already exists (`vibeAffinity × 20` in scoring) and stays; the floor is additive, not a replacement. | Yes — the threshold is one constant. |
| A19 | R8's fare-doubles-on-headcount property conflicts with R9's stretch ceiling in exactly the case QA found (B3). | R9 wins: a plan is never recommended above budget × 1.25, even when that means a headcount change also changes destination and the literal fare-scaling arithmetic no longer applies to that transition. R8 is amended to say so explicitly rather than leaving the conflict for QA to keep re-discovering every round. | No — this is a documented precedence rule, not a detail. |
