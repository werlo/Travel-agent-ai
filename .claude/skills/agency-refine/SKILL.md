---
name: agency-refine
description: Feed the founder's own feedback on a built product back into the agency — PM triages it, a developer implements it, QA regresses it, and the customer panel re-judges. Use when the founder reviews something the agency built and wants changes, or reports a bug in it.
---

# /agency-refine <slug> <feedback>

The founder has used the product and has notes. They are now the most important
judge on the panel — their feedback outranks the simulated customers.

## 1. Locate and orient

Confirm `products/<slug>/` exists (`/agency-status` if the slug is ambiguous). Read
`docs/01-prd.md` for the requirements and `docs/06-readiness-report.md` for where the
last run left it. If nothing was ever built, this is a `/ship`, not a refinement.

Append the feedback verbatim to `docs/05-customer-feedback.md` under
`## Founder feedback — round N`, dated. Their exact words, not your summary of them.

## 2. Decide the shape of the work

Read the feedback and pick honestly:

| The feedback is | Do |
|---|---|
| A bug, or a small specific change | Run the refinement workflow below |
| A new feature inside the existing product | Refinement workflow — the PM will fold it in as a new `R*` |
| A different product | Say so, and offer `/ship` with a new slug |

## 3. Run the refinement

```
Workflow({
  name: 'ship-product',
  args: { slug, dir, url, idea: <original idea>, refineOnly: true,
          founderFeedback: <verbatim>, judges: 3, maxFixRounds: 2,
          maxRefineRounds: 1, minScore: 8 },
})
```

The full pipeline is the wrong tool for a two-line change — it would re-plan and
re-architect a product that already exists. For anything small, do it directly
instead: dispatch a `developer` agent with the founder's exact words and the
relevant docs, then a `qa-engineer` agent for a regression pass. Two agents, minutes
instead of an hour. Use the workflow when the change touches scope, architecture or
several screens.

Either way the sequence is the same and the order is not optional:
**triage → implement → regress → re-judge.** Skipping the regression is how a
one-line fix breaks the flow that was already signed off.

## 4. Close the loop

Update `state.json` (increment `rounds.refine`, append to `history`), commit as
`fix(<slug>): founder feedback round N`, push, and tell the founder:

- What changed, in their terms — quote the note it answers.
- What you deliberately did **not** change, and why. Founders' feedback sometimes
  contradicts their own PRD; say so plainly rather than silently picking one.
- The regression result — what still passes, and anything that broke.
- Where to look to confirm it themselves.
