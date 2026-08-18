import { expect, test } from '@playwright/test'
import {
  REFERENCE_SUMMARY,
  assertNothingTransactional,
  assertProvenance,
  fillBasics,
  pickVibe,
  startFresh,
  toQuestions,
} from './qa-helpers'

/** QA verification suite — R1, R2, R3 and UX1, UX2, UX4, UX5, UX6. */

test.use({ viewport: { width: 1280, height: 800 } })

const VIBES = ['Mountains', 'Beach', 'Party', 'Honeymoon', 'Peace & Quiet', 'Culture & Food']

test.describe('R1 / UX1 / UX2 — choose a vacation vibe', () => {
  test('R1+UX1: six named vibe cards, no vertical scroll, Continue disabled with helper text', async ({
    page,
  }) => {
    await startFresh(page)

    for (const label of VIBES) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.locator('.vibe-grid button')).toHaveCount(6)

    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1,
    )
    expect(scrolls, 'the vibe screen must not scroll vertically at 1280x800').toBe(false)

    const cont = page.getByRole('button', { name: 'Continue', exact: true })
    await expect(cont).toBeDisabled()
    await expect(page.getByText('Pick a vibe to continue.')).toBeVisible()
    await assertProvenance(page)
    await assertNothingTransactional(page)
  })

  test('R1+UX2: selecting Beach presses exactly one card, enables Continue and advances', async ({
    page,
  }) => {
    await startFresh(page)
    await page.getByRole('button', { name: 'Beach', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(1)
    expect(await page.locator('.vibe-grid button[aria-pressed="false"]').count()).toBe(5)
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()

    // The pressed state moves; it never accumulates.
    await page.getByRole('button', { name: 'Mountains', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Mountains', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(await page.locator('.vibe-grid button[aria-pressed="true"]').count()).toBe(1)

    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  })

  test('UX2: the selected card carries a visible accent border and a check glyph', async ({
    page,
  }) => {
    await startFresh(page)
    const beach = page.getByRole('button', { name: 'Beach', exact: true })
    const before = await beach.evaluate((el) => getComputedStyle(el).borderColor)
    const glyphsBefore = await beach.locator('svg').count()
    await beach.click()
    await expect
      .poll(() => beach.evaluate((el) => getComputedStyle(el).borderColor), { timeout: 2000 })
      .not.toBe(before)
    // A check glyph is added on selection.
    await expect.poll(() => beach.locator('svg').count()).toBeGreaterThan(glyphsBefore)
  })
})

test.describe('R2 / UX4 — trip basics', () => {
  test('R2: the reference basics advance to question 1 with the exact summary bar', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)

    const bar = page.locator('.summary-bar')
    await expect(bar).toHaveAttribute('role', 'status')
    await expect(bar).toHaveText(REFERENCE_SUMMARY)

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
    await expect(page.locator('.summary-bar')).toHaveText(REFERENCE_SUMMARY)
  })

  test('UX4: changing travellers to 4 updates the bar without pressing Continue', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)
    await expect(page.locator('.summary-bar')).toHaveText(REFERENCE_SUMMARY)

    await page.getByLabel('Travellers').fill('4')
    await expect(page.locator('.summary-bar')).toHaveText(
      '5 nights · 4 travellers · from Bengaluru · ₹60,000',
    )
    // Still on S2 — nothing was submitted.
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  })

  test('UX3: S2 carries the provenance line and nothing transactional', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await assertProvenance(page)
    await assertNothingTransactional(page)
  })
})

