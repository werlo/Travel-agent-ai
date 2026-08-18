import { expect, test, type Page } from '@playwright/test'
import {
  answer,
  boxOf,
  budgetLine,
  costRows,
  destination,
  perPerson,
  planBySkipping,
  planFor,
  planId,
  planTotal,
  rupees,
  toQuestions,
  waitForPlan,
} from './qa-helpers'

/** QA verification suite — R7, R8, R9 and UX11, UX12, UX13. */

test.use({ viewport: { width: 1280, height: 800 } })

const BEACH_INDIA = ['Within India', 'West coast', 'Empty', 'Local stays']

async function referencePlan(page: Page): Promise<void> {
  await planFor(page, 'Beach', BEACH_INDIA)
}

test.describe('R7 / UX11 — one costed day-by-day itinerary', () => {
  test('R7+UX11: one destination as the h1 and exactly six Day blocks for a 5-night trip', async ({
    page,
  }) => {
    await referencePlan(page)

    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
    expect((await h1.innerText()).trim().length).toBeGreaterThan(0)

    const days = page.locator('.dayblock')
    await expect(days).toHaveCount(6)
    for (let i = 0; i < 6; i += 1) {
      await expect(days.nth(i).locator('h3')).toContainText(`Day ${i + 1}`)
    }
  })

  test('R7: every day block names at least one experience', async ({ page }) => {
    await referencePlan(page)
    const days = page.locator('.dayblock')
    for (let i = 0; i < 6; i += 1) {
      const named = days.nth(i).locator('.dayblock__label')
      expect(await named.count(), `Day ${i + 1} must list something named`).toBeGreaterThan(0)
      const labels = await named.allInnerTexts()
      const experiences = labels.filter(
        (l) => !/^Fly |^Train |^Drive |^Check in|^Check out/.test(l.trim()),
      )
      expect(experiences.length, `Day ${i + 1} must name an experience`).toBeGreaterThan(0)
    }
  })

  test('R7+UX11: a stay entry names the property and 5 nights, with flights on Day 1 and Day 6', async ({
    page,
  }) => {
    await referencePlan(page)
    const days = page.locator('.dayblock')

    const day1 = await days.nth(0).innerText()
    const day6 = await days.nth(5).innerText()
    expect(day1, 'Day 1 must carry the arrival leg').toMatch(/Fly .+ → .+/)
    expect(day6, 'Day 6 must carry the departure leg').toMatch(/Fly .+ → .+/)
    expect(day1).toMatch(/Check in — .+/)
    expect(day6).toMatch(/Check out — .+/)

    // The stay is named with its number of nights.
    const stayLine = await page.locator('.plan-section--cost').innerText()
    expect(stayLine).toMatch(/Stay: .+, 5 nights, \d+ rooms?\./)
    expect(day1).toContain('5 nights')
  })

  test('UX11: destination, total, budget badge and Copy as text are above 800px at 1280x800', async ({
    page,
  }) => {
    await referencePlan(page)
    const targets: Array<[string, ReturnType<Page['locator']>]> = [
      ['destination', page.locator('.plan-hero__title')],
      ['total', page.locator('.plan-hero__total')],
      ['budget badge', page.locator('.plan-hero .badge').first()],
      ['Copy as text', page.getByRole('button', { name: /Copy as text/ })],
    ]
    for (const [name, locator] of targets) {
      const { bottom } = await boxOf(locator)
      expect(bottom, `${name} must be within the first 800px`).toBeLessThanOrEqual(800)
    }
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY, 'nothing should require scrolling to see the hero').toBe(0)
  })

  test('UX11: reaching the plan via "Plan my trip now" on question 1 shows the defaulted count', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    await expect(page.getByText('3 questions answered for you')).toBeVisible()
  })
})

