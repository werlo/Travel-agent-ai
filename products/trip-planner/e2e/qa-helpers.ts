import { expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test'

/**
 * Shared helpers for the QA verification suite (docs/04-qa-report.md).
 *
 * These are deliberately written against what a user can see — visible labels,
 * headings, roles — rather than test ids or internal state.
 */

export const REFERENCE_SUMMARY = '5 nights · 2 travellers · from Bengaluru · ₹60,000'
export const SNAPSHOT_DATE = '2026-08-01'

export interface Basics {
  start?: string
  end?: string
  budget?: string
  travellers?: string
  origin?: string
}

export function watchConsole(page: Page): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
    if (msg.type() === 'warning') warnings.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return { errors, warnings }
}

/** A cold load with no saved session. */
export async function startFresh(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
  ).toBeVisible()
}

export async function pickVibe(page: Page, vibe = 'Beach'): Promise<void> {
  await page.getByRole('button', { name: vibe, exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
}

export async function fillBasics(page: Page, basics: Basics = {}): Promise<void> {
  await page.getByLabel('Start date').fill(basics.start ?? '2026-10-10')
  await page.getByLabel('End date').fill(basics.end ?? '2026-10-15')
  await page.getByLabel('Total budget for the whole party').fill(basics.budget ?? '60000')
  await page.getByLabel('Travellers').fill(basics.travellers ?? '2')
  await page.getByLabel('Flying from').selectOption(basics.origin ?? 'Bengaluru')
}

/** Cold load → vibe → basics filled → first adaptive question on screen. */
export async function toQuestions(
  page: Page,
  vibe = 'Beach',
  basics: Basics = {},
): Promise<void> {
  await startFresh(page)
  await pickVibe(page, vibe)
  await fillBasics(page, basics)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
}

/**
 * Click an answer option and wait for the screen to actually move on.
 *
 * The question screen holds the selection for one beat before advancing, so a test
 * that reads the heading straight after the click reads the *old* question.
 */
export async function answer(page: Page, label: string | RegExp): Promise<void> {
  const name = typeof label === 'string' ? new RegExp(`^${escapeRe(label)}`) : label
  const before = await screenSignature(page)
  await page.getByRole('button', { name }).first().click()
  await expect.poll(() => screenSignature(page), { timeout: 5000 }).not.toBe(before)
}

async function screenSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    if (document.querySelector('.plan-hero__title') !== null) return 'PLAN'
    if (document.querySelector('.generating') !== null) return 'GENERATING'
    const progress = document.querySelector('.progress__text')?.textContent ?? ''
    const h1 = document.querySelector('h1')?.textContent ?? ''
    return `${progress}|${h1}`
  })
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function waitForPlan(page: Page): Promise<void> {
  await expect(page.locator('.plan-hero__title')).toBeVisible({ timeout: 10_000 })
}

/** Full run to a rendered plan. */
export async function planFor(
  page: Page,
  vibe: string,
  answers: string[],
  basics: Basics = {},
): Promise<void> {
  await toQuestions(page, vibe, basics)
  for (const a of answers) await answer(page, a)
  await waitForPlan(page)
}

/** Run to a plan by skipping every remaining question from question 1. */
export async function planBySkipping(
  page: Page,
  vibe: string,
  basics: Basics = {},
): Promise<void> {
  await toQuestions(page, vibe, basics)
  await page.getByRole('button', { name: 'Plan my trip now' }).click()
  await waitForPlan(page)
}

export function rupees(text: string): number {
  const m = text.match(/₹\s?([\d,]+)/)
  if (m === null) throw new Error(`no rupee figure in ${JSON.stringify(text)}`)
  return Number(m[1]!.replace(/,/g, ''))
}

export async function planTotal(page: Page): Promise<number> {
  return rupees(await page.locator('.plan-hero__total').innerText())
}

export async function perPerson(page: Page): Promise<number> {
  return rupees(await page.locator('.plan-hero__perperson').innerText())
}

export async function planId(page: Page): Promise<string> {
  return (await page.locator('.plan-hero__id').innerText()).trim()
}

export async function destination(page: Page): Promise<string> {
  return (await page.locator('.plan-hero__title').innerText()).trim()
}

export async function budgetLine(page: Page): Promise<string> {
  return (await page.locator('.plan-hero .badge').first().innerText()).trim()
}

/** The four cost line items, keyed by their visible row label. */
export async function costRows(page: Page): Promise<Record<string, number>> {
  const rows = page.locator('.plan-section--cost tbody tr')
  const out: Record<string, number> = {}
  const n = await rows.count()
  for (let i = 0; i < n; i += 1) {
    const row = rows.nth(i)
    const label = (await row.locator('th').innerText()).split('\n')[0]!.trim()
    const amount = (await row.locator('td').last().innerText()).trim()
    if (/₹/.test(amount)) out[label] = rupees(amount)
  }
  return out
}

/**
 * Every accessible name in the document, for the R16 / UX3 sweep.
 * Uses the browser's own accessibility tree, not a DOM text scrape.
 */
export async function accessibleNames(page: Page): Promise<string[]> {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false })
  const names: string[] = []
  const walk = (node: { name?: string; children?: unknown[] } | null): void => {
    if (node === null) return
    if (typeof node.name === 'string' && node.name.trim() !== '') names.push(node.name.trim())
    for (const child of node.children ?? []) walk(child as { name?: string; children?: unknown[] })
  }
  walk(snapshot as { name?: string; children?: unknown[] } | null)
  return names
}

export const FORBIDDEN_NAMES = /^(book|booking|pay|checkout|reserve)$/i

export async function assertNothingTransactional(page: Page): Promise<void> {
  const names = await accessibleNames(page)
  expect(names.filter((n) => FORBIDDEN_NAMES.test(n))).toEqual([])
}

export async function assertProvenance(page: Page): Promise<void> {
  const line = page.locator('.provenance')
  await expect(line).toBeVisible()
  const text = await line.innerText()
  expect(text).toContain('indicative')
  expect(text).toContain(SNAPSHOT_DATE)
  // Non-dismissable: nothing inside it can close it.
  expect(await line.locator('button, [role="button"], a').count()).toBe(0)
}

export async function boxOf(locator: Locator): Promise<{ w: number; h: number; bottom: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('element has no box')
  return { w: box.width, h: box.height, bottom: box.y + box.height }
}

export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}
