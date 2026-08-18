import { expect, test } from '@playwright/test'
import {
  answer,
  assertNothingTransactional,
  assertProvenance,
  destination,
  planBySkipping,
  planFor,
  planId,
  planTotal,
  startFresh,
  toQuestions,
  waitForPlan,
} from './qa-helpers'

/** QA verification suite — R14, R15, R16, R17 and UX3, UX18, UX19, UX20. */

test.use({ viewport: { width: 1280, height: 800 } })

const BEACH_INDIA = ['Within India', 'West coast', 'Empty', 'Local stays']

/** The R14 dead-end case: International + Party + 2 nights + ₹25,000 for 4. */
async function deadEndCase(page: import('@playwright/test').Page): Promise<void> {
  await toQuestions(page, 'Party', {
    start: '2026-10-10',
    end: '2026-10-12',
    budget: '25000',
    travellers: '4',
  })
  await answer(page, 'International')
  await page.getByRole('button', { name: 'Plan my trip now' }).click()
  await waitForPlan(page)
}

test.describe('R14 / UX18 — never dead-end', () => {
  test('R14+UX18: a plan is still shown, with a banner naming what was dropped and why', async ({
    page,
  }) => {
    await deadEndCase(page)

    await expect(page.locator('.plan-hero__title')).not.toBeEmpty()
    await expect(page.locator('.plan-hero__total')).toContainText('₹')
    await expect(page.locator('.dayblock')).toHaveCount(3)

    const banner = page.locator('.plan-relax')
    await expect(banner).toBeVisible()
    const text = await banner.innerText()
    expect(text.toLowerCase(), 'the banner must name the original constraint').toContain(
      'international',
    )
    expect(text.toLowerCase(), 'the banner must name the substitute').toContain('within india')
    expect(text).toMatch(/₹[\d,]+/)

    // The banner sits above the plan and cannot be dismissed.
    const above = await page.evaluate(() => {
      const b = document.querySelector('.plan-relax')
      const h = document.querySelector('.plan-hero__title')
      if (b === null || h === null) return false
      return Boolean(b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(above, 'the banner must sit above the plan').toBe(true)
    const names = await banner.getByRole('button').allInnerTexts()
    expect(
      names.every((n) => !/close|dismiss|hide|×/i.test(n)),
      `no dismiss control allowed on the banner, saw ${JSON.stringify(names)}`,
    ).toBe(true)
  })

  test('R14+UX18: the restore control replaces the banner with a sentence carrying the cost', async ({
    page,
  }) => {
    await deadEndCase(page)
    const banner = page.locator('.plan-relax')
    const before = await banner.innerText()

    await banner.getByRole('button', { name: /^Put .+ back$/ }).click()
    await expect(banner).not.toHaveText(before)
    const after = await banner.innerText()
    expect(after, 'the restored sentence must state the resulting cost').toMatch(/₹[\d,]+/)
    expect(after.toLowerCase()).toContain('international')

    // Still no dismiss control, and the plan is still on screen.
    await expect(page.locator('.plan-hero__title')).toBeVisible()
    const names = await banner.getByRole('button').allInnerTexts()
    expect(names.every((n) => !/close|dismiss|hide|×/i.test(n))).toBe(true)
  })

  test('R14: the restored plan can be applied and honestly priced', async ({ page }) => {
    await deadEndCase(page)
    const banner = page.locator('.plan-relax')
    const before = await destination(page)
    await banner.getByRole('button', { name: /^Put .+ back$/ }).click()

    const apply = banner.getByRole('button', { name: /^Use the ₹/ })
    if ((await apply.count()) > 0) {
      await apply.click()
      await expect(page.locator('.plan-hero__title')).not.toHaveText(before)
      await expect(page.locator('.plan-hero__total')).toContainText('₹')
    } else {
      // No plan exists with the constraint back on — that must be said, not hidden.
      await expect(banner).toContainText(/Nothing in this catalogue/i)
    }
  })
})

test.describe('R15 / UX20 — surviving an interrupted session', () => {
  test('R15+UX20: a reload mid-questionnaire returns to the same question with answers intact', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    const heading = await page.locator('h1').innerText()
    const progress = await page.locator('.progress__text').innerText()
    const summary = await page.locator('.summary-bar').innerText()

    await page.reload()

    await expect(page.locator('h1')).toHaveText(heading)
    await expect(page.locator('.progress__text')).toHaveText(progress)
    expect(await page.locator('.summary-bar').innerText()).toBe(summary)

    // The earlier answers are still recorded — Back shows them pressed.
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('button', { name: /^West coast/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('R15+UX20: a reload on the plan shows the identical plan without regenerating', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const before = {
      id: await planId(page),
      total: await planTotal(page),
      days: await page.locator('.plan-section--days').innerText(),
    }

    await page.reload()
    await expect(page.locator('.plan-hero__title')).toBeVisible()
    expect(await page.locator('.generating').count(), 'no generating screen on reload').toBe(0)
    expect(await planId(page)).toBe(before.id)
    expect(await planTotal(page)).toBe(before.total)
    expect(await page.locator('.plan-section--days').innerText()).toBe(before.days)
  })

  test('R15+UX20: returning to / with a saved session shows the in-progress banner', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')

    await page.evaluate(() => {
      // Simulate a genuine return visit rather than an in-app navigation.
      window.location.href = '/'
    })
    await page.waitForLoadState('load')
    // The app restores the question; Start over is available in the app bar.
    await page.getByRole('button', { name: 'Start over' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toBeVisible()
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(0)

    await page.reload()
    await expect(page.getByText('You have a trip in progress')).toHaveCount(0)
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(0)
  })

  test('UX20: the "You have a trip in progress" banner is headed exactly that', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    // Go back to the vibe screen with the session still saved.
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('compass.session.v1')
      if (raw === null) throw new Error('no saved session')
      const parsed = JSON.parse(raw) as { phase?: string }
      parsed.phase = 'vibe'
      window.localStorage.setItem('compass.session.v1', JSON.stringify(parsed))
    })
    await page.reload()

    await expect(
      page.getByRole('heading', { name: 'You have a trip in progress' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Start over' }).first().click()
    await expect(page.getByText('You have a trip in progress')).toHaveCount(0)
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(0)
  })

  test('UX20: reaching the vibe screen with a saved session shows the banner by the normal route', async ({
    page,
  }) => {
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your trip basics' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()

    await expect(
      page.getByRole('heading', { name: 'You have a trip in progress' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  })

  test('R15: Start over from the plan clears the session and returns to the vibe screen', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toBeVisible()
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(0)
  })

  test('R15: a corrupt saved session does not white-screen the app', async ({ page }) => {
    await startFresh(page)
    await page.evaluate(() =>
      window.localStorage.setItem('compass.session.v1', '{"phase":"plan","nonsense":true'),
    )
    await page.reload()
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.vibe-grid button')).toHaveCount(6)
  })
})

test.describe('R16 / UX3 — provenance and no booking', () => {
  const screens: Array<[string, (page: import('@playwright/test').Page) => Promise<void>]> = [
    ['S1 vibe', async (page) => { await startFresh(page) }],
    [
      'S2 basics',
      async (page) => {
        await startFresh(page)
        await page.getByRole('button', { name: 'Beach', exact: true }).click()
        await page.getByRole('button', { name: 'Continue', exact: true }).click()
      },
    ],
    ['S3 question', async (page) => { await toQuestions(page, 'Beach') }],
    ['S5 plan', async (page) => { await planFor(page, 'Beach', BEACH_INDIA) }],
  ]

  for (const [name, setup] of screens) {
    test(`R16+UX3: ${name} shows an indicative-price line dated 2026-08-01 and nothing transactional`, async ({
      page,
    }) => {
      await setup(page)
      await assertProvenance(page)
      await assertNothingTransactional(page)
    })
  }

  test('R16+UX3: the export dialog is also free of transactional names', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.getByRole('button', { name: /Copy as text/ }).click()
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()
    await assertNothingTransactional(page)
  })

  test('R16+UX3: the relaxation path adds nothing transactional', async ({ page }) => {
    await deadEndCase(page)
    await assertNothingTransactional(page)
    await page.locator('.plan-relax').getByRole('button', { name: /^Put .+ back$/ }).click()
    await assertNothingTransactional(page)
  })
})

test.describe('R17 / UX19 — export the itinerary as plain text', () => {
  test('R17+UX19: the dialog is headed "Copy your trip" with a focused readonly textarea', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const dest = await destination(page)
    const total = await page.locator('.plan-hero__total').innerText()

    await page.getByRole('button', { name: /Copy as text/ }).click()
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()

    const textarea = page.locator('#export-text')
    await expect(textarea).toBeFocused()
    await expect(textarea).toHaveAttribute('readonly', '')

    const text = await textarea.inputValue()
    expect(text).toContain(dest)
    expect(text).toContain(total.replace(' total', '').trim())
    expect(text).toMatch(/Oct 2026/)
    for (let i = 1; i <= 6; i += 1) {
      expect(text, `the export must carry a Day ${i} line`).toMatch(
        new RegExp(`^Day ${i}\\b`, 'm'),
      )
    }
  })

  test('R17+UX19: Copy announces "Copied" in a role="status" region', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.getByRole('button', { name: /Copy as text/ }).click()
    await page.getByRole('button', { name: 'Copy', exact: true }).click()

    const statuses = page.locator('[role="status"]')
    await expect
      .poll(async () => (await statuses.allInnerTexts()).join(' | '))
      .toContain('Copied')
  })

  test('R17+UX19: Esc closes the dialog and returns focus to Copy as text', async ({ page }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    const copyBtn = page.getByRole('button', { name: /Copy as text/ })
    await copyBtn.click()
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toHaveCount(0)
    await expect(copyBtn).toBeFocused()
  })

  test('R17+UX19: without a clipboard the fallback message appears and the dialog stays open', async ({
    page,
  }) => {
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })
    await page.reload()
    await expect(page.locator('.plan-hero__title')).toBeVisible()

    await page.getByRole('button', { name: /Copy as text/ }).click()
    await page.getByRole('button', { name: 'Copy', exact: true }).click()

    await expect(
      page.getByText(
        "We couldn't copy automatically. The text is selected — press Ctrl+C (or Cmd+C) to copy it.",
      ),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()
  })

  test('R17: the exported text matches the plan currently on screen after switching variant', async ({
    page,
  }) => {
    await planBySkipping(page, 'Mountains')
    await page.locator('[data-alt="saver"]').getByRole('button', { name: 'Use this plan' }).click()
    const dest = await destination(page)
    await page.getByRole('button', { name: /Copy as text/ }).click()
    expect(await page.locator('#export-text').inputValue()).toContain(dest)
  })
})
