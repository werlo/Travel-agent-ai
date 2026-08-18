import { useEffect, useRef, useState } from 'react'
import type { OptionId, QuestionOption } from '../../domain/types'
import type { QuestionView } from '../../app/selectors'
import { Icon } from '../components/Icon'

/**
 * S3 — the adaptive question (docs/03-design.md §4 S3; R4, R5, R6, R15).
 *
 * Options are `<button aria-pressed>`, never a radio group: arrow keys deliberately
 * move nothing, so a stray arrow key can never change an answer. "No preference",
 * "Back" and "Plan my trip now" are on every render, in the same place — P2 of the
 * design principles, and the reason the questionnaire is never a wall.
 */

/** docs/03-design.md §5 — selection is visible for one beat before the screen moves. */
const ADVANCE_MS = 180

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface QuestionScreenProps {
  view: QuestionView
  branchChanged: boolean
  onAnswer: (questionId: string, optionId: OptionId) => void
  onBack: () => void
  onSkip: () => void
}

export function QuestionScreen({
  view,
  branchChanged,
  onAnswer,
  onBack,
  onSkip,
}: QuestionScreenProps) {
  const { node, position, total, selected, revisiting } = view
  const [pending, setPending] = useState<OptionId | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | null>(null)

  // Focus moves to the <h1> on every question change, except when arriving via
  // Back, where it lands on the option the user chose last time (§6.1).
  useEffect(() => {
    setPending(null)
    if (revisiting) selectedRef.current?.focus()
    else headingRef.current?.focus()
  }, [node.id, revisiting])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const choose = (option: QuestionOption): void => {
    setPending(option.id)
    const delay = prefersReducedMotion() ? 0 : ADVANCE_MS
    timer.current = window.setTimeout(() => onAnswer(node.id, option.id), delay)
  }

  const pressedId = pending ?? selected
  const answered = position - 1

  return (
    <div className="screen screen--form screen--narrow">
      <div className="progress">
        <p className="progress__text">
          Question {position} of {total}
        </p>
        <div
          className="progress__track"
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="progress__fill"
            style={{ width: `${Math.round((answered / Math.max(total, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {branchChanged ? (
        <div className="banner banner--info">
          <h2 className="banner__title">We&rsquo;ve updated the rest of the questions</h2>
          <p className="banner__body">Your earlier answers are still in the summary bar.</p>
        </div>
      ) : null}

      <h1 className="screen__title" tabIndex={-1} ref={headingRef}>
        {node.prompt}
      </h1>

      <ul className="options">
        {node.options.map((option) => {
          const isPressed = pressedId === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                className={
                  option.id === 'no-preference' ? 'option option--neutral' : 'option'
                }
                aria-pressed={isPressed}
                ref={isPressed && selected === option.id ? selectedRef : null}
                onClick={() => choose(option)}
              >
                <span className="option__text">
                  <span className="option__label">{option.label}</span>
                  <span className="option__desc">{option.description}</span>
                </span>
                {isPressed ? (
                  <Icon name="check" size={20} className="option__check" />
                ) : option.id === 'no-preference' ? null : (
                  <Icon name="chevron-right" size={20} className="option__chevron" />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="screen__actions screen__actions--row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn--secondary" onClick={onSkip}>
          Plan my trip now
        </button>
      </div>
      <p className="hint hint--actions">
        You can stop answering at any point &mdash; we&rsquo;ll fill in the rest.
      </p>
    </div>
  )
}
