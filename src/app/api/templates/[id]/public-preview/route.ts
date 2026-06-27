/**
 * Public (unauthenticated) template preview.
 *
 * Serves rendered template HTML for the live preview iframe on the marketing
 * template detail page (/vorlagen/[id]).
 *
 * Preview data hierarchy (per field):
 *   1. field.preview_value  — admin-set demo value (single source of truth)
 *   2. schema.preview_values[key] — legacy fallback
 *   3. field.default_value  — fallback
 *
 * ?data=<base64url JSON> can override fields that have preview_interactive: true.
 * All other overrides are silently ignored (security: visitors can only change
 * fields the admin explicitly marked as interactive).
 *
 * Preview-mode security is injected at the bottom of <body>:
 *   - All form submissions are blocked
 *   - All link navigation is blocked (only #anchor links pass through)
 *   - A subtle visual overlay is added to forms
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardOption { value: string }

interface PlaceholderField {
  key: string
  type?: string
  default_value?: string
  preview_value?: string
  preview_interactive?: boolean
  card_options?: CardOption[]
}

interface PlaceholderSchema {
  fields?: PlaceholderField[]
  preview_values?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Toggle-section helpers
// ---------------------------------------------------------------------------

/** Returns true when a field is a ja/nein 2-option toggle. */
function isToggleField(f: PlaceholderField): boolean {
  if (f.type !== 'card_select' || !f.card_options) return false
  const vals = f.card_options.map(o => o.value)
  return vals.length === 2 && vals.includes('ja') && vals.includes('nein')
}

/**
 * Balanced {{#if…}}…{{/if}} extractor.
 * Returns { content, end } where end is the index AFTER the closing {{/if}}.
 * Correctly handles nested {{#if}} blocks.
 */
function extractIfBlock(
  html: string,
  startPos: number,
  openTag: string,
): { content: string; end: number } | null {
  const closeTag = '{{/if}}'
  const anyOpen = '{{#if '
  let depth = 1
  let i = startPos + openTag.length
  while (i < html.length) {
    if (html.slice(i, i + anyOpen.length) === anyOpen) {
      depth++
      i += anyOpen.length
      continue
    }
    if (html.slice(i, i + closeTag.length) === closeTag) {
      depth--
      if (depth === 0) {
        return { content: html.slice(startPos + openTag.length, i), end: i + closeTag.length }
      }
      i += closeTag.length
      continue
    }
    i++
  }
  return null
}

/**
 * For every preview_interactive toggle field, replace all
 *   {{#if KEY=ja}}…{{/if}}   and   {{#if KEY=nein}}…{{/if}}
 * with wrapper divs that carry a data-fs-section attribute.
 * The section content is ALWAYS rendered — visibility is set via inline style.
 * This allows postMessage-based in-place show/hide without a full iframe reload.
 */
