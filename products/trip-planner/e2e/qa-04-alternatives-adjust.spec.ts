import { expect, test, type Page } from '@playwright/test'
import {
  budgetLine,
  costRows,
  destination,
  perPerson,
  planBySkipping,
  planFor,
  planId,
  planTotal,
  rupees,
} from './qa-helpers'

/** QA verification suite — R10, R11, R12 and UX14, UX15, UX16, UX17. */

test.use({ viewport: { width: 1280, height: 800 } })

const BEACH_INDIA = ['Within India', 'West coast', 'Empty', 'Local stays']

async function altCard(page: Page, variant: string) {
  return page.locator(`[data-alt="${variant}"]`)
}

test.describe('R10 / UX14 — why this trip', () => {
  // UX14's "collapsed on first render" was overturned by R19 in refinement round
  // 1: an accordion is where honesty goes to be ignored, so it opens by default.
  test('R19 (supersedes UX14): the section is expanded on first render', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const disclosure = page.locator('.why__summary')
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Because you said')).toBeVisible()
  })

  test('R10+UX14: expanding shows ≥3 reasons quoting the user, and a numbered rejection', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await expect(page.locator('.why__summary')).toHaveAttribute('aria-expanded', 'true')

    const reasons = await page.locator('[data-why="reasons"] li').allInnerTexts()
    expect(reasons.length, 'at least three reasons').toBeGreaterThanOrEqual(3)

    // Each reason must quote one of the user's own answers.
    const ownAnswers = [
      'beach',
      'within india',
      'west coast',
      'empty',
      'local stays',
      '60,000',
      'oct',
      '5 nights',
      '2 travellers',
      'bengaluru',
    ]
    for (const reason of reasons) {
      const lower = reason.toLowerCase()
      expect(
        ownAnswers.some((a) => lower.includes(a)),
        `reason must quote one of the user's answers: ${JSON.stringify(reason)}`,
      ).toBe(true)
    }

    const rejected = await page.locator('[data-why="rejected"] li').allInnerTexts()
    expect(rejected.length, 'at least one rejected destination').toBeGreaterThanOrEqual(1)
    expect(
      rejected.some((line) => /\d/.test(line)),
      'at least one rejection must carry a number',
    ).toBe(true)
    // The rejection names a destination — a leading proper noun before a dash.
    expect(rejected.some((line) => /^[^—-]+[—-]/.test(line.trim()))).toBe(true)
  })
})

