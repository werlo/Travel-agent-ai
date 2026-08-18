import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { CLIPBOARD_FAILED_MESSAGE, COPY_FAILED_MESSAGE } from '../src/ui/screens/ExportDialog'

/**
 * R17, as amended by customer fix 4: **the button copies.**
 *
 * It used to open this dialog with the text pre-selected and leave the user to
 * press Ctrl+C — two judges clicked it, pasted nothing, and said the label lied.
 * The dialog is now the fallback: it opens when `navigator.clipboard` is missing
 * or refuses, which is exactly what an insecure origin does, and it says so.
 *
 * jsdom implements no `HTMLDialogElement.showModal`, which is convenient rather
 * than awkward: the un-modal fallback is a real browser state and the design
 * requires it to keep working.
 */

type User = ReturnType<typeof userEvent.setup>

async function toPlan(): Promise<User> {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Beach' }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 1, name: 'Your trip basics' })
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText(/^Question 1 of \d$/)
  await user.click(screen.getByRole('button', { name: 'Plan my trip now' }))
  await waitFor(
    () => expect(document.querySelector('.plan-hero__id')?.textContent ?? '').toMatch(/· catalogue 2026-08-01$/),
    { timeout: 4000 },
  )
  return user
}

/**
 * `userEvent.setup()` installs its own `navigator.clipboard` stub, so the spy has
 * to be installed *after* the user is set up or it is silently replaced.
 */
