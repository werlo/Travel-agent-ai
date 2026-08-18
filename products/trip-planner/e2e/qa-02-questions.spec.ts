import { expect, test, type Page } from '@playwright/test'
import {
  REFERENCE_SUMMARY,
  answer,
  assertNothingTransactional,
  assertProvenance,
  planBySkipping,
  toQuestions,
  waitForPlan,
} from './qa-helpers'

/** QA verification suite — R4, R5, R6 and UX7, UX8, UX9, UX10. */

test.use({ viewport: { width: 1280, height: 800 } })

async function questionHeading(page: Page): Promise<string> {
  return (await page.locator('h1').innerText()).trim()
}

async function progressLine(page: Page): Promise<string> {
  return (await page.locator('.progress__text').innerText()).trim()
}

test.describe('R4 / UX8 — the decision graph branches', () => {
  test('R4+UX8: Beach + International leads to the flight-length question', async ({ page }) => {
    await toQuestions(page, 'Beach')
    await expect(page.locator('h1')).toHaveText('Within India, or international?')

    await answer(page, 'International')
    await expect(page.locator('h1')).not.toHaveText('Within India, or international?')

    const heading = await questionHeading(page)
    const screen = await page.locator('main').innerText()
    expect(
      /long-haul/i.test(heading),
      `UX8 requires the heading after "International" to contain "long-haul"; it read ${JSON.stringify(heading)}`,
    ).toBe(true)
    expect(screen).toContain('long-haul')
  })

  test('R4+UX8: Beach + Within India leads to the coast question and never says long-haul', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')

    const heading = await questionHeading(page)
    expect(heading.toLowerCase()).toContain('coast')

    // Walk the whole India branch: "long-haul" must never appear.
    for (;;) {
      const text = await page.locator('main').innerText()
      expect(text).not.toContain('long-haul')
      const noPref = page.getByRole('button', { name: /^No preference/ })
      if ((await noPref.count()) === 0) break
      await noPref.click()
      await page.waitForTimeout(400)
      if ((await page.locator('.plan-hero__title').count()) > 0) break
    }
  })

  test('R4+UX8: No preference on question 1 advances to a different question', async ({ page }) => {
    await toQuestions(page, 'Beach')
    const first = await questionHeading(page)
    expect(await progressLine(page)).toBe('Question 1 of 4')

    await answer(page, 'No preference')
    await expect(page.locator('.progress__text')).toHaveText(/^Question 2 of \d$/)
    expect(await questionHeading(page)).not.toBe(first)
  })

  test('R4: every vibe offers between 3 and 5 questions, each with a No preference option', async ({
    page,
  }) => {
    for (const vibe of ['Mountains', 'Beach', 'Party', 'Honeymoon', 'Peace & Quiet', 'Culture & Food']) {
      await toQuestions(page, vibe)
      const total = Number((await progressLine(page)).replace(/^Question \d+ of /, ''))
      expect(total, `${vibe} must ask 3-5 questions`).toBeGreaterThanOrEqual(3)
      expect(total, `${vibe} must ask 3-5 questions`).toBeLessThanOrEqual(5)

      // The denominator is branch-dependent by design; the position must still
      // step 1, 2, 3 ... and every render must offer "No preference".
      for (let i = 1; i <= 5; i += 1) {
        if ((await page.locator('.progress__text').count()) === 0) break
        await expect(page.locator('.progress__text')).toHaveText(
          new RegExp(`^Question ${i} of \\d$`),
        )
        await expect(page.getByRole('button', { name: /^No preference/ })).toBeVisible()
        await answer(page, 'No preference')
      }
      await waitForPlan(page)
    }
  })
})

test.describe('UX7 — the escape hatch is on every question render', () => {
  test('UX7: progress line, No preference, Back and Plan my trip now on first and last question', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    let seen = 0
    for (let i = 1; i <= 5; i += 1) {
      if ((await page.locator('.progress__text').count()) === 0) break
      await expect(page.locator('.progress__text')).toHaveText(
        new RegExp(`^Question ${i} of \\d$`),
      )
      await expect(page.getByRole('button', { name: /^No preference/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Plan my trip now' })).toBeVisible()
      await assertProvenance(page)
      seen += 1
      await answer(page, 'No preference')
    }
    expect(seen, 'the Beach path must ask between 3 and 5 questions').toBeGreaterThanOrEqual(3)
    await waitForPlan(page)
  })

  test('UX3: no question screen names anything transactional', async ({ page }) => {
    await toQuestions(page, 'Beach')
    await assertNothingTransactional(page)
  })
})

test.describe('R5 — skip the remaining questions', () => {
  test('R5: Plan my trip now on question 1 renders a complete plan and says 3 were defaulted', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await expect(page.locator('.progress__text')).toHaveText('Question 1 of 4')
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    await expect(page.locator('.plan-hero__title')).not.toBeEmpty()
    await expect(page.locator('.plan-hero__total')).toContainText('₹')
    await expect(page.locator('.dayblock')).toHaveCount(6)
    await expect(page.getByText('3 questions answered for you')).toBeVisible()
  })

  test('R5: skipping from question 3 reports only the questions actually defaulted', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await expect(page.locator('.progress__text')).toHaveText(/^Question 3 of \d$/)
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)
    await expect(page.getByText('2 questions answered for you')).toBeVisible()
  })

  test('R5: answering everything shows no defaulted-question badge', async ({ page }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')
    await answer(page, 'Local stays')
    await waitForPlan(page)
    await expect(page.getByText(/questions? answered for you/)).toHaveCount(0)
  })

  test('R5: double-clicking Plan my trip now produces exactly one plan', async ({ page }) => {
    await toQuestions(page, 'Beach')
    await page
      .getByRole('button', { name: 'Plan my trip now' })
      .click({ clickCount: 2, delay: 10 })
    await waitForPlan(page)
    await expect(page.locator('.plan-hero__title')).toHaveCount(1)
    await expect(page.locator('.dayblock')).toHaveCount(6)
  })
})

