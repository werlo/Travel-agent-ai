import { chromium } from 'playwright'
export async function run(fn, opts={}) {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
  await p.goto('http://localhost:4079')
  await p.waitForTimeout(400)
  await fn(p, b)
  return { p, b }
}
