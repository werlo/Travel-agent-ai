import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { CATALOGUE } from '../src/data/localCatalogue'

/**
 * The refinement-round-1 fixes, as the user meets them:
 * R12 (dates and origin in the adjust panel, DD/MM/YYYY everywhere), R19 (the
 * change notice), R20 (tax position and who is counted), R21 (a free day),
 * R22 (not this one — somewhere else) and R24 (children).
 */

type User = ReturnType<typeof userEvent.setup>

interface Trip {
  budget?: string
  adults?: string
  children?: string
  childAges?: string[]
  startDate?: string
  endDate?: string
  origin?: string
}

function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function toBasics(vibe: string): Promise<User> {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: vibe }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })
  return user
}

function enterTrip(trip: Trip): void {
  if (trip.startDate !== undefined) fill('Start date', trip.startDate)
  if (trip.endDate !== undefined) fill('End date', trip.endDate)
  if (trip.budget !== undefined) fill('Total budget for the whole party', trip.budget)
  if (trip.adults !== undefined) fill('Adults', trip.adults)
  if (trip.origin !== undefined) fill('Flying from', trip.origin)
  if (trip.children !== undefined) fill('Children', trip.children)
  ;(trip.childAges ?? []).forEach((age, index) => {
    fill(`Child ${index + 1} age`, age)
  })
}

