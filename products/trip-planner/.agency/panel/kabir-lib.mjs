export async function toPlan(p, {vibe='Party', travellers='9', budget='450000', q1='Within India', q2='A city', q3='A proper city night', q4='Local stays'}={}) {
  await p.goto('http://localhost:4079')
  await p.getByRole('button', { name: new RegExp(vibe) }).click()
  await p.getByRole('button', { name: /^Continue$/ }).click()
  await p.locator('#field-startDate').fill('13/11/2026')
  await p.locator('#field-endDate').fill('16/11/2026')
  await p.locator('#field-budget').fill(budget)
  await p.locator('#field-travellers').fill(travellers)
  await p.locator('#field-origin').selectOption({ label: 'Delhi' })
  await p.getByRole('button', { name: /^Continue$/ }).click()
  for (const q of [q1,q2,q3,q4]) { await p.waitForTimeout(250); await p.getByRole('button', { name: new RegExp(q) }).first().click() }
  await p.waitForTimeout(3000)
}
