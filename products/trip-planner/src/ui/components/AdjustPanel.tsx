import { useEffect, useRef, useState } from 'react'
import type { Basics } from '../../domain/types'
import {
  orderedErrors,
  validateBasics,
  type BasicsErrors,
  type BasicsField,
} from '../../domain/validate'
import { describedBy, FieldError, FieldMessage, hintId } from './Field'

/**
 * R12 — adjust budget and travellers and re-plan, without re-answering anything
 * (docs/03-design.md §4 S5 "Adjust panel", docs/02-architecture.md §7).
 *
 * **The inputs are uncontrolled and the engine runs only on Apply.** React never
 * owns their value; `onInput` does one string comparison to decide whether
 * `Update plan` is enabled, and nothing else. Re-planning on change would run the
 * engine on every digit of `60000` — five runs, harmless at 0.10ms today and 46ms
 * of jank at 1,400 destinations. R12's own wording ("sets travellers to 4 and
 * applies") sanctions the button.
 *
 * The panel re-syncs from `basics` after an apply rather than remounting, so the
 * user never loses their place; where focus lands afterwards is explained at
 * `lastEdited` below.
 *
 * Validation is `validateBasics` — the same function and therefore the same strings
 * as S2 (R3). An invalid value leaves the plan on screen completely untouched.
 */

const FIELDS: Record<'travellers' | 'budget', { id: string; label: string }> = {
  travellers: { id: 'adjust-travellers', label: 'Travellers' },
  budget: { id: 'adjust-budget', label: 'Total budget' },
}

export interface AdjustPanelProps {
  /** The basics behind the plan currently on screen. */
  basics: Basics
  onApply: (basics: Basics) => void
}

export function AdjustPanel({ basics, onApply }: AdjustPanelProps) {
  const travellersRef = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<BasicsErrors>({})
  /**
   * Where focus goes after a successful apply.
   *
   * docs/03-design.md §4 S5 says focus "stays on `Update plan`", but the same
   * section disables that button the moment the values match the plan again — and
   * a disabled control cannot hold focus, so focus would land on `<body>`, which
   * §6.1 forbids outright. It goes back to the field the user just edited instead:
   * focus is never lost, and a second adjustment is one keystroke away rather than
   * a tab journey from the top of the page.
   */
  const lastEdited = useRef<'travellers' | 'budget'>('travellers')
  const applied = useRef(false)

  const appliedTravellers = String(basics.travellers)
  const appliedBudget = String(basics.budget)

  // After an apply the typed values *are* the applied values, so this only has to
  // put the button back to its resting state. It also covers the case where the
  // basics change from somewhere else — the panel must never claim a pending edit
  // that no longer exists.
  useEffect(() => {
    if (travellersRef.current !== null) travellersRef.current.value = appliedTravellers
    if (budgetRef.current !== null) budgetRef.current.value = appliedBudget
    setDirty(false)
    setErrors({})
    if (applied.current) {
      applied.current = false
      const field = lastEdited.current === 'budget' ? budgetRef.current : travellersRef.current
      field?.focus()
    }
  }, [appliedTravellers, appliedBudget])

  const readValues = (): { travellers: string; budget: string } => ({
    travellers: travellersRef.current?.value ?? appliedTravellers,
    budget: budgetRef.current?.value ?? appliedBudget,
  })

  const onInput = (field: 'travellers' | 'budget'): void => {
    lastEdited.current = field
    const values = readValues()
    setDirty(
      values.travellers.trim() !== appliedTravellers ||
        values.budget.trim() !== appliedBudget,
    )
  }

  const focusField = (field: BasicsField): void => {
    if (field === 'travellers') travellersRef.current?.focus()
    if (field === 'budget') budgetRef.current?.focus()
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const values = readValues()
    const result = validateBasics({
      startDate: basics.startDate,
      endDate: basics.endDate,
      origin: basics.origin,
      travellers: values.travellers,
      budget: values.budget,
    })

    const problems = orderedErrors(result.errors)
    if (problems.length > 0 || result.basics === null) {
      setErrors(result.errors)
      const first = problems[0]
      if (first !== undefined) focusField(first[0])
      return
    }

    setErrors({})
    applied.current = true
    onApply(result.basics)
  }

  const listed = orderedErrors(errors)

  return (
    <section className="plan-section plan-section--adjust">
      <form className="adjust" onSubmit={submit} noValidate>
        <fieldset className="adjust__set">
          <legend className="adjust__legend">Adjust and re-plan</legend>
          <p className="adjust__sub">
            {"Change these and we'll re-price without asking the questions again."}
          </p>

          <div className="adjust__fields">
            <div className="field">
              <label className="field__label" htmlFor={FIELDS.travellers.id}>
                {FIELDS.travellers.label}
              </label>
              <input
                id={FIELDS.travellers.id}
                ref={travellersRef}
                className="field__control"
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                defaultValue={appliedTravellers}
                aria-invalid={errors.travellers !== undefined}
                aria-describedby={describedBy(
                  FIELDS.travellers.id,
                  false,
                  errors.travellers !== undefined,
                )}
                onInput={() => onInput('travellers')}
              />
              <FieldMessage>
                {errors.travellers !== undefined ? (
                  <FieldError
                    field={FIELDS.travellers.id}
                    message={errors.travellers}
                    alert={listed[0]?.[0] === 'travellers'}
                  />
                ) : null}
              </FieldMessage>
            </div>

            <div className="field">
              <label className="field__label" htmlFor={FIELDS.budget.id}>
                {FIELDS.budget.label}
              </label>
              <div className="field__money">
                <span className="field__prefix" aria-hidden="true">
                  ₹
                </span>
                <input
                  id={FIELDS.budget.id}
                  ref={budgetRef}
                  className="field__control field__control--money"
                  type="number"
                  inputMode="numeric"
                  defaultValue={appliedBudget}
                  aria-invalid={errors.budget !== undefined}
                  aria-describedby={describedBy(
                    FIELDS.budget.id,
                    false,
                    errors.budget !== undefined,
                  )}
                  onInput={() => onInput('budget')}
                />
              </div>
              <FieldMessage>
                {errors.budget !== undefined ? (
                  <FieldError
                    field={FIELDS.budget.id}
                    message={errors.budget}
                    alert={listed[0]?.[0] === 'budget'}
                  />
                ) : null}
              </FieldMessage>
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="btn btn--primary adjust__apply"
          disabled={!dirty}
          aria-describedby={dirty ? undefined : hintId('adjust')}
        >
          Update plan
        </button>
        {dirty ? null : (
          <p className="adjust__hint" id={hintId('adjust')}>
            Nothing has changed yet.
          </p>
        )}
      </form>
    </section>
  )
}
