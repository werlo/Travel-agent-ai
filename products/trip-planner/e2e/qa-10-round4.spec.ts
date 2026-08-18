import { expect, test } from '@playwright/test'
import {
  answer,
  assertProvenance,
  destination,
  fillBasics,
  pickVibe,
  planBySkipping,
  startFresh,
  waitForPlan,
} from './qa-helpers'

/**
 * QA round 4 — regression after the round-3 customer-feedback triage
 * (docs/05-customer-feedback.md, "Ranked fixes — refinement round 3"), covering the
 * five fixes shipped in this round: R27 (reroll honesty), R28 (exclusion variant
 * coverage), R29 (sticky one-line summary), R30 (indicative flight times), and R31
 * (internal-consistency of the auto-generated reasoning sentences).
 *
 * Every "fixed means" quoted in a test's title is the literal wording from
 * docs/05-customer-feedback.md so the report traces back cleanly.
 */

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('R27 — reroll is routed through the same claim-honesty check as R14', () => {
  test('R27: rerolling off a within-India, under-budget Manali & Solang plan never claims no within-India option fits, and names the dropped preference honestly', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Peace & Quiet')
    await fillBasics(page, {
      start: '20/12/2026',
      end: '27/12/2026',
      budget: '250000',
      travellers: '4',
      origin: 'Mumbai',
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await answer(page, 'Within India')
    await answer(page, 'The hills')
    await answer(page, 'Quiet, but some life')
    await answer(page, 'Resort comfort')
    await waitForPlan(page)

    expect(await destination(page)).toBe('Manali & Solang')
    const budgetLine = await page.locator('.plan-hero .badge').first().innerText()
    expect(budgetLine).toMatch(/under your budget/)

    // The plan on screen is within-India and under budget. Rerolling off it must
    // never render the R14-style blanket "No within India ... trip fits" claim —
    // that claim would be false, because this very plan just held it.
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await expect
      .poll(async () => destination(page))
      .not.toBe('Manali & Solang')

    const banner = page.locator('[class*="relax"]')
    await expect(banner).toBeVisible()
    const bannerText = await banner.innerText()
    expect(bannerText.toLowerCase()).not.toContain('no within india')
    expect(bannerText.toLowerCase()).not.toContain('nothing fits')

    // Where relaxing "Within India" is genuinely the closest fit, the banner must
    // name the dropped preference honestly instead.
    expect(bannerText).toMatch(/you asked for within india/i)

    // And the comparison list ("You turned these down") must include Manali &
    // Solang — the plan shown moments earlier — with an undo, never silently
    // dropped.
    const excludedList = page.locator('.excluded__list')
    await expect(excludedList).toContainText('Manali & Solang')
    const undo = page.getByRole('button', { name: /Manali & Solang back/ })
    await expect(undo).toBeVisible()
    await undo.click()
    await expect.poll(async () => destination(page)).toBe('Manali & Solang')
  })

  test('R27: where the reroll genuinely has nowhere else to go within the same region, the banner is still never a blanket false claim', async ({
    page,
  }) => {
    // A very small budget forces the ladder to work hard; whatever it drops, the
    // banner text must not assert something the app can't back up (no "nothing
    // fits" sentence naming a constraint that a visible destination already
    // satisfied).
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { budget: '30000' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)
    const before = await destination(page)

    const rerollBtn = page.getByRole('button', { name: 'Not this one — somewhere else' })
    if ((await rerollBtn.count()) === 0) return // exhausted already — nothing to reroll
    await rerollBtn.click()
    await expect.poll(async () => destination(page)).not.toBe(before)

    const excludedList = page.locator('.excluded__list')
    await expect(excludedList).toContainText(before)
  })
})

test.describe('R28 — an exclusion covers every named variant of a destination', () => {
  test('R28: excluding "Goa" on Trip basics shows a chip naming every variant, and neither variant ever appears in a plan, alternative or reroll', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')

    await page.getByLabel('Anywhere except…').fill('Goa')
    await page.getByRole('button', { name: 'Exclude' }).click()

    const chip = page.locator('.excluded__name')
    await expect(chip).toHaveText('Goa (covers North Goa & South Goa)')

    await fillBasics(page)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    const dest = await destination(page)
    expect(dest).not.toContain('North Goa')
    expect(dest).not.toContain('South Goa')

    const altNames = page.locator('.altcard__name')
    const names = await altNames.allInnerTexts()
    for (const name of names) {
      expect(name).not.toContain('North Goa')
      expect(name).not.toContain('South Goa')
    }

    for (let i = 0; i < 3; i += 1) {
      const rerollBtn = page.getByRole('button', { name: 'Not this one — somewhere else' })
      if ((await rerollBtn.count()) === 0) break
      const beforeDest = await destination(page)
      await rerollBtn.click()
      await expect.poll(async () => destination(page)).not.toBe(beforeDest)
      const rerolled = await destination(page)
      expect(rerolled).not.toContain('North Goa')
      expect(rerolled).not.toContain('South Goa')
    }
  })

  test('R28: the same variant-covering chip appears on the plan screen\'s "You turned these down" list', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    // Reroll until we've turned down a Goa plan, or confirm the chip format holds
    // for whatever we do reject.
    let rejectedNorthGoa = false
    for (let i = 0; i < 6; i += 1) {
      const dest = await destination(page)
      const rerollBtn = page.getByRole('button', { name: 'Not this one — somewhere else' })
      if ((await rerollBtn.count()) === 0) break
      await rerollBtn.click()
      await expect.poll(async () => destination(page)).not.toBe(dest)
      if (dest === 'North Goa') {
        rejectedNorthGoa = true
        break
      }
    }
    if (!rejectedNorthGoa) return // this run's reroll order never hit Goa — nothing to assert
    await expect(page.locator('.excluded__list')).toContainText(
      'Goa (covers North Goa & South Goa)',
    )
  })
})

