# Architecture — <Product Name>

**Author:** Tech Lead · **Reviews:** `01-prd.md`

## 1. Stack
| Layer | Choice | Why | What we would use instead at 100× |
|---|---|---|---|

Deviations from `docs/agency/house-stack.md` are justified here or they are not made.

## 2. Module map
```
src/
├── …
```
Dependency direction, and the one rule that must not be broken.

## 3. Data model
Entities, fields, types, relationships, and where each lives at rest.

## 4. Contracts
Component/API/state interfaces the developer implements against. Types, not prose.

## 5. Error handling
| Failure | Detected where | User sees | System does |
|---|---|---|---|

## 6. Performance budget
| Metric | Budget | Measured how |
|---|---|---|
| First contentful paint | | |
| Core interaction | | |
| Bundle size | | |

## 7. Scalability plan
| Scale | What breaks first | Why | Fix | Cost of the fix |
|---|---|---|---|---|
| 10× | | | | |
| 100× | | | | |
| 1000× | | | | |

Name the actual bottleneck with a number. "Add caching" is not an answer.

## 8. Security & privacy
What data exists, where it goes, what is never collected, what an attacker gets.

## 9. Observability
What is logged, what would tell us it is broken in production.

## 10. Work breakdown
| # | Slice | Requirements | Done when |
|---|---|---|---|
| 1 | Scaffold: project, tooling, test harness, npm scripts, one rendered screen | — | `npm run build && npm test` pass |
| 2 | | R1, R2 | |

Ordered. Each slice leaves the app running.

## 11. Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## 12. Deviations *(appended during build)*
| Slice | Spec said | Built instead | Why |
|---|---|---|---|
