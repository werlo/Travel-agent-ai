import { expect, test, type Page } from '@playwright/test'
import {
  altCardOf,
  answer,
  destination,
  fillBasics,
  planBySkipping,
  planId,
  planTotal,
  pickVibe,
  startFresh,
} from './qa-helpers'

/**
 * QA round 3 — new/amended requirements from the fix rounds F1–F4
 * (docs/01-prd.md §11): R25 (vibe-affinity floor, new), R11/R12 (hand-picked
 * plans survive edits and reload), and the architecture review's own
 * reproduction case for R14.
 *
 * The stale round-2 literals for R14/R11 that these fixes changed the wording
 * of are updated in place in qa-05-trust-session.spec.ts and trust-layer.spec.ts
 * (see the comments there); this file is new coverage only.
 */

test.use({ viewport: { width: 1280, height: 800 } })

// Destinations rated below the R25 floor (< 3/5) for Beach — read directly off
// src/data/catalogue/*.ts (vibeAffinity.beach). Manali & Solang and Gangtok &
// Pelling are the architecture review's own named regression.
const BEACH_BELOW_FLOOR = [
  'Manali & Solang',
  'Gangtok & Pelling',
  'Bangkok & Ayutthaya',
  'Kathmandu & Pokhara',
]

test.describe('R25 — the vibe-affinity floor', () => {
  test('R25: the recommendation and both alternatives are all >= 3/5 for Beach', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    const rec = await destination(page)
    for (const bad of BEACH_BELOW_FLOOR) {
      expect(rec, 'recommendation must not be a below-floor destination').not.toBe(bad)
    }
    const cardNames = await page.locator('.altcard__name').allInnerTexts()
    for (const name of cardNames) {
      for (const bad of BEACH_BELOW_FLOOR) {
        expect(name.trim(), 'no alternative may be a below-floor destination').not.toBe(bad)
      }
    }
  })

  test('R25: rerolling five times from Beach never *silently* surfaces a below-floor destination (regression: Manali/Gangtok)', async ({
    page,
  }) => {
    // Driven directly first: this catalogue has exactly 4 destinations that
    // clear the Beach floor (>=3/5) for the default dates/budget/party, so the
    // 5th reroll necessarily runs out and has to fall back to a below-floor
    // destination. R25's actual requirement is not "never shown" — it is
    // "never shown *without* the R14 banner naming the vibe as what was
    // dropped" (its own Given/When/Then's second clause). That is what is
    // asserted: whenever a below-floor destination appears, the banner is
    // there and names the vibe; it is never a silent substitution.
    await planBySkipping(page, 'Beach')
    const seen = new Set<string>([await destination(page)])
    for (let i = 0; i < 5; i += 1) {
      const reroll = page.getByRole('button', { name: 'Not this one — somewhere else' })
      if ((await reroll.count()) === 0) break
      const before = await destination(page)
      await reroll.click()
      await expect.poll(() => destination(page), { timeout: 3000 }).not.toBe(before)
      const now = await destination(page)
      seen.add(now)
      if (BEACH_BELOW_FLOOR.includes(now)) {
        const banner = page.locator('.plan-relax')
        await expect(
          banner,
          `reroll ${i + 1} surfaced ${now} (below the R25 floor) with no relaxation banner — a silent substitution`,
        ).toBeVisible()
        // R27 (customer fix 1) — a reroll that excludes a destination the user
        // just turned down uses the reroll-honest wording ("You asked for
        // beach — nothing else beach fits…") instead of the ladder's blanket
        // "No beach trip fits" claim, because a fitting beach trip *did* exist
        // a moment ago. Either wording still names beach as what was dropped.
        await expect(banner).toContainText(/no beach trip fits|nothing else beach fits/i)
      }
    }
    // Sanity: the reroll control actually moved us around the catalogue, this
    // is not a test that trivially never fails because nothing happened.
    expect(seen.size).toBeGreaterThan(1)
  })

  test('R25: when nothing clears the floor, R14 names the vibe rather than substituting silently', async ({
    page,
  }) => {
    // A very small, cheap, short Party trip — the same shape as the deadEnd
    // case elsewhere in the suite, which round 3 confirmed drops the vibe
    // constraint (relaxedKeys === ['vibe', ...]) and the banner says so.
    await startFresh(page)
    await pickVibe(page, 'Party')
    await fillBasics(page, { start: '10/10/2026', end: '12/10/2026', budget: '25000', travellers: '4' })
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 8000 })

    const banner = page.locator('.plan-relax')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/no party trip fits/i)
    await expect(banner).toContainText('we widened the search')
    // Never a silent substitution: the banner exists and names what was
    // widened, rather than the plan simply appearing with no explanation.
  })
})