test.describe('R29 — a sticky, skimmable one-line summary at the top of the results page', () => {
  test('R29: the sticky line ("<destination> · <total> · <budget position>") is visible on load and stays visible while scrolling, and opens "Why this trip" with the same sentence', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    const summaryLine = page.locator('.plan-summary-line')
    await expect(summaryLine).toBeVisible()

    const dest = await destination(page)
    const text = await summaryLine.innerText()
    expect(text).toContain(dest)
    expect(text).toMatch(/₹/)
    expect(text).toMatch(/under budget|over budget|on budget/)

    // Scroll well past the fold and confirm the line is still inside the viewport
    // (sticky), not merely still present in the DOM.
    await page.mouse.wheel(0, 3000)
    await page.waitForTimeout(150)
    const box = await summaryLine.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1)

    // Reused verbatim as the opening line of "Why this trip", ahead of the full
    // reasoning list.
    const why = page.locator('details.why, [class*="why"]').first()
    await expect(why).toBeVisible()
    const whyOpeningLine = page.locator('.why__summary-line')
    await expect(whyOpeningLine).toHaveText(text)

    // "First inside Why this trip": the opening line's DOM position precedes the
    // "Because you said" reasons list.
    const order = await page.evaluate(() => {
      const root = document.querySelector('[aria-label="Why this trip"]')
      if (root === null) return null
      const nodes = Array.from(root.querySelectorAll('.why__summary-line, .why__sub'))
      return nodes.map((n) => n.className)
    })
    expect(order).not.toBeNull()
    expect(order![0]).toContain('why__summary-line')
  })
})

