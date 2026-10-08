/**
 * Live-Binding-Annotation für die Editor-Vorschau (ausgelagert aus
 * src/app/api/preview/[siteId]/route.ts, damit sie testbar ist – siehe
 * scripts/check-template-render.ts).
 *
 * WICHTIG: <script>- und <style>-Blöcke werden vor der Annotation herausgenommen
 * und danach unverändert wieder eingesetzt. Templates wie das Vitalprofil nutzen
 * {{#if …}}/{{key}} innerhalb ihres JavaScripts – HTML-Kommentar-Marker dort
 * würden das Script syntaktisch zerstören (Vorschau zeigte nur den Kopf der Seite).
 */
export function annotateLiveBindings(html: string): string {
  const blocks: string[] = []
  const stash = (m: string) => { blocks.push(m); return `\u0000FSBLOCK${blocks.length - 1}\u0000` }
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, stash).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, stash)
  html = annotateMarkup(html)
  return html.replace(/\u0000FSBLOCK(\d+)\u0000/g, (_m, i) => blocks[Number(i)])
}

/**
 * Annotate a template HTML string with live-binding markers so the runtime
 * can patch text + attribute values without an iframe reload.
 *
 * - Text placeholders ({{key}}) outside of tags are wrapped in HTML comments:
 *     <!--fs:key-->{{key}}<!--/fs:key-->
 *   After substitution, the comments stay and bracket the substituted text.
 *
 * - Tags that contain placeholders in their attributes get a
 *     data-fs-bind='[{"a":"src","t":"{{profilbild}}"}, ...]'
 *   attribute so the runtime knows which attributes to recompute when a key
 *   changes.
 *
 * Skips template-engine control tokens: {{#if}}, {{#each}}, {{/if}}, etc.
 * Also skips content inside <script> / <style> / existing comments.
 */