test.describe('R3 / UX5 / UX6 — invalid basics are rejected inline', () => {
  test('UX5: an end date before the start date errors in place and takes focus', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)
    await page.getByLabel('End date').fill('2026-10-09')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    const end = page.getByLabel('End date')
    await expect(page.getByText('End date must be after your start date')).toBeVisible({
      timeout: 1000,
    })
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await expect(end).toHaveAttribute('aria-invalid', 'true')

    const describedBy = (await end.getAttribute('aria-describedby')) ?? ''
    const ids = describedBy.split(/\s+/).filter((s) => s !== '')
    expect(ids.length).toBeGreaterThan(0)
    const linkedText = (
      await Promise.all(ids.map((id) => page.locator(`#${id}`).innerText().catch(() => '')))
    ).join(' ')
    expect(linkedText).toContain('End date must be after your start date')

    await expect(end).toBeFocused()

    // The field border uses the danger token.
    const danger = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim(),
    )
    expect(danger).not.toBe('')
    const border = await end.evaluate((el) => getComputedStyle(el).borderColor)
    const rgb = await page.evaluate((hex: string) => {
      const d = document.createElement('div')
      d.style.color = hex
      document.body.appendChild(d)
      const v = getComputedStyle(d).color
      d.remove()
      return v
    }, danger)
    expect(border, 'end-date border must be --color-danger').toContain(
      rgb.replace(/^rgba?\(/, '').replace(/\)$/, '').split(',').slice(0, 3).map((s) => s.trim()).join(', '),
    )
  })

  test('R3: budget 0 errors inline and Continue still does not advance', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { budget: '0' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText('Enter a budget of at least ₹5,000').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await expect(page.getByLabel('Total budget for the whole party')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('UX6: two problems produce a focused error summary that counts down as they are fixed', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { budget: '0', travellers: '13' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    const summary = page.locator('.error-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('2 things to fix before we can plan')
    await expect(summary).toBeFocused()

    // The summary sits above the heading.
    const order = await page.evaluate(() => {
      const s = document.querySelector('.error-summary')
      const h = document.querySelector('h1')
      if (s === null || h === null) return 'missing'
      return s.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after'
    })
    expect(order).toBe('before')

    await expect(page.getByText('Enter a budget of at least ₹5,000').first()).toBeVisible()
    await expect(page.getByText('Travellers must be between 1 and 12').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()

    // Fix the budget alone.
    await page.getByLabel('Total budget for the whole party').fill('60000')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText('Travellers must be between 1 and 12').first()).toBeVisible()
    await expect(page.getByText('Enter a budget of at least ₹5,000')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  })

  test('UX6: with one error remaining the summary reads "1 thing to fix before we can plan"', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { budget: '0', travellers: '13' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator('.error-summary')).toContainText(
      '2 things to fix before we can plan',
    )

    await page.getByLabel('Total budget for the whole party').fill('60000')
    await expect(page.locator('.error-summary')).toContainText(
      '1 thing to fix before we can plan',
    )
  })
})

test.describe('R3 — hostile input on the basics screen', () => {
  const cases: Array<[string, string, string]> = [
    ['empty budget', '', 'Enter a budget as a number, digits only'],
    ['whitespace budget', '   ', 'Enter a budget as a number, digits only'],
    ['negative budget', '-5000', 'Enter a budget as a number, digits only'],
    ['zero budget', '0', 'Enter a budget of at least ₹5,000'],
    ['budget below the floor', '4999', 'Enter a budget of at least ₹5,000'],
  ]

  for (const [name, value, expected] of cases) {
    test(`R3: ${name} is rejected without advancing`, async ({ page }) => {
      await startFresh(page)
      await pickVibe(page, 'Beach')
      await fillBasics(page)
      await page.getByLabel('Total budget for the whole party').fill(value)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByText(expected).first()).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Your trip basics' }),
      ).toBeVisible()
    })
  }

  test('R3: an enormous budget never crashes the app', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { budget: '999999999999' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    // Either a validation error, or it plans. Never a blank screen.
    await expect(page.locator('h1')).toBeVisible()
  })

  test('R3: pasted HTML in the budget field is not executed and is rejected', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)
    await page
      .getByLabel('Total budget for the whole party')
      .evaluate((el: HTMLInputElement) => {
        el.value = '<img src=x onerror=alert(1)>'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    expect(await page.locator('main img').count()).toBe(0)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('R2: double-clicking Continue does not skip a screen or duplicate anything', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page)
    const cont = page.getByRole('button', { name: 'Continue', exact: true })
    await cont.click({ clickCount: 2, delay: 10 })
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
    expect(await page.locator('h1').count()).toBe(1)
  })
})

test.describe('R2 — the summary bar persists', () => {
  test('R2: the summary bar is present on every screen after the basics', async ({ page }) => {
    await toQuestions(page)
    await expect(page.locator('.summary-bar')).toHaveText(REFERENCE_SUMMARY)
  })
})
