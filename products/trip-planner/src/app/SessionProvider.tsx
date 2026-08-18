import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CATALOGUE } from '../data/localCatalogue'
import { canonicalise } from '../domain/hash'
import { generatePlanSet } from '../domain/planner'
import type { ISODate } from '../domain/types'
import {
  clearSession,
  readSession,
  writeSession,
  type PersistedSession,
} from '../storage/sessionStore'
import { plannerRequest } from './selectors'
import {
  initialState,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from './sessionReducer'

/**
 * The impure edge of the app. It owns exactly three things the domain may not:
 * the clock (read once, for the basics defaults), `localStorage` (R15) and the
 * generating beat between the last answer and the plan.
 *
 * Everything it computes goes through the pure engine, so what ends up on screen
 * is still a function of the answers alone (R13).
 */

/** docs/03-design.md §4 S4 — a minimum of 600ms so the status text is readable, a hard cap of 2000ms. */
export const GENERATING_MS = 800

interface SessionContextValue {
  state: SessionState
  dispatch: (action: SessionAction) => void
  /** Today, read once at mount. The domain never sees a clock. */
  today: ISODate
}

const SessionContext = createContext<SessionContextValue | null>(null)

function todayISO(): ISODate {
  const now = new Date()
  const y = String(now.getFullYear()).padStart(4, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function initFromStorage(): SessionState {
  const { session, available } = readSession(CATALOGUE.meta.version)
  if (session === null) return { ...initialState, persistenceAvailable: available }
  return {
    ...initialState,
    persistenceAvailable: available,
    phase: session.phase,
    vibe: session.vibe,
    basics: session.basics,
    answers: session.answers,
    selectedVariant: session.selectedVariant,
    planSet: session.planSet,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(sessionReducer, undefined, initFromStorage)
  const [today] = useState(todayISO)
  const persistenceFailed = useRef(false)

  const dispatch = useCallback((action: SessionAction) => {
    if (action.type === 'startOver') clearSession()
    rawDispatch(action)
  }, [])

  // ------------------------------------------------------------ persistence
  useEffect(() => {
    if (state.vibe === null) return
    const session: PersistedSession = {
      schema: 1,
      catalogueVersion: CATALOGUE.meta.version,
      phase: state.phase,
      vibe: state.vibe,
      basics: state.basics,
      answers: state.answers,
      selectedVariant: state.selectedVariant,
      planSet: state.planSet,
    }
    const ok = writeSession(session)
    if (!ok && !persistenceFailed.current) {
      persistenceFailed.current = true
      rawDispatch({ type: 'storageUnavailable' })
    }
  }, [state])

  // -------------------------------------------------------------- generating
  const request = useMemo(() => plannerRequest(state), [state])
  const planKey =
    request === null ? null : canonicalise(request.input, CATALOGUE.meta.version)

  useEffect(() => {
    if (state.phase !== 'generating' || request === null) return undefined

    const startedAt = performance.now()
    const planSet = generatePlanSet(request.input, CATALOGUE, {
      defaultedQuestions: request.defaultedQuestions,
    })
    const lastGenerateMs = performance.now() - startedAt

    const diagnostics = {
      catalogueVersion: CATALOGUE.meta.version,
      snapshotDate: CATALOGUE.meta.snapshotDate,
      phase: 'generating',
      planId: planSet.recommended.planId,
      lastGenerateMs,
      candidatesEvaluated: planSet.candidatesEvaluated,
      relaxedKeys: planSet.relaxation?.droppedKeys ?? [],
      persistenceAvailable: state.persistenceAvailable,
    }
    ;(window as unknown as { __compass?: unknown }).__compass = diagnostics

    const timer = window.setTimeout(() => {
      rawDispatch({ type: 'planReady', planSet })
    }, GENERATING_MS)

    return () => window.clearTimeout(timer)
    // `planKey` is the determinism hash: identical answers can never re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, planKey])

  const value = useMemo<SessionContextValue>(
    () => ({ state, dispatch, today }),
    [state, dispatch, today],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (value === null) throw new Error('[compass] E-CONTEXT useSession outside SessionProvider')
  return value
}
