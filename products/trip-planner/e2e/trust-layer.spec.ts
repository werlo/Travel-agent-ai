import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * Slice 3 E2E — R10, R11 and R14 in a real browser.
 *
 * The three things a judge will actually do on S5 and that the engine cannot prove
 * on its own: open "Why this trip" and find their own answers in it, switch to the
 * Saver and see the whole screen follow, and hit the dead-end case and be told what
 * was changed and what putting it back would cost.
 */

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

interface Trip {
  startDate?: string
  endDate?: string
  budget?: string
  travellers?: string
}

async function planFor(
  page: Page,
  vibe: string,
  answers: string[],
  trip: Trip = {},
): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  await page.getByRole('button', { name: vibe, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()

  await page.getByLabel('Start date').fill(trip.startDate ?? '10/10/2026')
  await page.getByLabel('End date').fill(trip.endDate ?? '15/10/2026')
  await page.getByLabel('Total budget for the whole party').fill(trip.budget ?? '60000')
  await page.getByLabel('Adults', { exact: true }).fill(trip.travellers ?? '2')
  await page.getByLabel('Flying from').selectOption('Bengaluru')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()

  for (const answer of answers) {
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    await page.getByRole('button', { name: new RegExp(answer) }).click()
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(heading ?? '')
  }
  const skip = page.getByRole('button', { name: 'Plan my trip now' })
  if ((await skip.count()) > 0) await skip.click()

  await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 6000 })
}

/** docs/02-architecture.md §9 — the read-only diagnostics handle QA reads. */
async function relaxedKeys(page: Page): Promise<string[] | undefined> {
  return page.evaluate(
    () =>
      (window as unknown as { __compass?: { relaxedKeys?: string[] } }).__compass
        ?.relaxedKeys,
  )
}

async function rupees(page: Page, selector: string): Promise<number> {
  const raw = (await page.locator(selector).textContent()) ?? ''
  return Number(raw.replace(/[^\d]/g, ''))
}

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('R10 — why this trip', () => {
  test('opens to at least three answer-quoting reasons and a numbered rejection', async ({
    page,
  }) => {
    await planFor(page, 'Beach', ['Within India', 'West coast', 'Empty', 'Local stays'])

    const summary = page.getByText('Why this trip')
    // R19 (refine round 1) supersedes the original "collapsed first" rule: the
    // section is expanded on first render, without a click.
    await expect(summary).toHaveAttribute('aria-expanded', 'true')

    const reasons = page.locator('[data-why="reasons"] li')
    await expect(reasons).toHaveCount(7)
    // Every answer the user actually gave is quoted back at them.
    for (const answer of ['Within India', 'West coast', 'Empty', 'Local stays']) {
      await expect(page.locator('[data-why="reasons"]')).toContainText(`You said ${answer}`)
    }
    await expect(page.locator('[data-why="reasons"]')).toContainText('You chose Beach')
    await expect(page.locator('[data-why="reasons"]')).toContainText('Your budget is ₹60,000')

    const rejected = page.locator('[data-why="rejected"] li')
    expect(await rejected.count()).toBeGreaterThanOrEqual(1)
    const lines = await rejected.allTextContents()
    expect(lines.filter((line) => /\d/.test(line)).length).toBe(lines.length)
  })
})

test.describe('R11 — the alternatives', () => {
  test('the Saver is <= 90% of the recommendation and switching moves everything', async ({
    page,
  }) => {
    await planFor(page, 'Beach', [])

    const before = {
      destination: await page.locator('.plan-hero__title').textContent(),
      total: await rupees(page, '[data-cost="total"]'),
      travel: await rupees(page, '[data-cost="travel"]'),
      budgetLine: await page.locator('.plan-hero .badge').first().textContent(),
      planId: await page.locator('.plan-hero__id').textContent(),
      day1: await page.locator('.dayblock').first().textContent(),
    }

    const saver = page.locator('[data-alt="saver"]')
    await expect(saver.getByText('Saver')).toBeVisible()
    const saverTotal = await rupees(page, '[data-alt="saver"] .altcard__total')
    expect(saverTotal).toBeLessThanOrEqual(Math.floor(before.total * 0.9))
    await expect(saver.locator('.altcard__delta')).toHaveText(
      /^₹[\d,]+ less than the recommendation$/,
    )

    await saver.getByRole('button', { name: 'Use this plan' }).click()

    // All four regions, together.
    await expect(page.locator('.plan-hero__title')).not.toHaveText(before.destination ?? '')
    expect(await rupees(page, '[data-cost="total"]')).toBe(saverTotal)
    expect(await rupees(page, '[data-cost="travel"]')).not.toBe(before.travel)
    await expect(page.locator('.plan-hero .badge').first()).not.toHaveText(
      before.budgetLine ?? '',
    )
    await expect(page.locator('.plan-hero__id')).not.toHaveText(before.planId ?? '')
    await expect(page.locator('.dayblock').first()).not.toHaveText(before.day1 ?? '')

    // R8 still holds on the plan we switched to.
    const [travel, stay, experiences, local, total] = await Promise.all([
      rupees(page, '[data-cost="travel"]'),
      rupees(page, '[data-cost="stay"]'),
      rupees(page, '[data-cost="experiences"]'),
      rupees(page, '[data-cost="localAllowance"]'),
      rupees(page, '[data-cost="total"]'),
    ])
    expect(travel + stay + experiences + local).toBe(total)

    // And back again, in one click.
    const recommended = page.locator('[data-alt="recommended"]')
    await expect(recommended.getByText('Recommended')).toBeVisible()
    await recommended.getByRole('button', { name: 'Use this plan' }).click()
    await expect(page.locator('.plan-hero__title')).toHaveText(before.destination ?? '')
    await expect(page.locator('.plan-hero__id')).toHaveText(before.planId ?? '')
  })

  test('an empty slot carries the sentence, never an empty box', async ({ page }) => {
    // R22 replaced the both-absent case with a single working control, so the
    // sentence is now asserted on a plan with exactly one absent slot.
    await planFor(page, 'Beach', [], { startDate: '20/12/2026', endDate: '27/12/2026' })

    const slot = page.locator('[data-alt="stretch-absent"]')
    await expect(slot).toBeVisible()
    await expect(slot).toContainText('No pricier option that still stays inside your stretch band')
    await expect(slot.locator('button')).toHaveCount(0)
  })
})

