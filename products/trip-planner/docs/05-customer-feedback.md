
## Rohan Mehta

*29, product designer, Bengaluru. Planning a break between two meetings, Slack open in the next tab. Brought: "Oct 10–15 (could stretch to the 16th), 2 people, ~₹60k all-in, from Bengaluru, somewhere with a beach — but not Goa, we did Goa last year." Compares against: Googling "beach destinations from Bangalore under 60k", opening MakeMyTrip, giving up, asking a friend on WhatsApp.*

**Goal met: yes. Roughly 25 seconds and four clicks.**

### What actually happened

1. **Landing — "What kind of trip do you want?"** Six vibe tiles. I clicked **Beach**, then **Continue**. No hesitation. The line "We'll ask three or four quick questions" made me tense slightly — I do not want to fill in a form about my travel personality — but three or four is survivable.
2. **"Your trip basics."** This is the best screen in the product. It had already guessed 5 nights, 2 travellers, from Bengaluru, ₹60,000. That is *literally my trip*. I only had to change the dates. "We've filled in the usual answers. Change what's wrong and keep the rest" is exactly the right promise and it kept it.
   - Small snag: the date fields render as `10/10/2026` in **MM/DD/YYYY**. On an app that prices everything in ₹ and lists six Indian metros, US date order is a jarring note. I had to look twice at `10/15/2026` to be sure it wasn't 10 November.
3. **"Question 1 of 4 — Within India, or international?"** And underneath it, in plain sight: **"Plan my trip now — you can stop answering at any point, we'll fill in the rest."** I clicked it immediately. That button is the single reason I did not close the tab. Every question also has a **No preference** option. Nothing is mandatory. Good.
4. **The plan.** Under a second. **Kochi & Varkala, ₹59,200 total, ₹29,600 per person, ₹800 under your budget.** Dates right there in the header: "Sat 10 – Thu 15 Oct 2026". Full day-by-day, a cost breakdown that adds up (flights + stay + experiences + local allowance), and it was **not Goa**.

That is the whole job done. Google gives me ten listicles; MakeMyTrip gives me a search form and then a wall of hotels. This gave me a place and a number before I'd finished my coffee.

### Verbatim

- "Oh — it already knows 2 people, Bengaluru, 60k. I only have to fix the dates."
- "'Plan my trip now.' Thank you. That's the button."
- "Kochi. Fine. Under budget by 800, so nobody's going to argue about it."
- "Copy as text — yes, that's the thing I actually do next."
- "Hang on. Varkala on day one and the Mattancherry spice market on day three? Those aren't the same town."
- "Anjuna flea market — 'Wednesdays only'. It has put it on a Sunday. It's arguing with itself."
- "The stretch option is North Goa. I said not Goa. Well — I didn't, because I skipped the questions. But there's nowhere to say it."
- "If I get Goa, my only way out is 'Start over' and re-type the dates. At that point I'd just WhatsApp my friend."

### Where I hesitated

- **"three or four quick questions"** on the landing page. That phrase nearly lost me before I'd started. The escape hatch exists but you only find out about it on the question screen — say it on the landing page.
- **"Copy as text"** does not copy. It opens a dialog with the text pre-selected. It's actually a fine dialog — plain text, clearly meant for WhatsApp/Slack — but the button lied about what it does and I had to work out that I now needed to press Ctrl+C myself. Clipboard was empty after clicking.
- **Day 3 of the Kochi plan.** "Kappil beach and the estuary… twenty minutes north" (that's Varkala) followed by "Mattancherry spice market" (that's Kochi) in the same day, with a Fort Kochi hotel booked for all five nights. Kochi to Varkala is about four hours each way. I'd have found this out by forwarding it to my partner and being asked. Selling two towns 170km apart as one destination with one hotel is the thing that would stop me trusting any of the other numbers.

### The Goa dead end (the serious one)

I got lucky by skipping. When I went back and answered the four questions honestly the way a beach person from Bengaluru would — Within India → **West coast** → Lively → Resort comfort — I got **North Goa, ₹58,000**. The exact place I ruled out.

