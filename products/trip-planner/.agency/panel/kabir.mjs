import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await p.goto(process.env.APP_URL)
await p.waitForTimeout(1000)
console.log(await p.locator('body').innerText())
await p.screenshot({ path: '.agency/screenshots/01-landing.png', fullPage: true })
await b.close()