function annotateMarkup(html: string): string {
  // ── Phase 0: convert truthy {{#if key}}…{{/if}} into HTML-comment ranges ──
  // (Equality form {{#if key=value}} is kept for the template engine — it's used
  // by section toggles which the editor already manages with smooth animations.)
  // The truthy form is converted so the wrapped content is ALWAYS rendered.
  // At runtime, we toggle the inner elements' display based on the key value,
  // which removes the need for an iframe reload when an optional field appears.
  //
  // Verschachtelungs-sicher: der passende {{/if}} wird durch Mitzählen aller
  // {{#if …}}-Öffner gefunden (auch der Gleichheitsform). Ein nicht-gieriger Regex
  // hatte beim Vitalprofil das {{/if}} eines inneren {{#if partner_modus=duo}}
  // erwischt – danach fehlte </template> und das Engine-Script lag inert im <template>.
  html = convertTruthyBlocks(html, 'if', 'fs-cond')
  html = convertTruthyBlocks(html, 'unless', 'fs-uncond')

  // ── Phase 1: tag-level attribute bindings ───────────────────────────
  // For each opening tag (e.g. <img src="{{profilbild}}" alt="{{vorname}}">),
  // collect attributes whose values contain at least one {{key}} placeholder
  // (not a control block), and append data-fs-bind='[...]'.
  html = html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (full, tagName, attrsStr) => {
    if (tagName === 'script' || tagName === 'style') return full
    const bindings: Array<{ a: string; t: string }> = []
    const attrRe = /\b([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(attrsStr)) !== null) {
      const attrName = m[1]
      const attrValue = m[2]
      if (attrName === 'data-fs-bind') continue
      // Find simple-substitution placeholders (no control blocks)
      const placeholderRe = /\{\{\s*([\w.]+)\s*\}\}/g
      if (placeholderRe.test(attrValue)) {
        bindings.push({ a: attrName, t: attrValue })
      }
    }
    if (bindings.length === 0) return full
    // Encode bindings as a single-quoted JSON attribute. The value's quotes
    // are safe because we use single-quote delimiter and escape ' inside.
    const json = JSON.stringify(bindings).replace(/'/g, '&#39;')
    return `<${tagName}${attrsStr} data-fs-bind='${json}'>`
  })

  // ── Phase 2: wrap text-content placeholders with HTML comments ──────
  // Walk char-by-char tracking whether we're inside a tag, a comment, a
  // script block, or a style block. Only wrap placeholders found in plain
  // text content.
  const out: string[] = []
  const N = html.length
  let i = 0
  let inTag = false
  let inComment = false
  let inScript = false
  let inStyle = false

  while (i < N) {
    if (inComment) {
      if (html.startsWith('-->', i)) { out.push('-->'); i += 3; inComment = false; continue }
      out.push(html[i]); i++; continue
    }
    if (inScript) {
      if (html.substr(i, 9).toLowerCase() === '</script>') { out.push(html.substr(i, 9)); i += 9; inScript = false; continue }
      out.push(html[i]); i++; continue
    }
    if (inStyle) {
      if (html.substr(i, 8).toLowerCase() === '</style>') { out.push(html.substr(i, 8)); i += 8; inStyle = false; continue }
      out.push(html[i]); i++; continue
    }
    if (inTag) {
      if (html[i] === '>') { inTag = false }
      out.push(html[i]); i++; continue
    }

    // Outside any tag/comment/script/style.
    if (html.startsWith('<!--', i)) { out.push('<!--'); i += 4; inComment = true; continue }
    if (html[i] === '<') {
      // Detect script/style entry
      const rest = html.substr(i, 8).toLowerCase()
      if (rest.startsWith('<script')) inScript = true
      else if (rest.startsWith('<style')) inStyle = true
      else inTag = true
      out.push(html[i]); i++; continue
    }

    // Triple-brace raw substitution {{{key}}} — leave alone so the engine
    // can substitute the un-escaped value (used for richtext fields whose
    // stored value is HTML). Wrapping these in fs: markers would break the
    // engine's triple-brace match.
    if (html.startsWith('{{{', i)) {
      const tripleEnd = html.indexOf('}}}', i + 3)
      if (tripleEnd !== -1) {
        out.push(html.substring(i, tripleEnd + 3))
        i = tripleEnd + 3
        continue
      }
    }

    // Text content. Check for {{key}} placeholder (simple, not control).
    if (html.startsWith('{{', i)) {
      const end = html.indexOf('}}', i + 2)
      if (end !== -1) {
        const expr = html.substring(i + 2, end).trim()
        const isControl = expr.startsWith('#') || expr.startsWith('/')
        if (!isControl && /^[\w.]+$/.test(expr)) {
          out.push(`<!--fs:${expr}-->{{${expr}}}<!--/fs:${expr}-->`)
          i = end + 2
          continue
        }
      }
    }

    out.push(html[i]); i++
  }
  return out.join('')
}

function convertTruthyBlocks(html: string, kind: 'if' | 'unless', marker: string): string {
  const openRe = new RegExp(`\\{\\{#${kind}\\s+(\\w+)\\}\\}`, 'g')
  const anyOpenRe = new RegExp(`\\{\\{#${kind}\\b[^}]*\\}\\}`, 'g')
  const close = `{{/${kind}}}`
  let cursor = 0
  for (;;) {
    openRe.lastIndex = cursor
    const m = openRe.exec(html)
    if (!m) break
    const start = m.index, innerStart = start + m[0].length
    let depth = 1, pos = innerStart, end = -1
    while (depth > 0) {
      anyOpenRe.lastIndex = pos
      const o = anyOpenRe.exec(html)
      const c = html.indexOf(close, pos)
      if (c === -1) break
      if (o && o.index < c) { depth++; pos = o.index + o[0].length }
      else { depth--; pos = c + close.length; if (depth === 0) end = c }
    }
    if (end === -1) { cursor = innerStart; continue }
    const content = html.slice(innerStart, end)
    // Skip conditionals that wrap <style> blocks. These control CSS rules
    // (background colour, background image, theme effects) that must only
    // be emitted when the condition is TRUE – the template engine re-evaluates
    // them on every (structural) render anyway.
    if (/<style\b/i.test(content)) { cursor = innerStart; continue }
    const open = `<!--${marker}:${m[1]}-->`
    html = html.slice(0, start) + open + content + `<!--/${marker}:${m[1]}-->` + html.slice(end + close.length)
    cursor = start + open.length // weiter im Inneren: verschachtelte Blöcke folgen
  }
  return html
}