test.describe('R14 — the relaxation banner', () => {
  const deadEnd: Trip = {
    startDate: '10/10/2026',
    endDate: '12/10/2026',
    budget: '25000',
    travellers: '4',
  }

  test('names what was dropped, prices putting it back, and applies it', async ({ page }) => {
    await planFor(page, 'Party', ['International'], deadEnd)

    const banner = page.locator('.plan-relax')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('We changed one thing to make this work')
    await expect(banner).toContainText(
      'No international party trip fits ₹25,000 for 4 — we searched within India instead.',
    )
    // Not dismissable: the only control puts the constraint back.
    await expect(banner.locator('button')).toHaveCount(1)

    const relaxedTotal = await rupees(page, '[data-cost="total"]')
    const relaxedId = await page.locator('.plan-hero__id').textContent()
    expect(await relaxedKeys(page)).toEqual(['region'])

    await banner.getByRole('button', { name: 'Put international back' }).click()

    await expect(banner).toContainText('With international back in')
    await expect(banner.locator('.banner__body')).toHaveText(
      /^The cheapest international party trip for 4 over these dates is ₹[\d,]+ — ₹[\d,]+ over your budget\.$/,
    )
    const body = (await banner.locator('.banner__body').textContent()) ?? ''
    const quoted = Number((body.match(/is (₹[\d,]+)/)?.[1] ?? '').replace(/[^\d]/g, ''))
    expect(quoted).toBeGreaterThan(relaxedTotal)

    await expect(banner.getByRole('button', { name: /^Keep the ₹[\d,]+ plan$/ })).toBeVisible()
    await banner.getByRole('button', { name: /^Use the ₹[\d,]+ plan$/ }).click()

    // The restored plan is the one the banner quoted, and it is genuinely international.
    expect(await rupees(page, '[data-cost="total"]')).toBe(quoted)
    await expect(page.locator('.plan-hero__id')).not.toHaveText(relaxedId ?? '')
    await expect(page.locator('.plan-relax')).toHaveCount(0)
    await expect(page.locator('.plan-hero__facts')).toContainText('4 travellers')

    // Nothing is relaxed any more, and the diagnostics handle says so (§9).
    expect(await relaxedKeys(page)).toEqual([])
  })

  test('declining the restore leaves the plan and the banner exactly as they were', async ({
    page,
  }) => {
    await planFor(page, 'Party', ['International'], deadEnd)
    const banner = page.locator('.plan-relax')
    const total = await rupees(page, '[data-cost="total"]')

    await banner.getByRole('button', { name: 'Put international back' }).click()
    await banner.getByRole('button', { name: /^Keep the ₹[\d,]+ plan$/ }).click()

    await expect(banner).toContainText('We changed one thing to make this work')
    expect(await rupees(page, '[data-cost="total"]')).toBe(total)
  })
})

test('the whole trust layer logs zero console errors', async ({ page }) => {
  const errors = collectConsoleErrors(page)

  await planFor(page, 'Beach', [])
  await page.getByText('Why this trip').click()
  await page.locator('[data-alt="saver"]').getByRole('button', { name: 'Use this plan' }).click()
  await expect(page.locator('[data-alt="recommended"]')).toBeVisible()
  await page.reload()
  await expect(page.locator('.plan-hero__id')).toBeVisible()

  expect(errors).toEqual([])
})
