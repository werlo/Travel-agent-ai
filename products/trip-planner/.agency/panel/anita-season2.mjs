import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:4079')
await page.waitForTimeout(500)
await page.getByRole('button', { name: /Peace & Quiet/ }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForTimeout(350)
await page.getByLabel('Start date').fill('2026-12-20')
await page.getByLabel('End date').fill('2026-12-27')
await page.getByLabel(/Total budget/).fill('250000')
await page.getByLabel('Travellers').fill('4')
await page.getByLabel('Flying from').selectOption({ label: 'Mumbai' })
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForTimeout(400)
for (const n of [/Within India/, /The hills/, /Quiet, but some life/, /Resort comfort/]) {
  await page.getByRole('button', { name: n }).click(); await page.waitForTimeout(350)
}
await page.waitForTimeout(1500)
// expand everything expandable
for (const b2 of await page.getByRole('button').all()) {
  const n = (await b2.innerText().catch(()=>''))
  if (/Why this trip|details|more/i.test(n)) { await b2.click().catch(()=>{}); await page.waitForTimeout(300) }
}
const t = await page.locator('body').innerText()
for (const w of ['season','Season','peak','Peak','supplement','tax','Tax','GST','vary','date-','per night rate']) {
  const hits = t.split('\n').filter(l=>l.includes(w))
  if (hits.length) console.log(`MENTIONS "${w}":`, hits.slice(0,3))
}
console.log('--- any word "season/peak/tax/GST" found? ---')
console.log(/season|peak|supplement|GST|\btax/i.test(t) ? 'YES' : 'NO — nothing about season, peak, supplements, taxes or GST anywhere on the plan page')
await b.close()
