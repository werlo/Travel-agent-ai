export async function setup(p) {
  await p.goto('http://localhost:4079')
  await p.waitForTimeout(500)
  await p.getByText('Peace & Quiet').click()
  await p.getByRole('button', { name: /Continue/i }).click()
  await p.waitForTimeout(400)
  const t = async (sel, val) => { await p.click(sel); await p.fill(sel,''); await p.locator(sel).pressSequentially(val,{delay:15}) }
  await t('#field-startDate','20/12/2026')
  await t('#field-endDate','27/12/2026')
  await t('#field-budget','250000')
  await t('#field-children','2')
  await p.waitForTimeout(250)
  const c1 = p.getByLabel('Child 1 age'); const c2 = p.getByLabel('Child 2 age')
  await c1.click(); await c1.pressSequentially('9',{delay:40}); await p.keyboard.press('Tab')
  await c2.click(); await c2.pressSequentially('12',{delay:40}); await p.keyboard.press('Tab')
  await p.selectOption('#field-origin','Mumbai')
  await p.waitForTimeout(300)
  await p.getByRole('button', { name: /^Continue$/ }).click()
  await p.waitForTimeout(800)
}
export async function answerAll(p) {
  await p.getByText('Within India', {exact:true}).click(); await p.waitForTimeout(500)
  await p.getByText('Backwaters and beaches', {exact:true}).click(); await p.waitForTimeout(500)
  await p.getByText('Quiet, but some life', {exact:true}).click(); await p.waitForTimeout(500)
}
export async function finish(p) {
  await p.getByText('Resort comfort', {exact:true}).click(); await p.waitForTimeout(1500)
}
