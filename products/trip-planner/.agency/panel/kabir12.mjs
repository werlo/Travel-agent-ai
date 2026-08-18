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

// Now change headcount to 7 in the "Adjust and re-plan" box
const adultsBox = p.locator('text=Adjust and re-plan').locator('..').locator('..')
await p.screenshot({ path: '.agency/screenshots/11-before-adjust.png', fullPage: true })

// find the Adults input within that section - it's the 4th visible number input near bottom
const inputs = await p.locator('input').all()
console.log('input count', inputs.length)
for (let i=0;i<inputs.length;i++){
  const val = await inputs[i].inputValue().catch(()=> 'n/a')
  console.log(i, val)
}
await b.close()
