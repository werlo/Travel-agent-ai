import { chromium } from 'playwright'
const b = await chromium.launch()
async function plan(start, end){
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4079')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Peace & Quiet/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(400)
  await page.getByLabel('Start date').fill(start)
  await page.getByLabel('End date').fill(end)
  await page.getByLabel(/Total budget/).fill('250000')
  await page.getByLabel('Travellers').fill('4')
  await page.getByLabel('Flying from').selectOption({ label: 'Mumbai' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Within India/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /The hills/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Quiet, but some life/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Resort comfort/ }).click()
  await page.waitForTimeout(2000)
  const t = await page.locator('body').innerText()
  const out = {
    dest: t.split('\n').find(l=>l.includes('&')),
    tot: (t.match(/₹[\d,]+ total/)||[])[0],
    id: (t.match(/Plan [A-Z0-9-]+-\w+/)||[])[0],
    room: (t.match(/₹[\d,]+ per room-night/)||[])[0],
    fl: (t.match(/₹[\d,]+ per traveller × 4/)||[])[0],
  }
  return {out, page, ctx}
}
const a = await plan('2026-12-20','2026-12-27'); console.log('RUN1 XMAS', JSON.stringify(a.out))
const c = await plan('2026-12-20','2026-12-27'); console.log('RUN2 XMAS', JSON.stringify(c.out)); await c.ctx.close()
const d = await plan('2027-02-10','2027-02-17'); console.log('RUN3 FEB ', JSON.stringify(d.out)); await d.ctx.close()
// reload the still-open run1 page
await a.page.reload()
await a.page.waitForTimeout(1800)
const t = await a.page.locator('body').innerText()
console.log('=== AFTER RELOAD ===')
console.log(t.slice(0,300))
await a.page.screenshot({ path: '.agency/screenshots/anita-09-reload.png' })
await b.close()
