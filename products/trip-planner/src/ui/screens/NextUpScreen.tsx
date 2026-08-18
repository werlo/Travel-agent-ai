/**
 * The honest end of slice 1.
 *
 * R1 requires that Continue advances off the vibe screen; S2 (trip basics, R2/R3)
 * is built in slice 2. Rather than pretend, this screen states plainly what is not
 * built yet, keeps the chosen vibe, and gives the user a way back. It is deleted
 * the moment BasicsScreen lands — see docs/02-architecture.md §12 Deviations.
 */
export interface NextUpScreenProps {
  vibeLabel: string
  onBack: () => void
}

export function NextUpScreen({ vibeLabel, onBack }: NextUpScreenProps) {
  return (
    <div className="screen screen--form">
      <h1 className="screen__title" tabIndex={-1}>
        Trip basics are next
      </h1>
      <p className="screen__sub">
        This part of Compass isn&rsquo;t built yet. Dates, budget, travellers and where
        you&rsquo;re flying from come next &mdash; your {vibeLabel} choice is remembered until
        then.
      </p>
      <div className="screen__actions screen__actions--start">
        <button type="button" className="btn btn--secondary" onClick={onBack}>
          Change your vibe
        </button>
      </div>
    </div>
  )
}
