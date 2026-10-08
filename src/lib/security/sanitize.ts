import sanitizeHtml from 'sanitize-html'

/**
 * Richtext-Werte (TipTap-HTML) werden beim Speichern auf eine feste Tag-/Attribut-Liste
 * reduziert. Das ist die zweite Verteidigungslinie neben dem Escaping in der Template-Engine:
 * Richtext wird bewusst roh ausgegeben, darf also nie Script, Event-Handler oder
 * javascript:-Links enthalten – weder auf der Kundenseite noch in der Editor-Vorschau
 * (die auf app.finestsites.io läuft, inkl. Admin-Impersonation).
 */
const RICHTEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'span', 'mark'],
  allowedAttributes: { a: ['href', 'target', 'rel'], span: ['class'], mark: ['class'], p: ['class'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer', ...(attribs.target ? { target: '_blank' } : {}) } }),
  },
  disallowedTagsMode: 'discard',
}

export function sanitizeRichtext(html: string): string {
  return sanitizeHtml(html, RICHTEXT_OPTIONS)
}

type SchemaField = { key: string; type?: string; fields?: Array<{ key: string; type?: string }> }

/** Richtext-Schlüssel und Loop-Schlüssel (mit ihren Richtext-Unterfeldern) aus dem Template-Schema. */
export function richtextKeysFromSchema(schema: unknown): { richtext: Set<string>; loops: Map<string, Set<string>> } {
  const richtext = new Set<string>()
  const loops = new Map<string, Set<string>>()
  const fields = (schema && typeof schema === 'object' && Array.isArray((schema as { fields?: unknown }).fields))
    ? ((schema as { fields: SchemaField[] }).fields)
    : []
  for (const f of fields) {
    if (!f || typeof f.key !== 'string') continue
    if (f.type === 'richtext' || /(_html|_html_en)$/.test(f.key)) richtext.add(f.key)
    if (f.type === 'loop' && Array.isArray(f.fields)) {
      loops.set(f.key, new Set(f.fields.filter(s => s && (s.type === 'richtext' || /(_html|_html_en)$/.test(s.key))).map(s => s.key)))
    }
  }
  return { richtext, loops }
}

/**
 * Bereinigt einen zu speichernden Feldwert anhand des Schemas. Nicht-Richtext-Werte
 * bleiben unverändert (sie werden bei der Ausgabe escaped); Loop-Werte (JSON-Array)
 * werden je Eintrag behandelt: Richtext-Unterfelder bereinigt, alle anderen Strings
 * von Tags befreit.
 */
export function sanitizeFieldValue(key: string, value: string, info: ReturnType<typeof richtextKeysFromSchema>): string {
  if (typeof value !== 'string' || value === '') return value
  if (info.richtext.has(key) || /(_html|_html_en)$/.test(key) || key === 'intro' || key === 'intro_en') return sanitizeRichtext(value)
  const loopSub = info.loops.get(key)
  if (loopSub !== undefined || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      const arr = JSON.parse(value)
      if (!Array.isArray(arr)) return value
      const cleaned = arr.map(item => {
        if (!item || typeof item !== 'object') return item
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          out[k] = typeof v === 'string'
            ? (loopSub?.has(k) ? sanitizeRichtext(v) : sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }))
            : v
        }
        return out
      })
      return JSON.stringify(cleaned)
    } catch { return value }
  }
  return value
}
