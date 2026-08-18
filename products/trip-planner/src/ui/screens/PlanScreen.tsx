import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPlainText } from '../../domain/export'
import { formatRupees } from '../../domain/money'
import { ADULT_AGE_NOTE, CHILD_RULE } from '../../domain/party'
import { TAX_NOTE } from '../../domain/pricing'
import { SEASON_BASIS_NOTE } from '../../domain/season'
import type {
  Basics,
  BudgetStatus,
  CatalogueMeta,
  PlanSet,
  PlanVariant,
  Vibe,
} from '../../domain/types'
import { AdjustPanel } from '../components/AdjustPanel'
import { Alternatives } from '../components/Alternatives'
import { CostTable } from '../components/CostTable'
import { DayBlockCard } from '../components/DayBlock'
import { Icon } from '../components/Icon'
import { LivePriceCheck } from '../components/LivePriceCheck'
import { RelaxBanner } from '../components/RelaxBanner'
import { WhyThisTrip } from '../components/WhyThisTrip'
import { CLIPBOARD_FAILED_MESSAGE, ExportDialog } from './ExportDialog'
import { defaultedLabel, planFacts, planSummaryLine } from '../format'

/**
 * S5 — Plan (docs/03-design.md §4 S5; R7, R8, R9, R10, R11, R13, R14, R16).
 *
 * The screen renders `planSet[selectedVariant]` and nothing else, which is what
 * makes R11's "the main itinerary, cost breakdown, budget line and plan ID all
 * update" true by construction rather than by four separate handlers agreeing.
 *
 * Slice 4 adds the two controls that make the plan the user's rather than ours:
 * the adjust panel (R12), which re-plans in place from the answers already given,
 * and the export dialog (R17), which is the only way the itinerary leaves the app.
 * Nothing here is a placeholder: every section that renders is real.
 */

const BADGE_VARIANT: Record<BudgetStatus, string> = {
  within: 'badge--success',
  'on-budget': 'badge--neutral',
  stretch: 'badge--warn',
  'no-fit': 'badge--warn',
}

export interface PlanScreenProps {
  planSet: PlanSet
  vibe: Vibe
  /** The basics behind this plan — what the adjust panel edits (R12). */
  basics: Basics
  meta: CatalogueMeta
  selectedVariant: PlanVariant
  restoreRequested: boolean
  restored: PlanSet | null
  /** R19 — what the last re-plan changed without being asked to. */
  changeNotice: string | null
  /** R22 — every destination that fits has now been turned down. */
  rejectExhausted: boolean
  onReject: (destinationId: string) => void
  onUndoReject: (destinationId: string) => void
  onAnswerDefaulted: () => void
  onSelectVariant: (variant: PlanVariant) => void
  /** R12 — apply new basics and re-plan without re-asking anything. */
  onAdjust: (basics: Basics) => void
  onRequestRestore: () => void
  onApplyRestore: (planSet: PlanSet) => void
  onDismissRestore: () => void
}