function wrapToggleSections(
  html: string,
  fields: PlaceholderField[],
  dataMap: Record<string, string>,
): string {
  const toggleFields = fields.filter(f => f.preview_interactive && isToggleField(f))
  let result = html

  for (const field of toggleFields) {
    const key = field.key
    const isVisible = (dataMap[key] ?? 'ja') === 'ja'

    for (const variant of ['ja', 'nein'] as const) {
      const openTag = `{{#if ${key}=${variant}}}`
      const sectionId = variant === 'ja' ? key : `${key}-nein`
      const hidden = (variant === 'ja') !== isVisible   // hide if variant doesn't match current value

      let pos = 0
      while (true) {
        const idx = result.indexOf(openTag, pos)
        if (idx === -1) break
        const block = extractIfBlock(result, idx, openTag)
        if (!block) { pos = idx + openTag.length; continue }
        const styleAttr = hidden ? ' style="display:none"' : ''
        const replacement = `<div data-fs-section="${sectionId}"${styleAttr}>${block.content}</div>`
        result = result.slice(0, idx) + replacement + result.slice(block.end)
        pos = idx + replacement.length
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Rate limiter: max 60 requests per IP per minute
// ---------------------------------------------------------------------------
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ---------------------------------------------------------------------------
// Preview-mode security injection
// ---------------------------------------------------------------------------
// Note: <base> element is injected separately into <head> (see below)
// to fix JS-initiated asset loading (GSAP frame sequences, fetch(), etc.)
//
// Section toggles work with two conventions:
//   1. Native [data-section="KEY"] attributes — used by most templates
//   2. Wrapped [data-fs-section="KEY"] divs — generated by wrapToggleSections()
//      for templates that use {{#if KEY=ja}}…{{/if}} blocks
// The postMessage handler checks both selectors so both conventions work.

const PREVIEW_GUARD = `
<style>.fs-preview-block{position:relative;pointer-events:none}</style>
<script>
(function(){
  /* ── Security ─────────────────────────────── */
  document.addEventListener('submit',function(e){
    e.preventDefault();e.stopImmediatePropagation();return false;
  },true);
  document.addEventListener('click',function(e){
    var el=e.target;
    while(el&&el.tagName!=='A')el=el.parentElement;
    if(!el)return;
    var href=el.getAttribute('href')||'';
    if(href===''||href.startsWith('javascript'))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(href.startsWith('#')){
      var t=document.getElementById(href.slice(1))||document.querySelector('[name="'+href.slice(1)+'"]');
      if(t)t.scrollIntoView({behavior:'smooth'});
    }
  },true);

  /* ── Helpers ─────────────────────────────── */
  function findSection(key){
    return document.querySelector('[data-section="'+key+'"]')
        || document.querySelector('[data-fs-section="'+key+'"]');
  }
  function findSectionNein(key){
    return document.querySelector('[data-section="'+key+'-nein"]')
        || document.querySelector('[data-fs-section="'+key+'-nein"]');
  }

  /**
   * Scroll to elem using an instant jump so GSAP ScrollTrigger cannot
   * intercept or fight against the scroll animation.
   * We kill any active GSAP scroll tweens before jumping.
   */
  function jumpToElem(elem){
    if(!elem)return;
    var rect=elem.getBoundingClientRect();
    /* already well-centered in the viewport → skip */
    if(rect.top>60&&rect.top<window.innerHeight*0.55)return;
    var targetY=Math.max(0,rect.top+window.pageYOffset-80);
    /* stop any GSAP scroll tweens so they don't fight us */
    if(window.gsap){try{window.gsap.killTweensOf(window);}catch(e){}}
    /* instant jump — no smooth animation, avoids ScrollTrigger interference */
    window.scrollTo(0,targetY);
  }

  /**
   * Show a fixed-position highlight ring + label over the section.
   * Uses position:fixed so it is not clipped by overflow:hidden parents
   * and is not affected by GSAP transforms.
   * @param {Element} elem  - section element
   * @param {boolean} show  - true = green "eingeblendet", false = red "ausgeblendet"
   */
  function showHighlight(elem,show){
    if(!elem)return;
    /* remove any lingering highlights */
    document.querySelectorAll('[data-fs-hl]').forEach(function(el){el.remove();});

    var rect=elem.getBoundingClientRect();
    /* don't show if element has no size (hidden or off-DOM) */
    if(rect.width<10||rect.height<10)return;

    var rgb=show?'34,197,94':'239,68,68';
    var label=show?'Sektion eingeblendet ✓':'Sektion ausgeblendet ✕';

    var hl=document.createElement('div');
    hl.setAttribute('data-fs-hl','');
    hl.style.cssText=[
      'position:fixed',
      'top:'+(rect.top-4)+'px',
      'left:'+(rect.left-4)+'px',
      'width:'+(rect.width+8)+'px',
      'height:'+(rect.height+8)+'px',
      'border:3px solid rgba('+rgb+',0.85)',
      'border-radius:3px',
      'background:rgba('+rgb+',0.06)',
      'pointer-events:none',
      'z-index:2147483647',
      'box-shadow:0 0 0 1px rgba('+rgb+',0.25),0 0 24px rgba('+rgb+',0.18)',
      'transition:opacity 0.5s ease',
    ].join(';');

    var badge=document.createElement('div');
    badge.style.cssText=[
      'position:absolute',
      'top:14px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba('+rgb+',0.95)',
      'color:#fff',
      'font:600 12px/1 -apple-system,BlinkMacSystemFont,sans-serif',
      'padding:5px 16px',
      'border-radius:20px',
      'white-space:nowrap',
      'box-shadow:0 2px 10px rgba(0,0,0,0.28)',
      'letter-spacing:0.01em',
    ].join(';');
    badge.textContent=label;
    hl.appendChild(badge);
    document.body.appendChild(hl);

    /* fade out after 2 s */
    setTimeout(function(){
      hl.style.opacity='0';
      setTimeout(function(){hl.remove();},500);
    },2000);
  }

  /* ── In-place section toggle (postMessage from parent) ── */
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='fs-toggle')return;
    var key=e.data.key;
    var show=e.data.value==='ja';
    var jaEl=findSection(key);
    var neinEl=findSectionNein(key);
    var toShow=show?jaEl:neinEl;
    var toHide=show?neinEl:jaEl;

    if(toShow){
      /* 1. Make it visible but transparent so we can measure its position */
      toShow.style.visibility='hidden';
      toShow.style.opacity='0';
      toShow.style.display='';
      void toShow.offsetHeight;          /* force reflow */

      /* 2. Instant jump to the section */
      jumpToElem(toShow);

      /* 3. After a single frame (scroll + paint settled), show highlight + fade in */
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          toShow.style.visibility='';
          showHighlight(toShow,true);
          toShow.style.transition='opacity 0.55s ease';
          toShow.style.opacity='1';
          setTimeout(function(){
            toShow.style.transition='';
            toShow.style.opacity='';
          },600);
        });
      });

      /* hide the other side immediately, no scroll */
      if(toHide){
        toHide.style.transition='opacity 0.3s ease';
        toHide.style.opacity='0';
        setTimeout(function(){
          toHide.style.display='none';
          toHide.style.opacity='';
          toHide.style.transition='';
        },320);
      }
    } else if(toHide){
      /* Only hiding — scroll to section, show red highlight, then fade out */
      jumpToElem(toHide);
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          showHighlight(toHide,false);
          toHide.style.transition='opacity 0.45s ease';
          toHide.style.opacity='0';
          setTimeout(function(){
            toHide.style.display='none';
            toHide.style.opacity='';
            toHide.style.transition='';
          },500);
        });
      });
    }
  });
})();
</script>`

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: and(
      eq(templates.id, id),
      eq(templates.status, 'published'),
      eq(templates.isTest, false)
    ),
  })

  if (!template?.r2BundlePath) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;color:#94a3b8;flex-direction:column;gap:12px}
svg{opacity:0.4}p{font-size:14px;font-weight:500}</style></head>
<body><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
<p>No preview available</p></body></html>`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }

  let html: string
  try {
    html = await getFromR2(template.r2BundlePath)
  } catch {
    return new NextResponse('Template file not found.', { status: 500 })
  }

  // ---------------------------------------------------------------------------
  // Inject <base> so ALL relative URLs (including JS fetch/Image/XHR) resolve
  // through the asset proxy — critical for GSAP frame sequences, video, etc.
  // ---------------------------------------------------------------------------
  const assetOrigin = `/api/templates/${id}/public-preview/asset/`
  const baseTag = `<base href="${assetOrigin}">`
  html = html.includes('<head>')
    ? html.replace('<head>', `<head>\n${baseTag}`)
    : html.replace(/<html[^>]*>/i, m => `${m}\n${baseTag}`)

  // ---------------------------------------------------------------------------
  // Build preview data map
  // Priority: field.preview_value > preview_values[key] > field.default_value
  // ---------------------------------------------------------------------------
  const schema = (template.placeholderSchema ?? {}) as PlaceholderSchema
  const fields = schema.fields ?? []
  const legacyPreviewValues: Record<string, string> = schema.preview_values ?? {}

  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] =
      f.preview_value !== undefined && f.preview_value !== ''
        ? f.preview_value
        : (legacyPreviewValues[f.key] ?? f.default_value ?? '')
  }

  // ---------------------------------------------------------------------------
  // Allow ?data=base64url overrides ONLY for preview_interactive fields
  // ---------------------------------------------------------------------------
  const interactiveKeys = new Set(
    fields.filter(f => f.preview_interactive).map(f => f.key)
  )

  const dataParam = req.nextUrl.searchParams.get('data')
  if (dataParam) {
    try {
      const overrides = JSON.parse(
        Buffer.from(dataParam, 'base64url').toString('utf8')
      ) as Record<string, string>
      for (const [key, value] of Object.entries(overrides)) {
        if (interactiveKeys.has(key) && typeof value === 'string') {
          dataMap[key] = value
        }
      }
    } catch { /* ignore malformed param */ }
  }

  // ---------------------------------------------------------------------------
  // Wrap preview_interactive toggle sections with data-fs-section divs.
  // For templates using {{#if KEY=ja/nein}} blocks this replaces them with
  // always-rendered wrapper divs (initially visible or hidden).
  // Templates that already use native [data-section] attributes skip this step
  // silently (no {{#if}} blocks found → no replacements made).
  // ---------------------------------------------------------------------------
  html = wrapToggleSections(html, fields, dataMap)

  // ---------------------------------------------------------------------------
  // Initial visibility: inject CSS to hide [data-section] / [data-fs-section]
  // elements whose current toggle value is 'nein'.
  // This handles native-attribute templates (e.g. FitLine) where the section
  // is always present in the DOM and visibility is controlled via CSS/JS only.
  // ---------------------------------------------------------------------------
  const toggleFields = fields.filter(f => f.preview_interactive && isToggleField(f))
  const hiddenSectionRules = toggleFields
    .filter(f => (dataMap[f.key] ?? 'ja') === 'nein')
    .flatMap(f => [
      `[data-section="${f.key}"]{display:none!important}`,
      `[data-fs-section="${f.key}"]{display:none!important}`,
    ])
  const shownNeinRules = toggleFields
    .filter(f => (dataMap[f.key] ?? 'ja') !== 'nein')
    .flatMap(f => [
      `[data-section="${f.key}-nein"]{display:none!important}`,
      `[data-fs-section="${f.key}-nein"]{display:none!important}`,
    ])
  const allInitRules = [...hiddenSectionRules, ...shownNeinRules]
  if (allInitRules.length > 0) {
    const initStyle = `<style data-fs-init>${allInitRules.join('')}</style>`
    html = html.includes('</head>')
      ? html.replace('</head>', `${initStyle}\n</head>`)
      : html.replace(/<body/i, `${initStyle}\n<body`)
  }

  // ---------------------------------------------------------------------------
  // Rewrite relative asset paths → public-preview asset proxy
  // ---------------------------------------------------------------------------
  const assetBase = `/api/templates/${id}/public-preview/asset`

  // <link href="..."> (CSS)
  html = html.replace(
    /(<link[^>]+href=")(?!https?:\/\/|\/\/|data:|#)([^"]+)(")/gi,
    (_m, pre, href, post) => `${pre}${assetBase}/${href}${post}`
  )
  // <script src="...">
  html = html.replace(
    /(<script[^>]+src=")(?!https?:\/\/|\/\/|data:)([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${assetBase}/${src}${post}`
  )
  // <img src="...">, <source src="...">, <video src="...">, <audio src="...">
  html = html.replace(
    /(<(?:img|source|video|audio)[^>]+src=")(?!https?:\/\/|\/\/|data:|#)([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${assetBase}/${src}${post}`
  )
  // srcset="..."
  html = html.replace(
    /( srcset=")([^"]+)(")/gi,
    (_m, pre, srcset, post) => {
      const rewritten = srcset.replace(
        /(^|,\s*)(?!https?:\/\/|\/\/|data:)(\S+)/g,
        (_s: string, sep: string, url: string) => {
          const [path, size] = url.split(/\s+/)
          return `${sep}${assetBase}/${path}${size ? ' ' + size : ''}`
        }
      )
      return `${pre}${rewritten}${post}`
    }
  )
  // CSS url() in inline styles and <style> blocks
  html = html.replace(
    /url\(['"]?(?!https?:\/\/|\/\/|data:|#)([^'")]+)['"]?\)/gi,
    (_m: string, path: string) => `url('${assetBase}/${path}')`
  )

  // ---------------------------------------------------------------------------
  // Render template + inject preview security guard
  // ---------------------------------------------------------------------------
  let rendered = renderTemplate(html, dataMap)

  // Inject security guard before </body>
  rendered = rendered.includes('</body>')
    ? rendered.replace('</body>', `${PREVIEW_GUARD}\n</body>`)
    : rendered + PREVIEW_GUARD

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