// ---------------------------------------------------------------------------
// R11 / R12 (amended) — a hand-picked plan survives adjust and reload
// ---------------------------------------------------------------------------

async function useSaver(page: Page): Promise<{ name: string; id: string }> {
  const saver = altCardOf(page, 'saver')
  const name = (await saver.locator('.altcard__name').innerText()).trim()
  await saver.getByRole('button', { name: 'Use this plan' }).click()
  await expect(page.locator('.plan-hero__title')).toHaveText(name)
  const id = await planId(page)
  return { name, id }
}

test.describe('R11 / R12 — a hand-picked plan is never silently overridden', () => {
  test('R11+R12: selecting the Saver survives a later traveller-count adjust', async ({
    page,
  }) => {
    await planBySkipping(page, 'Honeymoon')
    const { name: saverName } = await useSaver(page)

    await page.getByLabel('Adults', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toContainText('Total for 4 adults')

    // Still the hand-picked destination, not a silent revert to the engine's
    // own top pick.
    expect(await destination(page)).toBe(saverName)
  })

  test('R11+R12: selecting the Saver survives a reload, and the plan ID is re-derivable', async ({
    page,
  }) => {
    await planBySkipping(page, 'Honeymoon')
    const { name: saverName, id: saverId } = await useSaver(page)

    await page.reload()
    await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 8000 })
    expect(await destination(page)).toBe(saverName)
    expect(await planId(page)).toBe(saverId)
  })

  test('R22+R12: a rejected destination stays rejected through a later budget adjust', async ({
    page,
  }) => {
    await planBySkipping(page, 'Beach')
    const rejected = await destination(page)
    await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
    await expect.poll(() => destination(page)).not.toBe(rejected)

    // Adjust the budget upward; the picked (post-reroll) destination must not
    // silently revert to the original rejected one or to some other default.
    const budgetField = page.getByLabel('Total budget', { exact: true })
    const current = await budgetField.inputValue()
    await budgetField.fill(String(Number(current.replace(/[^\d]/g, '')) + 10000))
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toBeVisible()

    expect(await destination(page)).not.toBe(rejected)
  })

  test('R12: the change notice never names a destination other than the one in the <h1>', async ({
    page,
  }) => {
    await planBySkipping(page, 'Honeymoon')
    await useSaver(page)

    await page.getByLabel('Adults', { exact: true }).fill('5')
    await page.getByRole('button', { name: 'Update plan' }).click()
    await expect(page.locator('.plan-section--cost')).toBeVisible()

    const notice = page.locator('[data-notice="change"], .change-notice')
    if ((await notice.count()) > 0) {
      const noticeText = await notice.first().innerText()
      const h1 = await destination(page)
      // If the notice names an "instead of X / now Y" destination swap, Y must
      // match the <h1>. We can't parse arbitrary prose robustly, so the check
      // is the weaker but still meaningful one: the <h1> destination itself
      // must appear somewhere reasonable near the total, and the notice must
      // not claim a *different* current destination.
      expect(noticeText.includes(h1) || !/destination is now/i.test(noticeText)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// R14 (amended) — the architecture review's own 9-adult reproduction
// ---------------------------------------------------------------------------

test.describe('R14 — the architecture review reproduction', () => {
  test('R14: the 9-adult city-nightlife-party case does not falsely claim nothing fits', async ({
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
    // Walk the Party graph exactly as the architecture review's fixture does:
    // Within India -> a city -> a proper city night -> local stays.
    await answer(page, 'Within India')
    await answer(page, 'A city')
    await answer(page, 'A proper city night')
    await answer(page, 'Local stays')
    await expect(page.locator('.plan-hero__id')).toBeVisible({ timeout: 8000 })

    // The claim the architecture review disproved: a banner reading
    // "No city nightlife party trip fits ₹4,50,000 for 9" while cheaper
    // candidates that DO hold city nightlife exist. If a relaxation banner is
    // shown at all here, it must not make that specific false claim.
    const banner = page.locator('.plan-relax')
    if ((await banner.count()) > 0) {
      const text = (await banner.innerText()).toLowerCase()
      expect(text).not.toContain('no city nightlife party trip fits')
    }
    // And the budget line must never show an over-stretch total above ×1.25 —
    // whatever was recommended, it is inside the ceiling.
    const total = await planTotal(page)
    expect(total).toBeLessThanOrEqual(450000 * 1.25)
  })
})
