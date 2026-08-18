import { expect, test, type Page } from '@playwright/test'
import {
  costRows,
  destination,
  fillBasics,
  pickVibe,
  planBySkipping,
  planId,
  planTotal,
  rupees,
  startFresh,
  waitForPlan,
} from './qa-helpers'

/**
 * Refinement round 1 — the ten PM-ranked fixes from `docs/05-customer-feedback.md`,
 * driven through the real UI at the widths a user meets them at.
 *
 * Every test title names the requirement it covers (R1, R7, R12, R17, R18–R24) so
 * the QA report traces back. Assertions are on what the user can read, never on a
 * test id, and never on internal state.
 */

test.use({ viewport: { width: 1280, height: 900 } })

/** Every day block, as the user reads it. */
async function dayTexts(page: Page): Promise<string[]> {
  return page.locator('.dayblock').allInnerTexts()
}

/** The named experiences on each day, in day order. */
async function experiencesByDay(page: Page): Promise<string[][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.dayblock')].map((block) =>
      [...block.querySelectorAll('.dayblock__item')]
        .filter((item) => item.querySelector('.dayblock__blurb') !== null)
        .map((item) => item.querySelector('.dayblock__label')?.textContent?.trim() ?? ''),
    ),
  )
}

/** 'Sat 10 Oct' → 'Sat'. The weekday the day block itself claims. */
async function weekdayOfDay(page: Page, index: number): Promise<string> {
  const title = await page.locator('.dayblock__title').nth(index).innerText()
  return title.split('·')[1]?.trim().split(' ')[0] ?? ''
}

async function applyAdjust(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Update plan' })
  await expect(button).toBeEnabled()
  await button.click()
}

// ---------------------------------------------------------------------------
// Fix 1 / R18 — never state a false day-of-week
// ---------------------------------------------------------------------------

