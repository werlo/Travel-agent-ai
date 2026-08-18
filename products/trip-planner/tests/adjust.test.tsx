import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

/**
 * R12 — adjust and re-plan, plus R8's third clause and R13's plan ID.
 *
 * The interesting failure here is not "the number did not change"; it is the
 * questionnaire coming back, or half the screen updating. Both are asserted.
 */

type User = ReturnType<typeof userEvent.setup>

interface Trip {
  budget?: string
  travellers?: string
  startDate?: string
  endDate?: string
}

async function planFor(vibe: string, trip: Trip = {}): Promise<User> {
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
  if (trip.travellers !== undefined) fill('Travellers', trip.travellers)

  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText(/^Question 1 of \d$/)
  await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
  await screen.findByText(/· catalogue 2026-08-01$/, undefined, { timeout: 4000 })
  return user
}

function amount(key: string): number {
  const cell = document.querySelector(`[data-cost="${key}"]`)
  return Number((cell?.textContent ?? '').replace(/[^\d]/g, ''))
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? ''
}

/** `Return flights, ₹9,400 per traveller × 2` -> 9400. */
function fareFromBasis(): number {
  const basis = document.querySelector('[data-cost="travel"]')
    ?.closest('tr')
    ?.querySelector('.costtable__basis')?.textContent
  const match = /₹([\d,]+) per traveller/.exec(basis ?? '')
  if (match === null) throw new Error(`no per-traveller fare in "${basis ?? ''}"`)
  return Number(match[1]?.replace(/,/g, ''))
}

async function setTravellers(user: User, value: string): Promise<void> {
  const field = screen.getByLabelText('Travellers')
  await user.clear(field)
  await user.type(field, value)
}

