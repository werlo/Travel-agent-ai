import { chromium } from 'playwright'
const b = await chromium.launch()
async function plan({start,end,city='Mumbai',trav='4',budget='250000'}){
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4079')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Peace & Quiet/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(350)
  await page.getByLabel('Start date').fill(start)
  await page.getByLabel('End date').fill(end)
  await page.getByLabel(/Total budget/).fill(budget)
  await page.getByLabel('Travellers').fill(trav)
  await page.getByLabel('Flying from').selectOption({ label: city })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(400)
  for (const n of [/Within India/, /The hills/, /Quiet, but some life/, /Resort comfort/]) {
    await page.getByRole('button', { name: n }).click(); await page.waitForTimeout(350)
  }
  await page.waitForTimeout(1500)
  const t = await page.locator('body').innerText()
  return {ctx, page, t, sum:{
    dest: t.split('\n').find(l=>l.includes('&')),
    tot: (t.match(/₹[\d,]+ total/)||[])[0],
    room: (t.match(/₹[\d,]+ per room-night/)||[])[0],
    fl: (t.match(/Return flights, ₹[\d,]+ per traveller × \d+/)||[])[0],
    rooms: (t.match(/× \d nights × \d rooms/)||[])[0],
  }}
}
const jul = await plan({start:'2027-07-05',end:'2027-07-12'}); console.log('JULY MONSOON', JSON.stringify(jul.sum)); await jul.ctx.close()
const kol = await plan({start:'2026-12-20',end:'2026-12-27',city:'Kolkata'}); console.log('FROM KOLKATA', JSON.stringify(kol.sum)); await kol.ctx.close()
const t5 = await plan({start:'2026-12-20',end:'2026-12-27',trav:'5',budget:'300000'}); console.log('5 TRAVELLERS', JSON.stringify(t5.sum)); await t5.ctx.close()
await b.close()
