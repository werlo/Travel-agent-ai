import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

/**
 * S6 — the export dialog (R17, docs/03-design.md §4 S6).
 *
 * The text is on screen before the clipboard is touched, and it stays there
 * whatever the clipboard does. That ordering is the whole design: a copy control
 * that can fail silently is worse than no copy control, and `navigator.clipboard`
 * is genuinely unavailable on an insecure origin, so the fallback is a built path
 * rather than an edge case.
 *
 * Focus is trapped by the platform (`<dialog>` + `showModal()`), never by us.
 * Where `showModal` does not exist the dialog degrades to the `open` attribute —
 * the content is still reachable and Esc still closes it through our own handler.
 */

export const COPY_FAILED_MESSAGE =
  "We couldn't copy automatically. The text is selected — press Ctrl+C (or Cmd+C) to copy it."

/**
 * R17 (amended) — why this dialog opened at all. `Copy as text` now writes to the
 * clipboard in the same click; this dialog is the fallback, and it says so.
 */
export const CLIPBOARD_FAILED_MESSAGE =
  "Couldn't reach the clipboard — copy it from here"

/** How long `Copy` reads `Copied` before reverting (docs/03-design.md §4 S6). */
export const COPIED_MS = 2000

type CopyState = 'idle' | 'copied' | 'failed'

export interface ExportDialogProps {
  /** The plan as plain text — built by `domain/export.toPlainText`. */
  text: string
  /** Set when the dialog opened because the clipboard refused us (R17). */
  failureMessage?: string | null
  onClose: () => void
}

/** Mounted means open: S5 renders it only while the dialog is showing. */
export function ExportDialog({ text, failureMessage = null, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [state, setState] = useState<CopyState>('idle')
  const revertTimer = useRef<number | null>(null)

  const clearTimer = useCallback((): void => {
    if (revertTimer.current !== null) {
      window.clearTimeout(revertTimer.current)
      revertTimer.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return undefined

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    // Focus lands on the text with everything selected, so Ctrl+C works before
    // the user has reached the button (docs/03-design.md §4 S6, Default).
    const textarea = textareaRef.current
    textarea?.focus()
    textarea?.select()

    return () => {
      if (!dialog.open) return
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [])

  const copy = async (): Promise<void> => {
    clearTimer()
    try {
      const clipboard = navigator.clipboard
      if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
        throw new Error('clipboard unavailable')
      }
      await clipboard.writeText(text)
      setState('copied')
      revertTimer.current = window.setTimeout(() => {
        revertTimer.current = null
        setState('idle')
      }, COPIED_MS)
    } catch (error) {
      console.warn('[compass] E-CLIPBOARD', error)
      setState('failed')
      const textarea = textareaRef.current
      textarea?.focus()
      textarea?.select()
    }
  }

  return (
    <dialog
      className="dialog"
      ref={dialogRef}
      aria-labelledby="export-title"
      // Only `cancel` (Esc) is wired, never `close`: `close` also fires when this
      // component's own cleanup closes the dialog, and calling back into the
      // parent from there would make the dialog un-openable under StrictMode's
      // double-invoked effects.
      onCancel={onClose}
      onClick={(event) => {
        // The backdrop is the dialog element itself; a click on the panel inside
        // it has a different target (docs/03-design.md §4 S6, Closed).
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="dialog__panel">
        <h2 className="dialog__title" id="export-title">
          Copy your trip
        </h2>
        <p className="dialog__sub">
          Plain text, ready to paste into WhatsApp, Slack or an email.
        </p>
        {failureMessage !== null ? (
          <p className="dialog__failure" role="alert" data-failure="clipboard">
            {failureMessage}
          </p>
        ) : null}

        <label className="visually-hidden" htmlFor="export-text">
          Your trip as plain text
        </label>
        <textarea
          id="export-text"
          ref={textareaRef}
          className="dialog__text"
          readOnly
          rows={12}
          value={text}
        />

        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={() => void copy()}>
            {state === 'copied' ? (
              <>
                <Icon name="check" size={16} className="btn__glyph" />
                Copied
              </>
            ) : (
              <>
                <Icon name="copy" size={16} className="btn__glyph" />
                Copy
              </>
            )}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {state === 'failed' ? (
          <p className="dialog__failure" role="alert">
            {COPY_FAILED_MESSAGE}
          </p>
        ) : null}

        <p className="visually-hidden" role="status" aria-live="polite">
          {state === 'copied' ? 'Copied' : ''}
        </p>
      </div>
    </dialog>
  )
}