describe('the adjust panel (R12)', () => {
  it('is disabled until a value actually differs, and says so', async () => {
    const user = await planFor('Beach')

    const apply = screen.getByRole('button', { name: 'Update plan' })
    expect(apply).toBeDisabled()
    expect(screen.getByText('Nothing has changed yet.')).toBeInTheDocument()

    await setTravellers(user, '4')
    await waitFor(() => expect(apply).toBeEnabled())
    expect(screen.queryByText('Nothing has changed yet.')).not.toBeInTheDocument()

    // Typing the original value back is not a change.
    await setTravellers(user, '2')
    await waitFor(() => expect(apply).toBeDisabled())
  })

  it('never re-plans on change — only Update plan moves the numbers', async () => {
    const user = await planFor('Beach')
    const before = { id: text('.plan-hero__id'), total: amount('total') }

    await setTravellers(user, '4')
    const budget = screen.getByLabelText('Total budget')
    await user.clear(budget)
    await user.type(budget, '90000')

    expect(text('.plan-hero__id')).toBe(before.id)
    expect(amount('total')).toBe(before.total)
  })

  it('re-plans in place: total, per person and plan ID all move, questionnaire does not return', async () => {
    // Culture & Food from Bengaluru keeps the same destination at 2 and at 4
    // travellers, which is what makes R8's third clause observable here.
    const user = await planFor('Culture & Food')

    const before = {
      id: text('.plan-hero__id'),
      destination: text('.plan-hero__title'),
      total: amount('total'),
      perPerson: amount('perPerson'),
      travel: amount('travel'),
      fare: fareFromBasis(),
      summary: text('.summary-bar'),
    }
    expect(before.travel).toBe(before.fare * 2)

    await setTravellers(user, '4')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => expect(text('.plan-hero__id')).not.toBe(before.id))

    // R8, third clause: the travel line rises by exactly the per-person fare × 2.
    expect(text('.plan-hero__title')).toBe(before.destination)
    expect(fareFromBasis()).toBe(before.fare)
    expect(amount('travel')).toBe(before.travel + before.fare * 2)

    // R8 still adds up, and the per-person figure follows the new party size.
    expect(
      amount('travel') + amount('stay') + amount('experiences') + amount('localAllowance'),
    ).toBe(amount('total'))
    expect(amount('total')).not.toBe(before.total)
    expect(amount('perPerson')).not.toBe(before.perPerson)
    expect(amount('perPerson')).toBe(Math.round(amount('total') / 4 / 100) * 100)

    // R12 — the questionnaire is not shown again, and neither is the generating beat.
    expect(screen.queryByText(/^Question \d of \d$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Scoring \d+ destinations/)).not.toBeInTheDocument()

    // The summary bar follows the party size and nothing else.
    expect(text('.summary-bar')).toBe(before.summary.replace('2 travellers', '4 travellers'))
    expect(text('.summary-bar')).toContain('from Bengaluru')

    // The answers behind the plan are untouched: the same vibe is still quoted.
    expect(text('[data-why="reasons"]')).toContain('You chose Culture & Food')

    // `Update plan` disables itself once the values match again, so focus cannot
    // stay on it; it returns to the field just edited rather than to <body>.
    expect(screen.getByRole('button', { name: 'Update plan' })).toBeDisabled()
    expect(screen.getByLabelText('Travellers')).toHaveFocus()
  })

  it('announces the new plan in the live region', async () => {
    const user = await planFor('Culture & Food')
    await setTravellers(user, '4')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => {
      // The app-level polite region (the SummaryBar is also role=status).
      const live = document.querySelector('p.visually-hidden[role="status"]')
      expect(live?.textContent ?? '').toMatch(
        /^Plan updated\. .+, ₹[\d,]+ total for 4 travellers\.$/,
      )
    })
  })

  it('applies a budget change too, and re-derives the budget line', async () => {
    const user = await planFor('Beach')
    const before = { id: text('.plan-hero__id'), badge: text('.plan-hero .badge') }

    const budget = screen.getByLabelText('Total budget')
    await user.clear(budget)
    await user.type(budget, '150000')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => expect(text('.plan-hero__id')).not.toBe(before.id))
    expect(text('.plan-hero .badge')).not.toBe(before.badge)
    expect(text('.summary-bar')).toContain('₹1,50,000')
  })

  it('rejects an invalid value with the S2 string and leaves the plan untouched (R3)', async () => {
    const user = await planFor('Beach')
    const before = { id: text('.plan-hero__id'), total: amount('total') }

    await setTravellers(user, '13')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    expect(await screen.findByText('Travellers must be between 1 and 12')).toBeInTheDocument()
    expect(screen.getByLabelText('Travellers')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Travellers')).toHaveFocus()
    expect(text('.plan-hero__id')).toBe(before.id)
    expect(amount('total')).toBe(before.total)
  })

  it('rejects a budget below the floor with the S2 string', async () => {
    const user = await planFor('Beach')
    const budget = screen.getByLabelText('Total budget')
    await user.clear(budget)
    await user.type(budget, '900')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    expect(await screen.findByText('Enter a budget of at least ₹5,000')).toBeInTheDocument()
    expect(budget).toHaveFocus()
  })

  it('survives a reload with the adjusted plan, not the original (R13, R15)', async () => {
    const user = await planFor('Culture & Food')
    await setTravellers(user, '4')
    await user.click(screen.getByRole('button', { name: 'Update plan' }))
    await waitFor(() => expect(text('.plan-hero__facts')).toContain('4 travellers'))

    const adjusted = { id: text('.plan-hero__id'), total: amount('total') }

    // A reload is a fresh mount reading the same localStorage (R15).
    screen.getByRole('button', { name: 'Update plan' })
    document.body.innerHTML = ''
    render(<App />)

    await screen.findByText(/· catalogue 2026-08-01$/, undefined, { timeout: 4000 })
    expect(text('.plan-hero__id')).toBe(adjusted.id)
    expect(amount('total')).toBe(adjusted.total)
  })
})
