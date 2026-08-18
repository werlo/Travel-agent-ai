import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { VibeScreen } from '../src/ui/screens/VibeScreen'
import type { Vibe } from '../src/domain/types'

/** R1 — the six vibes, in the order the design puts them on screen. */
const LABELS = ['Mountains', 'Beach', 'Party', 'Honeymoon', 'Peace & Quiet', 'Culture & Food']

function Harness({ onContinue = () => {} }: { onContinue?: () => void }) {
  const [vibe, setVibe] = useState<Vibe | null>(null)
  return <VibeScreen selected={vibe} onSelect={setVibe} onContinue={onContinue} />
}

function cards(): HTMLElement[] {
  return screen.getAllByRole('button').filter((el) => el.hasAttribute('aria-pressed'))
}

describe('S1 — Vibe screen (R1)', () => {
  it('renders exactly six vibe cards with the named labels, in order', () => {
    render(<Harness />)
    const names = cards().map((el) => el.textContent ?? '')
    expect(names).toHaveLength(6)
    LABELS.forEach((label, i) => {
      expect(names[i]).toContain(label)
    })
  })

  it('names each card by its label alone, so the description cannot bleed into it', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Beach' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Peace & Quiet' })).toBeInTheDocument()
  })

  it('shows the designer’s heading, sub-copy and card descriptions', () => {
    render(<Harness />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'What kind of trip do you want?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Pick a vibe\. We’ll ask three or four quick questions/),
    ).toBeInTheDocument()
    expect(screen.getByText('Sand, sea, and not much of a plan.')).toBeInTheDocument()
    expect(screen.getByText('Nobody around, nothing scheduled.')).toBeInTheDocument()
  })

  it('starts with no card pressed, Continue disabled and the helper text shown', () => {
    render(<Harness />)
    expect(cards().every((el) => el.getAttribute('aria-pressed') === 'false')).toBe(true)

    const cont = screen.getByRole('button', { name: 'Continue' })
    expect(cont).toBeDisabled()

    const hint = screen.getByText('Pick a vibe to continue.')
    expect(cont).toHaveAttribute('aria-describedby', hint.id)
  })

  it('selects Beach on click: aria-pressed flips, Continue enables, helper is removed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Beach' }))

    const pressed = cards().filter((el) => el.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAttribute('data-vibe', 'beach')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.queryByText('Pick a vibe to continue.')).not.toBeInTheDocument()
  })

  it('moves the selection rather than adding one, and never returns to zero', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Mountains' }))

    const pressed = cards().filter((el) => el.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAttribute('data-vibe', 'mountains')

    await user.click(screen.getByRole('button', { name: 'Mountains' }))
    expect(cards().filter((el) => el.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('is operable from the keyboard: Tab to a card, Enter selects, Space selects', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mountains' }))

    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Beach' })).toHaveAttribute('aria-pressed', 'true')

    await user.tab()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Party' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Beach' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not respond to arrow keys, so a stray key cannot change an answer', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.keyboard('{ArrowRight}{ArrowDown}')

    expect(cards().every((el) => el.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('does not continue while nothing is selected, and continues once one is', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(<Harness onContinue={onContinue} />)

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
