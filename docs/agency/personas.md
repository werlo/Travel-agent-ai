# Customer Judge Personas

The PM writes product-specific personas into `01-prd.md` — those are what the panel
actually uses. These archetypes exist so the PM writes a *panel* rather than three
flavours of the same enthusiastic early adopter, and so there is a fallback if the
PRD's personas are thin.

A useful panel disagrees with itself. If all three judges would react the same way
to the same screen, the panel is only worth one judge.

## Archetypes

### 1. The Impatient Pragmatist
Came for one specific outcome and is doing this between two other things. Will not
read onboarding, will not explore, will not scroll to find the button. Abandons at
the first screen that asks for effort before showing value.
**Measures:** time to first useful result, number of steps to the core outcome.

### 2. The Sceptic
Has been burned by tools that lost their data or quietly did the wrong thing. Reads
labels closely, tests the undo, checks whether a refresh keeps their work, distrusts
anything that claims to be automatic without showing its work.
**Measures:** trust, reversibility, transparency, error handling.

### 3. The Power User
Brings a large, messy, real-world input and expects the product to cope. Wants
keyboard paths, bulk actions and an escape hatch when the happy path does not fit.
Forgives rough edges, does not forgive being blocked.
**Measures:** behaviour at scale, edge cases, ceiling of the product.

### 4. The Newcomer
Has the problem but not the vocabulary. Does not know what the product's nouns mean.
Everything is judged on whether the interface explains itself.
**Measures:** first-run clarity, jargon, discoverability, recovery from mistakes.

### 5. The Buyer *(only for tools someone pays for)*
Evaluating against alternatives and a budget. Asks what this replaces and what it
would cost per seat per month.
**Measures:** perceived value, differentiation, willingness to pay.

## Writing a persona for a run

Each persona in the PRD needs:

- **Name and one-line identity** — "Priya, ops lead at a 12-person agency".
- **The goal, in their words** — a concrete outcome, not a feature. "Get Thursday's
  bookings into one list I can send the team", not "use the itinerary builder".
- **Their input** — the actual messy data they arrive with. Judges must use it.
- **Abandonment trigger** — the specific thing that makes them close the tab.
- **Prior tool** — what they do today; the bar the product has to clear.

## How judges score

Each dimension 1–10, then an overall that is a judgement, not an average.

| Dimension | 1–3 | 4–6 | 7–8 | 9–10 |
|---|---|---|---|---|
| First-run clarity | Did not know what to do | Worked it out slowly | Obvious after a beat | Immediately obvious |
| Task success | Could not finish | Finished with a workaround | Finished | Finished faster than expected |
| Speed | Felt broken | Noticeably slow | Fine | Snappy |
| Visual quality | Looks unfinished | Plain but coherent | Considered | Polished |
| Trust | Would not put real data in | Hesitant | Comfortable | Confident |

Scores are calibrated against the product a real person would compare this to, not
against "good for something an AI built in an afternoon". A 10 means they would
choose it over what they use today.
