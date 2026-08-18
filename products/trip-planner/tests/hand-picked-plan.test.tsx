import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

/**
 * R11/R12 (fix round F2) — a plan the user hand-picked survives an edit or a
 * reload.
 *
 * Before this fix, selecting the Saver alternative or rejecting the
 * recommended destination and then applying an adjust-panel change silently
 * reverted the plan to whatever the unconstrained engine's own top pick was —
 * a different destination than the one the user had just chosen, with no
 * explanation, and a reload made the same silent substitution. These tests
 * drive the real reducer, the real engine and the real catalogue, the same
 * way `plan-trust.test.tsx` and `round1-screens.test.tsx` do.
 */

type User = ReturnType<typeof userEvent.setup>

interface Trip {
  budget?: string
  travellers?: string
  startDate?: string
  endDate?: string
}

async function planFor(vibe: string, answers: string[], trip: Trip = {}): Promise<User> {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: vibe }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })

  const fill = (label: string, value: string): void => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  if (trip.startDate !== undefined) fill('Start date', trip.startDate)
  if (trip.endDate !== undefined) fill('End date', trip.endDate)
  if (trip.budget !== undefined) fill('Total budget for the whole party', trip.budget)
  if (trip.travellers !== undefined) fill('Adults', trip.travellers)

  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText(/^Question 1 of \d$/)

  for (const answer of answers) {
    const before = document.querySelector('h1')?.textContent
    await user.click(await screen.findByRole('button', { name: new RegExp(answer) }))
    await waitFor(() => expect(document.querySelector('h1')?.textContent).not.toBe(before))
  }
  const skip = screen.queryByRole('button', { name: 'Plan my trip now' })
  if (skip !== null) await user.click(skip)

  await waitFor(
    () => expect(document.querySelector('.plan-hero__id')?.textContent ?? '').toMatch(/· catalogue 2026-08-01$/),
    { timeout: 4000 },
  )
  return user
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? ''
}

function card(variant: string): HTMLElement {
  const element = document.querySelector(`[data-alt="${variant}"]`)
  if (element === null) throw new Error(`no ${variant} card on screen`)
  return element as HTMLElement
}

async function updatePlan(user: User): Promise<void> {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Update plan' }))
}

describe('a hand-picked plan survives an edit (R11, R12)', () => {
  it('keeps pricing the selected Saver destination after an adjust, never the engine’s own top pick', async () => {
    const user = await planFor('Beach', [])

    const recommendedDestination = text('.plan-hero__title')
    const saver = card('saver')
    const saverDestination = saver.querySelector('.altcard__name')?.textContent ?? null
    expect(saverDestination).not.toBe(recommendedDestination)

    await user.click(within(saver).getByRole('button', { name: 'Use this plan' }))
    await waitFor(() => expect(text('.plan-hero__title')).toBe(saverDestination))

    // R12 — change travellers and apply.
    const adults = screen.getByLabelText('Adults')
    fireEvent.input(adults, { target: { value: '3' } })
    await updatePlan(user)

    // The h1 must still be the hand-picked destination, and a change notice
    // (if any) must never name a different one (R12's own acceptance clause).
    await waitFor(() => expect(text('.plan-hero__facts')).toContain('3 travellers'))
    expect(text('.plan-hero__title')).toBe(saverDestination)
    const notice = text('.plan-hero__notice')
    if (notice !== '') expect(notice).not.toContain(recommendedDestination as string)
  })

  it('keeps pricing the destination that survived a reject after an adjust', async () => {
    const user = await planFor('Beach', [])
    const rejectedDestination = text('.plan-hero__title')

    await user.click(screen.getByRole('button', { name: 'Not this one — somewhere else' }))
    await waitFor(() => expect(text('.plan-hero__title')).not.toBe(rejectedDestination))
    const survivorDestination = text('.plan-hero__title')

    const adults = screen.getByLabelText('Adults')
    fireEvent.input(adults, { target: { value: '3' } })
    await updatePlan(user)

    await waitFor(() => expect(text('.plan-hero__facts')).toContain('3 travellers'))
    expect(text('.plan-hero__title')).toBe(survivorDestination)
    const notice = text('.plan-hero__notice')
    if (notice !== '') expect(notice).not.toContain(rejectedDestination)
  })

  it('reloads to the hand-picked plan, not the engine’s default, with a re-derivable plan ID', async () => {
    const user = await planFor('Beach', [])
    const saver = card('saver')
    const saverDestination = saver.querySelector('.altcard__name')?.textContent ?? null
    await user.click(within(saver).getByRole('button', { name: 'Use this plan' }))
    await waitFor(() => expect(text('.plan-hero__title')).toBe(saverDestination))
    const handPicked = { id: text('.plan-hero__id'), total: text('.plan-hero__total') }

    // A reload is a fresh mount reading the same localStorage (R15).
    document.body.innerHTML = ''
    render(<App />)

    await waitFor(
    () => expect(document.querySelector('.plan-hero__id')?.textContent ?? '').toMatch(/· catalogue 2026-08-01$/),
    { timeout: 4000 },
  )
    expect(text('.plan-hero__title')).toBe(saverDestination)
    expect(text('.plan-hero__id')).toBe(handPicked.id)
    expect(text('.plan-hero__total')).toBe(handPicked.total)
  })
})