export function PlanScreen({
  planSet,
  vibe,
  basics,
  meta,
  selectedVariant,
  restoreRequested,
  restored,
  changeNotice,
  rejectExhausted,
  onReject,
  onUndoReject,
  onAnswerDefaulted,
  onSelectVariant,
  onAdjust,
  onRequestRestore,
  onApplyRestore,
  onDismissRestore,
}: PlanScreenProps) {
  // A variant that does not exist can only come from a tampered session; falling
  // back is cheaper than a blank screen (docs/02-architecture.md §5).
  const plan = planSet[selectedVariant] ?? planSet.recommended
  const { cost } = plan

  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [clipboardFailure, setClipboardFailure] = useState<string | null>(null)
  const copyButtonRef = useRef<HTMLButtonElement>(null)
  const wasExporting = useRef(false)
  const copiedTimer = useRef<number | null>(null)

  /**
   * docs/03-design.md §6.1 — closing S6 returns focus to `Copy as text`.
   *
   * It has to happen *after* the dialog has left the DOM. Focusing from inside the
   * close handler runs while the dialog is still modal, and the browser ignores a
   * focus() call on an inert element outside it — focus then lands on <body>, which
   * §6.1 forbids. Found by the keyboard-only E2E.
   */
  useEffect(() => {
    if (wasExporting.current && !exporting) copyButtonRef.current?.focus()
    wasExporting.current = exporting
  }, [exporting])

  // Cheap, but it is rebuilt on every plan change and nothing else; the plan ID is
  // the identity of the whole plan, so it is the only dependency there can be.
  const exportText = useMemo(() => toPlainText(plan, meta), [plan, meta])

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    },
    [],
  )

  /**
   * R17 (amended) — the button copies. It used to open a dialog and leave the user
   * to press Ctrl+C, which is not what "Copy as text" says it does. The dialog is
   * still built, and it is still where an insecure origin or a denied permission
   * ends up, with a message that names the failure.
   */
  const copyAsText = useCallback(async (): Promise<void> => {
    try {
      const clipboard = navigator.clipboard
      if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
        throw new Error('clipboard unavailable')
      }
      await clipboard.writeText(exportText)
      setClipboardFailure(null)
      setCopied(true)
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => {
        copiedTimer.current = null
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.warn('[compass] E-CLIPBOARD', error)
      setCopied(false)
      setClipboardFailure(CLIPBOARD_FAILED_MESSAGE)
      setExporting(true)
    }
  }, [exportText])

  return (
    <div className="screen screen--plan">
      {planSet.relaxation !== null ? (
        <RelaxBanner
          relaxation={planSet.relaxation}
          shown={plan}
          vibe={vibe}
          budget={basics.budget}
          requested={restoreRequested}
          restored={restored}
          onRequest={onRequestRestore}
          onApply={onApplyRestore}
          onDismiss={onDismissRestore}
        />
      ) : null}

      <div className="plan-hero">
        <div className="plan-hero__head">
          <h1 className="plan-hero__title" tabIndex={-1}>
            {plan.destinationName}
          </h1>
          <div className="plan-hero__price">
            <p className="plan-hero__total">{formatRupees(cost.partyTotal)} total</p>
            <p className="plan-hero__perperson">{formatRupees(cost.perPerson)} per person</p>
          </div>
        </div>
        {/* R19 — the substitution is stated where the total is, not in the small print. */}
        {changeNotice !== null ? (
          <p className="plan-hero__notice" data-notice="change">
            {changeNotice}
          </p>
        ) : null}
        <p className={`badge ${BADGE_VARIANT[plan.budget.status]}`}>{plan.budget.label}</p>
        <p className="plan-hero__facts">{planFacts(plan)}</p>
        {planSet.defaultedQuestions > 0 ? (
          <p className="plan-hero__defaults">
            <span className="badge badge--accent">
              {defaultedLabel(planSet.defaultedQuestions)}
            </span>
            <button type="button" className="btn btn--ghost" onClick={onAnswerDefaulted}>
              Answer them
            </button>
          </p>
        ) : null}
        <div className="plan-hero__actions">
          <button
            type="button"
            className="btn btn--primary"
            ref={copyButtonRef}
            onClick={() => void copyAsText()}
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} className="btn__glyph" />
            {copied ? 'Copied' : 'Copy as text'}
          </button>
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">
          {copied ? 'Copied' : ''}
        </p>
        <p className="plan-hero__id">
          {/* B4 — each token is kept on one line so the wrap point can only ever
              fall at the " · " between them, never mid-token (e.g. inside the
              catalogue date). */}
          <span className="plan-hero__id-token">{`Plan ${plan.planId}`}</span>
          {' · '}
          <span className="plan-hero__id-token">{`catalogue ${planSet.catalogueVersion}`}</span>
        </p>
      </div>

      {/*
        docs/03-design.md §4 S5: at 1280 the left column reads itinerary → why and
        the right column breakdown → alternatives; at 768 and below both collapse
        into one column with the breakdown promoted above the itinerary. The right
        column is after the left in the DOM, so the keyboard order matches the
        reading order rather than the visual columns.
      */}
      <div className="plan-grid">
        <div className="plan-col">
          <section className="plan-section plan-section--days" aria-labelledby="plan-days">
            <h2 id="plan-days" className="plan-section__title">
              Your days
            </h2>
            <div className="dayblocks">
              {plan.days.map((day) => (
                <DayBlockCard key={day.day} day={day} />
              ))}
            </div>
            {/* R18 — what we would not put on a day that contradicts it. */}
            {plan.unscheduled.length > 0 ? (
              <ul className="unscheduled" data-unscheduled="true">
                {plan.unscheduled.map((note) => (
                  <li key={note.experienceId} className="unscheduled__item">
                    {note.line}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="plan-section plan-section--why" aria-label="Why this trip">
            <WhyThisTrip why={plan.why} summaryLine={planSummaryLine(plan)} />
          </section>
        </div>

        <div className="plan-col plan-col--aside">
          <section className="plan-section plan-section--cost" aria-labelledby="plan-cost">
            <h2 id="plan-cost" className="plan-section__title">
              What makes up {formatRupees(cost.partyTotal)}
            </h2>
            <CostTable cost={cost} adults={plan.adults} childCount={plan.children} />
            <p className="plan-section__footnote">{TAX_NOTE}</p>
            <p className="plan-section__footnote">
              {CHILD_RULE} {ADULT_AGE_NOTE} One room per two travellers, rounded up.
            </p>
            <p className="plan-section__footnote">{SEASON_BASIS_NOTE}</p>
            <p className="plan-section__footnote">
              Stay: {plan.stay.name} in {plan.stay.baseName}, {plan.stay.nights}{' '}
              {plan.stay.nights === 1 ? 'night' : 'nights'}, {plan.stay.rooms}{' '}
              {plan.stay.rooms === 1 ? 'room' : 'rooms'}.
            </p>
          </section>

          <LivePriceCheck plan={plan} />

          <Alternatives
            planSet={planSet}
            selected={selectedVariant}
            onSelect={onSelectVariant}
            onReject={() => onReject(plan.destinationId)}
            onUndoReject={onUndoReject}
            exhausted={rejectExhausted}
          />

          <AdjustPanel basics={basics} onApply={onAdjust} />
        </div>
      </div>

      {exporting ? (
        <ExportDialog
          text={exportText}
          failureMessage={clipboardFailure}
          onClose={() => setExporting(false)}
        />
      ) : null}
    </div>
  )
}
