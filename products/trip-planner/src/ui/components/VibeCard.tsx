import { Icon, type IconName } from './Icon'
import type { Vibe } from '../../domain/types'

/**
 * docs/03-design.md §3 VibeCard. A `<button aria-pressed>`, not a radio group:
 * arrow keys deliberately move nothing, so a stray arrow key can never change an
 * answer (docs/03-design.md §4 S1 keyboard path).
 *
 * The accessible name is the label alone (§6.4); the description is attached with
 * aria-describedby so a screen-reader user still hears it, without it bleeding
 * into the name that R1's `aria-pressed` assertions locate the card by.
 */
export interface VibeCardProps {
  vibe: Vibe
  label: string
  description: string
  glyph: IconName
  selected: boolean
  onSelect: (vibe: Vibe) => void
}

export function VibeCard({
  vibe,
  label,
  description,
  glyph,
  selected,
  onSelect,
}: VibeCardProps) {
  const labelId = `vibe-${vibe}-label`
  const descId = `vibe-${vibe}-desc`

  return (
    <button
      type="button"
      className="vibe-card"
      aria-pressed={selected}
      aria-labelledby={labelId}
      aria-describedby={descId}
      data-vibe={vibe}
      onClick={() => onSelect(vibe)}
    >
      <Icon name={glyph} size={28} className="vibe-card__glyph" />
      <span id={labelId} className="vibe-card__label">
        {label}
      </span>
      <span id={descId} className="vibe-card__desc">
        {description}
      </span>
      {selected ? <Icon name="check" size={20} className="vibe-card__check" /> : null}
    </button>
  )
}
