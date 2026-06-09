/**
 * FinestSites Template Engine
 *
 * Syntax:
 *   {{key}}                         → simple value replacement
 *   {{#if key=value}} ... {{/if}}   → show block if field equals value
 *   {{#if key}}       ... {{/if}}   → show block if field is truthy
 *   {{#unless key=value}} ... {{/unless}} → opposite of #if
 *   {{#unless key}}   ... {{/unless}}
 *   {{#each key}}     ... {{/each}} → iterate over array (data[key] = JSON string)
 *     inside loop body:
 *       {{this.field}}              → current item field
 *       {{@index}}                  → 1-based index
 *       {{#each this.subkey}}…{{/each}} → nested loop over current item's sub-array
 *       {{../field}}                → parent item field (inside nested loop)
 */

export type SiteData = Record<string, string>
type Item = Record<string, string>

function htmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderTemplate(html: string, data: SiteData): string {
  html = processLoops(html, data, [])
  html = processConditionals(html, data)
  html = replaceSimplePlaceholders(html, data)
  return html
}

const OPEN_EACH = /\{\{#each\s+([\w.]+)\}\}/g
const CLOSE_EACH = '{{/each}}'

function resolveArray(key: string, data: SiteData, stack: Item[]): Item[] {
  let raw: string | undefined
  if (key.startsWith('this.')) {
    const top = stack[stack.length - 1]
    raw = top?.[key.substring(5)]
  } else {
    raw = data[key]
  }
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function processLoops(html: string, data: SiteData, stack: Item[]): string {
  let out = ''
  let cursor = 0
  OPEN_EACH.lastIndex = 0

  while (cursor < html.length) {
    OPEN_EACH.lastIndex = cursor
    const m = OPEN_EACH.exec(html)
    if (!m) {
      out += html.substring(cursor)
      break
    }
    // Emit content before the match (already free of outer-level each)
    out += html.substring(cursor, m.index)

    const key = m[1]
    const bodyStart = m.index + m[0].length

    // Find matching {{/each}} via depth counter
    let depth = 1
    let scan = bodyStart
    let bodyEnd = -1
    while (scan < html.length && depth > 0) {
      const nextOpen = html.indexOf('{{#each', scan)
      const nextClose = html.indexOf(CLOSE_EACH, scan)
      if (nextClose === -1) break // unbalanced
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        const tagEnd = html.indexOf('}}', nextOpen)
        scan = tagEnd === -1 ? html.length : tagEnd + 2
      } else {
        depth--
        if (depth === 0) {
          bodyEnd = nextClose
          break
        }
        scan = nextClose + CLOSE_EACH.length
      }
    }

    if (bodyEnd === -1) {
      // Unbalanced — emit literal start tag and continue
      out += m[0]
      cursor = bodyStart
      continue
    }

    const inner = html.substring(bodyStart, bodyEnd)
    const closeEnd = bodyEnd + CLOSE_EACH.length
    const items = resolveArray(key, data, stack)

    out += items.map((item, idx) => {
      const newStack = [...stack, item]
      // Recursively expand inner each-blocks (with new context)
      let chunk = processLoops(inner, data, newStack)
      // Resolve item-scoped conditionals BEFORE substituting {{this.field}}
      chunk = processItemConditionals(chunk, item)
      // Raw substitution {{{this.field}}} — for richtext (HTML already)
      chunk = chunk.replace(/\{\{\{this\.(\w+)\}\}\}/g, (_m, field: string) => String(item[field] ?? ''))
      // Substitute {{this.field}} with current item field (HTML-escaped for safety)
      chunk = chunk.replace(/\{\{this\.(\w+)\}\}/g, (_m, field: string) => htmlEscape(item[field] ?? ''))
      // 1-based index
      chunk = chunk.replace(/\{\{@index\}\}/g, String(idx + 1))
      // Parent item access from stack
      chunk = chunk.replace(/\{\{\.\.\/(\w+)\}\}/g, (_m, field: string) => {
        const parent = stack[stack.length - 1]
        return htmlEscape(parent?.[field] ?? '')
      })
      return chunk
    }).join('')

    cursor = closeEnd
    OPEN_EACH.lastIndex = cursor
  }
  return out
}

function processItemConditionals(html: string, item: Item): string {
  for (let pass = 0; pass < 20; pass++) {
    const next = html
      // {{#if this.field=value}} ... {{/if}}
      .replace(/\{\{#if\s+this\.(\w+)=([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, value, content) => (item[key] ?? '').trim() === value.trim() ? content : ''
      )
      // {{#if this.field}} ... {{/if}}
      .replace(/\{\{#if\s+this\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, content) => {
          const v = (item[key] ?? '').trim()
          return (v !== '' && v !== 'false' && v !== '0') ? content : ''
        }
      )
      // {{#unless this.field=value}} ... {{/unless}}
      .replace(/\{\{#unless\s+this\.(\w+)=([\w-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, value, content) => (item[key] ?? '').trim() !== value.trim() ? content : ''
      )
      // {{#unless this.field}} ... {{/unless}}
      .replace(/\{\{#unless\s+this\.(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, content) => {
          const v = (item[key] ?? '').trim()
          return (v === '' || v === 'false' || v === '0') ? content : ''
        }
      )
    if (next === html) break
    html = next
  }
  return html
}

function processConditionals(html: string, data: SiteData): string {
  // Run up to 20 passes to resolve all non-nested sequential blocks
  for (let pass = 0; pass < 20; pass++) {
    const next = html
      // {{#if key=value}} ... {{/if}}
      .replace(/\{\{#if\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, value, content) =>
          (data[key] ?? '').trim() === value.trim() ? content : ''
      )
      // {{#if key}} ... {{/if}}
      .replace(/\{\{#if\s+([\w]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, content) => {
          const v = (data[key] ?? '').trim()
          return (v !== '' && v !== 'false' && v !== '0') ? content : ''
        }
      )
      // {{#unless key=value}} ... {{/unless}}
      .replace(/\{\{#unless\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, value, content) =>
          (data[key] ?? '').trim() !== value.trim() ? content : ''
      )
      // {{#unless key}} ... {{/unless}}
      .replace(/\{\{#unless\s+([\w]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, content) => {
          const v = (data[key] ?? '').trim()
          return (v === '' || v === 'false' || v === '0') ? content : ''
        }
      )

    if (next === html) break
    html = next
  }
  return html
}

function replaceSimplePlaceholders(html: string, data: SiteData): string {
  // {{{key}}} → raw substitution (no HTML-escape). Used for richtext fields
  // whose stored value is already HTML.
  html = html.replace(/\{\{\{\s*([\w]+)\s*\}\}\}/g, (_m, key: string) => {
    const val = data[key]
    return val !== undefined && val !== null ? String(val) : ''
  })
  return html.replace(/\{\{([^#/{}][^{}]*)\}\}/g, (match, key) => {
    const val = data[key.trim()]
    return val !== undefined && val !== null ? val : ''
  })
}

export function extractPlaceholders(html: string): string[] {
  const keys = new Set<string>()
  const re = /\{\{([^#/{}][^{}]*)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) keys.add(m[1].trim())
  return Array.from(keys)
}
