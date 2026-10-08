// Prüft die Editor-Vorschau offline: Annotation + Rendering je Template, dann Laden im Browser.
// Fehler = JS-Fehler oder fehlender Hauptinhalt (beim Vitalprofil: der Check selbst).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '/private/tmp/claude-501/-Users-kurzeja-new-finestsites/fb01fa48-18c4-4d34-980f-53aca0ea91d8/scratchpad/node_modules/playwright-core/index.mjs'
const { annotateLiveBindings } = await import('../src/lib/preview/annotate.ts')
const { renderTemplate, rawKeysFromSchema } = await import('../src/lib/utils/template-engine.ts')
const root = path.resolve('templates')
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
let failures = 0
for (const dir of fs.readdirSync(root)) {
  const htmlPath = path.join(root, dir, 'index.html'), schemaPath = path.join(root, dir, 'placeholders-schema.json')
  if (!fs.existsSync(htmlPath) || !fs.existsSync(schemaPath)) continue
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  const data = {}
  for (const f of schema.fields ?? []) { if (f.default_value) data[f.key] = f.default_value; if (f.preview_value) data[f.key] = f.preview_value }
  Object.assign(data, schema.preview_values ?? {})
  const html = renderTemplate(annotateLiveBindings(fs.readFileSync(htmlPath, 'utf8')), data, { rawKeys: rawKeysFromSchema(schema) })
  const out = path.join(root, dir, 'preview-lokal'); fs.mkdirSync(out, { recursive: true })
  const file = path.join(out, `${dir}-editorpreview.html`); fs.writeFileSync(file, html)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)))
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' }).catch(() => {})
  await page.waitForTimeout(1200)
  const h = await page.evaluate(() => document.body.scrollHeight)
  const vitalOk = dir !== 'vitalprofil' || await page.$('#check .card, #check .opt, main#check *') !== null
  const ok = errs.length === 0 && h > 600 && vitalOk
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${dir}: Höhe ${h}px${errs.length ? ' · JS: ' + errs.join(' | ') : ''}${!vitalOk ? ' · Check nicht gerendert' : ''}`)
  await page.close()
}
await browser.close()
if (failures) { console.error(`${failures} Vorschau-Problem(e)`); process.exit(1) }
console.log('Vorschau-Check ok')
