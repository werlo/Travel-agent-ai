# Agency Playbook

The contract every role works to. The orchestrator
(`.claude/workflows/ship-product.js`) enforces the gates; this document explains
them and is the reference each agent prompt points back to.

## Principles

1. **Hand off in writing.** Agents do not share context. A stage's output is a file
   on disk plus a small structured summary. If it is not written down, the next
   role does not know it.
2. **Gates are mechanical.** "Build passes, 41/41 acceptance criteria have a passing
   E2E test" is a gate. "Looks good" is not.
3. **Separation of powers.** The role that writes the code never signs off on it.
   QA cannot edit product source; judges cannot read it.
4. **Bounded loops.** Every retry loop has a round cap. Exhausting it is a reported
   outcome, never a silent pass.
5. **Traceability.** Requirements are `R1..Rn` from the PRD. Design specs, tests,
   bugs and feedback all cite requirement IDs.

---

## Stage 1 — Discovery (Product Manager)

**In:** `docs/00-brief.md` (the founder's idea, verbatim).
**Out:** `docs/01-prd.md`.

Contains: problem and who has it; the one job the MVP does; in-scope requirements
`R1..Rn`, each with a Given/When/Then acceptance criterion; explicit out-of-scope
list; the primary user flow step by step; screen inventory; 2–4 customer personas
with goals and what would make each abandon the product; success metrics;
assumptions the PM decided rather than asked about.

**Gate:** every requirement has an acceptance criterion that a test could fail.
Scope is one pass of work — if it is not, the PM cuts until it is.

The PM does not ask the founder questions mid-run. Ambiguity is resolved by
deciding and recording the decision under Assumptions.

## Stage 2 — Architecture & Design (Tech Lead ∥ Designer)

Both read the PRD. They run in parallel and neither waits for the other.

### Tech Lead → `docs/02-architecture.md`

Stack and why; module boundaries and their dependency direction; data model; API /
state contracts; error and edge-case strategy; performance budget with numbers;
**scalability plan** — what breaks at 10×, 100×, 1000× users and the concrete fix
at each step; security and privacy posture; observability; risk register.

Plus the **work breakdown**: an ordered list of build slices. Slice 1 is always the
scaffold (project, tooling, test harness, CI-able scripts, one rendered screen).
Each later slice names the requirements it satisfies and how to verify it.

### Designer → `docs/03-design.md`

Design principles; **design tokens as literal CSS custom properties** for light and
dark; type scale; spacing; component inventory with states; a spec per screen in
the PRD's inventory covering layout, hierarchy, copy and every state — empty,
loading, error, success, permission-denied, offline; responsive behaviour at 360 /
768 / 1280; motion, with a reduced-motion answer; accessibility commitments
(WCAG 2.1 AA contrast, focus order, keyboard paths, labels, live regions).

Plus the **UX acceptance checklist**: numbered `UX1..UXn` checks QA will verify.

**Gate:** every PRD screen has a spec; every PRD requirement is claimed by a build
slice; the stack runs locally with no external services.

## Stage 3 — Build (Developer)

Slices are implemented **in order, one agent per slice**, each starting from the
previous slice's committed state. A slice is not finished until, in the product
directory: `npm run build` passes, `npm test` passes, typecheck and lint pass, and
the dev server serves the affected screens without console errors.

Rules: implement the design tokens as given rather than re-inventing them; no
placeholder or lorem content on paths the PRD covers; no `TODO` in a user-facing
path; keep modules inside the architecture's boundaries. If the spec is wrong or
impossible, implement the closest correct thing and record the deviation in
`docs/02-architecture.md` under *Deviations* — do not silently improvise.

**Gate:** build + unit tests green after every slice.

## Stage 4 — QA (QA Engineer)

Writes Playwright E2E specs covering **every** `R*` acceptance criterion and every
`UX*` check, then runs everything: typecheck, lint, unit, E2E, a responsive sweep at
three widths, a keyboard-only pass, and a console-error check.

**QA may create and edit files under `tests/` and `e2e/` only.** It never touches
product source to make something pass. Findings go to `docs/04-qa-report.md`:
per-criterion PASS/FAIL with evidence, and bugs with severity —

| Sev | Meaning |
|---|---|
| S1 | Blocks the core flow; product is unusable |
| S2 | A requirement is unmet, or a wrong result is shown |
| S3 | Works, but wrong per the design or UX spec |
| S4 | Polish |

**Gate:** verdict PASS with zero open S1/S2. Otherwise the failures go back to a
developer and QA re-verifies, up to the fix-round cap.

## Stage 5 — Customer Panel (Customer Judges)

One judge per PRD persona, in parallel. Each gets the running URL and the persona's
real-world goal — **nothing else**. Judges do not read the repo, the PRD or the
design spec; a judge that consults the source has invalidated its own verdict.

Each drives the live UI, then files: whether it completed the goal and how long it
took; where it hesitated or went wrong, with the screen and the element; scores 1–10
for first-run clarity, task success, speed, visual quality and trust; an overall
1–10; whether it would use it again and what it would pay; verbatim reactions; and
its top three fixes. Blockers are things that stopped the persona cold.

Collected into `docs/05-customer-feedback.md`.

**Gate:** mean overall score ≥ threshold (default 8) and zero blockers.

## Stage 6 — Refinement (PM → Developer → QA → re-judge)

Only runs if the panel gate fails. Per round:

1. PM triages all feedback into a ranked change list, each item tied to an `R*` or
   a new `R*`, with what "fixed" means. Feedback that contradicts the product's
   point is rejected in writing, not silently dropped.
2. Developer implements the top-ranked items.
3. QA runs a regression: full suite plus targeted checks on the changes.
4. Judges who scored below threshold or filed blockers re-run their goal. Judges
   who already passed are not re-run.

Loops until the gate passes or the refine-round cap is hit.

## Stage 7 — Sign-off (Tech Lead → Release Manager)

Tech Lead reviews the code as built against the architecture as designed and writes
`docs/07-architecture-review.md`: where implementation drifted, what the real
bottleneck is with a number attached, what the next 10× costs, security review, and
a technical go/no-go.

Release Manager writes `docs/06-readiness-report.md` for the founder: what the thing
does, how to run it, what is proven and by what evidence, scores, what is knowingly
missing, cost and scale summary, and a **READY / READY WITH CAVEATS / NOT READY**
verdict. Then the founder is notified.

---

## Escalation to the founder

The pipeline runs autonomously and does not stop for questions. It escalates only
when the run cannot honestly continue:

- The idea needs a credential, paid API or external service the sandbox cannot have.
- Two requirements are in direct contradiction and either choice changes the product.
- A legal, safety or privacy question sits at the centre of the idea.

Everything else is decided, recorded as an assumption, and surfaced in the report.

## Tuning a run

`/ship <idea> --depth quick|standard|deep`, or pass exact knobs:
`judges`, `maxSlices`, `maxFixRounds`, `maxRefineRounds`, `minScore`.
Defaults live in `.claude/workflows/ship-product.js`.
