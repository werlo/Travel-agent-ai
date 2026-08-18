import { chromium } from 'playwright'
import { toPlan } from './kabir-lib.mjs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await toPlan(p, {})
for (let i=0;i<4;i++){
  const btn = p.getByRole('button', { name: /somewhere else/ })
  if (!(await btn.count())) { console.log('no button left'); break }
  await btn.click(); await p.waitForTimeout(2500)
  const t = await p.locator('main').innerText()
  const lines = t.split('\n').filter(Boolean)
  const dest = lines.find(l=>/total$|₹[\d,]+ total/.test(l)) ? lines[lines.findIndex(l=>/₹[\d,]+ total/.test(l))-1] : lines[0]
  console.log(`swap ${i+1}: ${dest} | ${lines.find(l=>/₹[\d,]+ total/.test(l))}`)
  const alt = t.match(/Somewhere else[\s\S]{0,200}/)
  console.log('   panel:', (alt?alt[0]:'').replace(/\n/g,' ').slice(0,180))
}
await p.screenshot({ path: '.agency/screenshots/kabir-14-swaps.png', fullPage: true })
await b.close()
