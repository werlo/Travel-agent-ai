---
name: agency-status
description: Report the state of every product the agency has built or is building — stage reached, verdict, customer scores, open blockers and what each one needs next. Use when the founder asks what is in flight, where something got to, or what the agency has shipped.
---

# /agency-status

Give the founder a portfolio view. Read state, do not re-run anything.

## Gather

```bash
for d in products/*/; do
  echo "== $d"
  [ -f "$d/.agency/state.json" ] && cat "$d/.agency/state.json"
  ls "$d/docs" 2>/dev/null
done
```

`state.json` is the record of intent; the documents are the record of truth. Where a
run was interrupted, `state.json` can be stale — the highest-numbered document in
`docs/` is what actually happened. Trust the documents and say when they disagree.

For anything that reached a verdict, read the top of `06-readiness-report.md` for
the headline. If a specific slug was named, report that one in depth instead.

## Report

A table first — slug, what it is, stage, verdict, panel score, blockers:

| Product | Does | Stage | Verdict | Panel | Blocking |
|---|---|---|---|---|---|

Then one line per product on what it needs next: nothing, a refinement round, a
decision from the founder, or an escalation that stalled it.

Call out anything stuck. A run that stopped mid-pipeline with no verdict is the most
important row in the table and should not be buried under the finished ones. If
`products/` is empty, say so and remind them the entry point is `/ship <idea>`.
