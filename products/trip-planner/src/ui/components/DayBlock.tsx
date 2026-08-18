import type { DayBlock as DayBlockData } from '../../domain/types'
import { Icon } from './Icon'
import { experienceDetail, legDetail, legLabel } from '../format'

/**
 * docs/03-design.md §3 DayBlock. Every day carries at least one named experience,
 * the first and last also carry a travel leg, and the stay is named on both (R7).
 * Nothing in here is interactive, so none of it is in the tab order.
 */
export function DayBlockCard({ day }: { day: DayBlockData }) {
  const outbound = day.legs.filter((leg) => leg.kind === 'outbound')
  const inbound = day.legs.filter((leg) => leg.kind === 'return')

  return (
    <section className="dayblock">
      <h3 className="dayblock__title">
        {day.label} · {day.dateLabel}
      </h3>
      <ul className="dayblock__items">
        {outbound.map((leg) => (
          <li key={`${leg.kind}-${leg.date}`} className="dayblock__item">
            <Icon name="plane" size={16} className="dayblock__glyph" />
            <span className="dayblock__label">{legLabel(leg)}</span>
            <span className="dayblock__detail">{legDetail(leg)}</span>
          </li>
        ))}
        {day.stayEntry !== null ? (
          <li className="dayblock__item">
            <Icon name="bed" size={16} className="dayblock__glyph" />
            <span className="dayblock__label">{day.stayEntry.label}</span>
            {day.stayEntry.detail !== '' ? (
              <span className="dayblock__detail">{day.stayEntry.detail}</span>
            ) : null}
          </li>
        ) : null}
        {day.experiences.map((experience) => (
          <li key={experience.id} className="dayblock__item">
            <Icon name="star" size={16} className="dayblock__glyph" />
            <span className="dayblock__label">{experience.name}</span>
            <span className="dayblock__detail">{experienceDetail(experience)}</span>
            <span className="dayblock__blurb">{experience.blurb}</span>
          </li>
        ))}
        {day.note !== null ? (
          <li className="dayblock__item dayblock__item--free">
            <Icon name="star" size={16} className="dayblock__glyph" />
            <span className="dayblock__label">{day.note}</span>
          </li>
        ) : null}
        {inbound.map((leg) => (
          <li key={`${leg.kind}-${leg.date}`} className="dayblock__item">
            <Icon name="plane" size={16} className="dayblock__glyph" />
            <span className="dayblock__label">{legLabel(leg)}</span>
            <span className="dayblock__detail">{legDetail(leg)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
