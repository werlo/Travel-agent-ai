import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * Slice 1 E2E — R1 (the vibe screen) and R16 (the provenance line), plus the
 * zero-console-errors gate. QA owns e2e/ from stage 4 onwards; this file is the
 * slice's own proof that the done-when conditions hold in a real browser.
 */

const VIBES = ['Mountains', 'Beach', 'Party', 'Honeymoon', 'Peace & Quiet', 'Culture & Food']

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('S1 — Vibe screen', () => {
  test('shows exactly six named vibe cards, all visible without scrolling at 1280x800', async ({
    page,
  }) => {
    await page.goto('/')

    const cards = page.locator('button[aria-pressed]')
    await expect(cards).toHaveCount(6)

    for (const label of VIBES) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }

    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    )
    expect(scrolls).toBe(false)

    for (const label of VIBES) {
      const box = await page.getByRole('button', { name: label, exact: true }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(800)
    }
  })

  test('starts with Continue disabled and the helper text present', async ({ page }) => {
    await page.goto('/')

    const cont = page.getByRole('button', { name: 'Continue' })
    await expect(cont).toBeDisabled()
    await expect(page.getByText('Pick a vibe to continue.')).toBeVisible()

    const pressed = await page.locator('button[aria-pressed="true"]').count()
    expect(pressed).toBe(0)
  })

  test('selecting Beach sets aria-pressed="true", enables Continue, and advances', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Beach', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
    await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(5)

    const cont = page.getByRole('button', { name: 'Continue' })
    await expect(cont).toBeEnabled()
    await expect(page.getByText('Pick a vibe to continue.')).toHaveCount(0)

    await cont.click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // docs/03-design.md §6.1 — focus follows the screen change to the new <h1>.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
  })

  test('leaves focus at the top of the document on first paint', async ({ page }) => {
    await page.goto('/')
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('Skip to content')
  })

  test('moves the selection when a second card is chosen', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Mountains', exact: true }).click()

    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Mountains', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('is operable by keyboard alone', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab') // skip link
    await expect(page.locator(':focus')).toHaveText('Skip to content')

    await page.keyboard.press('Tab') // Mountains
    await page.keyboard.press('Tab') // Beach
    await page.keyboard.press('Enter')

    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  test('carries a non-dismissable provenance line naming the snapshot (R16)', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('indicative')
    await expect(footer).toContainText('2026-08-01')
    await expect(footer.locator('button')).toHaveCount(0)
  })

  test('names nothing Book, Pay, Checkout or Reserve (R16)', async ({ page }) => {
    await page.goto('/')

    const names = await page
      .locator('button, a, [role="button"]')
      .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()))

    for (const name of names) {
      expect(/^(book|booking|pay|checkout|reserve)$/i.test(name)).toBe(false)
    }
  })

  test('logs zero console errors across the slice-1 flow', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/')
    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    expect(errors).toEqual([])
  })
})
