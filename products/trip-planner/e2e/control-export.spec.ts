import { test, expect, type ConsoleMessage, type Page, type Request } from '@playwright/test'

/**
 * Slice 4 E2E — R12, R17 and the full R16 audit, with R8 and R13 regressed.
 *
 * These are the checks a judge or a regulator would make: does changing the party
 * size really re-price without starting again, does the itinerary really come out
 * as text, is there really nothing here that offers to take money, and does this
 * thing really talk to nobody.
 */

const BANNED = /^(book|booking|pay|checkout|reserve)$/i

/** Every role the app renders. The sweep has to cover all of them (R16). */
const ROLES = [
  'button',
  'link',
  'heading',
  'textbox',
  'spinbutton',
  'combobox',
  'checkbox',
  'radio',
  'listitem',
  'cell',
  'rowheader',
  'columnheader',
  'group',
  'region',
  'status',
  'alert',
  'table',
  'list',
  'dialog',
  'progressbar',
] as const

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function startFresh(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

/** Vibe → basics defaults → straight to a plan via the R5 escape hatch. */
async function planFor(page: Page, vibe: string): Promise<void> {
  await startFresh(page)
  await page.getByRole('button', { name: vibe, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
  await page.getByLabel('Start date').fill('2026-10-10')
  await page.getByLabel('End date').fill('2026-10-15')
  await page.getByLabel('Total budget for the whole party').fill('60000')
  await page.getByLabel('Travellers').fill('2')
  await page.getByLabel('Flying from').selectOption('Bengaluru')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
  await page.getByRole('button', { name: 'Plan my trip now' }).click()
  await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 6000 })
}

async function rupees(page: Page, selector: string): Promise<number> {
  const raw = (await page.locator(selector).textContent()) ?? ''
  return Number(raw.replace(/[^\d]/g, ''))
}

/** `Return flights, ₹9,400 per traveller × 2` -> 9400. */
async function perTravellerFare(page: Page): Promise<number> {
  const basis =
    (await page
      .locator('tr:has([data-cost="travel"]) .costtable__basis')
      .textContent()) ?? ''
  const match = /₹([\d,]+) per traveller/.exec(basis)
  if (match === null) throw new Error(`no per-traveller fare in "${basis}"`)
  return Number((match[1] ?? '').replace(/,/g, ''))
}

/** The answers the plan quotes back at the user, without the destination prose. */
async function quotedAnswers(page: Page): Promise<string[]> {
  const items = await page.locator('[data-why="reasons"] li').allTextContents()
  return items
    .filter((line) => line.startsWith('You chose') || line.startsWith('You said'))
    .map((line) => line.split(' — ')[0] ?? line)
}

async function sweepAccessibleNames(page: Page, where: string): Promise<void> {
  for (const role of ROLES) {
    const count = await page.getByRole(role, { name: BANNED }).count()
    expect(count, `${where}: an element with role="${role}" is named like a transaction`).toBe(
      0,
    )
  }
  // Belt and braces: the raw label and aria-label text, straight from the DOM.
  const raw = await page.evaluate(() => {
    const names: string[] = []
    for (const el of Array.from(document.querySelectorAll('[aria-label]'))) {
      names.push(el.getAttribute('aria-label') ?? '')
    }
    for (const el of Array.from(document.querySelectorAll('label, button, summary, a'))) {
      names.push((el.textContent ?? '').trim())
    }
    return names
  })
  for (const name of raw) {
    expect(BANNED.test(name), `${where}: "${name}"`).toBe(false)
  }
}

async function expectProvenance(page: Page, where: string): Promise<void> {
  const footer = page.locator('footer.provenance')
  await expect(footer, where).toBeVisible()
  await expect(footer, where).toContainText('indicative')
  await expect(footer, where).toContainText('2026-08-01')
  await expect(footer.locator('button, a, input'), where).toHaveCount(0)
}

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('R12 — adjust and re-plan', () => {
  test('travellers 2 → 4 re-prices in place, and the travel line rises by the fare × 2 (R8, R13)', async ({
    page,
  }) => {
    // Culture & Food from Bengaluru keeps the same destination at 2 and at 4
    // travellers, which is what makes R8's third clause observable end to end.
    await planFor(page, 'Culture & Food')

    const before = {
      planId: await page.locator('.plan-hero__id').textContent(),
      destination: await page.locator('.plan-hero__title').textContent(),
      total: await rupees(page, '[data-cost="total"]'),
      perPerson: await rupees(page, '[data-cost="perPerson"]'),
      travel: await rupees(page, '[data-cost="travel"]'),
      fare: await perTravellerFare(page),
      summary: (await page.locator('.summary-bar').textContent()) ?? '',
      answers: await quotedAnswers(page),
    }
    expect(before.travel).toBe(before.fare * 2)

    const apply = page.getByRole('button', { name: 'Update plan' })
    await expect(apply).toBeDisabled()
    await expect(page.getByText('Nothing has changed yet.')).toBeVisible()

    await page.getByLabel('Travellers', { exact: true }).fill('4')
    await expect(apply).toBeEnabled()

    // Nothing has re-planned yet: the panel is uncontrolled behind the button.
    await expect(page.locator('.plan-hero__id')).toHaveText(before.planId ?? '')

    await apply.click()

    // R13 — a new plan is a new ID.
    await expect(page.locator('.plan-hero__id')).not.toHaveText(before.planId ?? '')

    // R8, third clause.
    await expect(page.locator('.plan-hero__title')).toHaveText(before.destination ?? '')
    expect(await perTravellerFare(page)).toBe(before.fare)
    expect(await rupees(page, '[data-cost="travel"]')).toBe(before.travel + before.fare * 2)

    // R8, first two clauses, on the re-planned figures.
    const [travel, stay, experiences, local, total, perPerson] = await Promise.all([
      rupees(page, '[data-cost="travel"]'),
      rupees(page, '[data-cost="stay"]'),
      rupees(page, '[data-cost="experiences"]'),
      rupees(page, '[data-cost="localAllowance"]'),
      rupees(page, '[data-cost="total"]'),
      rupees(page, '[data-cost="perPerson"]'),
    ])
    expect(travel + stay + experiences + local).toBe(total)
    expect(total).not.toBe(before.total)
    expect(perPerson).not.toBe(before.perPerson)
    expect(perPerson).toBe(Math.round(total / 4 / 100) * 100)

    // R12 — the questionnaire is never shown again, and neither is S4.
    await expect(page.getByText(/^Question \d of \d$/)).toHaveCount(0)
    await expect(page.getByText(/^Scoring \d+ destinations/)).toHaveCount(0)

    // The vibe and the adaptive answers are unchanged; only the party size moved.
    expect(await quotedAnswers(page)).toEqual(before.answers)
    await expect(page.locator('.summary-bar')).toHaveText(
      before.summary.replace('2 travellers', '4 travellers'),
    )
    await expect(page.locator('.plan-hero__facts')).toContainText('from Bengaluru')

    // And the announcement a screen-reader user hears.
    await expect(page.locator('p.visually-hidden[role="status"]')).toHaveText(
      /^Plan updated\. .+, ₹[\d,]+ total for 4 travellers\.$/,
    )
  })

  test('an invalid value shows the S2 error and leaves the plan alone (R3)', async ({
    page,
  }) => {
    await planFor(page, 'Beach')
    const planId = await page.locator('.plan-hero__id').textContent()

    await page.getByLabel('Travellers', { exact: true }).fill('13')
    await page.getByRole('button', { name: 'Update plan' }).click()

    await expect(page.getByText('Travellers must be between 1 and 12')).toBeVisible()
    await expect(page.getByLabel('Travellers', { exact: true })).toBeFocused()
    await expect(page.locator('.plan-hero__id')).toHaveText(planId ?? '')
  })

  test('the adjusted plan survives a reload (R13, R15)', async ({ page }) => {
    await planFor(page, 'Culture & Food')
    await page.getByLabel('Travellers', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-hero__facts')).toContainText('4 travellers')

    const planId = await page.locator('.plan-hero__id').textContent()
    const total = await page.locator('[data-cost="total"]').textContent()

    await page.reload()

    await expect(page.getByText(/^Scoring \d+ destinations/)).toHaveCount(0)
    await expect(page.locator('.plan-hero__id')).toHaveText(planId ?? '')
    await expect(page.locator('[data-cost="total"]')).toHaveText(total ?? '')
  })
})

test.describe('R17 — copy as text', () => {
  test('reveals a read-only textarea with the trip in it and announces Copied', async ({
    page,
  }) => {
    await planFor(page, 'Beach')

    const destination = (await page.locator('.plan-hero__title').textContent()) ?? ''
    const total = (await page.locator('[data-cost="total"]').textContent()) ?? ''

    const copyAsText = page.getByRole('button', { name: 'Copy as text' })
    await copyAsText.click()

    const dialog = page.locator('dialog.dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Copy your trip' })).toBeVisible()

    const textarea = page.getByLabel('Your trip as plain text')
    await expect(textarea).toHaveAttribute('readonly', '')
    await expect(textarea).toBeFocused()

    const value = await textarea.inputValue()
    expect(value).toContain(destination)
    expect(value).toContain('Sat 10 – Thu 15 Oct 2026')
    expect(value).toContain(total)
    const dayLines = value.split('\n').filter((line) => /^Day \d+ — /.test(line))
    expect(dayLines).toHaveLength(6)

    await page.getByRole('button', { name: 'Copy', exact: true }).click()

    await expect(dialog.locator('[role="status"]')).toHaveText('Copied')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(value)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(copyAsText).toBeFocused()
  })

  test('the exported text carries the plan ID and the honesty sentence (R13, R16)', async ({
    page,
  }) => {
    await planFor(page, 'Beach')
    const planId = ((await page.locator('.plan-hero__id').textContent()) ?? '')
      .replace(/^Plan /, '')
      .replace(/ · catalogue.*$/, '')

    await page.getByRole('button', { name: 'Copy as text' }).click()
    const value = await page.getByLabel('Your trip as plain text').inputValue()

    expect(value).toContain(`Plan ${planId} · Compass catalogue 2026-08-01`)
    expect(value.trimEnd().endsWith(
      'Prices are indicative sample data. Compass does not sell or reserve anything.',
    )).toBe(true)
  })
})

