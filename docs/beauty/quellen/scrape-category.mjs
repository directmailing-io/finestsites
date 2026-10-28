import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ locale: 'de-DE' })
const apis = []
p.on('response', r => { const u = r.url(); if (/api|graphql|product/i.test(u) && r.request().resourceType() === 'fetch' || r.request().resourceType() === 'xhr') apis.push(u) })
await p.goto('https://www.fitline.com/de/de-de/products?category=beauty', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(4000)
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 3000); await p.waitForTimeout(800) }
const links = await p.$$eval('a[href*="/products/"]', as => [...new Set(as.map(a => a.href + ' | ' + a.innerText.replace(/\s+/g, ' ').trim().slice(0, 120)))])
console.log(links.join('\n'))
console.log('--- APIS'); console.log([...new Set(apis)].slice(0, 30).join('\n'))
await b.close()
