import { useEffect, useRef, useState } from 'react'
import { DATE_FORMAT_HINT, formatDMY } from '../../domain/dates'
import { ORIGIN_CITIES, type Basics } from '../../domain/types'
import {
  orderedErrors,
  validateBasics,
  type BasicsErrors,
  type BasicsField,
} from '../../domain/validate'
import { describedBy, FieldError, FieldMessage, hintId } from './Field'

/**
 * R12 (amended, customer fix 2) — adjust the trip and re-plan, without
 * re-answering anything (docs/03-design.md §4 S5 "Adjust panel").
 *
 * The panel used to model only travellers and budget, which made every other
 * change — a date that moved by a week, a different departure city — cost a
 * `Start over` that wiped the dates, the budget and the questionnaire. Every field
 * of the trip that is not an answer to a question now lives here, plus R21's free
 * day, so "Start over" is never the price of a change.
 *
 * **The inputs are uncontrolled and the engine runs only on Apply.** React never
 * owns their value; `onInput` does one string comparison to decide whether
 * `Update plan` is enabled, and nothing else. Re-planning on change would run the
 * engine on every digit of `60000`.
 *
 * Validation is `validateBasics` — the same function and therefore the same strings
 * as S2 (R3). An invalid value leaves the plan on screen completely untouched.
 */

type PanelField = 'startDate' | 'endDate' | 'travellers' | 'budget' | 'origin'

const FIELDS: Record<PanelField, { id: string; label: string }> = {
  startDate: { id: 'adjust-startDate', label: 'Start date' },
  endDate: { id: 'adjust-endDate', label: 'End date' },
  travellers: { id: 'adjust-travellers', label: 'Adults' },
  budget: { id: 'adjust-budget', label: 'Total budget' },
  origin: { id: 'adjust-origin', label: 'Flying from' },
}

export const FREE_DAY_LABEL = 'Leave one day free'

export interface AdjustPanelProps {
  /** The basics behind the plan currently on screen. */
  basics: Basics
  onApply: (basics: Basics) => void
}

