import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await p.goto('http://localhost:4079')
await p.getByRole('button', { name: /Beach/ }).click()
await p.getByRole('button', { name: 'Continue' }).click()
await p.getByLabel('Start date').fill('10/10/2026')
await p.getByLabel('End date').fill('15/10/2026')
await p.getByRole('button', { name: 'Continue' }).click()
await p.getByRole('button', { name: 'Plan my trip now' }).click()
await p.waitForTimeout(2000)
console.log('start ->', await p.locator('h1').first().innerText())
for (let i=1;i<=8;i++){
  const btn = p.getByRole('button', { name: /somewhere else/i })
  if (await btn.count() === 0) { console.log('reroll button gone at', i); break }
  const dis = await btn.isDisabled().catch(()=>false)
  if (dis) { console.log('reroll disabled at', i); break }
  await btn.click(); await p.waitForTimeout(1800)
  console.log('reroll', i, '->', await p.locator('h1').first().innerText())
}
console.log('--- tail ---')
const t = await p.locator('body').innerText()
const idx = t.indexOf('Somewhere else')
console.log(t.slice(idx-200, idx+400))
await p.screenshot({ path: '.agency/screenshots/rohan2-11-exhaust.png', fullPage: false })
await b.close()
