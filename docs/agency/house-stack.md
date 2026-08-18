# House Stack

Default technology for anything the agency builds. The Tech Lead may deviate, but
must justify it in `02-architecture.md` and must keep the **contract** below intact —
QA, the customer judges and the founder's own commands all depend on it.

## The contract

Every product exposes exactly these scripts in `products/<slug>/package.json`:

| Script | Must do |
|---|---|
| `npm run dev` | Serve the app on the port in `.agency/state.json`, no other setup |
| `npm run build` | Production build; non-zero exit on any type error |
| `npm test` | Unit + integration tests, headless, exits non-zero on failure |
| `npm run e2e` | Playwright suite against a freshly started dev server |
| `npm run lint` | Lint + typecheck |

If these five work, everything downstream works.

## Defaults

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict: true` | Type errors are the cheapest bugs to catch |
| UI | React 18 + Vite | Fast dev server, trivial Playwright target |
| Styling | Plain CSS with custom properties | Designer emits tokens; no build-time magic |
| State | React state/context; Zustand past ~3 shared stores | Boring until it hurts |
| Persistence | `localStorage`, or JSON on disk via a Vite dev middleware | No external service |
| Unit tests | Vitest + Testing Library | Same toolchain as Vite |
| E2E | Playwright (Chromium) | Preinstalled in this environment |
| Server (only if needed) | Express or Fastify on the same port via Vite proxy | One process to start |

## Environment facts

- Node 22, npm 10. `jq` and `curl` available. **No** `sqlite3` binary — if you need
  SQL use `better-sqlite3` (ships a prebuilt binary) or keep data in JSON.
- Chromium and its Playwright bundle are preinstalled at `/opt/pw-browsers`
  (`PLAYWRIGHT_BROWSERS_PATH` is already set). **Never run `npx playwright install`.**
  If npm tries to fetch browsers, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- Outbound HTTPS goes through a proxy. Do not build products that require live
  third-party APIs, keys or paid services. If an idea needs one, model it behind an
  interface with a deterministic local fake, and say so in the report.

## Playwright config every product uses

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'
const PORT = Number(process.env.PORT ?? 4173)
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

`reuseExistingServer: true` matters: QA and the customer judges often already have
the server up via `scripts/serve-product.sh`.

## Definition of runnable

A product is runnable when, from a clean clone:

```bash
cd products/<slug> && npm install && npm run build && npm test && npm run e2e
```

completes with zero failures and no manual step in between. That command is what
the Release Manager cites as evidence; if it has not been run, the product is not
ready, whatever else the agents say.