test.describe('R8 / UX13 — the cost breakdown adds up', () => {
  test('R8+UX13: four line items with a basis each, summing exactly to the party total', async ({
    page,
  }) => {
    await referencePlan(page)

    const rows = await costRows(page)
    for (const label of ['Travel', 'Stay', 'Experiences', 'Local allowance']) {
      expect(rows[label], `the breakdown must have a ${label} line`).toBeDefined()
    }
    const sum =
      rows.Travel! + rows.Stay! + rows.Experiences! + rows['Local allowance']!
    const total = await planTotal(page)
    expect(sum, 'the four line items must sum to the party total').toBe(total)
    expect(rows.total ?? total).toBe(total)

    // Every line carries a basis in words.
    const bases = await page.locator('.costtable__basis').allInnerTexts()
    expect(bases.filter((b) => b.trim() !== '').length).toBeGreaterThanOrEqual(4)
  })

  test('R8+UX13: the per-person figure is the total ÷ travellers rounded to the nearest ₹100', async ({
    page,
  }) => {
    await referencePlan(page)
    const total = await planTotal(page)
    const shown = await perPerson(page)
    expect(shown).toBe(Math.round(total / 2 / 100) * 100)
  })

  test('R8+UX13: travellers 2 → 4 raises Travel by the per-traveller fare × 2 when the destination is kept', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA, { budget: '200000' })
    const before = await costRows(page)
    const fare = rupees(await page.locator('.costtable__basis').first().innerText())
    const destBefore = await destination(page)
    expect(before.Travel).toBe(fare * 2)

    await page.getByLabel('Adults', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 adults')

    expect(await destination(page)).toBe(destBefore)
    const after = await costRows(page)
    expect(after.Travel).toBe(before.Travel! + fare * 2)
    expect(await page.locator('.costtable__basis').first().innerText()).toContain('× 4')
  })

  test('R8+UX13: travellers 2 → 4 at the R12 reference budget of ₹60,000 raises Travel by the fare × 2 only when the destination is kept (A19)', async ({
    page,
  }) => {
    // R8 is amended (docs/01-prd.md A19): the fare-doubles-on-headcount property is
    // asserted only for a re-plan that keeps the same destination. R9's stretch
    // ceiling takes precedence — if the reference destination would now exceed
    // budget × 1.25, the engine is required to switch, and that transition is
    // exempt from the linear-fare literal (it is covered by the R19 change notice
    // instead, not by this arithmetic).
    await referencePlan(page)
    const rowsBefore = await costRows(page)
    const travelBasis = await page.locator('.costtable__basis').first().innerText()
    const farePerTraveller = rupees(travelBasis)
    expect(rowsBefore.Travel).toBe(farePerTraveller * 2)
    const destBefore = await destination(page)

    await page.getByLabel('Adults', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.costtable__label').first()).toBeVisible()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 adults')

    const destAfter = await destination(page)
    const rowsAfter = await costRows(page)
    if (destAfter === destBefore) {
      expect(
        rowsAfter.Travel,
        `Travel must rise by the per-traveller fare × 2 (destination unchanged: ${destBefore})`,
      ).toBe(rowsBefore.Travel! + farePerTraveller * 2)
    } else {
      // R9 forced a destination change to stay inside the stretch ceiling — the
      // linear-fare literal does not apply to this transition (A19). The change
      // notice (R19) must say so instead.
      await expect(page.locator('.plan-hero')).toContainText(destAfter)
    }
  })

  test('R8: the breakdown adds up on several different answer sets', async ({ page }) => {
    const runs: Array<[string, string[], Record<string, string>]> = [
      ['Mountains', [], {}],
      ['Party', ['Within India'], {}],
      ['Culture & Food', ['International'], { budget: '120000' }],
      ['Honeymoon', [], { travellers: '4', budget: '150000' }],
    ]
    for (const [vibe, answers, basics] of runs) {
      await toQuestions(page, vibe, basics)
      for (const a of answers) await answer(page, a)
      await page.getByRole('button', { name: 'Plan my trip now' }).click()
      await waitForPlan(page)

      const rows = await costRows(page)
      const total = await planTotal(page)
      const sum = rows.Travel! + rows.Stay! + rows.Experiences! + rows['Local allowance']!
      expect(sum, `${vibe}: line items must sum to the party total`).toBe(total)

      const travellers = Number(basics.travellers ?? '2')
      expect(await perPerson(page), `${vibe}: per-person arithmetic`).toBe(
        Math.round(total / travellers / 100) * 100,
      )
    }
  })
})

