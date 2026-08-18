import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
await p.goto('http://localhost:4079')
await p.waitForTimeout(400)
await p.getByRole('button', { name: /Beach/ }).click()
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(300)
await p.getByLabel('Start date').fill('2026-10-10')
await p.getByLabel('End date').fill('2026-10-15')
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(400)
for (const label of ['Within India','West coast','Lively','Resort comfort']) {
  await p.getByRole('button', { name: new RegExp('^'+label) }).click()
  await p.waitForTimeout(500)
}
await p.waitForSelector('text=/total/')
await p.waitForTimeout(500)
console.log('--- ALL CONTROLS ON GOA PLAN ---')
for (const el of await p.locator('button, a, input, select, summary').all()) {
  const t = (await el.innerText().catch(()=> '')) || (await el.getAttribute('aria-label')) || ''
  console.log(await el.evaluate(e=>e.tagName), '|', t.replace(/\n/g,' ').slice(0,70))
}
await p.screenshot({ path: '.agency/screenshots/rohan-11-goa-deadend.png', fullPage: true })
await b.close()
