import { useCallback, useEffect, useRef, useState } from 'react'
import type { Phase, Vibe } from './domain/types'
import { vibeLabel } from './domain/vibes'
import { AppBar } from './ui/components/AppBar'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { ProvenanceLine } from './ui/components/ProvenanceLine'
import { VibeScreen } from './ui/screens/VibeScreen'
import { NextUpScreen } from './ui/screens/NextUpScreen'

/**
 * The app shell: phase switch plus the persistent chrome (AppBar + SummaryBar slot,
 * ProvenanceLine) wrapped in the ErrorBoundary (docs/02-architecture.md §2, §5).
 *
 * There is no router — the phase *is* the screen (§1). Slice 2 replaces this local
 * state with the sessionReducer + SessionProvider; the shell around it does not change.
 */
export function App() {
  const [phase, setPhase] = useState<Phase>('vibe')
  const [vibe, setVibe] = useState<Vibe | null>(null)

  const mainRef = useRef<HTMLElement>(null)
  const shownPhase = useRef<Phase | null>(null)

  // docs/03-design.md §6.1 — on every screen *change* focus moves to that screen's <h1>.
  // Never on first paint: the skip link must still be the first thing Tab reaches.
  // The guard compares the last phase actually shown rather than counting renders, so
  // StrictMode's double-invoked effect cannot steal focus on load.
  useEffect(() => {
    const previous = shownPhase.current
    shownPhase.current = phase
    if (previous === null || previous === phase) return
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [phase])

  const startOver = useCallback(() => {
    setVibe(null)
    setPhase('vibe')
  }, [])

  return (
    <ErrorBoundary onStartOver={startOver}>
      <div className="app">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppBar sticky={phase !== 'vibe'} summaryFacts={null} onStartOver={null} />
        <main id="main" className="app__main" ref={mainRef}>
          {phase === 'vibe' || vibe === null ? (
            <VibeScreen
              selected={vibe}
              onSelect={setVibe}
              onContinue={() => setPhase('basics')}
            />
          ) : (
            <NextUpScreen vibeLabel={vibeLabel(vibe)} onBack={() => setPhase('vibe')} />
          )}
        </main>
        <ProvenanceLine />
      </div>
    </ErrorBoundary>
  )
}
