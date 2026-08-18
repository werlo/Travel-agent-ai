import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { PROVENANCE_TEXT } from '../src/ui/components/ProvenanceLine'

/**
 * R16 — the honesty audit, screen by screen.
 *
 * Two claims, and neither is decoration:
 *
 * 1. **Nothing in this app is named `Book`, `Booking`, `Pay`, `Checkout` or
 *    `Reserve`.** The names are computed by Testing Library (the same accessible
 *    name a screen reader would announce), not scraped from `textContent`, so an
 *    `aria-label` cannot smuggle one past.
 * 2. **Every screen that shows a price carries the provenance line**, with the word
 *    `indicative` and the snapshot date in it, and no control that can dismiss it.
 *
 * The E2E sweep in `e2e/control-export.spec.ts` walks *every* element in a real
 * browser; this is the fast version that runs on every `npm test`.
 */

const BANNED = /^\s*(book|booking|pay|checkout|reserve)\s*$/i

/** Every role the app actually renders — the sweep must cover all of them. */
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

function auditNames(where: string): void {
  for (const role of ROLES) {
    const offenders = screen.queryAllByRole(role, { name: BANNED })
    expect(offenders, `${where}: role="${role}" named like a transaction`).toEqual([])
  }
  // Labels are how a form control gets its name; sweep them directly too.
  for (const label of Array.from(document.querySelectorAll('label'))) {
    expect(BANNED.test(label.textContent ?? ''), `${where}: <label>`).toBe(false)
  }
  for (const labelled of Array.from(document.querySelectorAll('[aria-label]'))) {
    expect(
      BANNED.test(labelled.getAttribute('aria-label') ?? ''),
      `${where}: aria-label`,
    ).toBe(false)
  }
}

function auditProvenance(where: string): void {
  const footer = document.querySelector('footer.provenance')
  expect(footer, `${where}: no provenance footer`).not.toBeNull()
  expect(footer?.textContent).toBe(PROVENANCE_TEXT)
  expect(footer?.textContent).toContain('indicative')
  expect(footer?.textContent).toContain('2026-08-01')
  // Non-dismissable: there is nothing on it to press.
  expect(footer?.querySelectorAll('button, a, input')).toHaveLength(0)
}

describe('R16 — the honesty audit', () => {
  it('finds nothing transactional and a provenance line on every screen', async () => {
    const user = userEvent.setup()
    render(<App />)

    // S1 — vibe
    auditNames('S1')
    auditProvenance('S1')

    await user.click(screen.getByRole('button', { name: 'Beach' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })

    // S2 — basics
    auditNames('S2')
    auditProvenance('S2')

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText(/^Question 1 of \d$/)

    // S3 — an adaptive question
    auditNames('S3')
    auditProvenance('S3')

    await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
    await screen.findByText(/· catalogue 2026-08-01$/, undefined, { timeout: 4000 })

    // S5 — the plan. "Why this trip" is open on first render now (R19), so its
    // contents are swept without a click.
    expect(screen.getByText('Why this trip')).toHaveAttribute('aria-expanded', 'true')
    auditNames('S5')
    auditProvenance('S5')

    // S6 is the clipboard fallback now (R17 amended): it opens when the clipboard
    // refuses, which is what jsdom does with no stub installed.
    Reflect.deleteProperty(navigator, 'clipboard')
    await user.click(screen.getByRole('button', { name: 'Copy as text' }))
    await screen.findByLabelText('Your trip as plain text')

    // S6 — the export dialog, over a screen that shows a price
    auditNames('S6')
    auditProvenance('S6')
  })

  it('offers no way to transact from the plan screen, whatever the plan', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Party' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText(/^Question 1 of \d$/)
    await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
    await screen.findByText(/· catalogue 2026-08-01$/, undefined, { timeout: 4000 })

    auditNames('S5 party')

    // Every control on the plan screen does one of four things: export, adjust,
    // switch variant, or navigate. None of them is a transaction.
    const names = screen
      .getAllByRole('button')
      .map((button) => (button.textContent ?? '').trim())
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(BANNED.test(name)).toBe(false)
  })
})
