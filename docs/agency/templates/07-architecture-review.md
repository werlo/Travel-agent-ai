# Architecture Review — <Product Name>

**Author:** Tech Lead · **Reviews:** the code as built vs `02-architecture.md`

## Verdict
GO / GO WITH RISK / NO-GO, and the one sentence that justifies it.

## Drift
| Designed | Built | Impact | Accept or fix |
|---|---|---|---|

## Code health
| Area | Finding | Severity | Fix cost |
|---|---|---|---|
Coupling, duplication, error handling, test quality, dead code, type escapes (`any`).

## Real bottleneck
Where it actually falls over, with a number: rows, requests/sec, payload size,
render count. Measured if possible, reasoned if not — say which.

## Scale readiness
| Scale | Holds? | First thing to break | Fix | Effort |
|---|---|---|---|---|
| 10× | | | | |
| 100× | | | | |
| 1000× | | | | |

## Security
Input handling, stored data, XSS/injection surface, dependency risk, secrets.

## What I would do next with a week
Ranked, with the reasoning.
