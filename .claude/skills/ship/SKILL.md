---
name: ship
description: Take a founder's product idea end to end through the agency — PM plans it, tech lead architects it, designer specs it, developers build it, QA tests it, customer judges use it and score it, the team refines on their feedback, and the founder gets a readiness report. Use when the founder gives a product idea or says ship/build this.
---

# /ship

The founder gave you an idea. Run the agency on it and report back when it is
end-to-end ready.

Invoking this command **is** the founder's opt-in to multi-agent orchestration.
Launch the workflow; do not ask again, and do not hand-build the app yourself in
this session — plan, design, build, test and critique are separated on purpose.

## 1. Read the idea

Everything after `/ship` is the idea, except trailing flags:

| Flag | Effect |
|---|---|
| `--depth quick` | 2 judges, 1 fix round, 0 refinement rounds |
| `--depth standard` | *(default)* 3 judges, 2 fix rounds, 1 refinement round |
| `--depth deep` | 3 judges, 2 fix rounds, 2 refinement rounds |
| `--slug <name>` | Override the derived slug |

If the "idea" is actually a question about the harness, or a change to an existing
product, this is the wrong command — answer directly, or use `/agency-refine`.

## 2. Create the product

Derive a slug: lowercase, hyphenated, 2–4 words from the idea (`travel bookmarks
into a day-by-day itinerary` → `itinerary-builder`). Then:

```bash
./scripts/new-product.sh <slug> <the idea, verbatim>
```

It prints JSON with the directory, port and URL. Pass the idea through **unedited** —
`00-brief.md` is the only record of the founder's actual words, and every later
document is an interpretation of it.

## 3. Tell the founder what is about to happen

One short message before you launch, so they can redirect early: the slug, the URL
the product will live at, the depth, and that you will report back when the run
finishes. Do not narrate every stage after that — the workflow logs its own progress
and they can watch it with `/workflows`.

## 4. Run the pipeline

```
Workflow({
  name: 'ship-product',
  args: {
    slug, dir, url,                    // from new-product.sh
    idea,                              // the founder's verbatim text
    judges, maxFixRounds, maxRefineRounds,   // from the depth preset
    maxSlices: 4,
    minScore: 8,
  },
})
```

It runs in the background and returns a task id; a notification arrives when it is
done. Do not poll it, do not re-invoke it, and do not guess at its results — wait
for the notification. If the founder asks in the meantime, say it is still running.

Expect roughly 11–16 agents for a standard run.

## 5. When it finishes

The workflow returns the verdict, the readiness report path, QA results, panel
scores, the architecture verdict and the gaps.

1. **Record it** — update `products/<slug>/.agency/state.json`: `stage: "shipped"`,
   the verdict, the round counts, and append a history entry.
2. **Commit** — `git add products/<slug> && git commit -m "feat(<slug>): <product> — <verdict>"`,
   then `git push -u origin <branch>`.
3. **Read the report yourself** before summarising it. If
   `06-readiness-report.md` disagrees with the workflow's structured verdict, say so
   rather than picking the flattering one.
4. **Notify the founder.** Use `PushNotification` if available — they asked to be
   told when it is ready and may not be watching.

## 6. What to tell the founder

Short, honest, and in this order:

- **The verdict**, plainly. READY, ready with named caveats, or not ready and why.
- **How to see it** — `./scripts/serve-product.sh <slug>`, the URL, and the three
  steps that show the point of the product.
- **What customers said** — the mean score and the sharpest criticism, not just the
  compliments.
- **What is missing** — the gaps, specifically enough to act on.
- **What is next** — the top moves from the report.
- Then the path to `06-readiness-report.md` for the detail.

Lead with bad news if there is any. A gate that was exhausted rather than passed, a
failed build, an escalation from Discovery — those go in the first three lines, not
in a footnote. The founder's ability to trust every future report depends on this
one being accurate.
