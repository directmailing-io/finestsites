/**
 * Render-Wächter: rendert jedes Template mit Testwerten und bricht ab, wenn
 *  (a) ein Richtext-Feld (type: richtext laut Schema) NICHT als HTML ausgegeben wird, oder
 *  (b) ein normales Textfeld NICHT escaped wird (XSS-Schutz), oder
 *  (c) Platzhalter-Reste ({{…}}) im Ergebnis stehen.
 * Läuft im Deploy-Script vor dem Build – ein Fehler stoppt den Deploy.
 * Aufruf: npx tsx scripts/check-template-render.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { renderTemplate, rawKeysFromSchema } from '../src/lib/utils/template-engine'

const root = path.resolve(__dirname, '..', 'templates')
let failures = 0
const fail = (msg: string) => { failures++; console.error('✗ ' + msg) }

for (const dir of fs.readdirSync(root)) {
  const htmlPath = path.join(root, dir, 'index.html'), schemaPath = path.join(root, dir, 'placeholders-schema.json')
  if (!fs.existsSync(htmlPath) || !fs.existsSync(schemaPath)) continue
  const html = fs.readFileSync(htmlPath, 'utf8')
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  const fields: Array<{ key: string; type?: string }> = schema.fields ?? []
  const rawKeys = rawKeysFromSchema(schema)
  const data: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === 'loop' || f.type === 'image' || f.type === 'card_select' || f.type === 'toggle' || f.type === 'select') continue
    data[f.key] = rawKeys.has(f.key) ? `<p><strong>RT-${f.key}</strong></p>` : `<i>TX-${f.key}</i>`
  }
  for (const k of rawKeys) if (k.endsWith('_en') && data[k.slice(0, -3)]) data[k] = `<p><em>EN-${k}</em></p>`
  const out = renderTemplate(html, data, { rawKeys })
  for (const [k, v] of Object.entries(data)) {
    const used = new RegExp(`\\{\\{\\{?\\s*${k}\\s*\\}?\\}\\}`).test(html)
    if (!used) continue
    if (rawKeys.has(k)) { if (!out.includes(v)) fail(`${dir}: Richtext „${k}“ wird nicht als HTML ausgegeben`) }
    else if (out.includes(`<i>TX-${k}</i>`)) fail(`${dir}: Textfeld „${k}“ wird NICHT escaped (XSS)`)
  }
  const leftovers = out.match(/\{\{[^}]{1,60}\}\}/g)
  if (leftovers) fail(`${dir}: Platzhalter-Reste im Output: ${[...new Set(leftovers)].slice(0, 5).join(' ')}`)
  console.log(`✓ ${dir} (${rawKeys.size ? 'richtext: ' + [...rawKeys].filter(k => !k.endsWith('_en')).join(', ') : 'kein richtext'})`)
}
if (failures) { console.error(`\n${failures} Problem(e) – Deploy abgebrochen.`); process.exit(1) }
console.log('Render-Check ok')
