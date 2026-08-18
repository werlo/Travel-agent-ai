import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { PROVENANCE_TEXT } from '../src/ui/components/ProvenanceLine'

/**
 * S2 → S3 → S4 → S5 as the user meets them (R2, R3, R4, R5, R7, R8, R16).
 * These run against the real reducer, the real engine and the real catalogue —
 * there is nothing to mock, because the only impure things in the app are storage
 * and one timer.
 */

async function toBasics(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Beach' }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })
  return user
}

function summaryBar(): HTMLElement {
  const bar = document.querySelector('.summary-bar')
  if (bar === null) throw new Error('no summary bar')
  return bar as HTMLElement
}

describe('S2 — trip basics (R2, R3)', () => {
  it('shows the summary bar with the pre-filled defaults', async () => {
    await toBasics()
    expect(summaryBar()).toHaveAttribute('role', 'status')
    expect(summaryBar().textContent).toBe(
      '5 nights · 2 travellers · from Bengaluru · ₹60,000',
    )
  })

  it('updates the summary bar as the party changes, before Continue', async () => {
    const user = await toBasics()
    const travellers = screen.getByLabelText('Travellers')
    await user.clear(travellers)
    await user.type(travellers, '4')

    await waitFor(() =>
      expect(summaryBar().textContent).toBe(
        '5 nights · 4 travellers · from Bengaluru · ₹60,000',
      ),
    )
  })

  it('advances to the first adaptive question with the same summary (R2)', async () => {
    const user = await toBasics()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Question 1 of 4')).toBeInTheDocument()
    expect(summaryBar().textContent).toBe(
      '5 nights · 2 travellers · from Bengaluru · ₹60,000',
    )
  })

  it('rejects an end date before the start date, inline, without advancing (R3)', async () => {
    const user = await toBasics()
    const end = screen.getByLabelText('End date') as HTMLInputElement
    fireEvent.change(end, { target: { value: '2026-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const error = await screen.findByText('End date must be after your start date')
    expect(error).toBeInTheDocument()
    expect(end).toHaveAttribute('aria-invalid', 'true')
    expect(end.getAttribute('aria-describedby')).toContain(error.id)
    expect(error.id).toBe('err-endDate')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your trip basics' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(end))
  })

  it('rejects a zero budget with the exact message (R3)', async () => {
    const user = await toBasics()
    const budget = screen.getByLabelText('Total budget for the whole party')
    fireEvent.change(budget, { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const error = await screen.findByText('Enter a budget of at least ₹5,000')
    expect(budget).toHaveAttribute('aria-invalid', 'true')
    expect(budget.getAttribute('aria-describedby')).toContain(error.id)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your trip basics' }),
    ).toBeInTheDocument()
  })

  it('summarises two problems at once and keeps both inline messages', async () => {
    const user = await toBasics()
    fireEvent.change(screen.getByLabelText('Total budget for the whole party'), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByLabelText('Travellers'), { target: { value: '13' } })
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('2 things to fix before we can plan')).toBeInTheDocument()
    expect(screen.getAllByText('Enter a budget of at least ₹5,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Travellers must be between 1 and 12').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your trip basics' }),
    ).toBeInTheDocument()
  })
})

describe('S3 — the adaptive questions (R4, R5, R6)', () => {
  async function toQuestions() {
    const user = await toBasics()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Question 1 of 4')
    return user
  }

  it('carries No preference, Back and Plan my trip now on every render', async () => {
    const user = await toQuestions()
    for (let i = 0; i < 2; i += 1) {
      expect(screen.getByRole('button', { name: /No preference/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Plan my trip now' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /No preference/ }))
      await waitFor(() =>
        expect(screen.getByText(`Question ${i + 2} of 3`)).toBeInTheDocument(),
      )
    }
  })

  it('branches to long-haul on International and to the coast within India (R4)', async () => {
    const user = await toQuestions()
    await user.click(screen.getByRole('button', { name: /International/ }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'How long a flight are you willing to sit through?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Happy with long-haul/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: /Within India/ }))

    const coast = await screen.findByRole('heading', {
      level: 1,
      name: 'Which coast are you drawn to?',
    })
    expect(coast).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('long-haul')
  })

  it('shows the previous answer selected when the user goes Back (R6)', async () => {
    const user = await toQuestions()
    await user.click(screen.getByRole('button', { name: /Within India/ }))
    await screen.findByText('Question 2 of 4')
    await user.click(screen.getByRole('button', { name: /West coast/ }))
    await screen.findByText('Question 3 of 4')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    const west = await screen.findByRole('button', { name: /West coast/ })
    expect(west).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Question 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Within India/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('S4 and S5 — the plan (R5, R7, R8, R9, R13, R16)', () => {
  it('skips to a complete plan and says how many answers it filled in', async () => {
    const user = await toBasics()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Question 1 of 4')

    await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
    expect(
      await screen.findByText('Scoring 14 destinations against your answers'),
    ).toBeInTheDocument()

    const heading = await screen.findByRole('heading', { level: 1, name: /Kochi|Goa|Puducherry|Havelock|Manali|Gangtok/ }, { timeout: 3000 })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('3 questions answered for you')).toBeInTheDocument()

    // R7 — six day blocks for a 5-night trip, each with a named experience.
    const days = screen.getAllByRole('heading', { level: 3 })
    expect(days).toHaveLength(6)
    days.forEach((day, index) => expect(day.textContent).toContain(`Day ${index + 1}`))
    for (const day of days) {
      const block = day.closest('section')!
      expect(within(block).getAllByRole('listitem').length).toBeGreaterThanOrEqual(1)
    }

    // R8 — the four line items sum to the displayed total.
    const amount = (key: string): number => {
      const cell = document.querySelector(`[data-cost="${key}"]`)
      return Number((cell?.textContent ?? '').replace(/[^\d]/g, ''))
    }
    expect(
      amount('travel') + amount('stay') + amount('experiences') + amount('localAllowance'),
    ).toBe(amount('total'))
    expect(amount('perPerson')).toBe(Math.round(amount('total') / 2 / 100) * 100)

    // R9 and R13 — a budget line and a visible, catalogue-stamped plan ID.
    expect(
      screen.getByText(/under your budget|On budget|Stretch — |Nothing in this catalogue/),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Plan [A-Z]{4}-5N-2P-B60-[0-9a-z]{4} · catalogue 2026-08-01$/)).toBeInTheDocument()

    // R16 — the provenance line is on the screen that shows the prices.
    expect(screen.getByText(PROVENANCE_TEXT)).toBeInTheDocument()
  })

  it('names nothing Book, Pay, Checkout or Reserve on the plan screen (R16)', async () => {
    const user = await toBasics()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Question 1 of 4')
    await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
    await screen.findByText('3 questions answered for you', undefined, { timeout: 3000 })

    const banned = /^(book|booking|pay|checkout|reserve)$/i
    for (const element of screen.getAllByRole('button')) {
      expect(banned.test((element.textContent ?? '').trim())).toBe(false)
    }
    expect(banned.test(document.body.textContent ?? '')).toBe(false)
  })
})