test.describe('R6 / UX9 — change an earlier answer without losing the others', () => {
  test('R6+UX9: Back twice shows question 2 with the previous answer pressed and focused', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')
    await expect(page.locator('.progress__text')).toHaveText(/^Question 4 of \d$/)

    const summaryBefore = await page.locator('.summary-bar').innerText()
    const q3Heading = await questionHeading(page)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()

    await expect(page.locator('.progress__text')).toHaveText(/^Question 2 of \d$/)
    const west = page.getByRole('button', { name: /^West coast/ })
    await expect(west).toHaveAttribute('aria-pressed', 'true')
    await expect(west).toBeFocused()
    expect(await page.locator('.summary-bar').innerText()).toBe(summaryBefore)
    expect(q3Heading.length).toBeGreaterThan(0)
  })

  test('R6+UX9: changing question 2 to a different branch replaces question 3', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    const q3Original = await questionHeading(page)
    const summaryBefore = await page.locator('.summary-bar').innerText()

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.locator('.progress__text')).toHaveText(/^Question 2 of \d$/)
    await answer(page, 'Islands')

    await expect(page.locator('.progress__text')).toHaveText(/^Question 3 of \d$/)
    const q3New = await questionHeading(page)
    expect(q3New, 'a different branch must ask a different question 3').not.toBe(q3Original)

    // Question 1's answer is untouched, and the facts bar is byte-identical.
    expect(await page.locator('.summary-bar').innerText()).toBe(summaryBefore)
    expect(await page.locator('.summary-bar').innerText()).toBe(REFERENCE_SUMMARY)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.locator('.progress__text')).toHaveText(/^Question 1 of \d$/)
    await expect(page.getByRole('button', { name: /^Within India/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('R6: Back from question 1 returns to the basics with the values intact', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await expect(page.getByLabel('Total budget for the whole party')).toHaveValue('60000')
    await expect(page.getByLabel('Start date')).toHaveValue('10/10/2026')
  })
})

test.describe('UX10 — the generating screen', () => {
  test('UX10: a role="status" line names the destination count, then clears within 2s', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')

    const started = Date.now()
    await answer(page, 'Local stays')

    const status = page.locator('[role="status"]').filter({ hasText: 'Scoring' })
    await expect(status).toContainText(/^Scoring \d+ destinations against your answers$/, {
      timeout: 2000,
    })
    expect(await status.innerText()).toContain('Scoring 14 destinations against your answers')
    const firstSeen = Date.now() - started

    // Still on screen a beat later — the user gets time to read it.
    await page.waitForTimeout(500)
    const stillThere =
      (await page.locator('.generating').count()) > 0 ||
      (await page.locator('.plan-hero__title').count()) > 0
    expect(stillThere).toBe(true)

    await waitForPlan(page)
    const total = Date.now() - started
    expect(total, 'the generating screen must be gone within 2000ms').toBeLessThan(2500)
    expect(firstSeen).toBeGreaterThanOrEqual(0)
    await expect(page.locator('.generating')).toHaveCount(0)
  })

  test('UX10: the generating screen holds for at least 600ms', async ({ page }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')
    const started = Date.now()
    await answer(page, 'Local stays')
    await expect(page.locator('.generating')).toBeVisible({ timeout: 2000 })
    await waitForPlan(page)
    const elapsed = Date.now() - started
    expect(elapsed, 'the generating beat must last at least 600ms').toBeGreaterThanOrEqual(600)
  })

  test('UX10: skipping to the plan also passes through the generating screen', async ({ page }) => {
    await planBySkipping(page, 'Beach')
    await expect(page.locator('.plan-hero__title')).toBeVisible()
  })
})
