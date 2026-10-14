/**
 * Wächter für die Markenfarben-Engine (App und Worker nutzen dieselbe Datei):
 * (1) für 360 Farbtöne × 10 Helligkeiten plus Grenzfälle halten alle Kontrastregeln,
 * (2) die Einfügung in den <head> passiert nur bei farbthema=eigene mit gültigem Hex.
 * Aufruf: npx tsx scripts/check-brand-palette.ts (läuft im Deploy)
 */
import { derivePalette, contrastRatio, applyBrandColor, brandCss } from '../src/lib/color/brand-palette'

const rules: Array<[string, (p: NonNullable<ReturnType<typeof derivePalette>>) => number, number]> = [
  ['Button-Text / Primär', p => contrastRatio(p.onPrimary, p.primary), 4.5],
  ['Tief / Papier', p => contrastRatio(p.deep, p.paper), 4.5],
  ['Tief / Zart', p => contrastRatio(p.deep, p.soft), 4.5],
  ['Tinte / Papier', p => contrastRatio(p.ink, p.paper), 7],
  ['Tinte 2 / Papier', p => contrastRatio(p.ink2, p.paper), 4.5],
  ['Hell / Dunkel 1', p => contrastRatio(p.bright, p.dark1), 4.5],
  ['Papier / Dunkel 1', p => contrastRatio(p.paper, p.dark1), 4.5],
  ['Primär / Papier (UI)', p => contrastRatio(p.primary, p.paper), 3],
]
const samples = ['#2F8650', '#1F4FA3', '#A0522D', '#F5C400', '#F6B8C9', '#39FF14', '#111111', '#E8E6E1', '#C8102E', '#7C3AED', '#FFFFFF', '#000000', '#808080']
for (let h = 0; h < 360; h += 6) for (let l = 0.1; l <= 0.95; l += 0.085) {
  // Farbe mit gegebener Helligkeit erzeugen: grobe Näherung über HSL reicht als Testraster
  const s = 0.7, lum = l
  const q = lum < 0.5 ? lum * (1 + s) : lum + s - lum * s, pp = 2 * lum - q
  const f = (t: number) => { t = (t + 360) % 360 / 360; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp }
  samples.push('#' + [f(h + 120), f(h), f(h - 120)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''))
}
let fails = 0
for (const hex of samples) {
  const p = derivePalette(hex)
  if (!p) { console.error('✗ keine Palette für', hex); fails++; continue }
  for (const [name, fn, min] of rules) {
    const v = fn(p)
    if (v < min) { fails++; console.error(`✗ ${hex} ${name} ${v.toFixed(2)} < ${min}`) }
  }
}
if (derivePalette('red') || derivePalette('#12345') || derivePalette('#GGGGGG')) { console.error('✗ ungültige Eingabe ergab eine Palette'); fails++ }

const html = '<html><head><title>x</title></head><body></body></html>'
if (applyBrandColor(html, { farbthema: 'blau', markenfarbe: '#2F8650' }) !== html) { console.error('✗ Einfügung trotz anderem Farbthema'); fails++ }
if (applyBrandColor(html, { farbthema: 'eigene', markenfarbe: 'red;}body{display:none}' }) !== html) { console.error('✗ Einfügung mit ungültigem Wert'); fails++ }
if (applyBrandColor(html, { farbthema: 'eigene' }) !== html) { console.error('✗ Einfügung ohne Markenfarbe'); fails++ }
const out = applyBrandColor(html, { farbthema: 'eigene', markenfarbe: '#a0522d' })
if (!out.includes('<style id="fs-brand">:root{--fs-brand:#A0522D;') || !out.includes('</style></head>')) { console.error('✗ Einfügung fehlt oder an falscher Stelle'); fails++ }
if (!/^:root\{(--fs-[a-z0-9-]+:(#[0-9A-F]{6}|\d{1,3}, \d{1,3}, \d{1,3});?)+\}$/.test(brandCss('#A0522D') ?? '')) { console.error('✗ CSS enthält unerwartete Zeichen'); fails++ }

if (fails) { console.error(`✗ Markenfarben-Check: ${fails} Fehler`); process.exit(1) }
console.log(`✓ Markenfarben-Check ok (${samples.length} Farben, ${rules.length} Regeln)`)