test.describe('R16 — the honesty audit', () => {
  test('no element on any screen is named Book, Pay, Checkout or Reserve', async ({ page }) => {
    await startFresh(page)
    await sweepAccessibleNames(page, 'S1')
    await expectProvenance(page, 'S1')

    await page.getByRole('button', { name: 'Beach', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await sweepAccessibleNames(page, 'S2')
    await expectProvenance(page, 'S2')

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
    await sweepAccessibleNames(page, 'S3')
    await expectProvenance(page, 'S3')

    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 6000 })
    await page.getByText('Why this trip').click()
    await sweepAccessibleNames(page, 'S5')
    await expectProvenance(page, 'S5')

    await page.getByRole('button', { name: 'Copy as text' }).click()
    await expect(page.locator('dialog.dialog')).toBeVisible()
    await sweepAccessibleNames(page, 'S6')
    await expectProvenance(page, 'S6')
  })

  test('the relaxation and alternatives paths add nothing transactional either', async ({
    page,
  }) => {
    // The slice-3 dead-end case: international + party + 2 nights + ₹25,000 for 4.
    await startFresh(page)
    await page.getByRole('button', { name: 'Party', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await page.getByLabel('Start date').fill('2026-10-10')
    await page.getByLabel('End date').fill('2026-10-12')
    await page.getByLabel('Total budget for the whole party').fill('25000')
    await page.getByLabel('Travellers').fill('4')
    await page.getByLabel('Flying from').selectOption('Bengaluru')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()

    const firstHeading = await page.getByRole('heading', { level: 1 }).textContent()
    await page.getByRole('button', { name: /International/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstHeading ?? '')
    const skip = page.getByRole('button', { name: 'Plan my trip now' })
    if ((await skip.count()) > 0) await skip.click()
    await expect(page.locator('.plan-relax')).toBeVisible({ timeout: 6000 })

    await sweepAccessibleNames(page, 'S5 relaxed')
    await page.getByRole('button', { name: /^Put .+ back$/ }).click()
    await sweepAccessibleNames(page, 'S5 restore offered')
  })
})

test.describe('the app talks to nobody', () => {
  test('no network request leaves localhost across the whole flow', async ({ page }) => {
    const offsite: string[] = []
    page.on('request', (request: Request) => {
      const url = request.url()
      if (!/^(https?|ws|wss):\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) {
        if (!url.startsWith('data:') && !url.startsWith('blob:')) offsite.push(url)
      }
    })
    const failures: string[] = []
    page.on('requestfailed', (request) => {
      failures.push(`${request.url()} ${request.failure()?.errorText ?? ''}`)
    })
    const errors = collectConsoleErrors(page)

    await planFor(page, 'Beach')
    await page.getByText('Why this trip').click()
    await page.getByLabel('Travellers', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-hero__facts')).toContainText('3 travellers')
    await page.getByRole('button', { name: 'Copy as text' }).click()
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(page.locator('dialog.dialog [role="status"]')).toHaveText('Copied')

    expect(offsite).toEqual([])
    expect(failures).toEqual([])
    expect(errors).toEqual([])
  })

  test('a Content Security Policy is declared on the page', async ({ page }) => {
    await page.goto('/')
    const policy = await page.evaluate(
      () =>
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute('content') ?? null,
    )
    expect(policy).not.toBeNull()
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("img-src 'self' data:")
    // The dev server needs its own socket; nothing off this machine is ever allowed.
    expect(policy).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1)/)
  })
})

test.describe('reflow — 360, 768 and 1280', () => {
  for (const [width, height] of [
    [360, 740],
    [768, 1024],
    [1280, 800],
  ] as const) {
    test(`the whole flow fits ${width}px with no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const noHorizontalScroll = async (where: string): Promise<void> => {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${where} at ${width}px`).toBeLessThanOrEqual(0)
      }

      await startFresh(page)
      await noHorizontalScroll('S1')

      await page.getByRole('button', { name: 'Beach', exact: true }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
      await noHorizontalScroll('S2')

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
      await noHorizontalScroll('S3')

      await page.getByRole('button', { name: 'Plan my trip now' }).click()
      await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 6000 })
      await noHorizontalScroll('S5')

      // The summary bar keeps all four facts, never an ellipsis.
      await expect(page.locator('.summary-bar')).toContainText('from Bengaluru')
      expect(
        await page
          .locator('.summary-bar')
          .evaluate((el) => getComputedStyle(el).textOverflow),
      ).not.toBe('ellipsis')

      await page.getByRole('button', { name: 'Copy as text' }).click()
      await expect(page.locator('dialog.dialog')).toBeVisible()
      await noHorizontalScroll('S6')
    })
  }

  test('at 1280 the plan is two columns; at 768 and 360 the breakdown is above the itinerary', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await planFor(page, 'Beach')

    const columns = await page
      .locator('.plan-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(2)

    const costTop = async (): Promise<number> =>
      (await page.locator('.plan-section--cost').boundingBox())?.y ?? -1
    const daysTop = async (): Promise<number> =>
      (await page.locator('.plan-section--days').boundingBox())?.y ?? -1

    for (const width of [768, 360]) {
      await page.setViewportSize({ width, height: 1024 })
      expect(await costTop(), `breakdown above itinerary at ${width}`).toBeLessThan(
        await daysTop(),
      )
    }
  })

  test('at 360 the primary action stays in a bottom bar however far the plan is scrolled', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await planFor(page, 'Beach')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByRole('button', { name: 'Copy as text' })).toBeInViewport()

    // And it does not sit on top of the provenance line.
    const bar = await page.locator('.plan-hero__actions').boundingBox()
    const footer = await page.locator('footer.provenance').boundingBox()
    expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual((bar?.y ?? 0) + 1)
  })

  test('at 1280 the destination, total, budget badge and Copy as text are above the fold', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await planFor(page, 'Beach')

    for (const selector of [
      '.plan-hero__title',
      '.plan-hero__total',
      '.plan-hero .badge',
      '.plan-hero__actions .btn',
    ]) {
      const box = await page.locator(selector).first().boundingBox()
      expect(box, selector).not.toBeNull()
      expect((box?.y ?? 0) + (box?.height ?? 0), selector).toBeLessThanOrEqual(800)
    }
  })
})