test.describe('R18 — weekday availability is data the scheduler obeys', () => {
  test('R18: the Anjuna flea market sits only on a Wednesday and Arpora only on a Saturday', async ({
    page,
  }) => {
    // Tue 10 – Sun 15 Nov 2026 contains exactly one Wednesday and one Saturday.
    await planBySkipping(page, 'Party', { start: '10/11/2026', end: '15/11/2026' })
    expect(await destination(page)).toBe('North Goa')

    const days = await dayTexts(page)
    const wednesday = days.findIndex((d) => d.includes('Anjuna flea market'))
    expect(wednesday, 'the Wednesday market is scheduled').toBeGreaterThanOrEqual(0)
    expect(await weekdayOfDay(page, wednesday)).toBe('Wed')

    const saturday = days.findIndex((d) => d.includes('Saturday night market, Arpora'))
    expect(saturday, 'the Saturday market is scheduled').toBeGreaterThanOrEqual(0)
    expect(await weekdayOfDay(page, saturday)).toBe('Sat')
  })

  test('R18: with no Wednesday in the dates the market is absent and the plan says why', async ({
    page,
  }) => {
    // Thu 12 – Sun 15 Nov 2026: no Wednesday anywhere in the range.
    await planBySkipping(page, 'Party', { start: '12/11/2026', end: '15/11/2026' })
    expect(await destination(page)).toBe('North Goa')

    const days = await dayTexts(page)
    expect(days.filter((d) => d.includes('Anjuna flea market'))).toEqual([])

    await expect(page.locator('.plan-section--days')).toContainText(
      'Not scheduled: Anjuna flea market — runs Wednesdays only, and your dates have no Wednesday',
    )
  })

  test('R18: no experience claims a weekday the day it sits on contradicts', async ({
    page,
  }) => {
    const ranges: [string, string][] = [
      ['10/11/2026', '15/11/2026'],
      ['12/11/2026', '15/11/2026'],
      ['02/11/2026', '05/11/2026'],
      ['05/11/2026', '12/11/2026'],
    ]
    const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (const [start, end] of ranges) {
      await planBySkipping(page, 'Party', { start, end })
      const days = await dayTexts(page)
      for (let i = 0; i < days.length; i += 1) {
        const actual = await weekdayOfDay(page, i)
        for (let w = 0; w < 7; w += 1) {
          const claim = `${full[w]}s only`
          if (days[i]!.includes(claim)) {
            expect(actual, `${start}–${end} day ${i + 1} claims "${claim}"`).toBe(short[w])
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Fix 2 / R12 — the whole trip is editable from the plan
// ---------------------------------------------------------------------------

test.describe('R12 — start date, end date and departure city in the adjust panel', () => {
  test('R12: moving the end date re-plans in place, keeping the vibe and every answer', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { start: '10/10/2026', end: '15/10/2026' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    for (const label of ['Within India', 'West coast', 'Empty', 'Local stays']) {
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click()
      await page.waitForTimeout(250)
    }
    await waitForPlan(page)

    await expect(page.locator('.plan-hero__facts')).toContainText('5 nights')
    const before = { total: await planTotal(page), id: await planId(page) }
    const reasonsBefore = await page.locator('[data-why="reasons"] li').allInnerTexts()

    await page.getByLabel('End date').fill('16/10/2026')
    await applyAdjust(page)

    await expect(page.locator('.plan-hero__facts')).toContainText('6 nights')
    expect(await planTotal(page)).not.toBe(before.total)
    expect(await planId(page)).not.toBe(before.id)
    // The questionnaire never came back, and nothing was answered for the user.
    await expect(page.getByText(/^Question \d of \d$/)).toHaveCount(0)
    await expect(page.getByText(/questions? answered for you/)).toHaveCount(0)
    // Vibe and adaptive answers survive: the same reasons are quoted back.
    const reasonsAfter = await page.locator('[data-why="reasons"] li').allInnerTexts()
    for (const answer of ['You chose Beach', 'You said Within India', 'You said West coast']) {
      expect(reasonsBefore.some((r) => r.includes(answer))).toBe(true)
      expect(reasonsAfter.some((r) => r.includes(answer))).toBe(true)
    }
  })

  test('R12: changing the departure city to Mumbai re-prices the travel line', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    const travelBefore = (await costRows(page)).Travel

    await page.getByLabel('Flying from').selectOption('Mumbai')
    await applyAdjust(page)

    await expect(page.locator('.plan-hero__facts')).toContainText('from Mumbai')
    expect((await costRows(page)).Travel).not.toBe(travelBefore)
  })

  test('R12: 10 October 2026 reads 10/10/2026 on both date screens, with a DD/MM/YYYY hint', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { start: '10/10/2026', end: '15/10/2026' })

    await expect(page.getByLabel('Start date')).toHaveValue('10/10/2026')
    await expect(page.getByLabel('End date')).toHaveValue('15/10/2026')
    await expect(page.locator('.field__hint').filter({ hasText: 'DD/MM/YYYY' })).toHaveCount(2)

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    await expect(page.getByLabel('Start date')).toHaveValue('10/10/2026')
    await expect(page.getByLabel('End date')).toHaveValue('15/10/2026')
    await expect(
      page.locator('.plan-section--adjust .field__hint').filter({ hasText: 'DD/MM/YYYY' }),
    ).toHaveCount(2)
  })

  test('R12: Start over is never the price of a change — every trip field is on the plan', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    const panel = page.locator('.plan-section--adjust')
    for (const label of ['Start date', 'End date', 'Adults', 'Total budget', 'Flying from']) {
      await expect(panel.getByText(label, { exact: true })).toHaveCount(1)
    }
  })
})

// ---------------------------------------------------------------------------
// Fix 3 / R19 — say what changed, next to the total
// ---------------------------------------------------------------------------

test.describe('R19 — substitutions are disclosed on the headline', () => {
  test('R19: a re-plan that drops the stay says so next to the total', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Mountains')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '15/10/2026',
      budget: '250000',
      travellers: '4',
      origin: 'Kolkata',
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    // Nothing has been substituted yet, so nothing is claimed.
    await expect(page.locator('.plan-hero__notice')).toHaveCount(0)
    const stayBefore = (await page.locator('.plan-section--cost').innerText()).match(
      /Stay: (.+?) in /,
    )?.[1]

    await page.getByLabel('Adults', { exact: true }).fill('5')
    await applyAdjust(page)

    const notice = page.locator('.plan-hero__notice')
    await expect(notice).toHaveCount(1)
    await expect(notice).toContainText('Changed to keep you inside budget:')
    await expect(notice).toContainText(/stay is now .+ \(₹[\d,]+\/night, (saver|standard|premium)\)/)
    await expect(notice).toContainText(`instead of ${stayBefore}`)

    // "Adjacent to the total" — the notice is inside the hero, with the price.
    const hero = page.locator('.plan-hero')
    await expect(hero).toContainText(await notice.innerText())
    const noticeBox = await notice.boundingBox()
    const totalBox = await page.locator('.plan-hero__total').boundingBox()
    expect(Math.abs(noticeBox!.y - totalBox!.y)).toBeLessThan(200)
  })

  test('R19: an overridden answer is named in the same notice', async ({ page }) => {
    // International + a budget nothing international fits: R14 relaxes it, and R19
    // must say so where the total is, not only in the banner.
    await startFresh(page)
    await pickVibe(page, 'Party')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '12/10/2026',
      budget: '25000',
      travellers: '4',
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: /^International/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    const notice = page.locator('.plan-hero__notice')
    await expect(notice).toHaveCount(1)
    await expect(notice).toContainText('you asked for')
    await expect(notice).toContainText('nothing fits')
    await expect(notice).toContainText(await destination(page))
  })

  test('R19: "Why this trip" is expanded on first render of any plan, without a click', async ({
    page,
  }) => {
    for (const vibe of ['Beach', 'Mountains', 'Party', 'Honeymoon', 'Peace & Quiet', 'Culture & Food']) {
      await planBySkipping(page, vibe)
      await expect(page.locator('.why__summary')).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByText('Because you said')).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Fix 4 / R17 + R1 — labels that describe what they do
// ---------------------------------------------------------------------------

test.describe('R17 / R1 — the labels tell the truth', () => {
  test('R17: one click on "Copy as text" leaves the itinerary on the clipboard', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    await page.getByRole('button', { name: 'Copy as text' }).click()

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain(await destination(page))
    expect(clip).toContain('Day 1 —')
    expect(clip).toContain('Day 6 —')

    // Announced in a live region, and no dialog in the way.
    await expect(page.locator('[role="status"]').filter({ hasText: 'Copied' })).toHaveCount(1)
    await expect(page.locator('.dialog__panel')).toHaveCount(0)
  })

  test('R17: the dialog is the fallback, and it names the failure', async ({ page }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })
    await page.getByRole('button', { name: 'Copy as text' }).click()

    const dialog = page.locator('.dialog__panel')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("Couldn't reach the clipboard")
  })

  test('R1: the vibe screen advertises the skip, and "three or four" is gone', async ({
    page,
  }) => {
    await startFresh(page)
    const body = await page.locator('.screen--form').innerText()
    expect(body).toContain('four quick questions')
    expect(body).toMatch(/or skip them and we[’']ll guess/)
    expect(body).not.toContain('three or four')
    expect(await page.locator('body').innerText()).not.toContain('three or four')
  })
})

// ---------------------------------------------------------------------------
// Fix 5 / R20 — the basis of every number
// ---------------------------------------------------------------------------

test.describe('R20 — tax position and who is counted', () => {
  test('R20: travel, stay, experiences and local allowance each carry a tax qualifier', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    for (const label of ['Travel', 'Stay', 'Experiences', 'Local allowance']) {
      const basis = page
        .locator('.costtable tr')
        .filter({ hasText: label })
        .locator('.costtable__basis')
        .first()
      await expect(basis).toContainText('incl. GST')
    }
    await expect(
      page.locator('.costtable tr').filter({ hasText: 'Stay' }).first(),
    ).toContainText(/₹[\d,]+ per room-night, incl\. GST/)
  })

  test('R20: the party total says what it covers, and GST and adults are on the screen', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    await expect(page.locator('.costtable__total')).toContainText('Total for 2 adults')
    const screen = await page.locator('.screen--plan').innerText()
    expect(screen).toContain('GST')
    expect(screen).toContain('adults')
  })
})

// ---------------------------------------------------------------------------
// Fix 6 / R21 — one free day on request, and no padding
// ---------------------------------------------------------------------------

test.describe('R21 — a day with nothing on it, on request', () => {
  test('R21: "Leave one day free" empties exactly one middle day and changes the plan ID', async ({
    page,
  }) => {
    await planBySkipping(page, 'Party', { start: '10/11/2026', end: '15/11/2026' })
    const before = { id: await planId(page) }

    await page.getByLabel('Leave one day free').check()
    await applyAdjust(page)

    const empty = await page.getByText('Nothing scheduled — this day is yours').all()
    expect(empty).toHaveLength(1)
    const perDay = await experiencesByDay(page)
    const emptyIndexes = perDay
      .map((day, i) => (day.length === 0 ? i : -1))
      .filter((i) => i >= 0)
    expect(emptyIndexes).toHaveLength(1)
    expect(emptyIndexes[0]).toBeGreaterThan(0)
    expect(emptyIndexes[0]).toBeLessThan(perDay.length - 1)
    expect(await planId(page)).not.toBe(before.id)
  })

  test('R21: the total drops by the freed day\'s experience cost', async ({ page }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    const before = await planTotal(page)

    await page.getByLabel('Leave one day free').check()
    await applyAdjust(page)

    await expect(page.getByText('Nothing scheduled — this day is yours')).toBeVisible()
    expect(
      await planTotal(page),
      'a day given up is a day of experiences the plan was charging for',
    ).toBeLessThan(before)
  })

  test('R21: no experience name appears on two different days, on any plan length', async ({
    page,
  }) => {
    const ranges: [string, string][] = [
      ['10/10/2026', '13/10/2026'],
      ['10/10/2026', '15/10/2026'],
      ['01/10/2026', '15/10/2026'],
      ['01/10/2026', '22/10/2026'],
    ]
    for (const vibe of ['Beach', 'Party', 'Mountains']) {
      for (const [start, end] of ranges) {
        await planBySkipping(page, vibe, { start, end })
        const perDay = await experiencesByDay(page)
        const all = perDay.flat()
        expect(new Set(all).size, `${vibe} ${start}–${end} repeats an experience`).toBe(
          all.length,
        )
      }
    }
  })

  test('R21 / R7: a plan nobody asked a free day of has something on every day', async ({
    page,
  }) => {
    const cases: [string, string, string][] = [
      ['Beach', '10/10/2026', '15/10/2026'],
      ['Beach', '20/12/2026', '27/12/2026'],
      ['Beach', '05/07/2027', '12/07/2027'],
      ['Party', '10/11/2026', '15/11/2026'],
      ['Mountains', '10/10/2026', '15/10/2026'],
    ]
    for (const [vibe, start, end] of cases) {
      await planBySkipping(page, vibe, { start, end })
      await expect(page.getByLabel('Leave one day free')).not.toBeChecked()
      const perDay = await experiencesByDay(page)
      const blank = perDay
        .map((day, i) => (day.length === 0 ? i + 1 : 0))
        .filter((n) => n > 0)
      expect(blank, `${vibe} ${start}–${end}: day(s) ${blank} have no experience`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// Fix 7 / R22 — not this one, somewhere else
// ---------------------------------------------------------------------------

test.describe('R22 — reject a destination and keep the whole trip', () => {
  test('R22: one click swaps the destination inside 2s and keeps every other fact', async ({
    page,
  }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    expect(await destination(page)).toBe('North Goa')
    const before = {
      dest: await destination(page),
      facts: await page.locator('.plan-hero__facts').innerText(),
      id: await planId(page),
    }

    const started = Date.now()
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await expect(page.locator('.plan-hero__title')).not.toHaveText(before.dest)
    expect(Date.now() - started).toBeLessThan(2000)

    // Dates, travellers and origin are carried through untouched; only the
    // destination and the base town it books may move.
    const keep = (facts: string): string[] => facts.split('·').slice(0, 4).map((s) => s.trim())
    expect(keep(await page.locator('.plan-hero__facts').innerText())).toEqual(keep(before.facts))
    expect(await planId(page)).not.toBe(before.id)

    const excluded = page.locator('.excluded')
    await expect(excluded).toContainText(before.dest)
    await expect(excluded.getByRole('button', { name: `Put ${before.dest} back` })).toBeVisible()
  })

  test('R22: the undo control puts the rejected destination back', async ({ page }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    const first = await destination(page)
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await expect(page.locator('.plan-hero__title')).not.toHaveText(first)

    await page.getByRole('button', { name: `Put ${first} back` }).click()
    await expect(page.locator('.plan-hero__title')).toHaveText(first)
  })

  test('R22: exhausting the catalogue ends in a sentence, never an empty screen', async ({
    page,
  }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    for (let i = 0; i < 20; i += 1) {
      const control = page.getByRole('button', { name: 'Not this one — somewhere else' })
      if ((await control.count()) === 0) break
      const shown = await destination(page)
      await control.click()
      await page.waitForFunction(
        (previous) =>
          document.querySelector('.plan-hero__title')?.textContent !== previous ||
          document.querySelector('.plan-section--alts [role="status"]') !== null,
        shown,
        { timeout: 5000 },
      )
    }

    await expect(page.locator('.plan-section--alts')).toContainText(
      "That's every destination that fits — here are the ones you turned down",
    )
    // Still a plan on screen, with a destination and a total.
    expect((await destination(page)).length).toBeGreaterThan(0)
    expect(await planTotal(page)).toBeGreaterThan(0)
    await expect(page.locator('.excluded__item').first()).toBeVisible()
  })

  test('R22: where no Saver or Stretch exists, one reject control fills that space', async ({
    page,
  }) => {
    // 2 adults + 2 children at ₹60,000 leaves the engine no qualifying alternative.
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '15/10/2026',
      childAges: ['9', '12'],
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    const cards = page.locator('.altcard')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toHaveAttribute('data-alt', 'reject')
    await expect(
      page.getByRole('button', { name: 'Not this one — somewhere else' }),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Fix 8 / R23 — the calendar is an input to the price
// ---------------------------------------------------------------------------

test.describe('R23 — the price moves with the travel dates', () => {
  test('R23: identical answers priced for December and July return different totals', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '20/12/2026', end: '27/12/2026' })
    const december = await planTotal(page)
    await expect(page.locator('.costtable')).toContainText(
      'Peak season (25 Dec – 2 Jan): +35% on stay and travel',
    )

    await planBySkipping(page, 'Beach', { start: '05/07/2027', end: '12/07/2027' })
    const july = await planTotal(page)
    await expect(page.locator('.costtable')).toContainText(
      'Off season (Jul): −20% on stay and travel',
    )

    expect(december).not.toBe(july)
  })

  test('R23: the seasonal line is inside the sum that ties to the total', async ({ page }) => {
    for (const [start, end] of [
      ['20/12/2026', '27/12/2026'],
      ['05/07/2027', '12/07/2027'],
      ['10/10/2026', '15/10/2026'],
    ] as [string, string][]) {
      await planBySkipping(page, 'Beach', { start, end })
      const seasonRow = page.locator('.costtable tr').filter({ hasText: 'Season' }).first()
      await expect(seasonRow).toHaveCount(1)
      const seasonal = rupees(await seasonRow.locator('td').innerText())

      const rows = await costRows(page)
      const cell = (label: string): number => {
        const value = rows[label]
        if (value === undefined) throw new Error(`no cost row named ${label}`)
        return value
      }
      const sum =
        cell('Travel') +
        cell('Stay') +
        cell('Experiences') +
        cell('Local allowance') +
        seasonal
      expect(sum, `${start}–${end}: the five lines must sum to the total`).toBe(
        await planTotal(page),
      )
    }
  })

  test('R23: the seasonal basis is labelled indicative sample data next to the R16 line', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '20/12/2026', end: '27/12/2026' })
    await expect(page.locator('.plan-section--cost')).toContainText(
      'Seasonal loadings are indicative sample data, like every other figure here.',
    )
    await expect(page.locator('.provenance')).toContainText('indicative')
  })
})

// ---------------------------------------------------------------------------
// Fix 9 / R7 — one plan, one base
// ---------------------------------------------------------------------------

test.describe('R7 — one base the traveller can move around in', () => {
  test('R7: the plan header names the base town it actually books', async ({ page }) => {
    for (const vibe of ['Beach', 'Party', 'Mountains', 'Peace & Quiet']) {
      await planBySkipping(page, vibe, { start: '10/10/2026', end: '15/10/2026' })
      const facts = await page.locator('.plan-hero__facts').innerText()
      const base = facts.match(/based in (.+)$/)?.[1]?.trim()
      expect(base, `${vibe}: the hero names no base`).toBeTruthy()
      // …and it is the town the stay is actually in.
      await expect(page.locator('.plan-section--cost')).toContainText(`in ${base},`)
    }
  })

  test('R7: with the Brunton Boatyard stay no day mixes a Kochi and a Varkala experience', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    await expect(page.locator('.plan-section--cost')).toContainText('Brunton Boatyard')

    const kochi = ['Mattancherry spice market', 'Fort Kochi heritage walk']
    const varkala = ['North cliff sunset walk', 'Kappil beach and the estuary']
    for (const day of await dayTexts(page)) {
      const hasKochi = kochi.some((name) => day.includes(name))
      const hasVarkala = varkala.some((name) => day.includes(name))
      expect(hasKochi && hasVarkala, `a day pairs Kochi with Varkala:\n${day}`).toBe(false)
    }
    // And the 170km town is not on the plan at all.
    const all = (await dayTexts(page)).join('\n')
    expect(varkala.some((name) => all.includes(name))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Fix 10 / R24 — children counted and priced at a published rate
// ---------------------------------------------------------------------------

test.describe('R24 — children are counted and priced', () => {
  test('R24: the summary bar reads "4 travellers (2 adults, 2 children)"', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '15/10/2026',
      childAges: ['9', '12'],
    })
    await expect(page.locator('.summary-bar__text')).toContainText(
      '4 travellers (2 adults, 2 children)',
    )
  })

  test('R24: the plan prints the child rule and splits the counts in the breakdown', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '15/10/2026',
      childAges: ['9', '12'],
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    await expect(page.locator('.screen--plan')).toContainText(
      'Children 2–11 are priced at 75% of the adult fare and 50% of experiences; they occupy a room place.',
    )
    // The 12-year-old pays the adult fare, and the plan says why.
    await expect(page.locator('.screen--plan')).toContainText(
      'A traveller aged 12 or over is priced as an adult.',
    )
    const travel = page.locator('.costtable tr').filter({ hasText: 'Travel' }).first()
    await expect(travel).toContainText('per adult × 3')
    await expect(travel).toContainText('per child × 1')
    await expect(page.locator('.costtable__total')).toContainText(
      'Total for 2 adults and 2 children',
    )
    // Room capacity counts the children as occupants: 4 travellers, 2 rooms.
    await expect(page.locator('.costtable tr').filter({ hasText: 'Stay' }).first()).toContainText(
      '2 rooms',
    )
  })

  test('R24: the child rate is what the plan actually charges', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { start: '10/10/2026', end: '15/10/2026', childAges: ['9'] })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    const basis = await page
      .locator('.costtable tr')
      .filter({ hasText: 'Travel' })
      .first()
      .locator('.costtable__basis')
      .innerText()
    const adult = rupees(basis.split('and')[0]!)
    const child = rupees(basis.split('and')[1]!)
    expect(child).toBe(Math.round(adult * 0.75))
  })
})
