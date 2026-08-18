# Repo: Software Agency Harness

This repo is a **harness**, not an app. It stages a pipeline of specialist agents
that take a founder's idea and produce a working, tested, critiqued product under
`products/<slug>/`.

The human working here is **the founder**. They give ideas and receive readiness
reports. They are not looking for a code walkthrough unless they ask for one.

## Layout

| Path | What it is |
|---|---|
| `.claude/agents/` | The staff. One system prompt per role. |
| `.claude/skills/` | Founder commands: `ship`, `agency-status`, `agency-refine`. |
| `.claude/workflows/ship-product.js` | The orchestrator that enforces stage gates. |
| `docs/agency/` | Playbook, house stack, personas, artifact templates. |
| `scripts/` | `new-product.sh`, `serve-product.sh`. |
| `products/<slug>/` | One built product per idea. |

## When the founder gives you an idea

Run `/ship <idea>`. Do not start hand-writing an app in the main session — the
whole point of the harness is that plan, design, build, test and critique are done
by different agents with independent context, and that the gates between them are
enforced. Invoking `/ship` is the founder's explicit opt-in to that orchestration.

If they ask for something that is *not* a product idea (a question about the
harness, a tweak to an agent prompt, a bug in a script), just do it directly.

## Working on the harness itself

- Agent prompts are the product here. Keep them specific and testable — "run
  `npm run build` and paste the output" beats "ensure quality".
- Every role's output contract is a file in `products/<slug>/docs/`. If you change
  what a role writes, update the matching template in `docs/agency/templates/` and
  the reader on the other side of the hand-off.
- The orchestrator passes **structured JSON** between stages and **file paths** for
  the detail. Agents get fresh context, so every prompt must name the files to read.

## Cost

Match the model tier and reasoning effort to the work. Wiring up a build config is
not the same kind of task as deciding what to cut from the scope, and paying the
same rate for both is waste. Simple, mechanical, spec-already-decided work gets low
effort; work where judgement determines whether the product is any good gets high.

The orchestrator's per-stage defaults live in the `EFFORT` table at the top of
`.claude/workflows/ship-product.js` and are overridable per run via
`args.effort`. Apply the same judgement to any agent you dispatch by hand.

## Conventions

- House stack for built products: TypeScript + Vite + React, Vitest, Playwright.
  Rationale and the required npm scripts are in `docs/agency/house-stack.md`.
- Products must run with no network calls at build time and no external services.
- Ports are derived from the slug and recorded in `products/<slug>/.agency/state.json`.
- Playwright's browsers are preinstalled at `/opt/pw-browsers`. Never run
  `npx playwright install`; set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if npm tries.

## Git

- Develop on `claude/software-agency-harness-mzljep`. Push with `git push -u origin <branch>`.
- Product work is committed as `feat(<slug>): ...`; harness work as `chore(agency): ...`.
- Do not open a PR unless the founder asks.