test.describe('keyboard only', () => {
  /** Tab until the focused element matches, so the test is not a tab-count fixture. */
  async function tabTo(page: Page, name: RegExp, limit = 40): Promise<void> {
    for (let i = 0; i < limit; i += 1) {
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        if (el === null) return ''
        const aria = el.getAttribute('aria-label')
        if (aria !== null) return aria.trim()
        if (el.id !== '') {
          const label = document.querySelector(`label[for="${el.id}"]`)
          if (label !== null) return (label.textContent ?? '').trim()
        }
        return (el.textContent ?? '').trim()
      })
      if (name.test(focused)) return
      await page.keyboard.press('Tab')
    }
    throw new Error(`never reached ${String(name)} with the keyboard`)
  }

  test('cold load to a copied itinerary, with no mouse at all', async ({ page }) => {
    await startFresh(page)

    // The first focusable thing on the page is the skip link.
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()

    await tabTo(page, /^Beach/)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Beach', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await tabTo(page, /^Continue$/)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    // The basics are pre-filled, so the shortest path is straight to Continue.
    await tabTo(page, /^Continue$/)
    await page.keyboard.press('Enter')
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    await tabTo(page, /Plan my trip now/)
    await page.keyboard.press('Enter')
    await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 6000 })
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    await tabTo(page, /^Copy as text$/)
    // The focus ring is real, and 3px, on the control the user is on.
    expect(
      await page.evaluate(() =>
        document.activeElement === null
          ? ''
          : getComputedStyle(document.activeElement).outlineWidth,
      ),
    ).toBe('3px')

    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Your trip as plain text')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog.dialog [role="status"]')).toHaveText('Copied')

    await page.keyboard.press('Escape')
    await expect(page.locator('dialog.dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Copy as text' })).toBeFocused()
  })

  test('the adjust panel is reachable and operable from the keyboard', async ({ page }) => {
    await planFor(page, 'Culture & Food')
    const planId = await page.locator('.plan-hero__id').textContent()

    await page.locator('.plan-hero__title').focus()
    await tabTo(page, /^Travellers$/, 60)
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('4')
    await tabTo(page, /^Update plan$/, 10)
    await page.keyboard.press('Enter')

    await expect(page.locator('.plan-hero__id')).not.toHaveText(planId ?? '')
    // `Update plan` disables itself once the values match again, and a disabled
    // control cannot hold focus — so focus returns to the field just edited rather
    // than being lost to <body> (docs/03-design.md §6.1; see AdjustPanel).
    await expect(page.getByLabel('Travellers', { exact: true })).toBeFocused()
    await expect(page.getByRole('button', { name: 'Update plan' })).toBeDisabled()
  })
})
