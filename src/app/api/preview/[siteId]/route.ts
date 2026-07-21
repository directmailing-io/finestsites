import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, siteData } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

// GET /api/preview/[siteId]?data=base64json  → renders template HTML for iframe
// The ?data param overrides stored data for live-preview while user is typing
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { siteId } = await params

  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, siteId), eq(userSites.userId, user.id)),
    with: { template: true },
  })

  if (!site) return new NextResponse('Not found', { status: 404 })
  if (!site.template?.r2BundlePath) {
    return new NextResponse(noFilePage(site.template?.title ?? 'Template'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Build a 3-layer fallback chain so the preview NEVER shows empty/broken
  // placeholders, even on first edit:
  //   1. Live query string (?data=…) — what the user typed just now
  //   2. Saved DB values (site_data table) — what was previously saved
  //   3. Schema default_value — defined per field by the template author
  let dataMap: Record<string, string> = {}

  // Layer 3: schema defaults (lowest priority — applied first so later layers override)
  interface SchemaField { key: string; type?: string; default_value?: string }
  interface PlaceholderSchema { fields?: SchemaField[] }
  const schema = site.template?.placeholderSchema as PlaceholderSchema | null
  const schemaDefaults: Record<string, string> = {}
  const imageFieldKeys = new Set<string>()
  for (const f of schema?.fields ?? []) {
    if (f.default_value) schemaDefaults[f.key] = f.default_value
    if (f.type === 'image') imageFieldKeys.add(f.key)
  }
  dataMap = { ...schemaDefaults }

  // Layer 2: DB-saved site_data (overrides defaults)
  const rows = await db.query.siteData.findMany({
    where: eq(siteData.userSiteId, siteId),
  })
  for (const row of rows) {
    const v = row.fieldValue ?? ''
    // For image fields: keep the default when DB value is empty string
    // (user hasn't set an image yet → fall back to placeholder).
    if (v === '' && imageFieldKeys.has(row.fieldKey) && schemaDefaults[row.fieldKey]) {
      continue
    }
    dataMap[row.fieldKey] = v
  }

  // Layer 1: live edit data from query string (highest priority)
  const rawData = req.nextUrl.searchParams.get('data')
  if (rawData) {
    try {
      const liveData: Record<string, string> = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'))
      for (const [k, v] of Object.entries(liveData)) {
        // Same image-fallback logic
        if (v === '' && imageFieldKeys.has(k) && schemaDefaults[k]) continue
        dataMap[k] = v
      }
    } catch {
      // fall back to DB layer
    }
  }

  let html: string
  try {
    html = await getFromR2(site.template.r2BundlePath)
  } catch {
    return new NextResponse('Template-Datei nicht gefunden.', { status: 500 })
  }

  // 1. Annotate the raw template for LIVE binding before substituting.
  //    - Text placeholders {{key}} get wrapped in HTML comments so the runtime
  //      can find them and update the text without reloading the iframe.
  //    - Tag attributes that contain placeholders get a data-fs-bind attribute
  //      so the runtime can recompute attribute values from the original
  //      template when a key changes.
  const annotated = annotateLiveBindings(html)

  // 2. Substitute placeholders. The markers we just inserted are preserved
  //    (comments stay as comments, data-fs-bind stays).
  let rendered = renderTemplate(annotated, dataMap)

  // 2. Rewrite relative asset URLs so the preview iframe can load them via
  //    /api/preview/[siteId]/asset/[path] (same-origin, authenticated).
  //    Skips:
  //      - absolute URLs (http://, https://, //, data:, blob:)
  //      - in-page anchors (#)
  //      - URLs starting with "/" (already absolute on this origin — e.g. our /api/media uploads)
  const assetBase = `/api/preview/${siteId}/asset`

  // 2a. Inject a tiny runtime patch at the start of <head> so that ANY relative
  //     URL constructed by JavaScript at runtime (e.g. new Image().src = 'assets/x.webp',
  //     new Audio('audio/x.mp3'), fetch('data/x.json'), <video src>, etc.) is
  //     auto-rewritten to go through the preview asset endpoint.
  //     This is critical for templates that use scroll-driven canvas animations
  //     (GSAP frame sequences), lazy-loaded audio, etc.
  // Inject initial values so live attribute-template recomputation has the
  // current state for keys it didn't receive yet (e.g. when "vorname" updates
  // and an attribute template depends on both vorname + nachname).
  const initialValuesJson = JSON.stringify(dataMap).replace(/</g, '\\u003c')
  const runtimePatch = `<script data-preview-runtime-patch>(function(){
  window.__fsValues = ${initialValuesJson};
  // Live conditional show/hide based on key truthiness.
  // Toggles display of every element between <!--fs-cond:key--> and <!--/fs-cond:key-->
  // (or inverse for fs-uncond:). Called on initial load and on every updateField.
  function isTruthy(v){
    if (v === undefined || v === null) return false;
    var s = String(v).trim();
    return s !== '' && s !== 'false' && s !== '0';
  }
  function toggleRange(startTag, endTag, key, visible){
    try {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);
      var node;
      var openTag = startTag + ':' + key;
      var closeTag = endTag + ':' + key;
      while ((node = walker.nextNode())) {
        if ((node.nodeValue || '').trim() !== openTag) continue;
        var sib = node.nextSibling;
        while (sib && !(sib.nodeType === 8 && (sib.nodeValue || '').trim() === closeTag)) {
          if (sib.nodeType === 1) {
            // Element — track original display so we can restore it on show.
            if (!visible) {
              if (!sib.hasAttribute('data-fs-orig-display')) {
                sib.setAttribute('data-fs-orig-display', sib.style.display || '');
              }
              sib.style.display = 'none';
            } else {
              if (sib.hasAttribute('data-fs-orig-display')) {
                sib.style.display = sib.getAttribute('data-fs-orig-display');
                sib.removeAttribute('data-fs-orig-display');
              } else {
                sib.style.display = '';
              }
            }
          }
          sib = sib.nextSibling;
        }
      }
    } catch(e){}
  }
  function applyConditional(key){
    var v = isTruthy(window.__fsValues[key]);
    toggleRange('fs-cond',   '/fs-cond',   key,  v); // {{#if key}}…{{/if}}
    toggleRange('fs-uncond', '/fs-uncond', key, !v); // {{#unless key}}…{{/unless}}
  }
  function applyAllConditionals(){
    Object.keys(window.__fsValues).forEach(applyConditional);
  }
  window.__fsApplyConditional = applyConditional;
  window.__fsApplyAllConditionals = applyAllConditionals;
  // Apply on initial load
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyAllConditionals);
  } else {
    setTimeout(applyAllConditionals, 0);
  }
  var BASE='${assetBase}/';
  function isAbs(u){return !u||/^(https?:)?\\/\\//.test(u)||u.indexOf('data:')===0||u.indexOf('blob:')===0||u.indexOf('#')===0||u.charAt(0)==='/';}
  function fix(u){return isAbs(u)?u:BASE+String(u).replace(/^\\.?\\//,'');}
  function fixSrcset(v){
    if(!v)return v;
    return String(v).split(',').map(function(part){
      var t=part.trim();var sp=t.search(/\\s/);
      if(sp===-1)return fix(t);
      return fix(t.slice(0,sp))+t.slice(sp);
    }).join(', ');
  }
  function patch(proto, prop, transform){
    try{
      var d=Object.getOwnPropertyDescriptor(proto,prop);
      if(!d||!d.set)return;
      Object.defineProperty(proto,prop,{
        configurable:true,enumerable:d.enumerable,
        get:function(){return d.get.call(this);},
        set:function(v){d.set.call(this,transform(v));}
      });
    }catch(e){}
  }
  // Image/source/video/audio src
  patch(HTMLImageElement.prototype,'src',fix);
  patch(HTMLImageElement.prototype,'srcset',fixSrcset);
  if(typeof HTMLSourceElement!=='undefined'){
    patch(HTMLSourceElement.prototype,'src',fix);
    patch(HTMLSourceElement.prototype,'srcset',fixSrcset);
  }
  if(typeof HTMLMediaElement!=='undefined'){
    patch(HTMLMediaElement.prototype,'src',fix);
  }
  // Constructor args: new Image('rel/x.jpg'), new Audio('rel/x.mp3')
  var OrigImage=window.Image;
  if(OrigImage){
    window.Image=function(w,h){
      var img=arguments.length>=2?new OrigImage(w,h):new OrigImage();
      return img;
    };
    window.Image.prototype=OrigImage.prototype;
  }
  var OrigAudio=window.Audio;
  if(OrigAudio){
    window.Audio=function(src){
      var a=src?new OrigAudio(fix(src)):new OrigAudio();
      return a;
    };
    window.Audio.prototype=OrigAudio.prototype;
  }
  // fetch() for relative URLs
  var origFetch=window.fetch;
  if(origFetch){
    window.fetch=function(input,init){
      if(typeof input==='string')input=fix(input);
      else if(input&&typeof input==='object'&&'url'in input&&!isAbs(input.url))input=new Request(fix(input.url),input);
      return origFetch.call(this,input,init);
    };
  }
  // ── Cross-frame scroll messaging ──────────────────────────────────────
  // The editor can post {type:'finestsites:scroll', section:'<key>', mode:'on'|'off'}
  // to request scrolling to (or just-before) a toggleable section.
  function getStickyOffset(){
    // Pick the tallest top-anchored fixed/sticky element (typically the nav)
    var max = 0;
    var nodes = document.querySelectorAll('header, nav, [class*="nav"], [class*="header"], [data-sticky-top]');
    for (var i = 0; i < nodes.length; i++){
      var el = nodes[i];
      var cs = getComputedStyle(el);
      if((cs.position === 'fixed' || cs.position === 'sticky') && (parseFloat(cs.top) || 0) <= 4){
        var r = el.getBoundingClientRect();
        if(r.height > max && r.top <= 4) max = r.height;
      }
    }
    return max || 80;
  }

  // Force GSAP ScrollTrigger to recalculate all pin positions.
  // Necessary because newly-shown/hidden sections shift the document height,
  // and ScrollTrigger caches the old positions.
  function refreshScrollTrigger(){
    try {
      var ST = window.ScrollTrigger;
      if (ST && typeof ST.refresh === 'function') ST.refresh(true);
    } catch (e) {}
  }

  // ── Live section toggle (no iframe reload) ───────────────────────────
  function animateSectionOut(el){
    var h = el.offsetHeight;
    el.style.overflow = 'hidden';
    el.style.maxHeight = h + 'px';
    void el.offsetHeight;
    el.style.transition = 'max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease-out, margin 0.45s ease, padding 0.45s ease';
    el.style.maxHeight = '0px';
    el.style.opacity = '0';
    el.style.marginTop = '0';
    el.style.marginBottom = '0';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
    setTimeout(function(){
      el.setAttribute('data-fs-hidden', '1');
      el.style.display = 'none';
      refreshScrollTrigger();
    }, 480);
  }
  function animateSectionIn(el){
    el.removeAttribute('data-fs-hidden');
    el.style.display = '';
    // Clear inline overrides to read natural height
    el.style.maxHeight = '';
    el.style.opacity = '';
    el.style.marginTop = '';
    el.style.marginBottom = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.transition = '';
    var naturalH = el.scrollHeight;
    // Start collapsed
    el.style.overflow = 'hidden';
    el.style.maxHeight = '0px';
    el.style.opacity = '0';
    el.style.marginTop = '0';
    el.style.marginBottom = '0';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
    void el.offsetHeight;
    // Animate to natural
    el.style.transition = 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease 0.05s, margin 0.5s ease, padding 0.5s ease';
    el.style.maxHeight = naturalH + 'px';
    el.style.opacity = '1';
    el.style.marginTop = '';
    el.style.marginBottom = '';
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    setTimeout(function(){
      // Cleanup inline styles
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.style.opacity = '';
      refreshScrollTrigger();
    }, 560);
  }

  function targetTop(el){
    var rect = el.getBoundingClientRect();
    var navH = getStickyOffset();
    var t = rect.top + window.scrollY - navH - 20;
    return Math.max(0, t);
  }

  window.addEventListener('message', function(ev){
    var d = ev && ev.data;
    if (!d) return;
    // ── Live section toggle ────────────────────────────────────────────
    if (d.type === 'finestsites:toggleSection' && d.section) {
      var sec = document.querySelector('[data-section="'+d.section+'"]');
      if (!sec) return;
      if (d.mode === 'off') {
        // Scroll the section into view (if not visible), then animate out.
        var r = sec.getBoundingClientRect();
        var navH = getStickyOffset();
        var inView = r.top > navH && r.top < window.innerHeight - 80;
        function doOut(){ animateSectionOut(sec); }
        if (!inView) {
          var ty = r.top + window.scrollY - navH - 20;
          window.scrollTo({ top: Math.max(0, ty), behavior: 'smooth' });
          setTimeout(doOut, 500);
        } else {
          doOut();
        }
      } else if (d.mode === 'on') {
        animateSectionIn(sec);
        // Smooth-scroll to it after a brief moment so the user sees it land
        setTimeout(function(){
          var r2 = sec.getBoundingClientRect();
          var navH2 = getStickyOffset();
          var ty2 = r2.top + window.scrollY - navH2 - 20;
          window.scrollTo({ top: Math.max(0, ty2), behavior: 'smooth' });
        }, 80);
      }
      return;
    }
    // ── Restore scroll position after reload ───────────────────────────
    if (d.type === 'finestsites:restoreScroll' && typeof d.y === 'number') {
      // Wait a tick so layout is ready, then jump (no smooth) to position.
      setTimeout(function(){
        window.scrollTo(0, d.y);
      }, 50);
      return;
    }
    // ── Live field update (no iframe reload) ───────────────────────────
    if (d.type === 'finestsites:updateField' && d.key !== undefined) {
      var key = String(d.key);
      var value = d.value == null ? '' : String(d.value);
      window.__fsValues = window.__fsValues || {};
      window.__fsValues[key] = value;

      // 1) Update text content between <!--fs:key--> ... <!--/fs:key-->
      //    The substituted value can be plain text OR rich HTML; we use
      //    innerHTML semantics so both work.
      var hits = 0;
      try {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);
        var open = 'fs:' + key;
        var close = '/fs:' + key;
        var startNode;
        var collected = [];
        while ((startNode = walker.nextNode())) {
          var v = (startNode.nodeValue || '').trim();
          if (v === open) collected.push(startNode);
        }
        for (var ci = 0; ci < collected.length; ci++){
          var startC = collected[ci];
          var endC = null;
          var cur = startC.nextSibling;
          var toRemove = [];
          while (cur) {
            if (cur.nodeType === 8 && (cur.nodeValue || '').trim() === close) { endC = cur; break; }
            toRemove.push(cur);
            cur = cur.nextSibling;
          }
          if (!endC) continue;
          var parent = startC.parentNode;
          toRemove.forEach(function(n){ parent.removeChild(n); });
          // Insert new value as HTML so rich-text fields render correctly.
          var holder = document.createElement('div');
          holder.innerHTML = value;
          while (holder.firstChild) parent.insertBefore(holder.firstChild, endC);
          hits++;
        }
      } catch(e){}

      // 2) Update attribute templates on tags with data-fs-bind
      try {
        var bound = document.querySelectorAll('[data-fs-bind]');
        bound.forEach(function(el){
          var raw = el.getAttribute('data-fs-bind');
          if (!raw) return;
          var bindings;
          try { bindings = JSON.parse(raw.replace(/&#39;/g, "'")); } catch(e){ return; }
          if (!Array.isArray(bindings)) return;
          for (var b = 0; b < bindings.length; b++) {
            var binding = bindings[b];
            if (!binding || !binding.t || binding.t.indexOf('{{' + key + '}}') === -1) continue;
            // Recompute attribute value
            var newVal = binding.t.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, function(_, k){
              return window.__fsValues[k] != null ? window.__fsValues[k] : '';
            });
            el.setAttribute(binding.a, newVal);
            hits++;
          }
        });
      } catch(e){}

      // 3) Toggle conditional visibility for {{#if key}} / {{#unless key}} blocks
      try {
        if (typeof window.__fsApplyConditional === 'function') {
          window.__fsApplyConditional(key);
          hits++; // even if no text/attr markers matched, the conditional did
        }
      } catch(e){}

      // 4) Send ACK so the editor knows live update worked.
      try {
        window.parent.postMessage({
          type: 'finestsites:updateFieldAck',
          key: key,
          handled: hits > 0,
        }, '*');
      } catch(e){}
      return;
    }
    if (d.type !== 'finestsites:scroll' || !d.section) return;

    function highlight(el){
      try {
        el.style.transition = 'box-shadow 1.2s ease';
        el.style.boxShadow = 'inset 0 0 0 9999px rgba(255, 226, 89, 0.14)';
        setTimeout(function(){ el.style.boxShadow = ''; }, 1400);
      } catch(e){}
    }

    function findTarget(){
      var el = document.querySelector('[data-section="'+d.section+'"]');
      if (!el && d.mode === 'off'){
        el = document.querySelector('section[data-section]') || null;
      }
      return el;
    }

    // Wait until window.scrollY stops changing for 3 consecutive 100ms ticks,
    // OR we time out at 2.5s. Resolves with the current scrollY.
    function waitForScrollSettle(cb){
      var lastY = -1, sameCount = 0, start = Date.now();
      var t = setInterval(function(){
        var y = window.scrollY || window.pageYOffset || 0;
        if (Math.abs(y - lastY) < 0.5) sameCount++; else sameCount = 0;
        lastY = y;
        if (sameCount >= 3 || Date.now() - start > 2500){
          clearInterval(t);
          cb(y);
        }
      }, 100);
    }

    function settledScroll(retriesLeft){
      var el = findTarget();
      if (!el){
        if (retriesLeft > 0) setTimeout(function(){ settledScroll(retriesLeft - 1); }, 250);
        return;
      }
      // Recalculate GSAP pin distances against the (now resized) document
      refreshScrollTrigger();
      // Two frames so layout settles
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          var ty = targetTop(el);
          // First attempt: instant jump to neighbourhood (avoids smooth-scroll
          // racing with GSAP-induced layout shifts), THEN smooth correction.
          var attemptNo = 6 - retriesLeft;
          if (attemptNo === 0){
            window.scrollTo({ top: ty, behavior: 'smooth' });
          } else {
            // Subsequent retries: instant — the page should be stable enough now.
            window.scrollTo(0, ty);
          }
          waitForScrollSettle(function(){
            // Verify final position. GSAP may have shifted the element during
            // the scroll. If off by > 60px, retry (max 6 times total).
            var rect = el.getBoundingClientRect();
            var navH = getStickyOffset();
            var off = rect.top - navH - 20;
            if (Math.abs(off) > 60 && retriesLeft > 0){
              settledScroll(retriesLeft - 1);
              return;
            }
            if (d.mode !== 'off') highlight(el);
          });
        });
      });
    }

    function start(){
      // Give iframe a moment for fonts, images, GSAP to fully init.
      setTimeout(function(){ settledScroll(6); }, 400);
    }
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  });
})();</script>`
  rendered = rendered.replace(/<head([^>]*)>/i, (match) => `${match}${runtimePatch}`)
  const isAbsolute = (u: string) =>
    /^(https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#') || u.startsWith('/')
  const toAbs = (u: string) => isAbsolute(u) ? u : `${assetBase}/${u.replace(/^\.?\//, '')}`

  // <link href="...">  (stylesheets, preloads, favicons, etc.)
  rendered = rendered.replace(
    /(<link[^>]+href=")([^"]+)(")/gi,
    (_m, pre, href, post) => `${pre}${toAbs(href)}${post}`
  )
  // <script src="...">
  rendered = rendered.replace(
    /(<script[^>]+src=")([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${toAbs(src)}${post}`
  )
  // <img src="...">
  rendered = rendered.replace(
    /(<img[^>]+src=")([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${toAbs(src)}${post}`
  )
  // <source src="..."> (audio/video sources)
  rendered = rendered.replace(
    /(<source[^>]+src=")([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${toAbs(src)}${post}`
  )
  // <video poster="...">
  rendered = rendered.replace(
    /(<video[^>]+poster=")([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${toAbs(src)}${post}`
  )
  // srcset="url1 1x, url2 2x" — multiple URLs comma-separated
  rendered = rendered.replace(
    /(<(?:img|source)[^>]+srcset=")([^"]+)(")/gi,
    (_m, pre, srcset, post) => {
      const fixed = srcset.split(',').map((part: string) => {
        const trimmed = part.trim()
        const sp = trimmed.search(/\s/)
        if (sp === -1) return toAbs(trimmed)
        const url = trimmed.slice(0, sp)
        const descriptor = trimmed.slice(sp)
        return `${toAbs(url)}${descriptor}`
      }).join(', ')
      return `${pre}${fixed}${post}`
    }
  )
  // CSS url(...) in inline <style> blocks and style="" attributes
  // Match: url("..."), url('...'), url(...)
  const cssUrlReplace = (css: string) => css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (_m, quote, url) => `url(${quote}${toAbs(url)}${quote})`
  )
  rendered = rendered.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, body, close) => `${open}${cssUrlReplace(body)}${close}`
  )
  rendered = rendered.replace(/(style=")([^"]*)(")/gi,
    (_m, pre, body, post) => `${pre}${cssUrlReplace(body)}${post}`
  )

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'no-store',
    },
  })
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
function annotateLiveBindings(html: string): string {
  // ── Phase 0: convert truthy {{#if key}}…{{/if}} into HTML-comment ranges ──
  // (Equality form {{#if key=value}} is kept for the template engine — it's used
  // by section toggles which the editor already manages with smooth animations.)
  // The truthy form is converted so the wrapped content is ALWAYS rendered.
  // At runtime, we toggle the inner elements' display based on the key value,
  // which removes the need for an iframe reload when an optional field appears.
  let prev: string | null = null
  while (prev !== html) {
    prev = html
    html = html.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match: string, key: string, content: string) => {
        // Skip conditionals that wrap <style> blocks. These control CSS rules
        // (background colour, background image, theme effects) that must only
        // be emitted when the condition is TRUE. If we convert them to
        // always-render comment ranges the template engine replaces {{key}}
        // with an empty string, producing invalid CSS like
        //   background: url('') center/cover no-repeat fixed !important
        // which (because of !important) overrides any colour the user picked.
        // Since colour/image fields are "structural" and always trigger a full
        // iframe reload, the template engine re-evaluates them on every render
        // anyway — live-range toggling adds no benefit here.
        if (/<style\b/i.test(content)) return _match
        return `<!--fs-cond:${key}-->${content}<!--/fs-cond:${key}-->`
      }
    )
  }
  // Same for {{#unless key}}…{{/unless}} (inverse — wrap with fs-uncond:)
  prev = null
  while (prev !== html) {
    prev = html
    html = html.replace(
      /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (_match: string, key: string, content: string) => {
        if (/<style\b/i.test(content)) return _match
        return `<!--fs-uncond:${key}-->${content}<!--/fs-uncond:${key}-->`
      }
    )
  }

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

function noFilePage(title: string) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#6b7280;}
.box{text-align:center;padding:2rem;}h2{font-size:1rem;font-weight:600;color:#374151;margin-bottom:.5rem;}</style></head>
<body><div class="box"><h2>${title}</h2><p>Noch keine HTML-Datei hochgeladen.</p></div></body></html>`
}
