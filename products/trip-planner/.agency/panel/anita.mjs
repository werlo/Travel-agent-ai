import { chromium } from 'playwright'
import { setup, answerAll, finish } from './anita_setup.mjs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 560 } })
await setup(p); await answerAll(p); await finish(p)
await p.getByRole('button',{name:/Use this plan/i}).nth(1).click()
await p.waitForTimeout(1200)
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(500)
await p.screenshot({ path: '.agency/screenshots/anita-12-banner-top.png' })
await b.close()