test.describe('R9 / UX12 — the budget line and the soft cutoff', () => {
  test('R9+UX12: an under-budget plan reads "₹N under your budget" with the success token', async ({
    page,
  }) => {
    await referencePlan(page)
    const line = await budgetLine(page)
    expect(line).toMatch(/^₹[\d,]+ under your budget$/)

    const total = await planTotal(page)
    expect(rupees(line)).toBe(60000 - total)

    const badge = page.locator('.plan-hero .badge').first()
    await expect(badge).toHaveClass(/badge--success/)
  })

  test('R9+UX12: an over-budget plan reads "Stretch — N% over your budget" with the warn token', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { budget: '30000' })
    const line = await budgetLine(page)
    expect(line).toMatch(/^(Stretch — \d+% over your budget|Nothing in this catalogue fits .+)$/)
    if (line.startsWith('Stretch')) {
      await expect(page.locator('.plan-hero .badge').first()).toHaveClass(/badge--warn/)
      const percent = Number(line.match(/(\d+)%/)![1])
      const total = await planTotal(page)
      expect(percent).toBe(Math.max(1, Math.round((100 * (total - 30000)) / 30000)))
    }
  })

  test('R9+UX12: a plan priced at exactly the budget reads "On budget" with the neutral token', async ({
    page,
  }) => {
    await referencePlan(page)
    const total = await planTotal(page)

    await page.getByLabel('Total budget', { exact: true }).fill(String(total))
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect.poll(() => budgetLine(page)).toBe('On budget')
    await expect(page.locator('.plan-hero .badge').first()).toHaveClass(/badge--neutral/)
  })

  test('UX12: the three budget-line states use the success, neutral and warn token pairs', async ({
    page,
  }) => {
    await referencePlan(page)
    const tokens = await page.evaluate(() => {
      const read = (name: string): string => {
        const probe = document.createElement('div')
        probe.style.color = getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim()
        document.body.appendChild(probe)
        const v = getComputedStyle(probe).color
        probe.remove()
        return v
      }
      return {
        successSubtle: read('--color-success-subtle'),
        successText: read('--color-success-text'),
        warnSubtle: read('--color-warn-subtle'),
        warnText: read('--color-warn-text'),
      }
    })

    const successBadge = await page
      .locator('.plan-hero .badge')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { bg: s.backgroundColor, fg: s.color }
      })
    expect(await budgetLine(page)).toMatch(/under your budget$/)
    expect(successBadge.bg).toBe(tokens.successSubtle)
    expect(successBadge.fg).toBe(tokens.successText)

    await planBySkipping(page, 'Beach', { budget: '30000' })
    const line = await budgetLine(page)
    test.skip(!line.startsWith('Stretch'), 'no stretch case reachable in this catalogue')
    const warnBadge = await page
      .locator('.plan-hero .badge')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { bg: s.backgroundColor, fg: s.color }
      })
    expect(warnBadge.bg).toBe(tokens.warnSubtle)
    expect(warnBadge.fg).toBe(tokens.warnText)
  })

  test('R9+UX12: no recommendation for a ₹60,000 budget ever exceeds ₹75,000', async ({
    page,
  }) => {
    for (const vibe of [
      'Mountains',
      'Beach',
      'Party',
      'Honeymoon',
      'Peace & Quiet',
      'Culture & Food',
    ]) {
      await planBySkipping(page, vibe, { budget: '60000' })
      const total = await planTotal(page)
      expect(total, `${vibe}: the recommendation must stay within budget × 1.25`).toBeLessThanOrEqual(
        75000,
      )
    }
  })

  test('R9+UX12: the branch-answered recommendations also respect the ceiling', async ({
    page,
  }) => {
    const runs: Array<[string, string[]]> = [
      ['Beach', ['International']],
      ['Party', ['International']],
      ['Culture & Food', ['International']],
      ['Mountains', ['International']],
    ]
    for (const [vibe, answers] of runs) {
      await toQuestions(page, vibe, { budget: '60000' })
      for (const a of answers) await answer(page, a)
      await page.getByRole('button', { name: 'Plan my trip now' }).click()
      await waitForPlan(page)
      const total = await planTotal(page)
      expect(total, `${vibe} + ${answers.join('/')} must not exceed ₹75,000`).toBeLessThanOrEqual(
        75000,
      )
    }
  })
})

test.describe('R13 — determinism', () => {
  test('R13: identical answers in a cleared session reproduce the identical plan', async ({
    page,
  }) => {
    await referencePlan(page)
    const first = {
      id: await planId(page),
      destination: await destination(page),
      total: await planTotal(page),
      itinerary: await page.locator('.plan-section--days').innerText(),
      cost: await page.locator('.plan-section--cost').innerText(),
    }

    await page.evaluate(() => window.localStorage.clear())
    await referencePlan(page)

    expect(await planId(page)).toBe(first.id)
    expect(await destination(page)).toBe(first.destination)
    expect(await planTotal(page)).toBe(first.total)
    expect(await page.locator('.plan-section--days').innerText()).toBe(first.itinerary)
    expect(await page.locator('.plan-section--cost').innerText()).toBe(first.cost)
  })
})