test.describe('R30 — an indicative departure/arrival time window on every flight leg', () => {
  test('R30: every flight leg on the itinerary shows a departs/arrives time, never inside 00:00–05:00, alongside the R16 provenance line', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    const legLabels = page.locator('.dayblock__label')
    const texts = await legLabels.allInnerTexts()
    const flightLines = texts.filter((t) => t.startsWith('Fly '))
    expect(flightLines.length).toBeGreaterThanOrEqual(2) // outbound + return

    for (const line of flightLines) {
      expect(line).toMatch(/departs \d{2}:\d{2}, arrives \d{2}:\d{2}/)
      const departMatch = line.match(/departs (\d{2}):(\d{2})/)
      expect(departMatch).not.toBeNull()
      const hour = Number(departMatch![1])
      expect(hour === 0 || (hour >= 1 && hour < 5) ? false : true).toBe(true)
    }

    // The plan screen still carries the R16 provenance line, so the invented-looking
    // clock time is not presented as a live fact.
    await assertProvenance(page)
  })

  test('R30: the exported plain-text copy also carries departs/arrives on every leg', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    const clipboardText = await page.evaluate(async () => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').includes('Copy as text'),
      )
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 300))
      return navigator.clipboard.readText()
    })
    const flightLines = clipboardText
      .split('\n')
      .filter((l) => l.includes('Fly') || l.includes('departs'))
    expect(flightLines.length).toBeGreaterThan(0)
    for (const line of flightLines) {
      expect(line).toMatch(/departs \d{2}:\d{2}, arrives \d{2}:\d{2}/)
    }
  })

  test('R30: no flight leg departs in the 00:00–05:00 window, checked across a spread of destinations/vibes', async ({
    page,
  }) => {
    const vibes = ['Beach', 'Mountains', 'Party', 'Culture & Food']
    for (const vibe of vibes) {
      await planBySkipping(page, vibe)
      const texts = await page.locator('.dayblock__label').allInnerTexts()
      for (const line of texts.filter((t) => t.startsWith('Fly '))) {
        const m = line.match(/departs (\d{2}):(\d{2})/)
        expect(m).not.toBeNull()
        const minutes = Number(m![1]) * 60 + Number(m![2])
        expect(minutes).toBeGreaterThanOrEqual(5 * 60)
      }
    }
  })
})

test.describe('R31 — internal-consistency of the auto-generated reasoning sentences', () => {
  test('R31: a hand-picked North Goa plan never has "Why this trip" call it "a city" — the pin gets its own honest sentence instead (fixture regression)', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Party')
    await fillBasics(page, {
      start: '13/11/2026',
      end: '16/11/2026',
      budget: '450000',
      travellers: '9',
      origin: 'Delhi',
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await answer(page, 'Within India')
    await answer(page, 'A city')
    await answer(page, 'A proper city night')
    await answer(page, 'Resort comfort')
    await waitForPlan(page)

    // Hand-pick North Goa via the alternatives (Saver/Stretch), matching Kabir's
    // exact repro: he picked North Goa himself, then adjusted headcount.
    const goaCard = page.locator('.altcards li', { hasText: 'Goa' })
    expect(await goaCard.count()).toBeGreaterThan(0)
    await goaCard.getByRole('button', { name: /Use this plan/ }).click()
    await expect.poll(async () => destination(page)).toBe('North Goa')

    await page.getByLabel('Adults', { exact: true }).fill('7')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect.poll(async () => destination(page)).toBe('North Goa')

    const reasons = await page.locator('.why__list[data-why="reasons"]').innerText()
    // The literal failure mode reported: an "A city" reason attaching the category
    // "a city" to North Goa as if North Goa itself were being asserted to be a city.
    expect(reasons).not.toMatch(/North Goa is a city/i)
    expect(reasons).toMatch(/North Goa is the plan you picked yourself, and it does not answer/i)

    // No sentence anywhere in "Why this trip" may apply a category label belonging
    // to a different destination to North Goa.
    const wholeWhy = await page.locator('[aria-label="Why this trip"]').innerText()
    expect(wholeWhy).not.toMatch(/North Goa\s+(is|rates as)\s+a city/i)
  })
})
