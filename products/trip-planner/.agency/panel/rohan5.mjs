import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await p.goto('http://localhost:4079')
await p.waitForTimeout(500)
await p.getByText('Beach', { exact: true }).click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(800)

const startInput = p.locator('input').nth(0)
await startInput.fill('10/10/2026')
const endInput = p.locator('input').nth(1)
await endInput.fill('15/10/2026')

await p.locator('input[placeholder="e.g. Goa"]').fill('Goa')
await p.getByRole('button', { name: 'Exclude' }).click()
await p.waitForTimeout(300)

await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(800)

// Skip questions immediately
await p.getByRole('button', { name: 'Plan my trip now' }).click()
await p.waitForTimeout(1500)

console.log(await p.locator('body').innerText())
await p.screenshot({ path: '.agency/screenshots/05-result.png', fullPage: true })
await b.close()
