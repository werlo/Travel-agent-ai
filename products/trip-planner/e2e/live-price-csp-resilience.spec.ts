import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * QA round — shallow pass, live price layer only (docs/04-qa-report.md).
 *
 * Covers item 3 of that round's scope: with a *fake* Travelpayouts key configured
 * (so `resolveLivePriceProviders()` believes it is configured and the provider
 * actually calls `fetch()`), the shipped Content Security Policy
 * (`connect-src 'none'`, docs/02-architecture.md §8) must block the outbound
 * request in the browser itself — not a generic network failure — and the app
 * must not crash or hang: `LivePriceProvider`'s contract (never throw, always
 * resolve `null` on any failure — src/data/livePrices/types.ts) must hold even
 * under this specific failure mode, so `<LivePriceCheck>` still renders nothing.
 *
 * This exercises a **production build** (`vite build` + `vite preview`), which is
 * what actually ships the exact `connect-src 'none'` string — the dev server
 * relaxes CSP for its own HMR socket (vite.config.ts `DEV_CSP`) and would not be a
 * faithful test of the shipped policy.
 *
 * This spec manages its own build + preview server on a separate port with a
 * fake env var, entirely independent of the shared `webServer` in
 * playwright.config.ts (which never sets these vars) — no other spec, and no
 * product source, is touched to make this possible.
 */

const ROOT = process.cwd()
const PORT = 4577
const BASE_URL = `http://localhost:${PORT}`

let outDir: string
let server: ChildProcessWithoutNullStreams | undefined

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`server at ${url} never came up: ${String(lastError)}`)
}

// Invoke the local `vite` binary directly rather than through `npx`: `npx` forks
// an extra wrapper process that does not reliably die when its parent is
// killed, which leaked a `vite preview` process (and its bound port) past this
// spec's `afterAll` when this was first written with `npx vite ...`.
const VITE_BIN = path.join(ROOT, 'node_modules', '.bin', 'vite')

test.beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), 'compass-liveprice-csp-'))

  // A real production build (not `npm run dev`) with a fake-but-present
  // Travelpayouts token/marker, so `resolveLivePriceProviders()` treats flights
  // as configured and `travelpayoutsProvider.ts` actually calls `fetch()`.
  const build = spawnSync(VITE_BIN, ['build', '--outDir', outDir], {
    cwd: ROOT,
    env: {
      ...process.env,
      VITE_TRAVELPAYOUTS_TOKEN: 'e2e-fake-token-never-real',
      VITE_TRAVELPAYOUTS_MARKER: 'e2e-fake-marker-never-real',
    },
    encoding: 'utf8',
  })
  if (build.status !== 0) {
    throw new Error(`fake-key production build failed:\n${build.stdout}\n${build.stderr}`)
  }

  server = spawn(VITE_BIN, ['preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'pipe',
    detached: true,
  })
  await waitForServer(BASE_URL, 20_000)
})

test.afterAll(() => {
  if (server !== undefined && server.pid !== undefined) {
    try {
      // Negative pid = kill the whole process group, in case vite forked further.
      process.kill(-server.pid, 'SIGKILL')
    } catch {
      server.kill('SIGKILL')
    }
  }
  if (outDir !== undefined) rmSync(outDir, { recursive: true, force: true })
})

test('R16/§13 — a fake key still hits the shipped connect-src \'none\' CSP, and the app neither crashes nor renders a live-price section', async ({
  browser,
}) => {
  const page = await browser.newPage()

  const consoleMessages: ConsoleMessage[] = []
  page.on('console', (msg) => consoleMessages.push(msg))
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  const requestFailures: string[] = []
  page.on('requestfailed', (req) => requestFailures.push(`${req.url()} ${req.failure()?.errorText ?? ''}`))

  await page.goto(BASE_URL)

  // Confirm this page really is running the shipped, unrelaxed CSP — not the dev
  // server's `connect-src 'self' ws://...` — before trusting anything below.
  const policy = await page.evaluate(
    () =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ??
      null,
  )
  expect(policy).toBe("default-src 'self'; connect-src 'none'; img-src 'self' data:")

  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  await page.getByRole('button', { name: 'Beach', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  await page.getByLabel('Start date').fill('10/10/2026')
  await page.getByLabel('End date').fill('15/10/2026')
  await page.getByLabel('Total budget for the whole party').fill('60000')
  await page.getByLabel('Adults', { exact: true }).fill('2')
  await page.getByLabel('Flying from').selectOption('Bengaluru')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
  await page.getByRole('button', { name: 'Plan my trip now' }).click()
  await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 8000 })

  // Give the live-price effect's fetch attempt (and its CSP rejection) time to
  // actually run and settle before asserting on it.
  await page.waitForTimeout(2000)

  // (a) The browser's CSP genuinely blocked the outbound request — a CSP
  // violation, not a generic network error. Chromium reports this as a
  // `securitypolicyviolation` event / console error naming the directive.
  const cspViolationText = consoleMessages
    .map((m) => m.text())
    .find((t) => /content security policy|connect-src/i.test(t))
  expect(cspViolationText, `console messages were: ${consoleMessages.map((m) => `[${m.type()}] ${m.text()}`).join('\n')}`).toBeDefined()
  expect(cspViolationText).toMatch(/connect-src/i)

  // (b) No unhandled exception, no crash, no hang — the provider contract's
  // "never throw" promise held under this exact failure.
  expect(pageErrors).toEqual([])

  // The request itself never left the browser to reach a non-local host —
  // "blocked by CSP", not "reached the network and failed".
  const offsiteFailures = requestFailures.filter(
    (f) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(f),
  )
  for (const failure of offsiteFailures) expect(failure).toMatch(/csp|blocked/i)

  // (c) The live-price section still simply does not render — not an error
  // state, not a placeholder, nothing in the DOM (same contract as the no-key
  // path).
  await expect(page.locator('.plan-section--liveprice')).toHaveCount(0)
  await expect(page.locator('#plan-liveprice')).toHaveCount(0)

  await page.close()
})
