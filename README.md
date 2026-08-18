# Software Agency Harness

An AI software agency in a repo. You are the founder. You give an idea; a staffed
pipeline of specialist agents plans it, designs it, builds it, tests it, puts it in
front of simulated customers, refines it on their feedback, reviews it for
architecture and scale, and reports back to you when it is end-to-end ready.

```
/ship an app that turns my messy travel bookmarks into a day-by-day itinerary
```

That is the whole interface. Everything below is what happens after you hit enter.

---

## The org chart

| Role | Agent | Owns | Ships |
|---|---|---|---|
| Product Manager | `product-manager` | Scope, flows, acceptance criteria | `01-prd.md` |
| Tech Lead | `tech-lead` | Architecture, work breakdown, scale plan | `02-architecture.md` |
| Designer | `designer` | Design system, screen specs, UX checklist | `03-design.md` |
| Developer | `developer` | Implementation + unit/integration tests | working code |
| QA Engineer | `qa-engineer` | E2E tests, functional + UX compliance | `04-qa-report.md` |
| Customer Panel | `customer-judge` ×N | Real usage, scores, verbatim feedback | `05-customer-feedback.md` |
| Release Manager | `release-manager` | Go/no-go, founder report | `06-readiness-report.md` |

Each role is a real subagent with its own system prompt in `.claude/agents/`.
They do not share a context window — they hand off through written artifacts on
disk, exactly like a real agency hands off through documents.

## The pipeline

```
     your idea
         │
   ┌─────▼─────┐
   │ DISCOVERY │  PM: problem, MVP scope, user flows, acceptance criteria, personas
   └─────┬─────┘  ── gate: every requirement is testable ──
         │
   ┌─────▼──────────────────┐
   │ ARCHITECTURE & DESIGN  │  Tech Lead + Designer, in parallel
   └─────┬──────────────────┘  ── gate: stack runs locally, every screen specced ──
         │
   ┌─────▼─────┐
   │   BUILD   │  Developer, one architecture slice at a time
   └─────┬─────┘  ── gate: build + unit tests green after every slice ──
         │
   ┌─────▼─────┐
   │    QA     │  E2E per acceptance criterion + UX compliance sweep
   └─────┬─────┘  ── gate: zero S1/S2 bugs; fix loop until clean ──
         │
   ┌─────▼──────────┐
   │ CUSTOMER PANEL │  N judges, each a persona, driving the real UI blind
   └─────┬──────────┘  ── gate: mean score ≥ threshold, no blockers ──
         │
   ┌─────▼──────┐
   │ REFINEMENT │  PM triages feedback → Developer fixes → QA regression → re-judge
   └─────┬──────┘  ── loop until the panel is satisfied or rounds run out ──
         │
   ┌─────▼─────┐
   │  SIGN-OFF │  Tech Lead architecture + scalability review, then release report
   └─────┬─────┘
         │
   ▼ founder notified: what shipped, how to run it, what is proven, what is not
```

Gates are enforced by the orchestrator, not by vibes. A stage that fails its gate
loops back to the role that can fix it, up to a configured number of rounds; if it
still fails, that fact lands in your report instead of being quietly buried.

## Commands

| Command | What it does |
|---|---|
| `/ship <idea>` | Run the full pipeline end to end. Notifies you when ready. |
| `/ship <idea> --depth deep` | More judges, more refinement rounds. |
| `/agency-status` | Every product, what stage it reached, what is blocking. |
| `/agency-refine <slug> <your feedback>` | You are the judge. Feed your notes back in. |

Depth presets:

| Preset | Judges | Fix rounds | Refine rounds | Roughly |
|---|---|---|---|---|
| `quick` | 2 | 1 | 0 | a prototype to look at |
| `standard` *(default)* | 3 | 2 | 1 | a working, tested, critiqued MVP |
| `deep` | 3 | 2 | 2 | above, plus a second refinement pass |

## Where things land

```
products/<slug>/
├── docs/
│   ├── 00-brief.md            your idea, verbatim
│   ├── 01-prd.md              PM
│   ├── 02-architecture.md     Tech Lead
│   ├── 03-design.md           Designer
│   ├── 04-qa-report.md        QA
│   ├── 05-customer-feedback.md  Customer panel
│   ├── 06-readiness-report.md   ← the one written for you
│   └── 07-architecture-review.md  Tech Lead sign-off
├── src/                       the product
├── tests/ e2e/                unit + end-to-end tests
└── .agency/state.json         pipeline state, port, run history
```

Read `06-readiness-report.md` first. It is written for a founder, not an engineer:
what exists, what is proven and by what evidence, what is knowingly missing, what
it costs to run, and what breaks at 100× the users.

## Running what got built

```bash
./scripts/serve-product.sh <slug>     # starts the dev server, waits for it to answer
cd products/<slug> && npm run e2e     # replay the end-to-end suite yourself
```

Every product exposes the same four scripts — `dev`, `build`, `test`, `e2e` — so
these commands work no matter what got built. See `docs/agency/house-stack.md`.

## The rules the agency runs on

1. **Nothing is "done" on an agent's say-so.** Done means the build passes, the
   tests pass, and the E2E suite drove the real UI through the acceptance criteria.
2. **QA may not edit product code.** It reports bugs; developers fix them. An agent
   that can silence its own alarm is not a test.
3. **Judges are blind.** Customer agents never read the source. They get the URL and
   a goal, same as a person would.
4. **Scope gets cut, not padded.** The PM's job is to find the smallest thing that
   is genuinely useful and defend it against everyone, including you.
5. **Bad news travels up.** Unfinished work, failed gates and known weak spots are
   in your report. A green report you cannot trust is worse than a red one.

Full detail on stages, gates and hand-offs: `docs/agency/playbook.md`.
