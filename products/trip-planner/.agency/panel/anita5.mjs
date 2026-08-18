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
const inputs = p.locator('input')
await inputs.nth(1).fill('27/12/2026')
await p.waitForTimeout(200)

const budgetInput = p.locator('input[type="number"]').first()
await budgetInput.fill('250000')
await p.waitForTimeout(200)

await p.getByLabel('Children').fill('2')
await p.waitForTimeout(500)

await p.getByLabel('Child 1 age').fill('9')
await p.getByLabel('Child 2 age').fill('12')
await p.waitForTimeout(200)

await p.locator('select').selectOption('Mumbai')
await p.waitForTimeout(200)

console.log(await p.locator('body').innerText())
await p.screenshot({ path: '.agency/screenshots/05-full-form.png', fullPage: true })
await b.close()
