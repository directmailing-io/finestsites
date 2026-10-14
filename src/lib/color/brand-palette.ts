/**
 * Markenfarbe → komplette, lesbare Palette (Phase A, 14.10.2026).
 *
 * Der Nutzer legt genau EINE Farbe fest (users.brand_color). Daraus entstehen alle Töne, die ein
 * Template braucht: Buttons, Links, getönte Flächen, dunkle Abschnitte, Papier, Tinte. Der Farbton
 * bleibt immer erhalten; Helligkeit und Buntheit werden so weit angepasst, dass jede Kombination
 * die WCAG-Schwellen erreicht (Text 4,5:1, Bedienelemente 3:1). Gerechnet wird in OKLCH.
 *
 * Ohne Imports, damit der Cloudflare-Worker sie direkt bündeln kann (cloudflare-worker/src/index.ts
 * importiert sie wie die anderen src/lib-Module). scripts/check-brand-palette.ts prüft die Kontraste.
 */

export const BRAND_HEX_RE = /^#[0-9A-Fa-f]{6}$/
/** Wert des Feldes `farbthema`: Markenfarbe des Kontos (`markenfarbe` kommt aus users.brand_color) */
export const BRAND_THEME_VALUE = 'eigene'
/** Präfix im Feld `farbthema` für eine Farbe nur dieser Seite: `seite:#RRGGBB` */
export const SITE_COLOR_PREFIX = 'seite:'

/** Welche Farbe für diese Seite gilt: Kontofarbe (eigene) oder Seitenfarbe (seite:#hex); null = Vorgabe-Thema */
export function effectiveBrandColor(data: Record<string, unknown>): string | null {
  const theme = String(data.farbthema ?? '').trim()
  const hex = theme === BRAND_THEME_VALUE ? String(data.markenfarbe ?? '').trim()
    : theme.startsWith(SITE_COLOR_PREFIX) ? theme.slice(SITE_COLOR_PREFIX.length).trim() : ''
  return BRAND_HEX_RE.test(hex) ? hex.toUpperCase() : null
}

/**
 * Vor dem Rendern aufrufen: eine Seitenfarbe (`seite:#hex`) wird auf `farbthema=eigene` + `markenfarbe`
 * normalisiert, damit die Templates nur einen Fall (`data-theme="eigene"`) kennen müssen. Ohne gültige
 * Farbe bleibt alles unverändert (dann greift das Standard-Thema des Templates).
 */
export function resolveBrandColor<T extends Record<string, unknown>>(data: T): T {
  const theme = String(data.farbthema ?? '').trim()
  if (!theme.startsWith(SITE_COLOR_PREFIX)) return data
  const hex = effectiveBrandColor(data)
  if (!hex) return data
  ;(data as Record<string, unknown>).farbthema = BRAND_THEME_VALUE
  ;(data as Record<string, unknown>).markenfarbe = hex
  return data
}