And on that screen there is no way out. The only controls are: Travellers, Total budget, Update plan, and Start over. "Other ways to do this" showed **"No cheaper option in this catalogue for these dates"** and **"No pricier option that still stays inside your stretch band"** — two empty dashed boxes. No "show me somewhere else", no "not this place", no way back to the questions (the "Answer them" link disappears once you've answered them all).

**Start over resets my dates back to 09/01/2026.** So the price of rejecting one destination is retyping the entire trip. That is where I close the tab and open WhatsApp.

The questionnaire has no lever for "not X". Q2 is the closest thing — "West coast: Konkan, **Goa**, Karnataka" — but it bundles the place I want with the place I don't.

### Smaller things

- The Goa plan showing *both* alternatives empty makes the catalogue feel about six destinations deep. Two empty boxes look worse than no boxes.
- No way to change dates after seeing a plan. I said I could stretch to the 16th; there's no field for it in "Adjust and re-plan", only travellers and budget.
- I never opened "Why this trip" and never read the provenance line, exactly as predicted. The price didn't surprise me, so I had no reason to.
- Visual is calm, legible, grown-up. It reads like a document rather than a booking funnel, which for this job is right.

### Blockers

1. Answering the questions honestly produces a destination I explicitly ruled out, and there is no way to reject a destination or request an alternative without wiping the whole plan.
2. "Kochi & Varkala" priced and scheduled as one place, with same-day itinerary items 170km apart and a single Fort Kochi hotel — the plan is not physically doable as written.

### Scores (against Google + MakeMyTrip + a friend on WhatsApp)

| | |
|---|---|
| First-run clarity | 9 |
| Task success | 8 |
| Speed | 9 |
| Visual | 8 |
| Trust | 4 |
| **Overall** | **7** |

### Top three fixes

1. **Let me reject a destination and get another one without losing my trip.** A "not this one, show me something else" on the plan page. Rejecting Goa should cost one click, not a re-typed form.
2. **Make the itinerary physically possible, and stop bundling towns.** One destination, one region I can actually move around in — or an explicit second hotel and a transfer leg with its own cost. And don't schedule a Wednesday-only market on a Sunday.
3. **Put the escape hatch on the landing page.** "Four quick questions — or skip them all and we'll guess" would have removed the only moment I nearly left. And make "Copy as text" actually put it on the clipboard.

### Would I use it again? Would I pay?

I'd use it again as a shortlist generator — it beats a listicle and it beats MakeMyTrip's search form for the "just tell me where" question. I would not pay for it as it stands, because the numbers are labelled indicative sample data and the Kochi plan wasn't doable, so I'd still have to verify everything. If the prices were live and it could take "not Goa" as an instruction, I'd pay about ₹300 one-off per trip planned, or ₹99/month, for the version that hands me something I can forward without checking it first.

## Anita Fernandes

**Who I am:** 47, chartered accountant, Mumbai. Last year I booked a "₹1.2 lakh family
package" that arrived at ₹2.1 lakh once taxes, transfers and a peak-season supplement
had been added. Today I keep a spreadsheet of quotes from two local agents and
cross-check every line against Booking.com.

**What I came for:** one complete number for four people over Christmas week
(Dec 20–27), flights included, with every component shown. If the total moves between
two views of the same plan, or I can't tell where a figure came from, I leave.

**Did I get it?** Partly. About 15 minutes. I got one complete, stable, fully itemised
number. It is just not a number for my family, and not a number for Christmas.

### What happened

Landing page, "What kind of trip do you want?". Six vibe cards. I picked **Peace &
Quiet** — "Nobody around, nothing scheduled" is exactly the brief. The footer said
*"Prices are indicative sample data... Compass does not sell or reserve anything."*
That is the first thing I look for and it was there before I'd clicked anything.
Good. Nobody is going to pretend I can book at this price.

**"Your trip basics"** — prefilled with 5 nights, 2 travellers, Bengaluru, ₹60,000.
I changed all of it: 20/12/2026 to 27/12/2026, ₹2,50,000, 4 travellers, Mumbai. The
summary bar updated to "7 nights · 4 travellers · from Mumbai · ₹2,50,000" with proper
Indian lakh formatting. Small thing, but it tells me somebody who writes numbers for
Indians built this.

**First hesitation, under the Travellers box:** *"Priced per adult traveller."* My two
are 9 and 12. There is no box for them. I carried on because I assumed a later question
would ask. It never did.

**Four questions** — within India / hills / quiet-but-some-life / resort comfort. Fast,
one click each, auto-advancing, and a standing "you can stop answering at any point".
No question about children. No question about flight times. I will not take a 3am
departure with a nine-year-old and there was nowhere to say so.

**The plan: Gangtok & Pelling, ₹2,33,600 total, ₹58,400 per person, ₹16,400 under
budget.** Then the part I actually care about, "What makes up your ₹2,33,600":

| Line | Basis shown | Amount |
|---|---|---|
| Travel | Return flights, ₹17,600 per traveller × 4 | ₹70,400 |
| Stay | Kanchenjunga View Retreat, ₹8,600 per room-night × 7 × 2 rooms | ₹1,20,400 |
| Experiences | 14 included experiences for 4 travellers | ₹15,600 |
| Local allowance | ₹850 per traveller per day × 4 × 8 days | ₹27,200 |
| **Total** | | **₹2,33,600** |

I checked every line by hand, because that is what I do. **They all tie.** The flight
line reconciles to the ₹8,800 each way printed on Day 1 and Day 8. The experiences
line reconciles to the per-person prices printed against each activity — I added up
₹800 + ₹600 + ₹900 + ₹1,600 = ₹3,900 per person × 4 = ₹15,600, exactly. Per person is
stated as "₹2,33,600 ÷ 4, rounded to the nearest ₹100", so I know what "per person"
means and I know it won't multiply back exactly. That is more disclosure than either
of my agents has ever given me.

**"Why this trip"** has a *"Considered and rejected"* list — Maldives ₹1,16,200 over
budget, Andamans not hill, Nepal not within India. I have asked agents for this for
twenty years and never got it.

**Reload:** identical. Same plan ID `GANG-7N-4P-B250-kxdt`, same ₹2,33,600. I ran the
same inputs three separate times in clean browsers and got the same ID and the same
total every time. **The Saver alternative card said ₹1,69,000 and the plan page it
opened said ₹1,69,000**, and that breakdown ties too. Nothing moved between views.
Credit where it is due: on my hardest requirement, it passed.

### Then I tested the thing that cost me ₹90,000 last year

I re-ran the identical trip with the dates changed to **5–12 July 2027** — monsoon,
dead season in Sikkim.

**₹2,33,600. The same room rate, ₹8,600 a night. The same flights, ₹17,600.**
And 10–17 February 2027: **₹2,33,600 again.**

So the number printed under the heading "Sun 20 – Sun 27 Dec 2026" has nothing
whatsoever to do with Christmas. It is an average-week number with my Christmas dates
typed on top of it. A Gangtok resort on 25 December is not the same price as 8 July,
and a Mumbai–Bagdogra return in Christmas week is not ₹17,600. Flights do move by
origin city — Kolkata came out at ₹8,400 against Mumbai's ₹17,600, so routes are
modelled — but not by one single day of the calendar.

Nothing on the page warns me about this. I searched the whole plan page: **the words
season, peak, supplement, tax and GST do not appear anywhere.** For a hotel line of
₹1,20,400 I cannot tell whether ₹8,600 a room-night is inclusive of GST or not, and
in India that is 12–18%, and that is precisely the line that turned my ₹1.2 lakh into
₹2.1 lakh. The budget field says "Everything in", which implies gross, but the rate
line itself is silent.

### One more thing that would have caught me out

On the plan page I changed Travellers from 4 to 5 in "Adjust and re-plan", budget
untouched at ₹2,50,000. The total went **down**, from ₹2,33,600 to ₹2,17,100. Adding
a person made the holiday cheaper. It had quietly moved me from Kanchenjunga View
Retreat at ₹8,600 a night to **Pelling Ridge Lodge at ₹3,600 a night** to keep me
inside budget. The destination heading, the itinerary and the layout are all identical.
The only place it is disclosed is inside the breakdown line. I only spotted it because
I read breakdowns for a living. And I had asked for "resort comfort" — I was given a
lodge without being asked.

### Verbatim

- "Priced per adult traveller — so where do I put a nine-year-old?"
- "Right, every single line ties. That is the first travel page I have ever been able
  to tick off."
- "Considered and rejected. Somebody actually thought about what I would ask."
- "Hold on. July is the same price as Christmas week? Then this isn't a Christmas
  number, it's a number with Christmas printed on it."
- "Where is the GST? A ₹1.2 lakh room bill and not one word about tax."
- "I added a person and it got cheaper. That's the sentence that made me stop trusting
  the last agent."
- "It's honest, it's tidy, and it's answering a slightly different question from the
  one I asked."

### Blockers

1. **The price does not depend on my dates.** Christmas week, February and monsoon July
   all return ₹2,33,600 to the rupee. My entire reason for being here was a peak-week
   number, and there isn't one — and nothing tells me so.
2. **No way to enter children.** Four travellers means four adults. The plan itself
   admits "Children aren't priced separately yet", which I appreciate, but it means the
   headline is not my family's number.
3. **No tax position anywhere.** I cannot tell whether ₹8,600 a room-night is gross or
   net of GST. Unstated tax is exactly how I got burned, so an unqualified total is
   not usable in my spreadsheet.

### Smaller things

- Nowhere to say "no departure before 7am". Flight times aren't shown at all, only
  duration ("3h 30m in the air").
- Re-planning silently swapped my hotel and my comfort tier. Say it out loud.
- "Copy as text" put nothing on my clipboard the first time; it opened a panel with the
  text instead, which worked, but the button name promised something else. The text
  itself is good and I would paste it straight into my spreadsheet — though it carries
  only the four subtotals, not the per-unit bases, so I'd have to come back for those.
- Day 6 (25 Dec) and Day 7 both list "A morning watching cloud fill the valley", and
  Days 7 and 8 both list "An afternoon of tea and nothing". Padding.

### Scores (against my spreadsheet + two agents + Booking.com)

| | |
|---|---|
| First-run clarity | 9 |
| Task success | 5 |
| Speed | 9 |
| Visual quality | 8 |
| Trust | 5 |
| **Overall** | **6** |

Ninety seconds from a cold landing page to a fully itemised costed itinerary, and it
survives a reload — my agents take three days and won't show me their maths. That is
worth something real. But an immaculate breakdown of the wrong number is still the
wrong number, and a page that prints "Sun 20 – Sun 27 Dec 2026" beside a price that
would be identical in July is doing the one thing I came here to protect myself
against. The honesty on the page ("does not sell or reserve anything", "children
aren't priced separately yet") is what keeps this at a 6 rather than a 3 — it tells
me its limits everywhere except the one that matters most.

### Top three fixes

1. **Make the total actually respond to my dates, and show the peak-season loading as
   its own line I can see.** Until then, put a warning on the plan saying rates do not
   vary by season — I would rather be told than find out.
2. **State the tax position on every line.** "₹8,600 per room-night incl. GST" or
   "excl." I cannot use a total whose tax basis I can't name.
3. **Let me say two of the four are children, with ages** — and if a re-plan changes my
   hotel or my comfort tier, tell me on the headline, not only in the small print.

### Would I use it again? Would I pay?

I'd use it again, but as a shortlisting and sanity-check tool, not as a quote. It is
very good at "is Sikkim or Manali the right shape of trip, and roughly what order of
money" — and the rejected-alternatives list is genuinely something I'd screenshot for
my husband. I would not put its total in my spreadsheet next to my agents' quotes,
because those are peak-week numbers and this one isn't.

Pay: not as it stands. If it priced my actual dates with a visible peak-season line and
told me where GST sits, I would pay ₹500 a trip, or ₹1,500 a year, for the itemisation
and the reload-stable plan ID alone — because that is the argument I'd be taking back
to my agent.

---

## Kabir Sandhu

34, runs a nine-person design studio in Delhi. Organising the annual studio offsite for
the fourth time. Today this lives in a Google Sheet with a tab per destination and a
WhatsApp group that argues for two weeks.

**What I came for:** one plan I can paste straight into Slack, nine people, Nov 13–16,
under ₹4.5 lakh all-in, from Delhi. One proper night out and one day where nobody has
to do anything. And two people always drop out, so I need to go to seven without
starting again.

**Did I get it? Partly.** About 90 seconds to a pasteable plan. Roughly 8 minutes total
poking at it.

### What happened

**Vibe screen.** Clean, six cards, obvious. I clicked Party, then clicked Peace & Quiet —
and Party deselected. It's single-select. That's my first problem: my trip *is* both. One
loud night and one dead day. I had to pick a lane. I picked Party.

> "It's one trip. Why do I have to choose which half of it matters?"

**Trip basics.** One screen, everything on it, prefilled with 2 travellers / ₹60,000 /
Bengaluru / September. I changed all five fields in about fifteen seconds. Fine. The
"Everything in: travel, stay, experiences and day-to-day spending" note under the budget
box is the single most useful sentence on the page — it told me my ₹4.5L means what I
think it means.

**Four questions.** Quick, and "Plan my trip now" is live from question one with "you can
stop answering at any point". Good — I'm impatient. Q2 (west coast or a city) and Q3
(beach shacks or a proper city night) felt like the same question twice; I'd already
ruled out the city.

**The plan.** North Goa, ₹3,87,300, ₹43,000 a head, ₹62,700 under budget. Four days laid
out. Sidebar shows exactly what makes it up — flights × 9, ₹12,500 a room-night × 3 nights
× 5 rooms, experiences, ₹1,300/day local allowance. I added it up myself. It's right,
every line. My Sheet has never been that legible.

> "OK. That's the number I'd have taken three evenings to get to."

**"Why this trip"** — I nearly missed it, it's a plain collapsed box at the bottom of the
left column. Opened it and it's the best thing in the product: "North Goa rates 5 out of 5
for Party", "one of 2 destinations that answer West coast", plus a *Considered and rejected*
list with reasons. That's the tab of my Sheet I never manage to write. It should not be
hidden in an accordion.

**Then I read the days properly and my stomach dropped.**

- Day 2 (Sat 14 Nov): *Anjuna flea market — "Wednesdays only, and worth arranging the week
  around."* On a Saturday.
- Day 3 (Sun 15 Nov): *Saturday night market, Arpora.* On a Sunday.

I ran it again over Nov 11–15 to check. Same thing: it put the Saturday night market on
Friday 13th. The day-of-week in the description is decoration; the scheduler ignores it.

> "I cannot paste this. Somebody in that WhatsApp group has been to Goa and I will hear
> about the Saturday market on a Sunday for the next year."

That's the whole product for me. The maths being immaculate doesn't help if the itinerary
says something that isn't true.

**Copy as text.** Opens a modal, plain text in a box, a Copy button. The output is
genuinely excellent — destination, dates, headcount, total, per-person, one line per day,
the stay, the four cost buckets, a plan ID. 746 characters. That is exactly the Slack
message. No notes.

**Nine to seven.** Typed 7 in the Adjust panel, hit Update plan, done in under two seconds,
no questions re-asked. ₹3,05,400, and it moved from 5 rooms to 4. Per-person went *up*
(₹43,000 → ₹43,600) because seven people don't fill the rooms as well. My Sheet doesn't
tell me that. This is the thing I would come back for.

**Twelve.** ₹3,60,000, ₹30,000 a head, "₹90,000 under your budget" — looks like a win.
Except in the breakdown my stay had silently changed from Assagao Villa & Pool (₹12,500)
to Casa Vagator (₹5,200). Nobody told me. Same headline, different holiday.

> "It didn't downgrade the trip, it downgraded the *hotel*, and it said 'under budget' like
> it had done me a favour."

**International on a budget that can't carry it.** Twelve people, ₹4.5L, long-haul. It gave
me Bangkok at ₹4,63,200 and labelled it *"Stretch — 3% over your budget"*, with Kathmandu
underneath as a Saver at ₹3,14,400. It did not lie. Good.

**Then I set the budget to ₹80,000 for twelve, deliberately absurd.** It came back with
Manali at ₹1,84,800 and the line *"Nothing in this catalogue fits ₹80,000 — the closest is
₹1,84,800."* No "no results", no dead end, nearest workable thing plus a straight admission.
That is the correct behaviour and most tools get it wrong.

One catch: I had asked for **International** and it handed me Manali without a word about
having overridden me. "2 questions answered for you" refers to questions I skipped, not the
answer it threw away.

**The day where nobody does anything.** Doesn't exist. I ran Peace & Quiet on the same dates
to check — Maldives, and still two scheduled activities every single day. Every plan in this
product is two-things-a-day, always, in every vibe. There is no way to ask for an empty
afternoon and no way to delete an activity once you have one. The results page has exactly
six interactive things on it: Start over, Copy as text, Why this trip, Use this plan,
Update plan, and the two adjust fields. That's it.

**Dates.** Only travellers and budget can be adjusted. Our offsite dates have moved by a week
in each of the last three years. To move them I have to hit Start over — which wipes
everything back to 2 travellers, ₹60,000, Bengaluru, September, and makes me re-answer all
four questions. That's my dealbreaker, just moved from headcount to dates.

The plan does survive a browser reload, which I appreciated.

### Where I hesitated

- The vibe screen, when the second click undid the first. Two full seconds of "is this broken
  or is it deliberate?"
- Finding the re-plan controls. They're at the bottom of the right-hand column below the
  alternatives; I scrolled past them once.
- "Why this trip" — collapsed, unstyled, easy to skip. It's the most persuasive thing here.
- The 12-person result, working out why the total had gone *down* per head. The answer was in
  the breakdown, not in the headline.

### Blockers

1. The itinerary makes false day-of-week claims. "Saturday night market" on a Sunday. I
   cannot send this to nine people without fact-checking every line, which is the work I
   came here to avoid.
2. No rest day, anywhere, in any vibe, and no way to ask for one. Half my brief is
   unbuildable and the product never says so.
3. Changing dates means Start over from blank defaults plus re-answering four questions.
4. One vibe only. A trip with a big night and a dead day cannot be described.

### Top three fixes

1. Never schedule a fixed-day activity on the wrong day — either move it, or drop it and say
   why. One wrong line costs you the whole plan's credibility.
2. Let me set the shape of the days: at least one "leave this day empty", and ideally let me
   remove or swap a single activity without re-planning the trip.
3. Put dates and origin next to travellers and budget in the Adjust panel, so nothing about
   my trip needs a Start over.

Runner-up: when a re-plan changes the hotel, the destination, or an answer I explicitly gave
(International → Manali), say so on the headline. Don't bury it in the breakdown.

### Scores

| | |
|---|---|
| First-run clarity | 9 |
| Task success | 6 |
| Speed | 10 |
| Visual quality | 8 |
| Trust | 5 |
| **Overall** | **7** |

Clarity and speed are genuinely better than anything I use. Trust is where it falls over —
the arithmetic is fully traceable and it admits when nothing fits, which I rate highly, but
the itinerary content contradicts itself and it makes silent substitutions.

### Would I use it again? Would I pay?

Yes, as a first-draft generator — it gets me to a costed, defensible number in ninety seconds
instead of three evenings, and the 9→7 re-price is worth the visit on its own. But I'd still
open the Sheet afterwards to check the activities, so it replaces the arguing, not the work.

I'd pay about ₹500 a trip, or ₹2,000 a year, and only for the re-costing and the copy-out.
I'd pay four or five times that the day the itinerary is date-correct and I can pin one day
as empty — because at that point I stop opening the Sheet at all.

---

## Ranked fixes *(PM triage — refinement round 1)*

**Panel:** 3 judges · mean overall 6.7 · 9 blockers · gate is 8.0 with zero blockers.

Ranked by (judges affected × severity) ÷ effort, both 1–5. Frequency beats intensity, so
two cheap fixes cited by two judges outrank one expensive fix cited by one — but **every
item below ships this round**, because between them they clear all nine blockers and the
gate is zero blockers, not "most blockers". Rank is implementation order, not permission
to stop.

Full acceptance criteria for every requirement named here are in `docs/01-prd.md` §10.

| # | Fix | Cited by | Requirement | Fixed means (observable) | Score | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Never state a false day-of-week.** Weekday availability moves out of the blurb prose and into structured data on the experience; the scheduler places a fixed-day activity only on a matching date, or drops it and says why. The cause is that the day constraint was decoration the scheduler could not read. | Rohan, Kabir (both #1 fix, both a blocker) | R18 (new) | "Anjuna flea market" appears only on a Wednesday and "Saturday night market, Arpora" only on a Saturday, on any date range. Where the dates contain no Wednesday, the market is absent and a line reads "Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday". No blurb asserts a weekday its day contradicts. | (2×5)/2 = 5.0 | accepted |
| 2 | **Dates and departure city join the Adjust panel; "Start over" is never the price of a change.** Includes DD/MM/YYYY on every date field. Cause: the re-plan panel modelled only the two cheapest inputs, so every other change became a full re-entry. | Rohan, Kabir (Kabir's blocker 3; Rohan's exit route) | R12 (amended) | From a rendered plan, changing the end date to the 16th re-plans in place — new nights, new total, new plan ID — with the questionnaire never re-shown and vibe and answers intact; changing origin to Mumbai re-prices travel. 10 October 2026 renders as `10/10/2026` with a visible `DD/MM/YYYY` hint. | (2×4)/2 = 4.0 | accepted |
| 3 | **Say what changed, where they are already looking.** Any re-plan that swaps the stay, drops the comfort tier, changes destination or overrides an answer states it next to the total; "Why this trip" opens by default. Cause: the plan's honesty lived in the breakdown and an accordion, and both judges act on the headline. | Anita, Kabir (Rohan too, for the unopened "Why this trip") | R19 (new) | 4→5 travellers shows, adjacent to the total: "Changed to keep you inside budget: stay is now Pelling Ridge Lodge (₹3,600/night, standard) instead of Kanchenjunga View Retreat (₹8,600/night, premium)". An International answer relaxed to Manali is named in the same notice. "Why this trip" is expanded on first render. | (2×4)/2 = 4.0 | accepted |
| 4 | **"Copy as text" copies, and the landing page advertises the skip.** Two labels that do not describe what they do: the copy button opens a dialog, and the escape hatch is only discoverable one screen after the moment it is needed. | Rohan, Anita (clipboard); Rohan (landing copy — his near-abandon) | R17, R1 (amended) | One click on "Copy as text" leaves the itinerary on the clipboard and announces "Copied"; the dialog appears only when clipboard access fails, with a message that says so. The vibe screen states "four quick questions — or skip them and we'll guess"; the phrase "three or four" is gone. | (2×2)/1 = 4.0 | accepted |
| 5 | **State the basis of every number: tax position and who is counted.** Cause: the breakdown discloses arithmetic but never its assumptions, and the one assumption Anita was burned by is the unstated one. | Anita (blocker 3) | R20 (new) | Every priced line carries a tax qualifier ("₹8,600 per room-night, incl. GST"); the total is labelled "Total for 4 adults"; "GST" and "adults" both appear on the plan screen. | (1×4)/1 = 4.0 | accepted |
| 6 | **One day with nothing scheduled, on request — and stop padding.** Cause: the planner hard-codes two activities a day and fills the gap by repeating a "repeatable" experience, so it can neither admit an empty day nor avoid printing the same morning twice. | Kabir (blocker 2), Anita (repeated Day 6/7 and 7/8 padding) | R21 (new) | "Leave one day free" in the Adjust panel produces exactly one middle day with no experiences and the words "Nothing scheduled — this day is yours", a lower total and a new plan ID. On any plan of any length, no experience name appears twice. | (2×4)/3 = 2.67 | accepted |
| 7 | **"Not this one — somewhere else", keeping the entire trip.** Also replaces the two empty dashed alternative boxes with this one control. Cause: the only exits from a plan were two alternatives that may not exist, and a Start over that wipes the trip. | Rohan (blocker 1 — his stated tab-closing moment) | R22 (new) | From a North Goa plan, one click yields a different destination in under 2 seconds with dates, budget, travellers, origin and answers unchanged, the rejection listed with an undo, and a new plan ID. Exhausting the catalogue shows "That's every destination that fits — here are the ones you turned down", never an empty screen. Where no Saver or Stretch exists, this control occupies that space instead of two empty slots. | (1×5)/2 = 2.5 | accepted |
| 8 | **The price moves with the dates, and the seasonal loading is its own visible line.** Cause: pricing is a pure function of destination, party and nights — the calendar was never an input, while the header printed the user's dates beside the number. | Anita (blocker 1 — her entire reason for coming) | R23 (new) | The same answers priced for 20–27 Dec 2026 and 5–12 Jul 2027 return different totals; each breakdown names its season and loading ("Peak season (25 Dec – 2 Jan): +35% on stay and travel"); the seasonal line is inside the sum that ties to the total; the seasonal basis is labelled indicative sample data. | (1×5)/3 = 1.67 | accepted |
| 9 | **One plan, one base you can actually move around in.** Every experience and stay gets a base town; the plan books one base, schedules nothing more than 90 minutes from it, and names that base. Cause: a "destination" was a marketing label covering two towns, while pricing and the stay assumed one place. | Rohan (blocker 2); latent in "Gangtok & Pelling", "Havelock & Neil" and nine more | R7 (amended) | No day pairs two places more than 90 minutes apart; with the Brunton Boatyard stay, no day contains both a Varkala item (`vkl-cliff`, `vkl-kappil`) and a Kochi item (`vkl-spice`, `vkl-fort`); the plan header names the base town it books. | (1×5)/4 = 1.25 | accepted |
| 10 | **Children, counted and priced at a published rate.** Cause: "Priced per adult traveller" is a disclosure of a gap, not a solution, and the four questions never asked. | Anita (blocker 2) | R24 (new) | The basics screen takes adults and children with ages; the summary bar reads "4 travellers (2 adults, 2 children)"; the plan prints the rule ("Children 2–11 are priced at 75% of the adult fare and 50% of experiences; they occupy a room place") and the breakdown shows adult and child counts separately. | (1×4)/4 = 1.0 | accepted |

### Rejected, with reasons

| Fix requested | Cited by | Rejected because |
|---|---|---|
| **Multi-select vibes** — "my trip is Party *and* Peace & Quiet". | Kabir (blocker 4) | Two vibes make the affinity score ambiguous: a destination that rates 5 for Party and 1 for Peace either wins on its best score (in which case the second vibe is theatre) or on an average (in which case the winner is the destination that is mildly good at everything — the listicle answer this product exists to beat). Single-select is the decision recorded in PRD A8 and it stands. The half of Kabir's brief that is real — one loud night and one dead day — is delivered by R21 (a day with nothing scheduled) plus the existing "one lively night, otherwise quiet" branch of the question graph, both inside a single Party vibe. If he re-runs and the empty day plus a night out does not describe his trip, that is a re-open with new evidence. |
| **Remove or swap an individual activity on the plan.** | Kabir (fix 2, second half) | Accepting this turns a decision engine into an itinerary editor: hand-edits have to persist, survive a re-plan, and be reconciled with a plan ID that is supposed to be a pure function of the answers (R13). The user's stated need is control over the *shape* of the days, which R21 gives at a fraction of the cost. Pinning one free day is in; free-form editing is a different product. |
| **Live, bookable prices.** | Rohan (condition of paying), implied by Anita | Requires a paid airline/hotel inventory API and a credential the build environment cannot hold, and would break the "no network calls, no external services" constraint the whole product is built under. R16 exists precisely so that nobody mistakes this catalogue for inventory. This is a founder-level decision about the product's future, not a refinement item — flagged in the readiness report, not fixed this round. |
| **Show flight departure times / "no departure before 7am".** | Anita (smaller things) | The catalogue holds fares and durations, not schedules. Printing a departure time would be inventing a fact — exactly the failure that rank 1 exists to eliminate. Adding a real timetable is the same paid-inventory problem as live prices. Declined; the plan will keep showing duration only. |
| **Put the per-unit bases into the copied text.** | Anita (smaller things) | The export is deliberately a 750-character message for WhatsApp and Slack, and Kabir — the judge who actually uses it that way — said "no notes". Growing it into a spreadsheet extract makes it worse at the job it does well. The bases stay on the plan page, where rank 5 now also puts the tax position. |

---

## Rohan Mehta — round 2

**Product designer, 29, Bengaluru. Impatient Pragmatist. Tried this before; it didn't work for me.**

**Goal:** "Oct 10–15, 2 people, ~₹60k all-in, from Bengaluru, somewhere with a beach — but not Goa, we did Goa last year. Tell me where and roughly what it costs, in five minutes."

**Did I get it? Yes.** Destination and a total price in **4 clicks and 2 typed dates**, about 45 seconds. Last time I bounced. This time I didn't.

### What actually happened

1. **Landing.** Six vibe tiles. The line "We'll ask four quick questions — or skip them and we'll guess" is the single best thing on this page — it told me up front there was an exit. Clicked **Beach** → **Continue**. (2 clicks)
2. **Your trip basics.** This is where I expected to rage-quit and instead I relaxed. It was *already* filled in with 5 nights, 2 travellers, from Bengaluru, ₹60,000. That is verbatim my trip. I changed two date fields and hit **Continue**. (3rd click)
3. **Question 1 of 4.** "Plan my trip now" sitting right there next to Back. Clicked it. (4th click)
4. **Plan.** *Kochi & Varkala · ₹56,600 total · ₹28,300 per person · ₹3,400 under your budget.* Day-by-day, flights, hotel, a cost breakdown I didn't ask for but could scan in three seconds.

That's the job done. Under my six-click ceiling, no unskippable question, and the first plan was not Goa.

**"Copy as text" is the feature I didn't know I wanted.** My actual workflow today ends with me typing a summary into WhatsApp for my partner. One click gave me a clean 15-line message with the days, the total and the split. That alone would make me come back.

### Where I hesitated, and what annoyed me

**"I clicked Beach. Where is the beach?"** Kochi & Varkala — six days of Chinese fishing nets, a spice market, a heritage walk, kathakali and a backwater canoe. Based in *Fort Kochi*. Varkala is in the title and appears nowhere in the plan. This is the one thing I asked for and the itinerary doesn't contain it. I'd read that and think the machine matched a label, not a holiday.

**No way to say "not Goa".** Nowhere in the entire flow. I hit **Not this one — somewhere else** and the very first alternative it handed me was **North Goa**. It also sits in the "Stretch" card on the first plan. I had to work out for myself that going back and answering Q2 "East coast" was the way to dodge the west coast — and Q2's own subtitle literally reads "Konkan, **Goa**, Karnataka", so the app knows the word and still won't let me exclude it. That inference is more thinking than this product should ask of me.

**The reroll forgets what I picked.** I kept clicking "somewhere else" out of curiosity:

> Kochi → North Goa → Puducherry → Ella → **Manali & Solang** → **Gangtok & Pelling** → **Kathmandu & Pokhara** → Havelock → Bangkok

By the fifth click it is offering me Himalayan hill stations for a **Beach** trip. That's the moment I stopped trusting the recommendations — if it'll offer Manali to someone who clicked Beach, then the first answer being good was luck. (The "You turned these down / Put X back" list is genuinely nice, though.)

**"one of 1 destination in this catalogue".** Once I did answer the questions, "Why this trip" told me East coast narrowed things to exactly one option. I wasn't going to read that box, but it's open by default so I did, and it made the catalogue feel thin.

### What worked without me thinking about it

- Stretching to the 16th in "Adjust and re-plan" re-priced instantly (Puducherry, 6 nights, ₹49,400) without re-asking anything. Exactly right.
- The breakdown adds up, GST is stated as included, per-person is spelled out. I believe the arithmetic.
- Everything loaded instantly. No spinners I noticed at human speed.
- Clean, quiet, readable. Nothing shouted at me, no popup asking for my email.

### Verbatim

- "Oh — it already knows it's two of us from Bangalore on 60k. Fine, I'll play."
- "'Plan my trip now'. Thank you. Genuinely, thank you."
- "₹56,600 and it's under budget. That's my answer, I can leave."
- "Hang on, I said *beach*. This is a spice market and a puppet show."
- "First alternative is North Goa. That's the one place I told you — well. I didn't tell you. There was nowhere to tell you."
- "It's offering me Manali. For a beach holiday. Okay, so it's just cycling a list."
- "I still have to go to MakeMyTrip to actually book this, so this is a shortlist tool, not a booking tool. Which is fine — that's the part I hate anyway."

### Blockers

None that stopped me getting an answer. The reroll-ignores-vibe and no-exclusion issues are trust damage, not blockers.

### Scores (against Google + MakeMyTrip + WhatsApp-ing a friend, which is what I do today)

| | |
|---|---|
| First-run clarity | 8 |
| Task success | 8 |
| Speed | 9 |
| Visual quality | 8 |
| Trust | 6 |
| **Overall** | **7** |

### Top three fixes

1. **Let me rule a place out in one gesture.** A "not there" or "somewhere else, but not X" on the plan itself. My hardest constraint is currently unspeakable, and the reroll walked straight into it.
2. **Make the plan deliver the vibe I clicked.** If I pick Beach, every day of the itinerary and every reroll should stay on a beach. Kochi with no beach day, and Manali on reroll five, both break the one promise the landing page made.
3. **Say what the destination actually is before I read six days.** One line under the title — "backwaters and colonial old town, beaches an hour out" — would have saved me the whole "where is the beach" moment.

### Would I use it again? Would I pay?

**Use again: yes.** For "we have five days, where do we go" this beats twenty minutes of Google and a MakeMyTrip form. I'd send the copied text to my partner and then go book it elsewhere.

**Pay: no, not as a subscription.** It's a two-minutes-every-four-months tool. I'd use it free, and I'd happily click through to a booking partner from it. The only version I'd pay for — maybe ₹200–300 one-off per trip — is one where the price is real and bookable, and right now the footer tells me it isn't.

## Anita Fernandes — round 2

**Who I am:** 47, chartered accountant, Mumbai. Last year I booked a "₹1.2 lakh family
package" that landed at ₹2.1 lakh once taxes, transfers and a peak-season supplement
appeared. Today I keep a spreadsheet of quotes from two local agents and cross-check
every line against Booking.com. I tried this thing before and it did not work for me.
I came back assuming nothing had been fixed.

**What I wanted:** One complete number for four people over Christmas week, flights in,
and a breakdown I can audit. If the number moved on reload, or I couldn't source a
figure, I was leaving.

**Did I get it?** Yes. ₹2,70,855 total, ₹67,700 per person, Havelock & Neil, Andaman,
20–27 Dec 2026, from Mumbai. About twelve minutes end to end, most of it me trying to
catch it out.

### What happened

Landing page offered six vibes. I picked **Peace & Quiet** — the copy said "Nobody
around, nothing scheduled", which is the whole point of this holiday. The footer already
said *"Compass does not sell or reserve anything"*. That line did more for my blood
pressure than anything else on the page. Last year's site let me believe I was booking.

**Your trip basics** put everything on one screen instead of dribbling it out. I typed
20/12/2026–27/12/2026, ₹2,50,000, 2 adults, 2 children, Mumbai. The moment I typed 2 in
Children, **Child 1 age / Child 2 age** appeared. I did not expect that. Every quote
form I use makes me phone the agent to explain that one of them is twelve. Under the
Children box it already said *"A traveller aged 12 or over is priced as an adult."* So I
knew before I saw a single rupee that my twelve-year-old was going to cost me a full
fare. Fine. Tell me up front and I have no argument.

Four questions — India or international, beaches or hills, how empty, resort or local.
Twenty seconds. Then the plan.

### The audit

This is the part I actually care about, so I did it properly.

| Line | As stated | My arithmetic |
|---|---|---|
| Travel | ₹26,000 × 3 adults + ₹19,500 × 1 child | 97,500 ✓ |
| Stay | 7 nights × 2 rooms × ₹3,200 | 44,800 ✓ |
| Experiences | ₹9,700 × 3 + ₹4,850 × 1 | 33,950 ✓ |
| Local allowance | ₹1,400 × 4 people × 8 days | 44,800 ✓ |
| Season | +35% on (stay + travel) = 35% × 142,300 | 49,805 ✓ |
| **Total** | | **2,70,855 ✓** |
| Per person | 2,70,855 ÷ 4, rounded to nearest ₹100 | 67,713.75 → 67,700 ✓ |

Every line ties. To the rupee. I also counted the eleven experiences down the itinerary
and added the paid ones — 3,500 + 400 + 800 + 1,200 + 1,600 + 2,200 = ₹9,700, exactly
the per-adult experiences figure. Nothing is hiding in a bucket.

And it told me what "per person" means instead of leaving me to guess. *"₹2,70,855 ÷ 4,
rounded to the nearest ₹100."* That single line is why I did not close the tab. On my
agents' quotes "per person" has meant per adult, per adult sharing, and per adult
sharing excluding flights, all in the same week.

**Determinism.** I ran the identical flow three times and reloaded the plan page each
time. ₹2,70,855 every time. The plan even carries an ID — `HAVE-7N-4P-B250-d1te` — and a
catalogue date. I can put that in my spreadsheet and quote it back.

**Copy as text** gave me a clean paste with the total, the day list, the five component
figures and the plan ID, and it matched the screen exactly. That goes straight into my
sheet next to the two agent quotes. This is the single most useful button on the site.

**Alternates hold their price.** The Stretch card advertised Puducherry at ₹2,72,688; I
clicked through and got ₹2,72,688. Breakdown re-derived correctly for the new
destination (44,250 + 1,26,000 + 10,850 + 32,000 + 59,588 = 2,72,688 ✓). No bait.

**Considered and rejected** — Maldives, Bali, Dubai, each with how far over budget. That
is the list my agent never shows me because she only sends what she earns on.

### Where I stopped and frowned

**1. The peak-season loading is all-or-nothing, and the label doesn't say so.** The line
reads *"Peak season (25 Dec – 2 Jan): +35% on stay and travel."* My trip is 20–27 Dec.
Two of my seven nights fall in that window. I am being charged 35% on all seven nights
and on the outbound flight of 20 December, which is nowhere near peak. I tested it: 13–20
Dec gives ₹0 season, 24–31 Dec gives ₹49,805, and my 20–27 Dec gives the identical
₹49,805 as a trip sitting entirely inside the window. So it is a switch, not a
calculation. It is disclosed and I can reproduce it, which is why I didn't leave — but
the wording implies a date range applied to dates, and it isn't. This is precisely the
shape of the supplement that cost me ₹90,000 last year. Either prorate it, or say
"any trip touching 25 Dec – 2 Jan carries +35% on the whole stay and travel."

> "Two nights in the window and you're loading my twentieth of December flight by
> thirty-five percent? Say that out loud on the line, then."

**2. The header says two children; the price says three adults.** The bar reads
"4 travellers (2 adults, 2 children)" and the total says "Total for 2 adults and 2
children" — while sitting directly above "₹26,000 per adult × 3". Both are true under the
stated 12+ rule, and the rule is printed. But you have the same trip described two
different ways within four centimetres of each other. Make the summary say
"3 charged as adults, 1 as a child" and the tension disappears.

**3. "Per traveller" in the itinerary means something different from "per traveller" in
the breakdown.** Day 1 says "Fly Mumbai → Havelock · ₹13,000 per traveller". My nine-year
old is not ₹13,000, she is ₹9,750 — as the breakdown correctly shows. Two definitions of
the same phrase on one page is exactly the trap I came here worried about. It's mild
because the correct figure is right there in the panel, but fix the word.

**4. A stale banner that names the wrong destination.** After I clicked through to
Puducherry, the page title said "Puducherry & Auroville", the total said ₹2,72,688 —
and the amber banner underneath still read *"you asked for resort comfort — nothing fits
₹2,50,000 for 4, so this is Havelock & Neil, Andaman."* Meanwhile "Why this trip" on the
same page said "Serenity Beach House **is** the resort-comfort choice in Puducherry."
The banner contradicts the reasoning section and names a place I'm not looking at. For
about ten seconds I genuinely did not know which trip I was being quoted.

> "Which one am I buying? The heading and the yellow box don't agree."

**5. I asked for no 3am flight and there is nowhere to say it.** Four questions, a full
basics form, an adjust panel — and not one field for departure time. The itinerary gives
me "5h 24m in the air" and no clock time anywhere on the page. So on the one comfort
question that matters when you're flying with a nine-year-old, I have learned nothing
and I still have to ring the agent.

**6. The re-plan panel can change adults but not children.** It has start, end, adults,
budget, origin. If I want to price the same trip with my sister's kids added I have to
start over.

**7. Cosmetic but it looked wrong:** the Andaman itinerary puts "Mangrove kayak after
dark" on Day 8, after check-out and alongside the flight home. Nobody does a night kayak
on the morning they fly out.

### Compared to what I do today

My spreadsheet has two agent quotes that arrive as PDFs with "Package cost ₹1,45,000*"
and an asterisk pointing at nothing. Neither agent will tell me the room-night rate.
Neither will tell me what they rejected. This gave me a total, five components, the
per-person arithmetic, the child rule, a stable plan ID and a paste-ready export in
twelve minutes. On transparency it is not close — this wins.

What it is not is bookable, and it does not pretend to be. Because it says so plainly,
I'd use it as the challenge document I take to my agent, which is worth real money to me
even though it's sample data.

### Would I use it again? Would I pay?

Yes, again — as a negotiating instrument. I'd walk in with the printed breakdown and ask
why their Havelock quote is ₹3.4 lakh when a room-night is ₹3,200.

Paying: not for sample data. Wire it to live inventory and give me a plan I can hand to
an agent and I'd pay **₹500 a trip, or ₹2,000 a year** for the household. I'd pay it for
the breakdown and the export, not for the destination suggestions — I can pick a place
myself; what I cannot do is get anyone to itemise.

### Scores

| | |
|---|---|
| First-run clarity | 8 |
| Task success | 8 |
| Speed | 9 |
| Visual quality | 8 |
| Trust | 7 |
| **Overall** | **8** |

Trust is the one I'd hold back on, and it's held back by four things and not by the
arithmetic: the season loading that isn't prorated, the banner that names the wrong
destination, "per traveller" meaning two things, and the adults/children label
mismatch. The maths itself is the most honest I have seen from anyone selling travel.

### Top three fixes

1. **Make the seasonal loading say what it actually does, or make it do what it says.**
   Right now a trip with two nights in the peak window pays exactly what a trip with
   seven does, under a label that reads like a date range. This is the one line on the
   page that could still cost me ₹50,000 I didn't expect.
2. **One plan, one story.** When I switch to an alternate, every explanation on the page
   must be about the plan I am looking at. A banner naming a different destination beside
   a different total is the fastest way to lose someone like me.
3. **Let me say when I can fly, and show me the times.** Not a preference toggle buried
   somewhere — I want to see the departure on the itinerary. A number I can't fly at
   3am for is not a number I can use.


## Kabir Sandhu — round 2

Design studio owner, Delhi, nine people, annual offsite. Round 1 didn't work for me.
What I brought: 9 travellers, 13–16 Nov, ₹4,50,000, from Delhi, Party *and* Peace &
Quiet, and a plan to change 9 → 7 → 12 to see what breaks. Today I use a Google Sheet
with a tab per destination and a WhatsApp group that argues for two weeks.

**Did I get what I came for? Partly. About 25 minutes.** I have a plan I would paste
into Slack. I do not fully trust the numbers in it, and that is the problem.

### What happened

**Vibe screen.** Six cards, clean, obvious. I clicked Party, then Peace & Quiet — it
deselected Party. Single-select. My trip is genuinely both: one big night out and one
day where nobody does anything. There is nowhere to say that. I went with Party and
hoped the questions would let me add the quiet part. They didn't.

**Trip basics.** One page, all four fields prefilled, sensible. Best screen in the
product. Filled 13/11/2026–16/11/2026, ₹450000, 9 adults, Delhi. The chip at the top
("3 nights · 9 travellers · from Delhi · ₹4,50,000") stayed with me the whole way,
which I liked.

**Four questions.** Within India → A city → A proper city night → Local stays. Fast,
branching, no dead ends. Notably it never asked me anything about pace or downtime —
the thing I actually needed.

**The plan.** Puducherry & Auroville, ₹2,49,900. With an amber banner: *"No city
nightlife party trip fits ₹4,50,000 for 9 — we included the coast."* And directly
underneath: *"₹2,00,100 under your budget."*

> "Hang on. You're telling me nothing fits ₹4.5 lakh, and in the same breath you're
> handing me something two lakh under it. Which is it?"

Then the itinerary: Goubert market, White Town at first light, the Matrimandir, and
the Sri Aurobindo ashram — *ten minutes of complete silence*. For nine designers on a
Party offsite. I would be laughed out of the studio.

**"Put city nightlife back".** I clicked it out of irritation. It said: *"The cheapest
city nightlife party trip for 9 over these dates is ₹2,34,300 — ₹2,15,700 under your
budget."* So the city nightlife trip exists, fits, **and is cheaper than the one it
just gave me.** The banner was flatly wrong and the product disproved itself in one
click.

> "So it lied to me. Not maliciously, but it lied, and I only caught it because I was
> annoyed enough to click. My WhatsApp group would have argued about Puducherry for a
> week off the back of that sentence."

**North Goa.** Now it's right. "A night out in Anjuna — the one properly late night,
with a taxi arranged in advance." Chapora fort, Fontainhas, dolphin boat. And it told
me *"Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no
Wednesday."* That is exactly the honesty I want and my Sheet never gives me.

But the amber note under the ₹1,76,100 headline still read *"destination is now
Puducherry & Auroville instead of North Goa … so this is Puducherry & Auroville"* on a
page whose H1 says **North Goa**. Stale text sitting directly under the price.

**9 → 7 (the test I came to run).** Changed Adults to 7 in "Adjust and re-plan",
ticked "Leave one day free", hit Update. It did **not** re-ask the questions — that
part passes, and it's the thing that made me leave last time. But it silently threw
away my North Goa override and dropped me back into Puducherry, with the same false
"nothing fits ₹4,50,000 for 7" banner — even more absurd, because it's *fewer people
and less money.* I had to click "Put city nightlife back" → "Use the plan" all over
again.

> "Wait — where did my Goa go? I changed one number. I didn't ask you to redecide the
> whole trip."

If I hadn't been watching, I'd have pasted a Puducherry ashram itinerary into Slack
under the heading "offsite".

**Leave one day free.** Works, visibly: *"Day 2 · Sat 14 Nov — Nothing scheduled, this
day is yours."* And then honestly: *"Not scheduled: Saturday night market, Arpora —
runs Saturdays only, and there was no room on your Saturday."* Good. But it picked
Saturday, my one big evening, and never asked which day I wanted free.

**Copy as text.** The best thing in the product. Fourteen lines, destination, dates,
headcount, total, per person, day-by-day, room count, cost split, the two caveats, a
plan ID. That is a Slack message. That replaces three tabs of my Sheet.

**12 people, International, ₹4,50,000 (the trap).** It gave me Ella & the south coast
at ₹4,29,600 and — at the bottom, in small text — *"Dubai — ₹1,56,000 over your budget
for 12. Phuket & Phi Phi — ₹1,20,000 over. Bali — ₹1,93,200 over."* It did not lie. It
told me the exact gap. Credit where due. But it never said it up top, and it quietly
handed me a destination rated **1 out of 5 for Party** without a banner saying "your
budget cannot buy an international party trip for twelve".

**₹50,000 for 12 (the impossible one).** No "no results". *"Nothing in this catalogue
fits ₹50,000 — the closest is ₹1,84,800."* Manali, and it noted the shortfall. Exactly
right. This alone is better than every booking site I use.

**"Not this one — somewhere else."** Cycled North Goa → Manali → Kochi → Gangtok, kept
a "You turned these down" list with put-back. Good. But North Goa came back at
₹3,82,800 here, versus ₹2,34,300 via the other route. Same destination, ₹1.5 lakh
apart, no explanation anywhere. That is a fresh two-week WhatsApp argument.

### Where I hesitated

- Vibe screen: five seconds trying to select a second card before accepting I couldn't.
- The "nothing fits / ₹2,00,100 under budget" contradiction — I stopped and re-read it
  three times.
- After Update plan, working out whether the destination had changed on purpose.
- ₹2.7 lakh under budget with nine people. There is no way to say "use my money" —
  no upgrade the stay, no add a nicer dinner. Under budget reads as a win to the
  product and as a failure to me.

### Blockers

1. Changing the headcount silently discards a destination I explicitly chose. It
   doesn't re-ask the questions — but it re-decides the answer, which is worse,
   because I don't notice.
2. The budget banners state things that are not true. "No city nightlife party trip
   fits ₹4,50,000 for 9" when a cheaper one exists is the one sentence that costs the
   product its credibility, and it's above the fold.
3. Stale text: an amber note naming Puducherry sits under a North Goa headline.

### Verbatim

> "You're telling me nothing fits ₹4.5 lakh and handing me something two lakh under it."
> "It disproved itself in one click. That's the bit I can't unsee."
> "Wait — where did my Goa go? I changed one number."
> "The Slack paste is genuinely great. I'd use the product for that alone if I could
> trust the number at the top of it."
> "Nine designers, one ashram, ten minutes of complete silence. No."

### Scores

| | |
|---|---|
| First-run clarity | 8 |
| Task success | 6 |
| Speed | 8 |
| Visual quality | 8 |
| Trust | 4 |
| **Overall** | **6** |

### Top three fixes

1. **Never tell me something doesn't fit when it does.** Every "nothing fits ₹X for N"
   line must be true at the moment it's rendered, and if a cheaper option exists that
   matches what I asked for, show me that first instead of the banner.
2. **A choice I made by hand survives a headcount change.** If re-pricing forces a
   different destination, say so loudly and offer one click back — don't silently
   revert to the machine's pick.
3. **Let me spend the budget I gave you.** ₹2.7 lakh under is not a win for an offsite.
   Offer the better stay, and let me hold two vibes at once — one loud night, one dead
   day — because that is what every group trip actually is.

**Would I use it again?** Yes, for the Copy-as-text alone — but I'd sanity-check every
banner, which is the exact work I came here to stop doing.

**Would I pay?** ₹1,000 one-off per trip, or ~₹2,500/year for the studio. Not more
while it's a sample catalogue that doesn't book anything, and not at all until the
budget lines stop contradicting themselves.
