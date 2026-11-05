// Baut die Sprachtabelle des Besucher-Chat-Widgets aus public/chat-widget/i18n/{lang}.json in public/chat-widget/v1.js ein
// (zwischen /* i18n:start */ und /* i18n:end */). Aufruf: node scripts/build-chat-widget-i18n.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const dir = new URL('../public/chat-widget/i18n/', import.meta.url)
const file = new URL('../public/chat-widget/v1.js', import.meta.url)
const ORDER = ['de', 'en', 'it', 'ru', 'uk', 'pl', 'bg', 'hi', 'tr', 'sr', 'es', 'zh', 'ko']
const langs = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
const T = {}
const de = JSON.parse(readFileSync(new URL('de.json', dir), 'utf8'))
for (const l of langs) {
  const t = JSON.parse(readFileSync(new URL(`${l}.json`, dir), 'utf8'))
  const missing = Object.keys(de).filter(k => typeof t[k] !== 'string' || !t[k].trim())
  const extra = Object.keys(t).filter(k => !(k in de))
  if (missing.length || extra.length) throw new Error(`${l}: fehlt ${missing.join(',') || '-'} / zu viel ${extra.join(',') || '-'}`)
  for (const k of ['notice', 'hoTitle', 'hoText']) for (const ph of (de[k].match(/\{\w+\}/g) || [])) if (!t[k].includes(ph)) throw new Error(`${l}.${k}: Platzhalter ${ph} fehlt`)
  if (l !== 'de' && l !== 'en' && /[—–]/.test(JSON.stringify(t))) throw new Error(`${l}: Gedankenstrich gefunden`)
  T[l] = Object.fromEntries(Object.keys(de).map(k => [k, t[k]]))
}
let js = readFileSync(file, 'utf8')
const start = js.indexOf('  /* i18n:start'), end = js.indexOf('  /* i18n:end */\n')
if (start < 0 || end < 0) throw new Error('Marker fehlen in v1.js')
const head = js.slice(start, js.indexOf('\n', start) + 1)
js = js.slice(0, start) + head + '  var T = ' + JSON.stringify(T, null, 2).replace(/\n/g, '\n  ') + ';\n' + js.slice(end)
writeFileSync(file, js)
console.log('Chat-Widget Sprachen:', langs.join(' '), '| Schlüssel je Sprache:', Object.keys(de).length)
