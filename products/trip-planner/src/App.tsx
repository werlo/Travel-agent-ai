import { useCallback, useEffect, useRef, useState } from 'react'
import { SessionProvider, useSession } from './app/SessionProvider'
import { questionView, summaryFacts } from './app/selectors'
import { CATALOGUE } from './data/localCatalogue'
import { formatRupees } from './domain/money'
import { nightsBetween, nightsLabel } from './domain/dates'
import { vibeLabel } from './domain/vibes'
import { AppBar } from './ui/components/AppBar'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { ProvenanceLine } from './ui/components/ProvenanceLine'
import { VibeScreen } from './ui/screens/VibeScreen'
import { BasicsScreen } from './ui/screens/BasicsScreen'
import { QuestionScreen } from './ui/screens/QuestionScreen'
import { GeneratingScreen } from './ui/screens/GeneratingScreen'
import { PlanScreen } from './ui/screens/PlanScreen'

/**
 * The app shell: phase switch plus the persistent chrome (AppBar + SummaryBar,
 * ProvenanceLine) wrapped in the ErrorBoundary (docs/02-architecture.md §2, §5).
 *
 * There is no router — the phase *is* the screen (§1), which is also what lets R15
 * restore a screen rather than a URL.
 */

function AppShell() {
  const { state, dispatch, today } = useSession()
  const { phase } = state

  const [draftFacts, setDraftFacts] = useState<string[] | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const shownPhase = useRef<string | null>(null)

  // docs/03-design.md §6.1 — on every screen *change* focus moves to that screen's
  // <h1>. Never on first paint: the skip link must still be the first thing Tab
  // reaches. The guard compares the last phase actually shown rather than counting
  // renders, so StrictMode's double-invoked effect cannot steal focus on load.
  useEffect(() => {
    const previous = shownPhase.current
    shownPhase.current = phase
    if (previous === null || previous === phase) return
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [phase])

  const startOver = useCallback(() => {
    setDraftFacts(null)
    dispatch({ type: 'startOver' })
  }, [dispatch])

  const view = phase === 'question' ? questionView(state) : null
  const facts =
    phase === 'basics' ? (draftFacts ?? summaryFacts(state)) : summaryFacts(state)

  const resumable =
    phase === 'vibe' && state.vibe !== null && state.basics !== null ? state.basics : null

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppBar
        sticky={phase !== 'vibe'}
        summaryFacts={phase === 'vibe' ? null : facts}
        onStartOver={state.vibe === null ? null : startOver}
      />
      <main id="main" className="app__main" ref={mainRef}>
        {phase === 'vibe' ? (
          <>
            {resumable !== null && state.vibe !== null ? (
              <div className="banner banner--info">
                <h2 className="banner__title">You have a trip in progress</h2>
                <p className="banner__body">
                  {vibeLabel(state.vibe)} ·{' '}
                  {nightsLabel(nightsBetween(resumable.startDate, resumable.endDate))} from{' '}
                  {resumable.origin} ·{' '}
                  {state.planSet !== null
                    ? `${state.planSet.recommended.destinationName}, ${formatRupees(
                        state.planSet.recommended.cost.partyTotal,
                      )}`
                    : 'Questions in progress'}
                </p>
                <div className="banner__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => dispatch({ type: 'resume' })}
                  >
                    Resume
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={startOver}>
                    Start over
                  </button>
                </div>
              </div>
            ) : null}
            <VibeScreen
              selected={state.vibe}
              onSelect={(vibe) => dispatch({ type: 'selectVibe', vibe })}
              onContinue={() => dispatch({ type: 'startBasics' })}
            />
          </>
        ) : null}

        {phase === 'basics' ? (
          <BasicsScreen
            today={today}
            saved={state.basics}
            onDraftChange={setDraftFacts}
            onBack={() => dispatch({ type: 'backToVibe' })}
            onSubmit={(basics) => dispatch({ type: 'submitBasics', basics })}
          />
        ) : null}

        {phase === 'question' && view !== null ? (
          <QuestionScreen
            view={view}
            branchChanged={state.branchChanged}
            onAnswer={(questionId, optionId) =>
              dispatch({ type: 'answerQuestion', questionId, optionId })
            }
            onBack={() => dispatch({ type: 'back' })}
            onSkip={() => dispatch({ type: 'skipToPlan' })}
          />
        ) : null}

        {phase === 'generating' && state.basics !== null ? (
          <GeneratingScreen
            origin={state.basics.origin}
            destinationCount={CATALOGUE.destinations.length}
          />
        ) : null}

        {phase === 'plan' && state.planSet !== null ? (
          <PlanScreen
            planSet={state.planSet}
            onAnswerDefaulted={() => dispatch({ type: 'answerDefaulted' })}
          />
        ) : null}
      </main>
      <p className="visually-hidden" role="status" aria-live="polite">
        {state.announcement}
      </p>
      <ProvenanceLine />
    </div>
  )
}

export function App() {
  return (
    <SessionProvider>
      <AppRoot />
    </SessionProvider>
  )
}

function AppRoot() {
  const { dispatch } = useSession()
  const startOver = useCallback(() => dispatch({ type: 'startOver' }), [dispatch])
  return (
    <ErrorBoundary onStartOver={startOver}>
      <AppShell />
    </ErrorBoundary>
  )
}
