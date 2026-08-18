import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
await p.goto(process.env.APP_URL)
await p.getByText('Party', { exact: true }).click()
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(300)
await p.locator('input').nth(0).fill('13/11/2026')
await p.locator('input').nth(1).fill('16/11/2026')
await p.locator('input').nth(2).fill('450000')
await p.locator('input').nth(3).fill('9')
await p.locator('input').nth(4).fill('0')
await p.locator('select').selectOption({ label: 'Delhi' })
await p.getByRole('button', { name: 'Continue' }).click()
await p.waitForTimeout(300)
await p.getByText('Within India', { exact: true }).click()
await p.waitForTimeout(300)
await p.getByText('A city', { exact: true }).click()
await p.waitForTimeout(300)
await p.getByText('A proper city night', { exact: true }).click()
await p.waitForTimeout(300)
await p.getByText('Resort comfort', { exact: true }).click()
await p.waitForTimeout(3000)

// pick the Saver plan (North Goa) explicitly
await p.getByRole('button', { name: 'Use this plan' }).first().click()
await p.waitForTimeout(1500)
console.log('=== AFTER PICKING NORTH GOA ===')
console.log((await p.locator('body').innerText()).slice(0, 400))
await p.screenshot({ path: '.agency/screenshots/16-picked-goa.png', fullPage: true })

// now edit adults to 7 via adjust and re-plan, keep everything else
const inputs = await p.locator('input').all()
for (let i=0;i<inputs.length;i++){
  const val = await inputs[i].inputValue().catch(()=> 'n/a')
  console.log(i, val)
}
await b.close()
