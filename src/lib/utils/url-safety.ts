/**
 * Letzte Verteidigungslinie beim Rendern (App-Vorschau und Cloudflare-Worker, darum ohne
 * Abhängigkeiten): Link- und Quell-Attribute im fertigen HTML dürfen nie Script ausführen.
 * Platzhalter werden zwar HTML-escaped, aber `href="{{this.url}}"` mit dem Wert
 * `javascript:…` bliebe sonst ein klickbarer Script-Link – auf der Kundenseite und in der
 * Editor-Vorschau auf app.finestsites.io (auch während Admin-Impersonation).
 *
 * Gesperrt: javascript:, vbscript:, und data: außer data:image/… (Bilder).
 * Browser ignorieren Steuerzeichen/Leerraum im Schema („java\nscript:“) – darum wird vor dem
 * Vergleich alles bis U+0020 entfernt und es werden Zeichenreferenzen aufgelöst.
 */
const URL_ATTR_RE = /(\s(?:href|src|action|formaction|xlink:href|poster|background|data)\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi

function decodeRefs(v: string): string {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16) || 0))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d) || 0))
    .replace(/&colon;/gi, ':').replace(/&tab;/gi, '').replace(/&newline;/gi, '')
}

export function isDangerousUrl(value: string): boolean {
  const norm = decodeRefs(value).replace(/[\x00-\x20\x7f-\x9f]+/g, '').toLowerCase()
  if (/^(javascript|vbscript|livescript):/.test(norm)) return true
  if (/^data:/.test(norm) && !/^data:image\//.test(norm)) return true
  return false
}

export function neutralizeDangerousUrls(html: string): string {
  return html.replace(URL_ATTR_RE, (m, pre: string, dq: string | undefined, sq: string | undefined) => {
    const val = dq ?? sq ?? ''
    if (!isDangerousUrl(val)) return m
    return dq !== undefined ? `${pre}"#"` : `${pre}'#'`
  })
}
