import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

/**
 * S5's trust layer as the user meets it (R10, R11, R14).
 *
 * These run against the real reducer, the real engine and the real catalogue. The
 * point of testing the switch here rather than only in the engine is R11's exact
 * words: the itinerary, the breakdown, the budget line and the plan ID must update
 * *together*. A half-updated screen is the failure mode worth catching.
 */

type User = ReturnType<typeof userEvent.setup>

interface Trip {
  budget?: string
  travellers?: string
  startDate?: string
  endDate?: string
}

async function planFor(
  vibe: string,
  answers: string[],
  trip: Trip = {},
): Promise<User> {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: vibe }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })

  // `fireEvent.change` rather than `user.type`: jsdom's date input does not accept
  // typed characters, and S2 validates on blur and submit, not on keystroke.
  const fill = (label: string, value: string): void => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  if (trip.startDate !== undefined) fill('Start date', trip.startDate)
  if (trip.endDate !== undefined) fill('End date', trip.endDate)
  if (trip.budget !== undefined) fill('Total budget for the whole party', trip.budget)
  if (trip.travellers !== undefined) fill('Travellers', trip.travellers)

  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText(/^Question 1 of \d$/)

  for (const answer of answers) {
    // S3 holds the selection visible for one beat (180ms) before it advances, so
    // the screen has to be waited for rather than assumed.
    const before = document.querySelector('h1')?.textContent
    await user.click(await screen.findByRole('button', { name: new RegExp(answer) }))
    await waitFor(() =>
      expect(document.querySelector('h1')?.textContent).not.toBe(before),
    )
  }
  // Anything still unanswered takes the R5 escape hatch and its neutral defaults.
  const skip = screen.queryByRole('button', { name: 'Plan my trip now' })
  if (skip !== null) await user.click(skip)

  await screen.findByText(/· catalogue 2026-08-01$/, undefined, { timeout: 4000 })
  return user
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? ''
}

function amount(key: string): number {
  const cell = document.querySelector(`[data-cost="${key}"]`)
  return Number((cell?.textContent ?? '').replace(/[^\d]/g, ''))
}

function card(variant: string): HTMLElement {
  const element = document.querySelector(`[data-alt="${variant}"]`)
  if (element === null) throw new Error(`no ${variant} card on screen`)
  return element as HTMLElement
}

describe('Why this trip (R10)', () => {
  it('is collapsed, then lists three answer-quoting reasons and a numbered rejection', async () => {
    const user = await planFor('Beach', [])

    const summary = screen.getByText('Why this trip')
    expect(summary).toHaveAttribute('aria-expanded', 'false')

    await user.click(summary)
    expect(summary).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText('Because you said')).toBeInTheDocument()
    const reasons = document.querySelector('[data-why="reasons"]') as HTMLElement
    expect(within(reasons).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    for (const item of within(reasons).getAllByRole('listitem')) {
      expect(item.textContent).toMatch(/^(You chose|You said|You have|Your budget)/)
    }

    expect(screen.getByText('Considered and rejected')).toBeInTheDocument()
    const rejected = document.querySelector('[data-why="rejected"]') as HTMLElement
    const lines = within(rejected).getAllByRole('listitem')
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.some((line) => /\d/.test(line.textContent ?? ''))).toBe(true)
  })
})

