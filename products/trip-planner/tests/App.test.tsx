import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { SummaryBar } from '../src/ui/components/SummaryBar'
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary'
import { PROVENANCE_TEXT } from '../src/ui/components/ProvenanceLine'

describe('App shell', () => {
  it('starts on the vibe screen with the skip link first in the tab order', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toBeInTheDocument()

    await user.tab()
    expect(document.activeElement).toHaveTextContent('Skip to content')
  })

  it('carries the provenance line on the vibe screen (R16)', () => {
    render(<App />)
    const provenance = screen.getByText(PROVENANCE_TEXT)
    expect(provenance).toBeInTheDocument()
    expect(provenance.textContent).toContain('indicative')
    expect(provenance.textContent).toContain('2026-08-01')
  })

  it('gives the provenance line no dismiss control (R16)', () => {
    const { container } = render(<App />)
    const footer = container.querySelector('footer')
    expect(footer).not.toBeNull()
    expect(footer?.querySelector('button')).toBeNull()
  })

  it('names no control Book, Pay, Checkout or Reserve (R16)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const banned = /^(book|booking|pay|checkout|reserve)$/i
    for (const el of screen.getAllByRole('button')) {
      expect(banned.test((el.textContent ?? '').trim())).toBe(false)
    }
  })

  it('renders no summary bar until there is something to summarise', () => {
    render(<App />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('advances off the vibe screen on Continue and moves focus to the new h1', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Trip basics are next')
    expect(document.activeElement).toBe(heading)
    expect(
      screen.queryByRole('heading', { name: 'What kind of trip do you want?' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the chosen vibe when the user comes back', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(/your Beach choice is remembered/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change your vibe' }))
    expect(screen.getByRole('button', { name: 'Beach' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})

describe('SummaryBar', () => {
  it('renders nothing when there are no facts', () => {
    const { container } = render(<SummaryBar facts={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is a polite atomic status region with · separated facts when it has them', () => {
    render(<SummaryBar facts={['5 nights', '2 travellers', 'from Bengaluru', '₹60,000']} />)
    const bar = screen.getByRole('status')
    expect(bar).toHaveAttribute('aria-live', 'polite')
    expect(bar).toHaveAttribute('aria-atomic', 'true')
    expect(bar.textContent).toBe('5 nights · 2 travellers · from Bengaluru · ₹60,000')
  })
})

describe('ErrorBoundary', () => {
  function Boom({ explode }: { explode: boolean }) {
    if (explode) throw new Error('boom')
    return <p>recovered</p>
  }

  it('catches a render throw, logs E-RENDER and offers a working Start over', async () => {
    const user = userEvent.setup()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Host() {
      const [explode, setExplode] = useState(true)
      return (
        <ErrorBoundary onStartOver={() => setExplode(false)}>
          <Boom explode={explode} />
        </ErrorBoundary>
      )
    }

    render(<Host />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(errors.mock.calls.some((call) => call[0] === '[compass] E-RENDER')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