export function AdjustPanel({ basics, onApply }: AdjustPanelProps) {
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const travellersRef = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const originRef = useRef<HTMLSelectElement>(null)
  const freeDayRef = useRef<HTMLInputElement>(null)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<BasicsErrors>({})
  /**
   * Where focus goes after a successful apply.
   *
   * docs/03-design.md §4 S5 says focus "stays on `Update plan`", but the same
   * section disables that button the moment the values match the plan again — and
   * a disabled control cannot hold focus, so focus would land on `<body>`, which
   * §6.1 forbids outright. It goes back to the field the user just edited instead.
   */
  const lastEdited = useRef<PanelField | 'freeDay'>('travellers')
  const applied = useRef(false)

  const appliedValues = {
    startDate: formatDMY(basics.startDate),
    endDate: formatDMY(basics.endDate),
    travellers: String(basics.adults),
    budget: String(basics.budget),
    origin: basics.origin,
  }
  const appliedFreeDay = basics.freeDay
  const appliedKey = `${appliedValues.startDate}|${appliedValues.endDate}|${appliedValues.travellers}|${appliedValues.budget}|${appliedValues.origin}|${appliedFreeDay}`

  const refFor = (field: PanelField): HTMLInputElement | HTMLSelectElement | null => {
    if (field === 'startDate') return startRef.current
    if (field === 'endDate') return endRef.current
    if (field === 'travellers') return travellersRef.current
    if (field === 'budget') return budgetRef.current
    return originRef.current
  }

  // After an apply the typed values *are* the applied values, so this only has to
  // put the button back to its resting state. It also covers the case where the
  // basics change from somewhere else — the panel must never claim a pending edit
  // that no longer exists.
  useEffect(() => {
    for (const field of Object.keys(FIELDS) as PanelField[]) {
      const el = refFor(field)
      if (el !== null) el.value = appliedValues[field]
    }
    if (freeDayRef.current !== null) freeDayRef.current.checked = appliedFreeDay
    setDirty(false)
    setErrors({})
    if (applied.current) {
      applied.current = false
      const target =
        lastEdited.current === 'freeDay' ? freeDayRef.current : refFor(lastEdited.current)
      target?.focus()
    }
    // `appliedKey` is every applied value in one string: the effect must run when
    // any of them changes and never on an unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey])

  const readValues = () => ({
    startDate: startRef.current?.value ?? appliedValues.startDate,
    endDate: endRef.current?.value ?? appliedValues.endDate,
    travellers: travellersRef.current?.value ?? appliedValues.travellers,
    budget: budgetRef.current?.value ?? appliedValues.budget,
    origin: originRef.current?.value ?? appliedValues.origin,
    freeDay: freeDayRef.current?.checked ?? appliedFreeDay,
  })

  const onInput = (field: PanelField | 'freeDay'): void => {
    lastEdited.current = field
    const values = readValues()
    setDirty(
      values.startDate.trim() !== appliedValues.startDate ||
        values.endDate.trim() !== appliedValues.endDate ||
        values.travellers.trim() !== appliedValues.travellers ||
        values.budget.trim() !== appliedValues.budget ||
        values.origin !== appliedValues.origin ||
        values.freeDay !== appliedFreeDay,
    )
  }

  const focusField = (field: BasicsField): void => {
    if (field === 'children') return
    refFor(field)?.focus()
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const values = readValues()
    const result = validateBasics({
      startDate: values.startDate,
      endDate: values.endDate,
      origin: values.origin,
      travellers: values.travellers,
      // Children are set on the basics screen and carried through untouched: a
      // re-plan must never quietly drop half the party.
      childAges: basics.children.map((age) => String(age)),
      budget: values.budget,
      freeDay: values.freeDay,
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

  const dateField = (
    field: 'startDate' | 'endDate',
    ref: React.RefObject<HTMLInputElement>,
  ) => (
    <div className="field">
      <label className="field__label" htmlFor={FIELDS[field].id}>
        {FIELDS[field].label}
      </label>
      <input
        id={FIELDS[field].id}
        ref={ref}
        className="field__control"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={DATE_FORMAT_HINT}
        defaultValue={appliedValues[field]}
        aria-invalid={errors[field] !== undefined}
        aria-describedby={describedBy(FIELDS[field].id, true, errors[field] !== undefined)}
        onInput={() => onInput(field)}
      />
      <p id={hintId(FIELDS[field].id)} className="field__hint">
        {DATE_FORMAT_HINT}
      </p>
      <FieldMessage>
        {errors[field] !== undefined ? (
          <FieldError
            field={FIELDS[field].id}
            message={errors[field]}
            alert={listed[0]?.[0] === field}
          />
        ) : null}
      </FieldMessage>
    </div>
  )

  return (
    <section className="plan-section plan-section--adjust">
      <form className="adjust" onSubmit={submit} noValidate>
        <fieldset className="adjust__set">
          <legend className="adjust__legend">Adjust and re-plan</legend>
          <p className="adjust__sub">
            {"Change these and we'll re-price without asking the questions again."}
          </p>

          <div className="adjust__fields">
            {dateField('startDate', startRef)}
            {dateField('endDate', endRef)}

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
                defaultValue={appliedValues.travellers}
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
                  defaultValue={appliedValues.budget}
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

            <div className="field">
              <label className="field__label" htmlFor={FIELDS.origin.id}>
                {FIELDS.origin.label}
              </label>
              <select
                id={FIELDS.origin.id}
                ref={originRef}
                className="field__control"
                defaultValue={appliedValues.origin}
                aria-invalid={errors.origin !== undefined}
                aria-describedby={describedBy(
                  FIELDS.origin.id,
                  false,
                  errors.origin !== undefined,
                )}
                onChange={() => onInput('origin')}
              >
                {ORIGIN_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <FieldMessage>
                {errors.origin !== undefined ? (
                  <FieldError
                    field={FIELDS.origin.id}
                    message={errors.origin}
                    alert={listed[0]?.[0] === 'origin'}
                  />
                ) : null}
              </FieldMessage>
            </div>
          </div>

          {/* R21 — one day with nothing on it, on request. */}
          <div className="adjust__check">
            <input
              id="adjust-freeday"
              ref={freeDayRef}
              className="adjust__checkbox"
              type="checkbox"
              defaultChecked={appliedFreeDay}
              onChange={() => onInput('freeDay')}
            />
            <label className="field__label" htmlFor="adjust-freeday">
              {FREE_DAY_LABEL}
            </label>
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