function installClipboard(
  writeText: ReturnType<typeof vi.fn>,
): ReturnType<typeof vi.fn> {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

function grantClipboard(): ReturnType<typeof vi.fn> {
  return installClipboard(vi.fn().mockResolvedValue(undefined))
}

function denyClipboard(): ReturnType<typeof vi.fn> {
  return installClipboard(
    vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
  )
}

/** The fallback path: a refused clipboard is the only way the dialog opens now. */
async function openDialog(): Promise<{ user: User; textarea: HTMLTextAreaElement }> {
  const user = await toPlan()
  denyClipboard()
  await user.click(screen.getByRole('button', { name: 'Copy as text' }))
  const textarea = (await screen.findByLabelText(
    'Your trip as plain text',
  )) as HTMLTextAreaElement
  return { user, textarea }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Copy as text copies (R17)', () => {
  it('writes the itinerary to the clipboard in the same click and announces Copied', async () => {
    const user = await toPlan()
    const writeText = grantClipboard()

    await user.click(screen.getByRole('button', { name: 'Copy as text' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copied = writeText.mock.calls[0]?.[0] as string
    const destination = document.querySelector('.plan-hero__title')?.textContent ?? ''
    expect(destination.length).toBeGreaterThan(0)
    expect(copied).toContain(destination)
    expect(copied.split('\n').filter((line) => /^Day \d+ — /.test(line))).toHaveLength(6)

    const announced = [...document.querySelectorAll('[role="status"]')].some(
      (node) => (node.textContent ?? '').trim() === 'Copied',
    )
    expect(announced).toBe(true)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('does not open the dialog when the clipboard works', async () => {
    const user = await toPlan()
    grantClipboard()
    await user.click(screen.getByRole('button', { name: 'Copy as text' }))
    await screen.findByRole('button', { name: 'Copied' })
    expect(screen.queryByLabelText('Your trip as plain text')).not.toBeInTheDocument()
  })

  it('falls back to the dialog and names the failure when the clipboard refuses', async () => {
    const { textarea } = await openDialog()
    expect(await screen.findByText(CLIPBOARD_FAILED_MESSAGE)).toBeInTheDocument()
    expect(textarea.value.length).toBeGreaterThan(0)
  })
})

describe('S6 — the export dialog (R17, the fallback)', () => {
  it('is not on screen before anything is clicked', async () => {
    await toPlan()
    expect(screen.queryByLabelText('Your trip as plain text')).not.toBeInTheDocument()
    expect(screen.queryByText('Copy your trip')).not.toBeInTheDocument()
  })

  it('shows a read-only textarea holding the destination, dates, total and one line per day', async () => {
    const { textarea } = await openDialog()

    expect(screen.getByText('Copy your trip')).toBeInTheDocument()
    expect(
      screen.getByText('Plain text, ready to paste into WhatsApp, Slack or an email.'),
    ).toBeInTheDocument()
    expect(textarea).toHaveAttribute('readonly')

    const destination = document.querySelector('.plan-hero__title')?.textContent ?? ''
    const total = document.querySelector('[data-cost="total"]')?.textContent ?? ''
    expect(destination.length).toBeGreaterThan(0)
    expect(textarea.value).toContain(destination)
    expect(textarea.value).toContain(total)
    // The date range is whatever S2's defaults produced; the facts line is the
    // same string, so asserting they agree is stronger than a fixed date.
    const range = (document.querySelector('.plan-hero__facts')?.textContent ?? '').split(
      ' · ',
    )[1]
    expect(range).toMatch(/\d{4}$/)
    expect(textarea.value).toContain(range ?? '')

    const dayLines = textarea.value.split('\n').filter((line) => /^Day \d+ — /.test(line))
    expect(dayLines).toHaveLength(6)
  })

  it('focuses the text with everything selected, so Ctrl+C works immediately', async () => {
    const { textarea } = await openDialog()
    await waitFor(() => expect(textarea).toHaveFocus())
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(textarea.value.length)
  })

  it('writes the same text to the clipboard and announces Copied', async () => {
    const { user, textarea } = await openDialog()
    const writeText = grantClipboard()

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(textarea.value))
    const live = document.querySelector('.dialog [role="status"]')
    await waitFor(() => expect(live?.textContent).toBe('Copied'))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('reverts the button to Copy after the confirmation beat', async () => {
    const { user } = await openDialog()
    grantClipboard()

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await screen.findByRole('button', { name: 'Copied' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument(), {
      timeout: 4000,
    })
  })

  it('tells the user how to copy by hand when the clipboard is unavailable', async () => {
    const { user, textarea } = await openDialog()
    await user.click(screen.getByRole('button', { name: 'Copy' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((node) => node.textContent === COPY_FAILED_MESSAGE)).toBe(true)
    // The text is still on screen and re-selected, so the fallback is actionable.
    expect(textarea).toBeInTheDocument()
    expect(textarea.selectionEnd).toBe(textarea.value.length)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('closes on Close and returns focus to Copy as text', async () => {
    const { user } = await openDialog()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() =>
      expect(screen.queryByLabelText('Your trip as plain text')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Copy as text' })).toHaveFocus()
  })

  it('closes on Esc and returns focus to Copy as text', async () => {
    await openDialog()
    // jsdom does not implement the dialog's own Esc handling, so the platform
    // `cancel` event is dispatched directly — which is exactly what a browser fires.
    const dialog = document.querySelector('dialog')
    if (dialog === null) throw new Error('no dialog')
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))

    await waitFor(() =>
      expect(screen.queryByLabelText('Your trip as plain text')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Copy as text' })).toHaveFocus()
  })

  it('reopens clean — no stale Copied from the previous visit', async () => {
    const { user } = await openDialog()
    grantClipboard()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await screen.findByRole('button', { name: 'Copied' })
    await user.click(screen.getByRole('button', { name: 'Close' }))

    denyClipboard()
    await user.click(screen.getByRole('button', { name: 'Copy as text' }))
    expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(document.querySelector('.dialog [role="status"]')?.textContent).toBe('')
  })

  it('offers nothing named Book, Pay, Checkout or Reserve (R16)', async () => {
    await openDialog()
    const banned = /^(book|booking|pay|checkout|reserve)$/i
    for (const element of screen.getAllByRole('button')) {
      expect(banned.test((element.textContent ?? '').trim())).toBe(false)
    }
  })
})