export interface BrandPalette {
  brand: string
  primary: string; primaryRgb: string; onPrimary: string; hover: string
  deep: string; deepRgb: string
  soft: string; softRgb: string; soft2: string
  /** deutlich getönte Fläche (Karten-Akzente), unterscheidbar von Papier */
  tint: string
  /** dritte Papierstufe (dunkler Seitenhintergrund) */
  paper3: string
  bright: string; brightRgb: string
  dark1: string; dark2: string; dark3: string; dark3Rgb: string
  paper: string; paper2: string; surface: string
  ink: string; ink2: string; ink3: string; line: string; line2: string
  /** true, wenn die Farbe für Buttons/Links verändert werden musste */
  adjusted: boolean
  grey: boolean
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
function rgbToHex(r: [number, number, number]): string {
  return '#' + r.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
function rgbToOklab([r0, g0, b0]: [number, number, number]): [number, number, number] {
  const r = lin(r0), g = lin(g0), b = lin(b0)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
}
function oklabToRgb([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)]
}
interface Lch { l: number; c: number; h: number }
function toLch(hex: string): Lch {
  const [L, a, b] = rgbToOklab(hexToRgb(hex))
  return { l: L, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }
}
/** Buntheit schrittweise verringern, bis die Farbe im sRGB-Raum liegt */
function fromLch({ l, c, h }: Lch): string {
  for (let cc = c; cc >= 0; cc -= 0.004) {
    const rgb = oklabToRgb([l, cc * Math.cos(h * Math.PI / 180), cc * Math.sin(h * Math.PI / 180)])
    if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) return rgbToHex(rgb)
  }
  return rgbToHex(oklabToRgb([l, 0, 0]))
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG-2.1-Kontrast zweier Farben (1 bis 21) */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
function rgbTriple(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function derivePalette(input: string): BrandPalette | null {
  if (!BRAND_HEX_RE.test(input)) return null
  const hex = input.toUpperCase()
  const src = toLch(hex)
  const h = src.h
  const grey = src.c < 0.02
  const c = grey ? 0 : Math.min(src.c, 0.19)   // Neon deckeln, Farbton bleibt
  const tint = (k: number) => (grey ? 0 : k)

  const paper = fromLch({ l: 0.985, c: tint(0.008), h })
  const paper2 = fromLch({ l: 0.955, c: tint(0.012), h })
  const paper3 = fromLch({ l: 0.925, c: tint(0.016), h })
  const surface = '#FFFFFF'
  const ink = fromLch({ l: 0.22, c: tint(0.025), h })
  const ink2 = fromLch({ l: 0.42, c: tint(0.02), h })
  const ink3 = fromLch({ l: 0.62, c: tint(0.018), h })
  const line = fromLch({ l: 0.90, c: tint(0.012), h })
  const line2 = fromLch({ l: 0.945, c: tint(0.01), h })

  // Primär: Helligkeit in den Bereich, in dem weißer Text 4,5:1 erreicht (helle Farben werden
  // abgedunkelt, die exakte Farbe bleibt als `brand` für Flächen). Schwarz darf schwarz bleiben.
  let l = clamp(src.l, grey ? 0.22 : 0.36, 0.64)
  let primary = fromLch({ l, c, h })
  while (contrastRatio('#FFFFFF', primary) < 4.5 && l > 0.2) { l -= 0.01; primary = fromLch({ l, c, h }) }
  const adjusted = Math.abs(l - src.l) > 0.03 || c < src.c - 0.01
  const hover = fromLch({ l: l - 0.06, c, h })

  // Tief: Links und Akzente auf Papier UND auf der zarten Fläche lesbar
  const soft = fromLch({ l: 0.93, c: tint(Math.min(c * 0.45, 0.06)), h })
  const soft2 = fromLch({ l: 0.97, c: tint(Math.min(c * 0.3, 0.03)), h })
  const tintSurface = fromLch({ l: 0.915, c: tint(Math.min(c * 0.7, 0.09)), h })
  let dl = 0.40
  let deep = fromLch({ l: dl, c: Math.min(c, 0.14), h })
  while ((contrastRatio(deep, paper) < 4.5 || contrastRatio(deep, soft) < 4.5 || contrastRatio(deep, tintSurface) < 4.5) && dl > 0.15) { dl -= 0.01; deep = fromLch({ l: dl, c: Math.min(c, 0.14), h }) }

  // Dunkle Abschnitte: fast schwarz, im Farbton des Nutzers (Blau → Navy, Orange → Dunkelbraun)
  const dark1 = fromLch({ l: 0.27, c: tint(Math.min(c * 0.55, 0.08)), h })
  const dark2 = fromLch({ l: 0.20, c: tint(Math.min(c * 0.5, 0.06)), h })
  const dark3 = fromLch({ l: 0.13, c: tint(Math.min(c * 0.4, 0.04)), h })
  // Akzenttext auf dunklem Grund
  let bl = 0.76
  let bright = fromLch({ l: bl, c: Math.min(c, 0.13), h })
  while (contrastRatio(bright, dark1) < 4.5 && bl < 0.95) { bl += 0.01; bright = fromLch({ l: bl, c: Math.min(c, 0.13), h }) }

  return {
    brand: fromLch(src),
    primary, primaryRgb: rgbTriple(primary), onPrimary: '#FFFFFF', hover,
    deep, deepRgb: rgbTriple(deep),
    soft, softRgb: rgbTriple(soft), soft2, tint: tintSurface, paper3,
    bright, brightRgb: rgbTriple(bright),
    dark1, dark2, dark3, dark3Rgb: rgbTriple(dark3),
    paper, paper2, surface, ink, ink2, ink3, line, line2,
    adjusted, grey,
  }
}

/** CSS-Variablen (`--fs-*`) für die Palette; Templates bilden sie auf ihre eigenen Variablen ab. */
export function brandCss(hex: string): string | null {
  const p = derivePalette(hex)
  if (!p) return null
  const v: Record<string, string> = {
    'brand': p.brand, 'primary': p.primary, 'primary-rgb': p.primaryRgb, 'on-primary': p.onPrimary, 'primary-hover': p.hover,
    'deep': p.deep, 'deep-rgb': p.deepRgb, 'soft': p.soft, 'soft-rgb': p.softRgb, 'soft-2': p.soft2, 'tint': p.tint,
    'bright': p.bright, 'bright-rgb': p.brightRgb, 'dark-1': p.dark1, 'dark-2': p.dark2, 'dark-3': p.dark3, 'dark-3-rgb': p.dark3Rgb,
    'paper': p.paper, 'paper-2': p.paper2, 'paper-3': p.paper3, 'surface': p.surface, 'ink': p.ink, 'ink-2': p.ink2, 'ink-3': p.ink3, 'line': p.line, 'line-2': p.line2,
  }
  return ':root{' + Object.entries(v).map(([k, val]) => `--fs-${k}:${val}`).join(';') + '}'
}

/**
 * Fügt den Palette-Block in den <head> ein, wenn die Seite die Markenfarbe nutzt
 * (`farbthema` = eigene und `markenfarbe` ein gültiger Hex-Wert). In die Seite gelangen nur
 * berechnete Werte, nie der Rohtext des Nutzers. Für alle anderen Seiten bleibt das HTML unverändert.
 */
export function applyBrandColor(html: string, data: Record<string, unknown>): string {
  const hex = effectiveBrandColor(data)
  const css = hex ? brandCss(hex) : null
  if (!css) return html
  const tag = `<style id="fs-brand">${css}</style>`
  const i = html.search(/<\/head\s*>/i)
  return i === -1 ? tag + html : html.slice(0, i) + tag + html.slice(i)
}

/** Zusätzliche Platzhalter (z. B. für <meta name="theme-color">), nur gesetzt, wenn die Markenfarbe greift */
export function brandDataKeys(data: Record<string, unknown>): Record<string, string> {
  const hex = effectiveBrandColor(data)
  const p = hex ? derivePalette(hex) : null
  if (!p) return {}
  return { brand_primary: p.primary, brand_deep: p.deep, brand_dark: p.dark3 }
}
