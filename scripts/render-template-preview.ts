/**
 * Renders a template locally with its preview values (no DB, no R2) into
 * templates/<slug>/preview-lokal/ so it can be opened in a browser.
 *
 *   npx tsx scripts/render-template-preview.ts vitalcheck-b [--theme mint] [--result]
 *
 * --result seeds a finished check into sessionStorage (preview files only)
 * so the evaluation can be viewed without answering 20 statements.
 */
import fs from 'node:fs'
import path from 'node:path'
import { renderTemplate } from '../src/lib/utils/template-engine'

const slug = process.argv[2]
if (!slug) { console.error('usage: render-template-preview.ts <template-slug> [--theme x] [--result] [--nolinks] [--intro]'); process.exit(1) }
const argv = process.argv.slice(3)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const flag = (k: string) => argv.includes(k)

const dir = path.join(process.cwd(), 'templates', slug)
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
const schema = JSON.parse(fs.readFileSync(path.join(dir, 'placeholders-schema.json'), 'utf8'))

const data: Record<string, string> = {}
for (const f of schema.fields) {
  const v = f.preview_value ?? f.default_value ?? ''
  if (v !== '') data[f.key] = String(v)
}
Object.assign(data, schema.preview_values ?? {})
if (opt('--theme')) data.farbthema = opt('--theme')!
if (flag('--nolinks')) delete data.links
if (flag('--intro')) data.intro = 'Hi, ich bin Daniel. Ich hab vor zwei Jahren angefangen, meine Gewohnheiten umzukrempeln, und seitdem hat sich mein Alltag komplett verändert. Mach den Check, dann weißt du, wo du stehst.'

let out = renderTemplate(html, data)

if (flag('--result')) {
  const answers: Record<string, number> = {}
  const pattern = [[3, 2, 4, 3], [1, 2, 1, 0], [4, 3, 3, 4], [1, 2, 0, 1], [2, 3, 2, 2]]
  pattern.forEach((qs, di) => qs.forEach((v, qi) => { answers[`${di}:${qi}`] = v }))
  const state = { step: 999, wishes: ['energie', 'schlaf'], answers, motives: ['familie'], invest: 'ca3bis4', interests: [], sent: false }
  // step 999 is clamped to the last step by go(); we want 'result': compute index = steps().indexOf('result')
  const seed = `<script>try{var s=${JSON.stringify(state)};var steps=['wishes','area:0','area:1','area:2','area:3','area:4'];${data.frage_motive !== 'aus' ? "steps.push('motive');" : ''}${data.frage_investition === 'an' ? "steps.push('invest');" : ''}steps.push('reveal','result');s.step=steps.indexOf('result');sessionStorage.setItem('vcb_state_v1',JSON.stringify(s));}catch(e){}</script>`
  out = out.replace('<head>', '<head>' + seed)
}

const outDir = path.join(dir, 'preview-lokal')
fs.mkdirSync(outDir, { recursive: true })
const name = `${slug}-${data.farbthema ?? 'default'}${flag('--result') ? '-result' : ''}${flag('--nolinks') ? '-nolinks' : ''}${flag('--intro') ? '-intro' : ''}.html`
fs.writeFileSync(path.join(outDir, name), out)
console.log('wrote', path.relative(process.cwd(), path.join(outDir, name)))
