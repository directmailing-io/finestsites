/**
 * FinestSites Template Engine
 *
 * Syntax:
 *   {{key}}                         → simple value replacement
 *   {{#if key=value}} ... {{/if}}   → show block if field equals value
 *   {{#if key}}       ... {{/if}}   → show block if field is truthy
 *   {{#unless key=value}} ... {{/unless}} → opposite of #if
 *   {{#unless key}}   ... {{/unless}}
 */

export type SiteData = Record<string, string>

export function renderTemplate(html: string, data: SiteData): string {
  html = processConditionals(html, data)
  html = replaceSimplePlaceholders(html, data)
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
