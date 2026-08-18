import { VibeCard } from '../components/VibeCard'
import type { IconName } from '../components/Icon'
import type { Vibe } from '../../domain/types'
import { VIBE_LABELS, VIBE_ORDER } from '../../domain/vibes'

/**
 * S1 — Vibe (docs/03-design.md §4 S1, docs/01-prd.md R1).
 *
 * Copy is the designer's, verbatim. The card order is VIBE_ORDER, so the grid reads
 * Mountains, Beach, Party / Honeymoon, Peace & Quiet, Culture & Food at 1280.
 */

interface VibeCardCopy {
  description: string
  glyph: IconName
}

const CARD_COPY: Readonly<Record<Vibe, VibeCardCopy>> = {
  mountains: { description: 'Cool air, big views, slow walks.', glyph: 'mountains' },
  beach: { description: 'Sand, sea, and not much of a plan.', glyph: 'beach' },
  party: { description: 'Late nights, music, people.', glyph: 'party' },
  honeymoon: { description: 'Just the two of you, done properly.', glyph: 'honeymoon' },
  peace: { description: 'Nobody around, nothing scheduled.', glyph: 'peace' },
  culture: { description: 'Old streets, markets, long meals.', glyph: 'culture-food' },
}

export interface VibeScreenProps {
  selected: Vibe | null
  onSelect: (vibe: Vibe) => void
  onContinue: () => void
}

export function VibeScreen({ selected, onSelect, onContinue }: VibeScreenProps) {
  const canContinue = selected !== null

  return (
    <div className="screen screen--form">
      <h1 className="screen__title" tabIndex={-1}>
        What kind of trip do you want?
      </h1>
      <p className="screen__sub">
        Pick a vibe. We&rsquo;ll ask three or four quick questions, then hand you one costed
        trip &mdash; where to go, where to stay, what to do each day, and the total.
      </p>

      <div className="vibe-grid">
        {VIBE_ORDER.map((vibe) => {
          const copy = CARD_COPY[vibe]
          return (
            <VibeCard
              key={vibe}
              vibe={vibe}
              label={VIBE_LABELS[vibe]}
              description={copy.description}
              glyph={copy.glyph}
              selected={selected === vibe}
              onSelect={onSelect}
            />
          )
        })}
      </div>

      <div className="screen__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canContinue}
          {...(canContinue ? {} : { 'aria-describedby': 'hint-continue' })}
          onClick={onContinue}
        >
          Continue
        </button>
        {canContinue ? null : (
          <p id="hint-continue" className="hint hint--actions">
            Pick a vibe to continue.
          </p>
        )}
      </div>
    </div>
  )
}
