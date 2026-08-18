import { expect, test } from '@playwright/test'
import { destination, pickVibe, planTotal, startFresh, waitForPlan } from './qa-helpers'

/**
 * R26 — exclude a destination before any plan is generated (fix round F3).
 *
 * "Anywhere except…" lives on Trip basics (S2), accepts one or more names before
 * Continue, and writes to the same excluded set R22's post-plan reject uses: no
 * session that excludes Goa ever shows Goa as the recommendation, a Saver/Stretch
 * alternative, or a reroll result for the rest of that session.
 */

test.describe('R26 — Anywhere except…', () => {
  test('accepts a name, shows it with an undo, and Goa never appears again this session', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')

    await page.getByLabel('Anywhere except…').fill('Goa')
    await page.getByRole('button', { name: 'Exclude' }).click()

    await expect(page.locator('.excluded__name', { hasText: 'North Goa' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Undo.*North Goa/ })).toBeVisible()
    // The field clears itself, ready for a second entry (R26: "one or more").
    await expect(page.getByLabel('Anywhere except…')).toHaveValue('')

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText(/^Question 1 of \d$/)).toBeVisible()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)

    expect(await destination(page)).not.toContain('Goa')

    const saver = page.locator('.altcard--saver .altcard__name')
    if (await saver.count()) expect(await saver.innerText()).not.toContain('Goa')
    const stretch = page.locator('.altcard--stretch .altcard__name')
    if (await stretch.count()) expect(await stretch.innerText()).not.toContain('Goa')

    // Reroll — the same excluded set R22 writes to, so Goa cannot resurface.
    for (let i = 0; i < 3; i += 1) {
      const before = await destination(page)
      await page.getByRole('button', { name: 'Not this one — somewhere else' }).click()
      await expect.poll(async () => destination(page)).not.toBe(before)
      expect(await destination(page)).not.toContain('Goa')
    }
  })

  test('per-entry undo removes just that destination from the excluded set', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')

    await page.getByLabel('Anywhere except…').fill('Goa')
    await page.getByRole('button', { name: 'Exclude' }).click()
    await page.getByLabel('Anywhere except…').fill('Varkala')
    await page.getByRole('button', { name: 'Exclude' }).click()

    const excludedNames = page.locator('.excluded__name')
    await expect(excludedNames.filter({ hasText: 'North Goa' })).toBeVisible()
    await expect(excludedNames.filter({ hasText: 'Kochi & Varkala' })).toBeVisible()

    await page.getByRole('button', { name: /Undo.*North Goa/ }).click()
    await expect(excludedNames.filter({ hasText: 'North Goa' })).toHaveCount(0)
    await expect(excludedNames.filter({ hasText: 'Kochi & Varkala' })).toBeVisible()
  })

  test('an unrecognised name is rejected inline rather than silently accepted', async ({
    page,
  }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')

    await page.getByLabel('Anywhere except…').fill('Narnia')
    await page.getByRole('button', { name: 'Exclude' }).click()

    await expect(page.getByRole('alert')).toContainText("don't recognise")
  })

  test('survives a reload and still feeds the plan (R15 + R26)', async ({ page }) => {
    await startFresh(page)
    await pickVibe(page, 'Beach')
    await page.getByLabel('Anywhere except…').fill('Goa')
    await page.getByRole('button', { name: 'Exclude' }).click()
    await expect(page.locator('.excluded__name', { hasText: 'North Goa' })).toBeVisible()

    // The persisted phase is 'basics' — a reload lands straight back on it, no
    // vibe screen and no Resume click in between.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Your trip basics' })).toBeVisible()
    await expect(page.locator('.excluded__name', { hasText: 'North Goa' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Plan my trip now' }).click()
    await waitForPlan(page)
    expect(await destination(page)).not.toContain('Goa')
    expect(await planTotal(page)).toBeGreaterThan(0)
  })
})
