import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  DATE_FORMAT_HINT,
  firstOfNextMonth,
  formatDMY,
  nightsBetween,
  nightsLabel,
  parseDMY,
} from '../../domain/dates'
import { CHILD_AGE_HINT, CHILD_INPUT_MAX_AGE, CHILD_INPUT_MIN_AGE } from '../../domain/party'
import { ORIGIN_CITIES, type Basics, type ISODate } from '../../domain/types'
import {
  BASICS_FIELD_ORDER,
  errorSummaryHeading,
  orderedErrors,
  validateBasics,
  type BasicsErrors,
  type BasicsField,
  type RawBasics,
} from '../../domain/validate'
import { describedBy, errorId, FieldError, FieldMessage, hintId } from '../components/Field'
import { draftSummaryFacts } from '../format'

/**
 * S2 — Trip basics (docs/03-design.md §4 S2, R2, R3).
 *
 * Validation runs on submit and on blur, never on keystroke: typing a date should
 * not flash an error at you mid-entry, and it keeps the reducer out of the input
 * path entirely (docs/02-architecture.md §7). The form is never blank — the
 * defaults mean an impatient user can press Continue immediately.
 */

const HINTS: Partial<Record<BasicsField, string>> = {
  startDate: DATE_FORMAT_HINT,
  budget: 'Everything in: travel, stay, experiences and day-to-day spending.',
  travellers: 'Priced at the full adult fare. One room per two travellers, rounded up.',
  children: CHILD_AGE_HINT,
  origin: 'Six metros for now: Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad.',
}

const LABELS: Record<BasicsField, string> = {
  startDate: 'Start date',
  endDate: 'End date',
  budget: 'Total budget for the whole party',
  travellers: 'Adults',
  children: 'Children',
  origin: 'Flying from',
}

export const MAX_CHILD_FIELDS = 8

export function defaultRawBasics(today: ISODate, saved: Basics | null): RawBasics {
  if (saved !== null) {
    return {
      startDate: formatDMY(saved.startDate),
      endDate: formatDMY(saved.endDate),
      budget: String(saved.budget),
      travellers: String(saved.adults),
      childAges: saved.children.map((age) => String(age)),
      origin: saved.origin,
      freeDay: saved.freeDay,
    }
  }
  const startDate = firstOfNextMonth(today)
  return {
    startDate: formatDMY(startDate),
    endDate: formatDMY(addDays(startDate, 5)),
    budget: '60000',
    travellers: '2',
    childAges: [],
    origin: 'Bengaluru',
    freeDay: false,
  }
}

export interface BasicsScreenProps {
  today: ISODate
  saved: Basics | null
  onSubmit: (basics: Basics) => void
  onBack: () => void
  onDraftChange: (facts: string[]) => void
}

