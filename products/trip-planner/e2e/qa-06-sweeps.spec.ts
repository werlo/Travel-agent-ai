import { expect, test, type Page } from '@playwright/test'
import {
  answer,
  destination,
  hasHorizontalScroll,
  planFor,
  planId,
  planTotal,
  startFresh,
  toQuestions,
  waitForPlan,
  watchConsole,
} from './qa-helpers'

/** QA cross-cutting sweeps — UX21 (reflow), UX22 (a11y), UX23 (motion), UX24 (offline). */

const BEACH_INDIA = ['Within India', 'West coast', 'Empty', 'Local stays']
const WIDTHS = [360, 768, 1280] as const

async function walkEveryScreen(page: Page): Promise<Array<[string, void]>> {
  const seen: Array<[string, void]> = []
  await startFresh(page)
  seen.push(['S1', undefined])
  await page.getByRole('button', { name: 'Beach', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  seen.push(['S2', undefined])
  return seen
}

test.describe('UX21 — reflow at 360 / 768 / 1280', () => {
  for (const width of WIDTHS) {
    test(`UX21: no horizontal scroll on any screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await walkEveryScreen(page)
      expect(await hasHorizontalScroll(page), `S2 overflows at ${width}`).toBe(false)

      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.locator('.progress__text')).toBeVisible()
      expect(await hasHorizontalScroll(page), `S3 overflows at ${width}`).toBe(false)

      for (const a of BEACH_INDIA) await answer(page, a)
      await waitForPlan(page)
      expect(await hasHorizontalScroll(page), `S5 overflows at ${width}`).toBe(false)

      // The plan screen scrolled to the bottom must still not overflow sideways.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      expect(await hasHorizontalScroll(page), `S5 (scrolled) overflows at ${width}`).toBe(false)

      await page.getByRole('button', { name: /Copy as text/ }).click()
      await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()
      expect(await hasHorizontalScroll(page), `S6 overflows at ${width}`).toBe(false)
    })
  }

  test('UX21: the vibe grid is one column at 360 and two at 768', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await startFresh(page)
    const columnsAt360 = await page
      .locator('.vibe-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(columnsAt360, 'one column at 360').toBe(1)

    await page.setViewportSize({ width: 768, height: 900 })
    const columnsAt768 = await page
      .locator('.vibe-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(columnsAt768, 'two columns at 768').toBe(2)
  })

  test('UX21: the plan is one column at 360/768 with the breakdown above the itinerary', async ({
    page,
  }) => {
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 900 })
      await planFor(page, 'Beach', BEACH_INDIA)

      // One column means every plan section shares a left edge and a width.
      const rects = await page.evaluate(() =>
        [...document.querySelectorAll('.plan-section')].map((el) => {
          const r = el.getBoundingClientRect()
          return { cls: el.className, x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y) }
        }),
      )
      const xs = new Set(rects.map((r) => r.x))
      const ws = new Set(rects.map((r) => r.w))
      expect(xs.size, `every section must share a left edge at ${width}`).toBe(1)
      expect(ws.size, `every section must share a width at ${width}`).toBe(1)

      const cost = rects.find((r) => r.cls.includes('plan-section--cost'))!
      const days = rects.find((r) => r.cls.includes('plan-section--days'))!
      expect(
        cost.y < days.y,
        `the cost breakdown must sit above the itinerary at ${width}`,
      ).toBe(true)
    }
  })

  test('UX21: the plan is two columns at 1280 with a sticky right-hand breakdown', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await planFor(page, 'Beach', BEACH_INDIA)
    const rects = await page.evaluate(() => {
      const pick = (sel: string) => {
        const r = document.querySelector(sel)!.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
      }
      return { days: pick('.plan-section--days'), cost: pick('.plan-section--cost') }
    })
    expect(rects.cost.x, 'the breakdown must sit in a right-hand column at 1280').toBeGreaterThan(
      rects.days.x + rects.days.w - 1,
    )

    const sticky = await page
      .locator('.plan-col--aside')
      .evaluate((el) => getComputedStyle(el).position)
    expect(sticky, 'the right column must be sticky at 1280').toBe('sticky')
  })

  test('UX21: at 360 the primary action sits in a sticky bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 })
    await planFor(page, 'Beach', BEACH_INDIA)
    const copy = page.getByRole('button', { name: /Copy as text/ })
    const first = await copy.boundingBox()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(200)
    const after = await copy.boundingBox()
    expect(after, 'Copy as text must stay on screen when the plan is scrolled').not.toBeNull()
    expect(Math.abs(after!.y - first!.y), 'the action bar must be fixed').toBeLessThan(4)
    expect(after!.y + after!.height).toBeLessThanOrEqual(721)
  })

  test('UX21: the summary bar keeps all four facts at 768 without an ellipsis', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await toQuestions(page, 'Beach')
    const bar = page.locator('.summary-bar')
    const text = await bar.innerText()
    for (const fact of ['5 nights', '2 travellers', 'from Bengaluru', '₹60,000']) {
      expect(text, `the bar must keep "${fact}" at 768`).toContain(fact)
    }
    const overflow = await bar
      .locator('.summary-bar__text')
      .evaluate((el) => getComputedStyle(el).textOverflow)
    expect(overflow).not.toBe('ellipsis')
    const clipped = await bar
      .locator('.summary-bar__text')
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped, 'the bar must not be visually truncated at 768').toBe(false)
  })
})

test.describe('UX22 — keyboard and hit targets', () => {
  for (const width of WIDTHS) {
    test(`UX22: every control is at least 44x44 at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await planFor(page, 'Beach', BEACH_INDIA)

      const undersized = await page.evaluate(() => {
        const out: string[] = []
        const controls = document.querySelectorAll<HTMLElement>(
          'button, [role="button"], input, select, textarea, summary, a[href]',
        )
        for (const el of controls) {
          if (el.classList.contains('skip-link')) continue
          const rect = el.getBoundingClientRect()
          if (rect.width === 0 && rect.height === 0) continue
          if (rect.width < 44 || rect.height < 44) {
            out.push(
              `${el.tagName.toLowerCase()}"${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
            )
          }
        }
        return out
      })
      expect(undersized, `controls below 44x44 at ${width}px`).toEqual([])
    })
  }

  test('UX22: the focus ring is 3px in --color-focus with a 2px offset', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await startFresh(page)
    await page.keyboard.press('Tab') // skip link
    await page.keyboard.press('Tab') // first vibe card

    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (el === null) return null
      const s = getComputedStyle(el)
      return { width: s.outlineWidth, offset: s.outlineOffset, color: s.outlineColor, style: s.outlineStyle }
    })
    expect(ring).not.toBeNull()
    expect(ring!.width, 'a 3px focus ring').toBe('3px')
    expect(ring!.offset, 'a 2px offset').toBe('2px')
    expect(ring!.style).not.toBe('none')

    const focusToken = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.color = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-focus')
        .trim()
      document.body.appendChild(probe)
      const v = getComputedStyle(probe).color
      probe.remove()
      return v
    })
    expect(ring!.color).toBe(focusToken)
  })

  test('UX22: every element reached by Tab on every screen shows the 3px/2px ring', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })

    const sweepRings = async (screen: string): Promise<void> => {
      const bad: string[] = []
      const seen = new Set<string>()
      for (let i = 0; i < 60; i += 1) {
        await page.keyboard.press('Tab')
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (el === null || el === document.body) return null
          const s = getComputedStyle(el)
          return {
            key: `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 24)}:${el.id}`,
            skip: el.classList.contains('skip-link'),
            width: s.outlineWidth,
            offset: s.outlineOffset,
            style: s.outlineStyle,
          }
        })
        if (info === null) break
        if (seen.has(info.key)) break
        seen.add(info.key)
        if (info.skip) continue
        if (info.width !== '3px' || info.offset !== '2px' || info.style === 'none') {
          bad.push(`${info.key} → ${info.width}/${info.offset}/${info.style}`)
        }
      }
      expect(seen.size, `${screen}: Tab must reach at least one control`).toBeGreaterThan(0)
      expect(bad, `${screen}: controls without a 3px/2px focus ring`).toEqual([])
    }

    await startFresh(page)
    await sweepRings('S1 vibe')

    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await sweepRings('S2 basics')

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator('.progress__text')).toBeVisible()
    await sweepRings('S3 question')

    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)
    await sweepRings('S5 plan')
  })

  test('UX22: the whole primary flow is completable with the keyboard alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const console_ = watchConsole(page)
    await startFresh(page)

    const tabTo = async (name: RegExp | string, limit = 40): Promise<void> => {
      for (let i = 0; i < limit; i += 1) {
        const label = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (el === null) return ''
          return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
        })
        const matches = typeof name === 'string' ? label === name : name.test(label)
        if (matches) return
        await page.keyboard.press('Tab')
      }
      throw new Error(`Tab never reached ${String(name)}`)
    }

    await tabTo(/^Beach/)
    await page.keyboard.press('Enter')
    await tabTo('Continue')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    // Focus lands on the new h1 after the screen change.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    await tabTo('Continue')
    await page.keyboard.press('Enter')
    await expect(page.locator('.progress__text')).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    for (let q = 0; q < 5; q += 1) {
      if ((await page.locator('.progress__text').count()) === 0) break
      await tabTo(/^No preference/)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(400)
    }
    await waitForPlan(page)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    await tabTo(/Copy as text/)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('export-text')

    await tabTo('Copy')
    await page.keyboard.press('Enter')
    await expect
      .poll(async () => (await page.locator('[role="status"]').allInnerTexts()).join(' | '))
      .toContain('Copied')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Copy your trip' })).toHaveCount(0)
    expect(console_.errors, 'the keyboard flow must log no console errors').toEqual([])
  })

  test('UX22: focus is never lost to <body> during the flow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await planFor(page, 'Beach', BEACH_INDIA)
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')

    await page.getByLabel('Travellers', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 travellers')
    expect(
      await page.evaluate(() => document.activeElement?.tagName),
      'focus must not fall to body after Update plan',
    ).not.toBe('BODY')
  })
})

test.describe('UX23 — reduced motion', () => {
  test('UX23: nothing animates position or scale, and the status text still steps', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await toQuestions(page, 'Beach')
    expect(
      await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
      'reduced motion must be emulated for this check to mean anything',
    ).toBe(true)

    const optionTransition = await page
      .locator('.option')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(
      optionTransition.split(',').every((d) => parseFloat(d) <= 0.001),
      `option transition-duration was ${optionTransition}`,
    ).toBe(true)

    const seen = new Set<string>()

    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')
    // The last answer is clicked bare so the sampling loop starts immediately.
    await page.getByRole('button', { name: /^Local stays/ }).click()

    for (let i = 0; i < 40; i += 1) {
      const t = await page
        .locator('.generating__status')
        .innerText({ timeout: 200 })
        .catch(() => null)
      if (t !== null && t.trim() !== '') seen.add(t.trim())
      if ((await page.locator('.plan-hero__title').count()) > 0) break
      await page.waitForTimeout(50)
    }
    await waitForPlan(page)

    expect(
      seen.size,
      `the generating status must still step through its strings, saw ${JSON.stringify([...seen])}`,
    ).toBeGreaterThanOrEqual(2)

    const barTransition = await page
      .locator('.plan-hero')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(barTransition.split(',').every((d) => parseFloat(d) <= 0.001)).toBe(true)

    await page.getByRole('button', { name: /Copy as text/ }).click()
    const dialogAnim = await page
      .locator('.dialog__panel')
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { t: s.transitionDuration, a: s.animationDuration, transform: s.transform }
      })
    expect(dialogAnim.t.split(',').every((d) => parseFloat(d) <= 0.001)).toBe(true)
    expect(dialogAnim.a.split(',').every((d) => parseFloat(d) <= 0.001)).toBe(true)
  })
})

test.describe('UX24 — offline and console hygiene', () => {
  test('UX24: the whole flow completes offline with no error UI and no console errors', async ({
    page,
    context,
  }) => {
    const console_ = watchConsole(page)
    const failed: string[] = []
    page.on('requestfailed', (req) => failed.push(`${req.method()} ${req.url()}`))

    await page.setViewportSize({ width: 1280, height: 800 })
    await startFresh(page)
    await context.setOffline(true)

    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    for (let q = 0; q < 5; q += 1) {
      if ((await page.locator('.progress__text').count()) === 0) break
      await answer(page, 'No preference')
    }
    await waitForPlan(page)

    await page.getByRole('button', { name: /Copy as text/ }).click()
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect
      .poll(async () => (await page.locator('[role="status"]').allInnerTexts()).join(' | '))
      .toContain('Copied')

    await context.setOffline(false)
    expect(console_.errors, 'zero console errors offline').toEqual([])
    expect(failed, 'no failed requests offline').toEqual([])
    expect(await page.locator('.error-boundary, [role="alert"]').count()).toBe(0)
  })

  test('console: the primary flow logs no errors and no React warnings', async ({ page }) => {
    const console_ = watchConsole(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await planFor(page, 'Beach', BEACH_INDIA)
    await page.locator('.why__summary').click()
    await page.getByLabel('Travellers', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 travellers')
    await page.getByRole('button', { name: /Copy as text/ }).click()
    await page.keyboard.press('Escape')

    expect(console_.errors).toEqual([])
    const reactWarnings = console_.warnings.filter((w) =>
      /unique "key"|Warning:|validateDOMNesting|act\(/i.test(w),
    )
    expect(reactWarnings, 'no React warnings during the primary flow').toEqual([])
  })

  test('no request ever leaves localhost', async ({ page }) => {
    const offsite: string[] = []
    page.on('request', (req) => {
      if (!req.url().startsWith('http://localhost') && !req.url().startsWith('data:')) {
        offsite.push(req.url())
      }
    })
    await planFor(page, 'Beach', BEACH_INDIA)
    expect(offsite).toEqual([])
  })
})

test.describe('reload mid-flow and hostile input sweeps', () => {
  test('sweep: a reload on every screen returns the user to that screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await startFresh(page)
    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.reload()
    // The vibe survives a reload before the basics are submitted.
    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await toQuestions(page, 'Beach')
    await page.reload()
    await expect(page.locator('.progress__text')).toHaveText(/^Question 1 of \d$/)

    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await page.reload()
    await expect(page.locator('.progress__text')).toHaveText(/^Question 3 of \d$/)
  })

  test('sweep: a reload during the generating beat still lands on a plan', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await toQuestions(page, 'Beach')
    await answer(page, 'Within India')
    await answer(page, 'West coast')
    await answer(page, 'Empty')
    await page.getByRole('button', { name: /^Local stays/ }).click()
    await page.reload()
    await expect(page.locator('h1')).toBeVisible()
    // Either the plan or the question it came from — never a blank or stuck screen.
    const stuck = await page.locator('.generating').count()
    expect(stuck, 'the app must not be stuck on the generating screen after a reload').toBe(0)
  })

  test('sweep: unicode and long text in the departure city cannot break the plan', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await startFresh(page)
    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    // The origin is a <select>: an out-of-list value must be rejected, not crash.
    await page.getByLabel('Flying from').evaluate((el: HTMLSelectElement) => {
      const option = document.createElement('option')
      option.value = '🛫 Ｍｕｍｂａｉ '.repeat(20)
      option.textContent = 'hostile'
      el.appendChild(option)
      el.value = option.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText('Choose a departure city from the list')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  })

  test('sweep: a 21-night trip is planned and a 22-night trip is refused', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await startFresh(page)
    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByLabel('Start date').fill('2026-10-01')
    await page.getByLabel('End date').fill('2026-10-23')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText("Trips longer than 21 nights aren't supported yet")).toBeVisible()

    await page.getByLabel('End date').fill('2026-10-22')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator('.progress__text')).toBeVisible()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)
    await expect(page.locator('.dayblock')).toHaveCount(22)
  })

  test('sweep: 1 traveller and 12 travellers both plan cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    for (const travellers of ['1', '12']) {
      await planFor(page, 'Beach', BEACH_INDIA, { travellers, budget: '300000' })
      await expect(page.locator('.plan-hero__total')).toContainText('₹')
      const total = await planTotal(page)
      expect(total).toBeGreaterThan(0)
      await expect(page.locator('.plan-section--cost')).toContainText(
        travellers === '1' ? 'Total for 1 traveller' : 'Total for 12 travellers',
      )
      expect((await destination(page)).length).toBeGreaterThan(0)
      expect((await planId(page)).length).toBeGreaterThan(0)
    }
  })
})