test.describe('R11 / UX15 / UX16 — alternatives', () => {
  test('R11+UX15: a Saver is at least 10% below and a Stretch within budget × 1.25', async ({
    page,
  }) => {
    // Round 3 (F2): the R25 vibe-affinity floor removed Manali & Solang as a
    // Saver candidate for Mountains-skip, so that answer set no longer has a
    // Saver card (see R11+UX15 'single empty slot' below). Honeymoon-skip still
    // clears the floor with both cards present, so it is used here instead.
    await planBySkipping(page, 'Honeymoon')
    const recommended = await planTotal(page)

    const saver = await altCard(page, 'saver')
    const stretch = await altCard(page, 'stretch')
    await expect(saver).toBeVisible()
    await expect(stretch).toBeVisible()

    const saverTotal = rupees(await saver.locator('.altcard__total').innerText())
    expect(saverTotal, 'the Saver must be at least 10% below the recommendation').toBeLessThanOrEqual(
      Math.floor(recommended * 0.9),
    )
    await expect(saver.locator('.altcard__name')).not.toBeEmpty()
    await expect(saver.locator('.altcard__delta')).not.toBeEmpty()
    await expect(saver.getByRole('button', { name: 'Use this plan' })).toBeVisible()

    const stretchTotal = rupees(await stretch.locator('.altcard__total').innerText())
    expect(stretchTotal).toBeGreaterThan(recommended)
    expect(stretchTotal, 'the Stretch must stay inside budget × 1.25').toBeLessThanOrEqual(75000)
    await expect(stretch.getByRole('button', { name: 'Use this plan' })).toBeVisible()
  })

  test('R11+UX15: a single empty slot carries the literal sentence, never an empty box', async ({
    page,
  }) => {
    // Beach over this 7-night window has a Saver but no Stretch: exactly one
    // absent slot. (Fix round F1 capped `in-varkala`'s maxNights from 14 to 5 —
    // R7/D3, its base towns only reach 6 experiences each — so the Christmas
    // window this test used to reach for is now a *both*-absent case instead;
    // see the R22 test below for that one.)
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '17/10/2026' })
    const stretch = await altCard(page, 'stretch-absent')
    await expect(stretch).toBeVisible()
    await expect(stretch).toContainText(
      'No pricier option that still stays inside your stretch band',
    )
    expect((await stretch.innerText()).trim().length).toBeGreaterThan(0)
  })

  // R22 (refine round 1) supersedes UX15 for the both-absent case: two dashed boxes
  // that do nothing are replaced by the one control that does.
  test('R22 (supersedes UX15): with neither alternative, one reject control fills the space', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await expect(page.locator('[data-alt="saver"], [data-alt="stretch"]')).toHaveCount(0)
    await expect(page.locator('[data-alt="saver-absent"], [data-alt="stretch-absent"]')).toHaveCount(
      0,
    )
    await expect(page.locator('.altcard')).toHaveCount(1)
    await expect(page.locator('[data-alt="reject"]')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Not this one — somewhere else' }),
    ).toBeVisible()
  })

  test('R11+UX16: Use this plan on the Saver moves destination, total, cost lines, budget line and plan ID together', async ({
    page,
  }) => {
    // Round 3 (F2): the R25 vibe-affinity floor removed Manali & Solang as a
    // Saver candidate for Mountains-skip, so that answer set no longer has a
    // Saver card (see R11+UX15 'single empty slot' below). Honeymoon-skip still
    // clears the floor with both cards present, so it is used here instead.
    await planBySkipping(page, 'Honeymoon')
    const before = {
      destination: await destination(page),
      total: await planTotal(page),
      id: await planId(page),
      budget: await budgetLine(page),
      cost: await costRows(page),
    }
    const saver = await altCard(page, 'saver')
    const saverName = (await saver.locator('.altcard__name').innerText()).trim()
    const saverTotal = rupees(await saver.locator('.altcard__total').innerText())

    await saver.getByRole('button', { name: 'Use this plan' }).click()
    await expect(page.locator('.plan-hero__title')).toHaveText(saverName)

    expect(await planTotal(page)).toBe(saverTotal)
    expect(await planId(page)).not.toBe(before.id)
    expect(await budgetLine(page)).not.toBe(before.budget)
    const after = await costRows(page)
    expect(after.Travel !== before.cost.Travel || after.Stay !== before.cost.Stay).toBe(true)

    // The change is announced.
    const announcements = await page.locator('[role="status"]').allInnerTexts()
    expect(
      announcements.some((t) => t.trim().startsWith('Plan updated.')),
      `expected a "Plan updated." announcement, saw ${JSON.stringify(announcements)}`,
    ).toBe(true)

    // The previous recommendation is now a card that switches back.
    const rec = await altCard(page, 'recommended')
    await expect(rec).toBeVisible()
    await expect(rec.locator('.altcard__name')).toHaveText(before.destination)
    await rec.getByRole('button', { name: 'Use this plan' }).click()
    await expect(page.locator('.plan-hero__title')).toHaveText(before.destination)
    expect(await planTotal(page)).toBe(before.total)
    expect(await planId(page)).toBe(before.id)
  })

  test('R11: the itinerary itself changes with the variant, not just the numbers', async ({
    page,
  }) => {
    // Round 3 (F2): the R25 vibe-affinity floor removed Manali & Solang as a
    // Saver candidate for Mountains-skip, so that answer set no longer has a
    // Saver card (see R11+UX15 'single empty slot' below). Honeymoon-skip still
    // clears the floor with both cards present, so it is used here instead.
    await planBySkipping(page, 'Honeymoon')
    const daysBefore = await page.locator('.plan-section--days').innerText()
    const saver = await altCard(page, 'saver')
    await saver.getByRole('button', { name: 'Use this plan' }).click()
    await expect(page.locator('.plan-hero__title')).not.toHaveText('')
    const daysAfter = await page.locator('.plan-section--days').innerText()
    expect(daysAfter).not.toBe(daysBefore)
    await expect(page.locator('.dayblock')).toHaveCount(6)
  })
})

