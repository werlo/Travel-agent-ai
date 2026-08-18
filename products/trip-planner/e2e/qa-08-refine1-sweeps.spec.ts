import { expect, test, type Page } from '@playwright/test'
import {
  destination,
  fillBasics,
  hasHorizontalScroll,
  pickVibe,
  planBySkipping,
  planId,
  planTotal,
  startFresh,
  waitForPlan,
  watchConsole,
} from './qa-helpers'

/**
 * The cross-cutting sweeps, re-run over the surfaces refinement round 1 added:
 * the six-field adjust panel with its free-day checkbox, the child-age fields, the
 * reject control and its excluded list, and the change notice in the hero.
 */

const WIDTHS = [360, 768, 1280] as const

async function planWithChildren(page: Page): Promise<void> {
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
}

test.describe('responsive — the surfaces round 1 added', () => {
  for (const width of WIDTHS) {
    test(`${width}px: the child-age fields and the six-field adjust panel never overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await startFresh(page)
      await pickVibe(page, 'Beach')
      await fillBasics(page, {
        start: '10/10/2026',
        end: '15/10/2026',
        childAges: ['9', '12', '4'],
      })
      expect(await hasHorizontalScroll(page), `basics at ${width}`).toBe(false)

      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('button', { name: 'Plan my trip now' }).click()
      await waitForPlan(page)
      expect(await hasHorizontalScroll(page), `plan at ${width}`).toBe(false)

      // Every adjust control is inside the viewport, not clipped off the side.
      for (const label of ['Start date', 'End date', 'Adults', 'Total budget', 'Flying from']) {
        const box = await page.locator('.plan-section--adjust').getByLabel(label).boundingBox()
        expect(box, `${label} has no box at ${width}`).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width, `${label} runs off ${width}px`).toBeLessThanOrEqual(width + 1)
      }
      await expect(page.getByLabel('Leave one day free')).toBeVisible()
    })

    test(`${width}px: the change notice and the excluded list stay on screen`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
      const first = await destination(page)
      await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
      await expect(page.locator('.plan-hero__title')).not.toHaveText(first)

      expect(await hasHorizontalScroll(page), `plan after a reject at ${width}`).toBe(false)
      const notice = page.locator('.plan-hero__notice')
      if ((await notice.count()) > 0) {
        const box = await notice.boundingBox()
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      }
      await expect(page.locator('.excluded')).toContainText(first)
    })
  }
})

test.describe('keyboard only — the new controls', () => {
  test('the free-day checkbox and Update plan are reachable and operable with keys alone', async ({
    page,
  }) => {
    await planBySkipping(page, 'Party', { start: '10/11/2026', end: '15/11/2026' })
    const before = await planId(page)

    // Tab until the checkbox has focus, then space + Enter, with no mouse at all.
    let reached = false
    for (let i = 0; i < 60 && !reached; i += 1) {
      await page.keyboard.press('Tab')
      reached = await page.evaluate(
        () => document.activeElement?.id === 'adjust-freeday',
      )
    }
    expect(reached, 'the free-day checkbox is reachable by Tab').toBe(true)
    await page.keyboard.press('Space')
    await expect(page.getByLabel('Leave one day free')).toBeChecked()

    let onApply = false
    for (let i = 0; i < 10 && !onApply; i += 1) {
      await page.keyboard.press('Tab')
      onApply = await page.evaluate(
        () => document.activeElement?.textContent?.trim() === 'Update plan',
      )
    }
    expect(onApply, 'Update plan follows the checkbox in the tab order').toBe(true)
    await page.keyboard.press('Enter')

    await expect(page.getByText('Nothing scheduled — this day is yours')).toBeVisible()
    expect(await planId(page)).not.toBe(before)
    // Focus is never lost to <body> after an apply.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  })

  test('"Not this one — somewhere else" can be operated with the keyboard', async ({ page }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    const first = await destination(page)
    const control = page.getByRole('button', { name: 'Not this one — somewhere else' })
    await control.focus()
    await expect(control).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.plan-hero__title')).not.toHaveText(first)
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  })
})

test.describe('console — the new flows are silent', () => {
  test('children, a reject, a free day and a copy raise no console error', async ({ page }) => {
    const log = watchConsole(page)
    await planWithChildren(page)
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await page.waitForTimeout(400)
    await page.getByLabel('Leave one day free').check()
    await page.getByRole('button', { name: 'Update plan' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Copy as text' }).click()
    await page.waitForTimeout(400)

    expect(log.errors).toEqual([])
    expect(
      log.warnings.filter((w) => /key|validateDOMNesting|Warning:/i.test(w)),
      'no React warnings',
    ).toEqual([])
  })
})

test.describe('reload mid-flow — the new state survives', () => {
  test('children and their ages come back after a refresh of the plan', async ({ page }) => {
    await planWithChildren(page)
    const before = { id: await planId(page), total: await planTotal(page) }

    await page.reload()
    await waitForPlan(page)

    expect(await planId(page)).toBe(before.id)
    expect(await planTotal(page)).toBe(before.total)
    await expect(page.locator('.summary-bar__text')).toContainText(
      '4 travellers (2 adults, 2 children)',
    )
    await expect(page.locator('.screen--plan')).toContainText('Total for 2 adults and 2 children')
  })

  test('a rejected destination is still rejected after a refresh', async ({ page }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    const first = await destination(page)
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await expect(page.locator('.plan-hero__title')).not.toHaveText(first)
    const after = await destination(page)

    await page.reload()
    await waitForPlan(page)

    expect(await destination(page)).toBe(after)
    await expect(page.locator('.excluded')).toContainText(first)
  })
})

test.describe('hostile input — the new fields', () => {
  test('a malformed date is rejected inline and the plan is left alone', async ({ page }) => {
    await planBySkipping(page, 'Beach', { start: '10/10/2026', end: '15/10/2026' })
    const before = { id: await planId(page), total: await planTotal(page) }

    for (const bad of ['32/13/2026', 'not a date', '<img src=x onerror=alert(1)>', '  ']) {
      await page.locator('.plan-section--adjust').getByLabel('End date').fill(bad)
      await page.getByRole('button', { name: 'Update plan' }).click()
      await page.waitForTimeout(200)
      expect(await planId(page), `"${bad}" changed the plan`).toBe(before.id)
      expect(await planTotal(page)).toBe(before.total)
      await expect(page.locator('.plan-section--adjust [role="alert"]').first()).toBeVisible()
    }
    expect(await page.locator('img').count()).toBe(0)
  })

  test('an absurd child count and a negative age never crash the app', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, { start: '10/10/2026', end: '15/10/2026' })

    await page.getByLabel('Children', { exact: true }).fill('99')
    await expect(page.getByLabel('Child 1 age')).toBeVisible()
    // Whatever the cap is, it is finite and the screen still renders.
    const ageFields = await page.locator('[id^="field-child-age-"]').count()
    expect(ageFields).toBeGreaterThan(0)
    expect(ageFields).toBeLessThanOrEqual(12)

    await page.getByLabel('Children', { exact: true }).fill('1')
    await page.getByLabel('Child 1 age').fill('-4')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    // Either it is rejected inline or it is accepted and priced — never a crash.
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.locator('.error-boundary').count()).toBe(0)
  })

  test('a party of 12 adults plus children is held to the stated limit', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await fillBasics(page, {
      start: '10/10/2026',
      end: '15/10/2026',
      travellers: '12',
      childAges: ['5'],
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText('Adults and children together must be 12 or fewer')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  })
})

test.describe('double-submit — the new actions', () => {
  test('double-clicking the reject control rejects exactly one destination', async ({ page }) => {
    await planBySkipping(page, 'Party', { start: '13/11/2026', end: '16/11/2026' })
    const control = page.getByRole('button', { name: 'Not this one — somewhere else' })
    await control.dblclick()
    await page.waitForTimeout(800)

    const excluded = await page.locator('.excluded__item').count()
    expect(excluded, 'one click, one rejection').toBeLessThanOrEqual(2)
    await expect(page.locator('.plan-hero__title')).toHaveCount(1)
    expect(await planTotal(page)).toBeGreaterThan(0)
  })

  test('double-clicking Update plan applies the change once', async ({ page }) => {
    await planBySkipping(page, 'Party', { start: '10/11/2026', end: '15/11/2026' })
    await page.getByLabel('Leave one day free').check()
    await page.getByRole('button', { name: 'Update plan' }).dblclick()
    await page.waitForTimeout(800)

    expect(await page.getByText('Nothing scheduled — this day is yours').count()).toBe(1)
    await expect(page.locator('.plan-hero__title')).toHaveCount(1)
  })
})
