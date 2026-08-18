import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await p.goto(process.env.APP_URL)
await p.waitForTimeout(500)
await p.getByText('Peace & Quiet').click()
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(800)

await p.fill('input[value="01/09/2026"]', '20/12/2026')
await p.waitForTimeout(200)
const endInput = p.locator('input').nth(1)
await endInput.fill('27/12/2026')
await p.waitForTimeout(200)

// budget
await p.fill('input[value="60000"]', '250000')
await p.waitForTimeout(200)

// children count - find input with value 0 label Children
await p.fill('#children, input[type="number"]', '').catch(()=>{})
await p.waitForTimeout(100)

console.log(await p.locator('body').innerText())
await p.screenshot({ path: '.agency/screenshots/03-filled-partial.png', fullPage: true })
await b.close()