test.describe('R12 / UX17 — adjust and re-plan on the plan screen', () => {
  test('UX17: Update plan is disabled until a value actually differs', async ({ page }) => {
    await planBySkipping(page, 'Beach')
    const apply = page.getByRole('button', { name: 'Update plan' })
    await expect(apply).toBeDisabled()
    await expect(page.getByText('Nothing has changed yet.')).toBeVisible()

    await page.getByLabel('Adults', { exact: true }).fill('4')
    await expect(apply).toBeEnabled()

    await page.getByLabel('Adults', { exact: true }).fill('2')
    await expect(apply).toBeDisabled()
  })

  test('R12+UX17: travellers 2 → 4 re-renders in place with a new total, per-person and plan ID', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const before = {
      total: await planTotal(page),
      perPerson: await perPerson(page),
      id: await planId(page),
      summary: await page.locator('.summary-bar').innerText(),
    }

    await page.getByLabel('Adults', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 adults')

    expect(await planTotal(page)).not.toBe(before.total)
    expect(await perPerson(page)).not.toBe(before.perPerson)
    expect(await planId(page)).not.toBe(before.id)

    // No question screen, no generating screen.
    expect(await page.locator('.progress__text').count()).toBe(0)
    expect(await page.locator('.generating').count()).toBe(0)

    // The summary bar keeps the departure city and updates the traveller count.
    const summaryAfter = await page.locator('.summary-bar').innerText()
    expect(summaryAfter).toContain('from Bengaluru')
    expect(summaryAfter).toContain('4 travellers')
    expect(before.summary).toContain('2 travellers')

    // Per-person arithmetic still holds for the new party size.
    expect(await perPerson(page)).toBe(Math.round((await planTotal(page)) / 4 / 100) * 100)
  })

  test('R12: adjusting the budget re-prices without re-asking anything', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const before = await planId(page)
    await page.getByLabel('Total budget', { exact: true }).fill('120000')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect.poll(() => planId(page)).not.toBe(before)
    expect(await page.locator('.progress__text').count()).toBe(0)
    await expect(page.locator('.dayblock')).toHaveCount(6)
  })

  test('R12: an invalid adjustment leaves the plan untouched and errors inline', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const before = { id: await planId(page), total: await planTotal(page) }

    await page.getByLabel('Adults', { exact: true }).fill('13')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.getByText('Travellers must be between 1 and 12').first()).toBeVisible()
    expect(await planId(page)).toBe(before.id)
    expect(await planTotal(page)).toBe(before.total)
  })

  test('R12: double-clicking Update plan applies once', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.getByLabel('Adults', { exact: true }).fill('4')
    await page
      .getByRole('button', { name: 'Update plan' })
      .click({ clickCount: 2, delay: 10 })
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 adults')
    await expect(page.locator('.plan-hero__title')).toHaveCount(1)
    await expect(page.getByLabel('Adults', { exact: true })).toHaveValue('4')
  })
})

test.describe('R5 — returning to the defaulted questions', () => {
  test('R5: "Answer them" takes the user back into the questionnaire without losing the basics', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    await expect(page.getByText('3 questions answered for you')).toBeVisible()
    await page.getByRole('button', { name: 'Answer them' }).click()

    await expect(page.locator('.progress__text')).toHaveText(/^Question \d of \d$/)
    await expect(page.locator('.summary-bar')).toContainText('from Bengaluru')
    await expect(page.locator('.summary-bar')).toContainText('₹60,000')

    // Answering through returns a plan with nothing defaulted.
    for (let i = 0; i < 5; i += 1) {
      if ((await page.locator('.progress__text').count()) === 0) break
      await page.getByRole('button', { name: /^No preference/ }).click()
      await page.waitForTimeout(350)
    }
    await expect(page.locator('.plan-hero__title')).toBeVisible({ timeout: 10_000 })
  })
})