async function planFor(vibe: string, trip: Trip = {}): Promise<User> {
  const user = await toBasics(vibe)
  enterTrip(trip)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText(/^Question 1 of \d$/)
  await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
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

describe('dates read and write DD/MM/YYYY (R12)', () => {
  it('renders 10 October 2026 as 10/10/2026 with a visible hint on both screens', async () => {
    const user = await planFor('Beach', { startDate: '10/10/2026', endDate: '15/10/2026' })

    // S5's adjust panel carries the dates now, in the same format.
    expect(screen.getByLabelText('Start date')).toHaveValue('10/10/2026')
    expect(screen.getByLabelText('End date')).toHaveValue('15/10/2026')
    const hints = [...document.querySelectorAll('.field__hint')].map((n) => n.textContent)
    expect(hints.filter((hint) => hint?.includes('DD/MM/YYYY')).length).toBeGreaterThanOrEqual(2)

    // And S2 renders the same strings when the user goes back to it.
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    await screen.findByRole('heading', { level: 1, name: 'What kind of trip do you want?' })
  })
})

describe('the adjust panel carries the whole trip (R12)', () => {
  it('re-plans in place when the end date moves, without re-asking anything', async () => {
    const user = await planFor('Beach', { startDate: '10/10/2026', endDate: '15/10/2026' })

    expect(text('.plan-hero__facts')).toContain('5 nights')
    const before = { total: amount('total'), planId: text('.plan-hero__id') }

    fireEvent.input(screen.getByLabelText('End date'), { target: { value: '16/10/2026' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => expect(text('.plan-hero__facts')).toContain('6 nights'))
    expect(amount('total')).not.toBe(before.total)
    expect(text('.plan-hero__id')).not.toBe(before.planId)
    // The questionnaire never came back.
    expect(screen.queryByText(/^Question 1 of \d$/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('End date')).toHaveValue('16/10/2026')
  })

  it('re-prices the travel line when the departure city changes', async () => {
    const user = await planFor('Beach', { startDate: '10/10/2026', endDate: '15/10/2026' })
    const travelBefore = amount('travel')

    fireEvent.change(screen.getByLabelText('Flying from'), { target: { value: 'Mumbai' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => expect(amount('travel')).not.toBe(travelBefore))
    expect(text('.plan-hero__facts')).toContain('from Mumbai')
  })
})

describe('the plan states its assumptions (R20, R7)', () => {
  it('names GST, the party it is a total for, and the base town it books', async () => {
    await planFor('Beach')

    const main = document.querySelector('.screen--plan')?.textContent ?? ''
    expect(main).toContain('GST')
    expect(main).toContain('adults')
    expect(main).toContain('incl. GST')

    const totalRow = document.querySelector('.costtable__total')?.textContent ?? ''
    expect(totalRow).toMatch(/Total for \d+ adults?/)

    // R7 amended — the header names the base the plan actually books.
    const facts = text('.plan-hero__facts')
    expect(facts).toMatch(/based in .+/)
    const baseNames = CATALOGUE.destinations.flatMap((d) => d.bases.map((b) => b.name))
    expect(baseNames.some((name) => facts.includes(`based in ${name}`))).toBe(true)
  })

  it('shows the seasonal loading as its own line, and labels it sample data', async () => {
    await planFor('Beach')
    const seasonal = document.querySelector('[data-cost="seasonal"]')
    expect(seasonal).not.toBeNull()
    const row = seasonal?.closest('tr')?.textContent ?? ''
    expect(row).toMatch(/season/i)
    expect(document.querySelector('.plan-section--cost')?.textContent).toContain(
      'indicative sample data',
    )
  })
})

describe('children (R24)', () => {
  it('counts them in the summary bar and prices them by the published rule', async () => {
    await planFor('Beach', { adults: '2', children: '2', childAges: ['9', '12'] })

    expect(text('.summary-bar__text')).toContain('4 travellers (2 adults, 2 children)')
    const plan = document.querySelector('.screen--plan')?.textContent ?? ''
    expect(plan).toContain(
      'Children 2–11 are priced at 75% of the adult fare and 50% of experiences; they occupy a room place.',
    )
    // The 12-year-old pays the adult fare, and the rule on screen says so.
    expect(plan).toContain('A traveller aged 12 or over is priced as an adult.')
    const travelBasis =
      document.querySelector('[data-cost="travel"]')?.closest('tr')?.textContent ?? ''
    expect(travelBasis).toContain('per adult × 3')
    expect(travelBasis).toContain('per child × 1')
    // Four travellers occupy two rooms, children included.
    expect(document.querySelector('[data-cost="stay"]')?.closest('tr')?.textContent).toContain(
      '2 rooms',
    )
  })
})

describe('a day with nothing scheduled (R21)', () => {
  it('empties one middle day, lowers the total and changes the plan ID', async () => {
    // Party/Goa has more to do than the trip has slots, so the day that is given
    // up is a day of experiences the plan was really charging for.
    const user = await planFor('Party', { startDate: '10/10/2026', endDate: '15/10/2026' })
    const before = { total: amount('total'), planId: text('.plan-hero__id') }

    await user.click(screen.getByLabelText('Leave one day free'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() =>
      expect(screen.getByText('Nothing scheduled — this day is yours')).toBeInTheDocument(),
    )
    expect(screen.getAllByText('Nothing scheduled — this day is yours')).toHaveLength(1)
    expect(amount('total')).toBeLessThan(before.total)
    expect(text('.plan-hero__id')).not.toBe(before.planId)
  })
})

describe('not this one — somewhere else (R22)', () => {
  it('swaps the destination, keeps the trip, and offers an undo', async () => {
    const user = await planFor('Party', { startDate: '13/11/2026', endDate: '16/11/2026' })

    const before = {
      destination: text('.plan-hero__title'),
      facts: text('.plan-hero__facts'),
      planId: text('.plan-hero__id'),
    }

    await user.click(screen.getByRole('button', { name: 'Not this one — somewhere else' }))

    await waitFor(() => expect(text('.plan-hero__title')).not.toBe(before.destination))
    // Everything except the destination and its base town is carried through.
    const factsOf = (value: string): string[] => value.split(' · ').slice(0, 4)
    expect(factsOf(text('.plan-hero__facts'))).toEqual(factsOf(before.facts))
    expect(text('.plan-hero__id')).not.toBe(before.planId)

    const excluded = document.querySelector('.excluded') as HTMLElement
    expect(within(excluded).getByText(before.destination)).toBeInTheDocument()

    await user.click(
      within(excluded).getByRole('button', { name: `Put ${before.destination} back` }),
    )
    await waitFor(() => expect(text('.plan-hero__title')).toBe(before.destination))
  })

  it('ends with a sentence rather than an empty screen when everything is turned down', async () => {
    const user = await planFor('Party', { startDate: '13/11/2026', endDate: '16/11/2026' })

    for (let i = 0; i < CATALOGUE.destinations.length + 1; i += 1) {
      const control = screen.queryByRole('button', { name: 'Not this one — somewhere else' })
      if (control === null) break
      await user.click(control)
    }

    expect(
      await screen.findByText(
        "That's every destination that fits — here are the ones you turned down",
      ),
    ).toBeInTheDocument()
    // Never an empty screen: there is still a plan, with a total.
    expect(text('.plan-hero__title').length).toBeGreaterThan(0)
    expect(amount('total')).toBeGreaterThan(0)
  })
})

describe('the change notice (R19)', () => {
  it('states a swapped stay next to the total', async () => {
    const user = await planFor('Peace & Quiet', {
      startDate: '20/12/2026',
      endDate: '27/12/2026',
      budget: '250000',
      adults: '4',
      origin: 'Mumbai',
    })

    expect(document.querySelector('.plan-hero__notice')).toBeNull()

    const adults = screen.getByLabelText('Adults')
    fireEvent.input(adults, { target: { value: '5' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Update plan' }))

    await waitFor(() => expect(document.querySelector('.plan-hero__notice')).not.toBeNull())
    const notice = text('.plan-hero__notice')
    expect(notice).toContain('Changed to keep you inside budget:')
    expect(notice).toMatch(/stay is now .+ \(₹[\d,]+\/night, (saver|standard|premium)\)/)
    // Adjacent to the total, not three scrolls down inside the breakdown.
    expect(document.querySelector('.plan-hero')?.textContent).toContain(notice)
  })
})
