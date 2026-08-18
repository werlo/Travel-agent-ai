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
import type { Basics, ISODate, PlanSet } from '../domain/types'
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
  /**
   * R14 — the plan we would show if the dropped constraint were put back. It is
   * derived, never stored: the engine is re-run from the same answers with that one
   * key forced on, so the number in the banner is the plan behind the button.
   */
  restored: PlanSet | null
  /**
   * R12 — the plan these basics would produce, from the answers already given.
   * Called once, from the Apply handler, never on change: at 1,400 destinations a
   * re-plan per keystroke is 46ms of jank (docs/02-architecture.md §7).
   */
  replan: (basics: Basics) => PlanSet | null
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
    // A saved variant whose plan did not survive narrowing falls back rather than
    // rendering an empty screen.
    selectedVariant:
      session.planSet?.[session.selectedVariant] == null
        ? 'recommended'
        : session.selectedVariant,
    planSet: session.planSet,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(sessionReducer, undefined, initFromStorage)
  const [today] = useState(todayISO)
  const persistenceFailed = useRef(false)
  const lastGenerateMsRef = useRef(0)

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

    lastGenerateMsRef.current = lastGenerateMs

    const timer = window.setTimeout(() => {
      rawDispatch({ type: 'planReady', planSet })
    }, GENERATING_MS)

    return () => window.clearTimeout(timer)
    // `planKey` is the determinism hash: identical answers can never re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, planKey])

  // ----------------------------------------------------------- diagnostics
  // docs/02-architecture.md §9. Read-only, contains nothing private, and kept in
  // step with what is on screen — a stale `relaxedKeys` after an R11 switch or an
  // R14 restore would send QA looking for a bug that is not there.
  useEffect(() => {
    const shown =
      state.planSet === null
        ? null
        : (state.planSet[state.selectedVariant] ?? state.planSet.recommended)
    ;(window as unknown as { __compass?: unknown }).__compass = {
      catalogueVersion: CATALOGUE.meta.version,
      snapshotDate: CATALOGUE.meta.snapshotDate,
      phase: state.phase,
      planId: shown?.planId ?? null,
      variant: state.selectedVariant,
      lastGenerateMs: lastGenerateMsRef.current,
      candidatesEvaluated: state.planSet?.candidatesEvaluated ?? 0,
      relaxedKeys: state.planSet?.relaxation?.droppedKeys ?? [],
      persistenceAvailable: state.persistenceAvailable,
    }
  }, [state.phase, state.planSet, state.selectedVariant, state.persistenceAvailable])

  // ------------------------------------------------- R14, the restore preview
  // Only asked for when the engine has already said a plan with the constraint back
  // exists; `restore.total === null` means it does not, and the banner says so.
  const restore = state.planSet?.relaxation?.restore ?? null
  const restoreKey =
    state.restoreRequested && restore !== null && restore.total !== null
      ? restore.key
      : null

  const restored = useMemo<PlanSet | null>(() => {
    if (restoreKey === null || request === null) return null
    return generatePlanSet(
      { ...request.input, forceConstraints: [restoreKey] },
      CATALOGUE,
      { defaultedQuestions: request.defaultedQuestions },
    )
    // `planKey` is the determinism hash of the answers; `restoreKey` is the one
    // constraint we are putting back. Nothing else can change this plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreKey, planKey])

  // ------------------------------------------------------- R12, re-plan in place
  const replan = useCallback(
    (basics: Basics): PlanSet | null => {
      const next = plannerRequest({ ...state, basics })
      if (next === null) return null
      return generatePlanSet(next.input, CATALOGUE, {
        defaultedQuestions: next.defaultedQuestions,
      })
    },
    [state],
  )

  const value = useMemo<SessionContextValue>(
    () => ({ state, dispatch, today, restored, replan }),
    [state, dispatch, today, restored, replan],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (value === null) throw new Error('[compass] E-CONTEXT useSession outside SessionProvider')
  return value
}
