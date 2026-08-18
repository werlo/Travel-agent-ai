import { formatRupees } from '../../domain/money'
import { totalLabel } from '../../domain/pricing'
import type { CostBreakdown } from '../../domain/types'

/**
 * R8 — the breakdown that adds up. The four amounts come straight from the engine
 * and their sum is `partyTotal` by construction; nothing is recomputed here, so
 * there is no way for the screen and the engine to disagree.
 *
 * Every line carries its basis in words (A7), because a number without a basis is
 * exactly what P2 stopped trusting.
 */
export function CostTable({
  cost,
  adults,
  childCount,
}: {
  cost: CostBreakdown
  adults: number
  /** How many children are in the party (R24). `children` is React's, not ours. */
  childCount: number
}) {
  const rows = [
    { key: 'travel', label: 'Travel', amount: cost.travel, basis: cost.basis.travel },
    { key: 'stay', label: 'Stay', amount: cost.stay, basis: cost.basis.stay },
    {
      key: 'experiences',
      label: 'Experiences',
      amount: cost.experiences,
      basis: cost.basis.experiences,
    },
    {
      key: 'localAllowance',
      label: 'Local allowance',
      amount: cost.localAllowance,
      basis: cost.basis.localAllowance,
    },
    // R23 — the seasonal loading is a line of its own, inside the sum that ties.
    {
      key: 'seasonal',
      label: 'Season',
      amount: cost.seasonal,
      basis: cost.basis.seasonal,
    },
  ]

  return (
    <table className="costtable">
      <caption className="visually-hidden">
        What makes up your {formatRupees(cost.partyTotal)} total
      </caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="costtable__item">
              <span className="costtable__label">{row.label}</span>
              <span className="costtable__basis">{row.basis}</span>
            </th>
            <td className="costtable__amount" data-cost={row.key}>
              {formatRupees(row.amount)}
            </td>
          </tr>
        ))}
        <tr className="costtable__total">
          <th scope="row" className="costtable__item">
            <span className="costtable__label">{totalLabel(adults, childCount)}</span>
          </th>
          <td className="costtable__amount" data-cost="total">
            {formatRupees(cost.partyTotal)}
          </td>
        </tr>
        <tr className="costtable__perperson">
          <th scope="row" className="costtable__item">
            <span className="costtable__label">Per person</span>
            <span className="costtable__basis">{cost.basis.perPerson}</span>
          </th>
          <td className="costtable__amount" data-cost="perPerson">
            {formatRupees(cost.perPerson)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
