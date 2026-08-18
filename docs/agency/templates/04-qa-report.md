# QA Report — <Product Name>

**Author:** QA Engineer · **Round:** <n> · **Verdict:** PASS / FAIL

## Commands run
```
$ npm run lint     → 
$ npm run build    → 
$ npm test         → 
$ npm run e2e      → 
```
Paste real output, including the failure lines.

## Requirement coverage
| ID | Requirement | E2E spec | Result | Evidence |
|---|---|---|---|---|
| R1 | | `e2e/…spec.ts:12` | PASS | |

## UX checklist
| ID | Check | Result | Note |
|---|---|---|---|

## Cross-cutting sweeps
| Sweep | Result | Notes |
|---|---|---|
| Responsive 360 / 768 / 1280 | | |
| Keyboard-only path through the primary flow | | |
| Console errors & warnings | | |
| Reload mid-flow — state survives | | |
| Empty / malformed input | | |

## Bugs
| ID | Sev | Title | Repro | Expected | Actual | Requirement |
|---|---|---|---|---|---|---|
| B1 | S1 | | 1. … | | | R3 |

S1 blocks the core flow · S2 requirement unmet or wrong result · S3 off-spec · S4 polish.

## Verdict
PASS requires zero open S1/S2. State it plainly, then list what is still open.
