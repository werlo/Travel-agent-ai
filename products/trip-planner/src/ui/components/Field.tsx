import type { ReactNode as _ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * The form primitives of docs/03-design.md §3: FieldHint, FieldError and the
 * label/control wrapper they attach to.
 *
 * `aria-describedby` points at `hint-x err-x`, in that order, and the error id is
 * only in the list while the error exists (R3, §6.4).
 */

export function hintId(field: string): string {
  return `hint-${field}`
}

export function errorId(field: string): string {
  return `err-${field}`
}

export function describedBy(field: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? hintId(field) : null, hasError ? errorId(field) : null].filter(
    (id): id is string => id !== null,
  )
  return ids.length === 0 ? undefined : ids.join(' ')
}

/**
 * The error's slot is always in the layout, whether or not there is an error.
 *
 * That is not cosmetic: validation runs on blur, so clicking Continue from inside
 * a field can make an error appear *between* mousedown and mouseup. Without a
 * reserved line the action row moves under the pointer and the click never lands —
 * the form silently does nothing. Reserving the line makes showing and hiding an
 * error a zero-shift operation.
 */
export function FieldMessage({ children }: { children: _ReactNode }) {
  return <div className="field__message">{children}</div>
}

export interface FieldErrorProps {
  field: string
  message: string
  /** `role="alert"` goes on the first error only; the rest are read via describedby. */
  alert: boolean
}

export function FieldError({ field, message, alert }: FieldErrorProps) {
  return (
    <p
      id={errorId(field)}
      className="field__error"
      {...(alert ? { role: 'alert' as const } : {})}
    >
      <Icon name="alert-triangle" size={16} className="field__error-glyph" />
      {message}
    </p>
  )
}