export function BasicsScreen({
  today,
  saved,
  onSubmit,
  onBack,
  onDraftChange,
}: BasicsScreenProps) {
  const [raw, setRaw] = useState<RawBasics>(() => defaultRawBasics(today, saved))
  const [errors, setErrors] = useState<BasicsErrors>({})
  // The summary is a snapshot taken on submit, cleared field by field as the user
  // fixes things. It deliberately does NOT track blur: it sits above the <h1>, so
  // adding it mid-click would move the whole form out from under the pointer.
  const [summaryErrors, setSummaryErrors] = useState<BasicsErrors>({})
  // Focus is moved after the render that shows the errors, not from inside the
  // submit handler: the browser puts focus on the button it was clicked with, and
  // a focus() call racing that is the classic way this silently stops working.
  const [focusRequest, setFocusRequest] = useState<{ target: BasicsField | 'summary'; nonce: number } | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const facts = useMemo(() => draftSummaryFacts(raw), [raw])
  useEffect(() => {
    onDraftChange(facts)
  }, [facts, onDraftChange])

  useEffect(() => {
    if (focusRequest === null) return
    if (focusRequest.target === 'summary') summaryRef.current?.focus()
    else formRef.current?.querySelector<HTMLElement>(`#field-${focusRequest.target}`)?.focus()
  }, [focusRequest])

  const startISO = parseDMY(raw.startDate)
  const endISO = parseDMY(raw.endDate)
  const nights =
    startISO === null || endISO === null ? Number.NaN : nightsBetween(startISO, endISO)
  const endHint = `${
    Number.isFinite(nights) && nights > 0 ? nightsLabel(nights) : 'Pick a date after the start'
  } · ${DATE_FORMAT_HINT}`
  const childAges = raw.childAges ?? []

  const listed = orderedErrors(errors)
  const summaryList = orderedErrors(summaryErrors)

  const focusField = (field: BasicsField): void => {
    const el = formRef.current?.querySelector<HTMLElement>(`#field-${field}`)
    el?.focus()
  }

  const setField = (field: BasicsField, value: string): void => {
    setRaw((current) => ({ ...current, [field]: value }))
    // An error is removed on the field's next valid input, not only on resubmit.
    if (errors[field] !== undefined) {
      const next = validateBasics({ ...raw, [field]: value })
      if (next.errors[field] === undefined) {
        const without = (current: BasicsErrors): BasicsErrors => {
          const copy = { ...current }
          delete copy[field]
          return copy
        }
        setErrors(without)
        setSummaryErrors(without)
      }
    }
  }

  const setChildCount = (value: string): void => {
    const count = Math.max(0, Math.min(MAX_CHILD_FIELDS, Number(value) || 0))
    setRaw((current) => {
      const ages = [...(current.childAges ?? [])]
      while (ages.length < count) ages.push('')
      ages.length = count
      return { ...current, childAges: ages }
    })
  }

  const setChildAge = (index: number, value: string): void => {
    setRaw((current) => {
      const ages = [...(current.childAges ?? [])]
      ages[index] = value
      return { ...current, childAges: ages }
    })
  }

  const blurField = (field: BasicsField): void => {
    const result = validateBasics(raw)
    setErrors((current) => {
      const copy = { ...current }
      const message = result.errors[field]
      if (message === undefined) delete copy[field]
      else copy[field] = message
      return copy
    })
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const result = validateBasics(raw)
    setErrors(result.errors)
    setSummaryErrors(result.errors)
    const problems = orderedErrors(result.errors)

    if (problems.length === 0 && result.basics !== null) {
      onSubmit(result.basics)
      return
    }
    const nonce = (focusRequest?.nonce ?? 0) + 1
    if (problems.length >= 2) {
      setFocusRequest({ target: 'summary', nonce })
      return
    }
    const first = problems[0]
    if (first !== undefined) setFocusRequest({ target: first[0], nonce })
  }

  return (
    <div className="screen screen--form screen--narrow">
      {summaryList.length >= 2 ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h2 className="error-summary__title">{errorSummaryHeading(summaryList.length)}</h2>
          <ul className="error-summary__list">
            {summaryList.map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#field-${field}`}
                  onClick={(event) => {
                    event.preventDefault()
                    focusField(field)
                  }}
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h1 className="screen__title" tabIndex={-1}>
        Your trip basics
      </h1>
      <p className="screen__sub">
        We&rsquo;ve filled in the usual answers. Change what&rsquo;s wrong and keep the rest.
      </p>

      <form className="card form" onSubmit={submit} ref={formRef} noValidate>
        <div className="form__row">
          <div className="field">
            <label className="field__label" htmlFor="field-startDate">
              {LABELS.startDate}
            </label>
            <input
              id="field-startDate"
              className="field__control"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={DATE_FORMAT_HINT}
              value={raw.startDate}
              aria-invalid={errors.startDate !== undefined}
              aria-describedby={describedBy('startDate', true, errors.startDate !== undefined)}
              onChange={(e) => setField('startDate', e.target.value)}
              onBlur={() => blurField('startDate')}
            />
            <p id={hintId('startDate')} className="field__hint">
              {HINTS.startDate}
            </p>
            <FieldMessage>
              {errors.startDate !== undefined ? (
                <FieldError
                  field="startDate"
                  message={errors.startDate}
                  alert={listed[0]?.[0] === 'startDate'}
                />
              ) : null}
            </FieldMessage>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="field-endDate">
              {LABELS.endDate}
            </label>
            <input
              id="field-endDate"
              className="field__control"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={DATE_FORMAT_HINT}
              value={raw.endDate}
              aria-invalid={errors.endDate !== undefined}
              aria-describedby={describedBy('endDate', true, errors.endDate !== undefined)}
              onChange={(e) => setField('endDate', e.target.value)}
              onBlur={() => blurField('endDate')}
            />
            <p id={hintId('endDate')} className="field__hint">
              {endHint}
            </p>
            <FieldMessage>
              {errors.endDate !== undefined ? (
                <FieldError
                  field="endDate"
                  message={errors.endDate}
                  alert={listed[0]?.[0] === 'endDate'}
                />
              ) : null}
            </FieldMessage>
          </div>
        </div>

        <div className="form__row">
          <div className="field">
            <label className="field__label" htmlFor="field-budget">
              {LABELS.budget}
            </label>
            <div className="field__money">
              <span className="field__prefix" aria-hidden="true">
                ₹
              </span>
              <input
                id="field-budget"
                className="field__control field__control--money"
                type="number"
                inputMode="numeric"
                value={raw.budget}
                aria-invalid={errors.budget !== undefined}
                aria-describedby={describedBy('budget', true, errors.budget !== undefined)}
                onChange={(e) => setField('budget', e.target.value)}
                onBlur={() => blurField('budget')}
              />
            </div>
            <p id={hintId('budget')} className="field__hint">
              {HINTS.budget}
            </p>
            <FieldMessage>
              {errors.budget !== undefined ? (
                <FieldError
                  field="budget"
                  message={errors.budget}
                  alert={listed[0]?.[0] === 'budget'}
                />
              ) : null}
            </FieldMessage>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="field-travellers">
              {LABELS.travellers}
            </label>
            <input
              id="field-travellers"
              className="field__control"
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={raw.travellers}
              aria-invalid={errors.travellers !== undefined}
              aria-describedby={describedBy('travellers', true, errors.travellers !== undefined)}
              onChange={(e) => setField('travellers', e.target.value)}
              onBlur={() => blurField('travellers')}
            />
            <p id={hintId('travellers')} className="field__hint">
              {HINTS.travellers}
            </p>
            <FieldMessage>
              {errors.travellers !== undefined ? (
                <FieldError
                  field="travellers"
                  message={errors.travellers}
                  alert={listed[0]?.[0] === 'travellers'}
                />
              ) : null}
            </FieldMessage>
          </div>
        </div>

        {/* R24 — children are counted and priced at a published rate (A12). */}
        <div className="field">
          <label className="field__label" htmlFor="field-children">
            {LABELS.children}
          </label>
          <input
            id="field-children"
            className="field__control"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_CHILD_FIELDS}
            value={String(childAges.length)}
            aria-invalid={errors.children !== undefined}
            aria-describedby={describedBy('children', true, errors.children !== undefined)}
            onChange={(e) => setChildCount(e.target.value)}
          />
          <p id={hintId('children')} className="field__hint">
            {HINTS.children}
          </p>
          {childAges.length > 0 ? (
            <div className="field__ages">
              {childAges.map((age, index) => (
                <div className="field field--age" key={`child-age-${index}`}>
                  <label className="field__label" htmlFor={`field-child-age-${index}`}>
                    {`Child ${index + 1} age`}
                  </label>
                  <input
                    id={`field-child-age-${index}`}
                    className="field__control"
                    type="number"
                    inputMode="numeric"
                    min={CHILD_INPUT_MIN_AGE}
                    max={CHILD_INPUT_MAX_AGE}
                    value={age}
                    onChange={(e) => setChildAge(index, e.target.value)}
                    onBlur={() => blurField('children')}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <FieldMessage>
            {errors.children !== undefined ? (
              <FieldError
                field="children"
                message={errors.children}
                alert={listed[0]?.[0] === 'children'}
              />
            ) : null}
          </FieldMessage>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="field-origin">
            {LABELS.origin}
          </label>
          <select
            id="field-origin"
            className="field__control"
            value={raw.origin}
            aria-invalid={errors.origin !== undefined}
            aria-describedby={describedBy('origin', true, errors.origin !== undefined)}
            onChange={(e) => setField('origin', e.target.value)}
            onBlur={() => blurField('origin')}
          >
            {ORIGIN_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <p id={hintId('origin')} className="field__hint">
            {HINTS.origin}
          </p>
          <FieldMessage>
            {errors.origin !== undefined ? (
              <FieldError
                field="origin"
                message={errors.origin}
                alert={listed[0]?.[0] === 'origin'}
              />
            ) : null}
          </FieldMessage>
        </div>

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn btn--primary">
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}

export { BASICS_FIELD_ORDER, errorId }