describe('the alternatives (R11)', () => {
  it('switches the itinerary, the breakdown, the budget line and the plan ID together', async () => {
    const user = await planFor('Beach', [])

    const before = {
      destination: text('.plan-hero__title'),
      total: amount('total'),
      travel: amount('travel'),
      budgetLine: text('.plan-hero .badge'),
      planId: text('.plan-hero__id'),
      firstDay: text('.dayblock'),
    }

    const saver = card('saver')
    const saverTotal = Number(
      (saver.querySelector('.altcard__total')?.textContent ?? '').replace(/[^\d]/g, ''),
    )
    // R11 — at least 10% below the recommendation.
    expect(saverTotal).toBeLessThanOrEqual(Math.floor(before.total * 0.9))
    expect(within(saver).getByText('Saver')).toBeInTheDocument()
    expect(
      within(saver).getByText(/^₹[\d,]+ less than the recommendation$/),
    ).toBeInTheDocument()

    await user.click(within(saver).getByRole('button', { name: 'Use this plan' }))

    await waitFor(() => expect(text('.plan-hero__title')).not.toBe(before.destination))
    expect(amount('total')).toBe(saverTotal)
    expect(amount('travel')).not.toBe(before.travel)
    expect(text('.plan-hero .badge')).not.toBe(before.budgetLine)
    expect(text('.plan-hero__id')).not.toBe(before.planId)
    expect(text('.dayblock')).not.toBe(before.firstDay)
    expect(
      amount('travel') + amount('stay') + amount('experiences') + amount('localAllowance'),
    ).toBe(amount('total'))

    // The announcement the design specifies, in the app's live region.
    expect(
      screen.getByText(new RegExp(`^Plan updated\\. ${text('.plan-hero__title')}, ₹`)),
    ).toBeInTheDocument()

    // And the previous recommendation is one click away.
    const recommended = card('recommended')
    expect(within(recommended).getByText('Recommended')).toBeInTheDocument()
    expect(within(recommended).getByText(/^₹[\d,]+ more$/)).toBeInTheDocument()

    await user.click(within(recommended).getByRole('button', { name: 'Use this plan' }))
    await waitFor(() => expect(text('.plan-hero__title')).toBe(before.destination))
    expect(amount('total')).toBe(before.total)
    expect(text('.plan-hero__id')).toBe(before.planId)
  })

  it('renders the sentence, not an empty box, where no cheaper option qualifies', async () => {
    await planFor('Beach', ['Within India', 'West coast', 'Empty', 'Local stays'])

    const slot = card('saver-absent')
    expect(slot.textContent).toContain('No cheaper option in this catalogue for these dates')
    expect((slot.textContent ?? '').trim().length).toBeGreaterThan(0)
    expect(within(slot).queryByRole('button')).toBeNull()
    expect(document.querySelector('[data-alt="saver"]')).toBeNull()
  })
})

describe('the relaxation banner (R14)', () => {
  const deadEnd: Trip = {
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    budget: '25000',
    travellers: '4',
  }

  it('names the dropped constraint and offers no way to dismiss it', async () => {
    await planFor('Party', ['International'], deadEnd)

    const banner = document.querySelector('.plan-relax') as HTMLElement
    expect(banner).not.toBeNull()
    expect(within(banner).getByText('We changed one thing to make this work')).toBeInTheDocument()
    expect(
      within(banner).getByText(
        'No international party trip fits ₹25,000 for 4 — we searched within India instead.',
      ),
    ).toBeInTheDocument()

    // One control, and it is not a dismiss.
    const buttons = within(banner).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Put international back')

    // R14 still shows a plan.
    expect(text('.plan-hero__title').length).toBeGreaterThan(0)
    expect(amount('total')).toBeGreaterThan(0)
  })

  it('states the cost of putting it back, in rupees, and applies it on request', async () => {
    const user = await planFor('Party', ['International'], deadEnd)
    const relaxedTotal = amount('total')
    const relaxedId = text('.plan-hero__id')

    const banner = () => document.querySelector('.plan-relax') as HTMLElement
    await user.click(within(banner()).getByRole('button', { name: 'Put international back' }))

    expect(within(banner()).getByText('With international back in')).toBeInTheDocument()
    const body = banner().querySelector('.banner__body')?.textContent ?? ''
    expect(body).toMatch(
      /^The cheapest international party trip for 4 over these dates is ₹[\d,]+ — ₹[\d,]+ over your budget\.$/,
    )
    const quoted = Number((body.match(/is (₹[\d,]+)/)?.[1] ?? '').replace(/[^\d]/g, ''))
    expect(quoted).toBeGreaterThan(relaxedTotal)

    const use = within(banner()).getByRole('button', { name: `Use the ₹${quoted.toLocaleString('en-IN')} plan` })
    expect(
      within(banner()).getByRole('button', { name: /^Keep the ₹[\d,]+ plan$/ }),
    ).toBeInTheDocument()

    await user.click(use)

    await waitFor(() => expect(amount('total')).toBe(quoted))
    expect(text('.plan-hero__id')).not.toBe(relaxedId)
    // The plan really is international now, so nothing was relaxed to get it.
    expect(document.querySelector('.plan-relax')).toBeNull()
    expect(
      screen.getByText(/^Showing the international plan\. .+, ₹[\d,]+ total\.$/),
    ).toBeInTheDocument()
  })

  it('keeps the plan on screen when the restore is declined', async () => {
    const user = await planFor('Party', ['International'], deadEnd)
    const relaxedTotal = amount('total')

    const banner = () => document.querySelector('.plan-relax') as HTMLElement
    await user.click(within(banner()).getByRole('button', { name: 'Put international back' }))
    await user.click(within(banner()).getByRole('button', { name: /^Keep the ₹/ }))

    expect(amount('total')).toBe(relaxedTotal)
    expect(
      within(banner()).getByText('We changed one thing to make this work'),
    ).toBeInTheDocument()
  })
})
