/**
 * Werbung & Tracking (Meta / Google Ads / TikTok) auf Kundenseiten.
 * Konzept: docs/werbung-tracking-konzept.html
 *
 *  - injectTracking(): hängt beim Ausliefern einen Script-Block an (nur wenn der Besitzer
 *    Tracking eingerichtet hat). Der Block lädt Pixel erst nach Einwilligung, sichert Klick-IDs,
 *    meldet Kontakt-Klicks und gespeicherte Anfragen mit einer Ereignis-Nummer.
 *  - Einwilligung: derselbe localStorage-Schlüssel `fs_consent_v1` wie die Cookie-Banner in den
 *    Templates (Wellpreneur, Cellrestart). Hat das Template ein Banner, wird es benutzt; sonst
 *    bringt der Block ein eigenes, gleich aufgebautes Banner mit. Zusätzlich Cookie `fs_mkt`,
 *    damit der Worker die Einwilligung bei Formular und Beacon sieht.
 *  - sendServerEvent(): Conversions API (Meta) und Events API (TikTok) mit derselben
 *    Ereignis-Nummer wie im Browser → die Plattform zählt genau einmal.
 */
import type { PublicTrackingConfig } from '../../src/lib/tracking/types'
import {
  sendMetaEvent, sendTikTokEvent, normalizeEmail, normalizeName, normalizePhone, pickContactFields,
  type ServerEvent, type TrackingEventName,
} from '../../src/lib/tracking/platforms'
import { BOT_UA_RE, sha256Hex, type Env, type SiteMeta } from './index'

export type { PublicTrackingConfig }

// ─── Cookies ──────────────────────────────────────────────────────────────────

export function cookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Nutzer hat „Mein Gerät nicht mitzählen“ gewählt */
export const isNoTrack = (request: Request) => cookie(request, 'fs_notrack') === '1'
/** Einwilligung zu Marketing (vom Script als Cookie gespiegelt) */
export const hasMarketingConsent = (request: Request) => cookie(request, 'fs_mkt') === '1'

export function handleNoTrack(url: URL): Response {
  const off = url.searchParams.get('off') === '1'
  const body = off
    ? 'Dein Gerät wird auf dieser Seite wieder mitgezählt.'
    : 'Erledigt: Dein Gerät wird auf dieser Seite nicht mehr mitgezählt (kein Pixel, keine Übertragung). Gilt für diesen Browser, ein Jahr lang.'
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tracking</title><body style="font-family:-apple-system,system-ui,sans-serif;padding:40px 20px;max-width:520px;margin:auto;line-height:1.5"><p style="font-size:17px">${body}</p><p><a href="/" style="color:#111">Zur Seite</a></p>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': off
        ? 'fs_notrack=; Max-Age=0; Path=/; SameSite=Lax; Secure'
        : 'fs_notrack=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure',
    },
  })
}

// ─── Script-Block fürs HTML ───────────────────────────────────────────────────

const MARK = 'data-fs-tracking'

export function shouldInject(pathname: string, request: Request, meta: SiteMeta): boolean {
  if (!meta.tracking) return false
  if (pathname === '/impressum' || pathname === '/datenschutz') return false
  if (isNoTrack(request)) return false
  const ua = request.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA_RE.test(ua)) return false
  return true
}

export function injectTracking(html: string, meta: SiteMeta): string {
  if (!meta.tracking || html.includes(MARK)) return html
  const cfg = JSON.stringify(meta.tracking).replace(/</g, '\\u003c')
  const block = `<script ${MARK}>window.__fsTrackingConfig=${cfg};</script><script ${MARK}>${TRACKING_JS}</script>`
  return html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : html + block
}

/*
 * Browser-Teil. Bewusst altes JavaScript (kein let/const/Arrow), damit auch ältere Smartphones
 * der Zielgruppe mitkommen. Keine Backticks und kein "${" — der Code steckt in einem
 * TypeScript-Template-String.
 */
const TRACKING_JS = String.raw`(function(){
var C=window.__fsTrackingConfig||{};if(!C.meta&&!C.google&&!C.tiktok)return;
if(/(^|; )fs_notrack=1/.test(document.cookie))return;
var KEY='fs_consent_v1',loaded=false,EN=/^en/i.test(document.documentElement.lang||'');
function id(){var a='',h='0123456789abcdef';for(var i=0;i<24;i++)a+=h[Math.floor(Math.random()*16)];return 'fs-'+Date.now().toString(16)+'-'+a}
function cookieSet(n,v,days){document.cookie=n+'='+encodeURIComponent(v)+'; Max-Age='+(days*86400)+'; Path=/; SameSite=Lax; Secure'}
function cookieGet(n){var m=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return m?decodeURIComponent(m[1]):''}
function loadConsent(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
function beacon(d){try{var b=JSON.stringify(d);if(navigator.sendBeacon){navigator.sendBeacon('/.finestsites/t',new Blob([b],{type:'application/json'}))}else{fetch('/.finestsites/t',{method:'POST',body:b,keepalive:true,headers:{'Content-Type':'application/json'}})}}catch(e){}}
function q(n){var m=location.search.match('[?&]'+n+'=([^&]+)');return m?decodeURIComponent(m[1]):''}
/* Klick-IDs aus Anzeigen-Links sichern (nur nach Einwilligung) */
function keepClickIds(){var f=q('fbclid');if(f&&!cookieGet('_fbc'))cookieSet('_fbc','fb.1.'+Date.now()+'.'+f,90);var g=q('gclid');if(g)cookieSet('_fs_gclid',g,90);var t=q('ttclid');if(t)cookieSet('_fs_ttclid',t,90)}
function script(src){var s=document.createElement('script');s.async=true;s.src=src;document.head.appendChild(s)}
/* Google: Consent Mode v2 — Standard „abgelehnt“, wird nach Einwilligung auf „erteilt“ gesetzt */
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
if(C.google){gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})}
function loadPixels(){if(loaded)return;loaded=true;keepClickIds();
 if(C.meta){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',C.meta.pixelId);fbq('track','PageView')}
 if(C.google){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});script('https://www.googletagmanager.com/gtag/js?id='+C.google.adsId);gtag('js',new Date());gtag('config',C.google.adsId,{allow_enhanced_conversions:true})}
 if(C.tiktok){!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement('script');o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load(C.tiktok.pixelId);ttq.page()}(window,document,'ttq')}}
function consented(){var c=loadConsent();return !!(c&&c.marketing)}
function fire(name,eid,hashed){ /* Browser-Ereignis, nur mit Einwilligung; Server-Teil macht der Worker mit derselben Nummer */
 if(!consented())return;loadPixels();
 try{if(C.meta&&window.fbq)fbq('track',name,{},{eventID:eid})}catch(e){}
 try{if(C.google){var l=name==='Lead'?C.google.leadLabel:C.google.contactLabel;if(l){var p={send_to:C.google.adsId+'/'+l,transaction_id:eid};gtag('event','conversion',p)}}}catch(e){}
 try{if(C.tiktok&&window.ttq)ttq.track(name==='Lead'?'SubmitForm':'Contact',{},{event_id:eid})}catch(e){}}
/* Einwilligung anwenden + Cookie fürs Backend spiegeln + einmal in eigener Statistik zählen */
function apply(c){if(!c)return;var m=!!c.marketing;cookieSet('fs_mkt',m?'1':'0',180);
 var sentKey='fs_consent_sent',last='';try{last=localStorage.getItem(sentKey)||''}catch(e){}
 if(last!==c.ts){try{localStorage.setItem(sentKey,c.ts)}catch(e){}beacon({t:'consent',c:m?'yes':'no',u:location.href})}
 if(m)loadPixels()}
window.addEventListener('fs:consent',function(e){apply(e.detail)});
/* Eigenes Banner nur, wenn das Template keins hat (FitLine, Linkseite) */
function ownBanner(){if(document.getElementById('fs-ck-banner'))return;
 var css='#fs-tk-wrap{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;display:flex;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}#fs-tk{background:#fff;color:#111;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:16px 18px;max-width:560px;width:100%;font-size:15px;line-height:1.45}#fs-tk b{display:block;font-size:16px;margin-bottom:4px}#fs-tk p{margin:0 0 12px;color:#4B5563}#fs-tk a{color:#111}#fs-tk .r{display:flex;gap:8px}#fs-tk button{flex:1;min-height:46px;border-radius:12px;font:inherit;font-weight:600;font-size:15px;cursor:pointer}#fs-tk .y{background:#111;color:#fff;border:0}#fs-tk .n{background:#fff;color:#111;border:1.5px solid #D1D5DB}#fs-tk-re{position:fixed;left:12px;bottom:12px;z-index:99998;width:40px;height:40px;border-radius:50%;border:1px solid #E5E7EB;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer;font-size:18px;display:none;align-items:center;justify-content:center}';
 var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 var w=document.createElement('div');w.id='fs-tk-wrap';w.style.display='none';
 w.innerHTML='<div id="fs-tk" role="dialog" aria-live="polite"><b>'+(EN?'Help measure our ads':'Hilf mit, Werbung zu messen')+'</b><p>'+(EN?'This site uses advertising services (e.g. Meta) to see whether ads work. You can decline – the site works either way. ':'Diese Seite nutzt Werbedienste (z. B. Meta), um zu sehen, ob Anzeigen funktionieren. Du kannst ablehnen, die Seite funktioniert trotzdem. ')+'<a href="/datenschutz">'+(EN?'Details':'Mehr dazu')+'</a></p><div class="r"><button type="button" class="n" id="fs-tk-no">'+(EN?'No, thanks':'Nein, danke')+'</button><button type="button" class="y" id="fs-tk-yes">'+(EN?'OK':'Einverstanden')+'</button></div></div>';
 document.body.appendChild(w);
 var re=document.createElement('button');re.id='fs-tk-re';re.type='button';re.title=EN?'Privacy settings':'Datenschutz-Einstellungen';re.setAttribute('aria-label',re.title);re.textContent='🍪';document.body.appendChild(re);
 function save(m){var c={v:1,ts:new Date().toISOString(),necessary:true,statistics:false,marketing:!!m};try{localStorage.setItem(KEY,JSON.stringify(c))}catch(e){}window.dispatchEvent(new CustomEvent('fs:consent',{detail:c}));w.style.display='none';re.style.display='flex'}
 document.getElementById('fs-tk-yes').onclick=function(){save(true)};document.getElementById('fs-tk-no').onclick=function(){save(false)};
 re.onclick=function(){w.style.display='flex';re.style.display='none'};
 window.addEventListener('fs:consent:open',function(){w.style.display='flex';re.style.display='none'});
 var ex=loadConsent();if(ex){re.style.display='flex'}else{setTimeout(function(){w.style.display='flex'},900)}}
/* Kontakt-Klicks (WhatsApp, Telefon, E-Mail): einmal je Besucher und Seite */
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';var kind=/wa\.me|whatsapp\.com/i.test(h)?'whatsapp':/^tel:/i.test(h)?'telefon':/^mailto:/i.test(h)?'email':'';if(!kind)return;
 var k='fs_contact_'+kind;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(x){}
 var eid=id();beacon({t:'contact',id:eid,k:kind,u:location.href,c:consented()?1:0});fire('Contact',eid)},true);
/* Anfragen: Ereignis-Nummer ans Formular hängen, nach „gespeichert“ melden */
var of=window.fetch;window.fetch=function(input,init){var url=typeof input==='string'?input:(input&&input.url)||'';if(url.indexOf('/.finestsites/forms/')<0)return of.apply(this,arguments);
 var eid=id();init=init||{};try{var b=init.body;if(typeof b==='string'){var j=JSON.parse(b);j._event_id=eid;j._page=location.href;init.body=JSON.stringify(j)}else if(b&&typeof FormData!=='undefined'&&b instanceof FormData){b.append('_event_id',eid);b.append('_page',location.href)}}catch(x){}
 return of.call(this,input,init).then(function(r){try{if(r.ok)r.clone().json().then(function(j){if(j&&j.success&&!j.duplicate)fire('Lead',j.event_id||eid)}).catch(function(){})}catch(x){}return r})};
function start(){var c=loadConsent();if(c){apply(c)}ownBanner()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();`

// ─── Beacon: Kontakt-Klick / Einwilligung ────────────────────────────────────

interface BeaconBody { t?: string; id?: string; k?: string; u?: string; c?: number | string }

export async function handleTrackingBeacon(request: Request, meta: SiteMeta, env: Env, ctx: ExecutionContext, hostname: string): Promise<Response> {
  const text = await request.text().catch(() => '')
  let body: BeaconBody = {}
  try { body = JSON.parse(text) as BeaconBody } catch { /* leer */ }
  if (!meta.tracking || isNoTrack(request)) return new Response(null, { status: 204 })
  const ua = request.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA_RE.test(ua)) return new Response(null, { status: 204 })

  if (body.t === 'consent' && (body.c === 'yes' || body.c === 'no')) {
    ctx.waitUntil(recordEvent(env, meta, hostname, request, 'consent', body.u ?? '', null, { choice: body.c }))
    return new Response(null, { status: 204 })
  }
  if (body.t === 'contact' && typeof body.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.id)) {
    const eventId = body.id
    const kind = String(body.k ?? '').slice(0, 20)
    const sourceUrl = body.u ?? `https://${hostname}/`
    ctx.waitUntil((async () => {
      const dup = await recordEvent(env, meta, hostname, request, 'contact', sourceUrl, eventId, { kind })
      if (dup) return
      if (body.c === 1 && hasMarketingConsent(request)) {
        await sendServerEvent(env, meta, request, { name: 'Contact', eventId, sourceUrl })
      }
    })())
  }
  return new Response(null, { status: 204 })
}

/** Ereignis in die eigene Statistik schreiben; true = gab es schon (gleiche Ereignis-Nummer). */
export async function recordEvent(
  env: Env, meta: SiteMeta, hostname: string, request: Request,
  eventType: 'contact' | 'lead' | 'consent', sourceUrl: string, eventId: string | null, extra: Record<string, unknown>,
): Promise<boolean> {
  try {
    let u: URL | null = null
    try { u = new URL(sourceUrl) } catch { u = null }
    const ua = request.headers.get('user-agent') ?? ''
    const ip = request.headers.get('cf-connecting-ip') ?? ''
    const day = new Date().toISOString().slice(0, 10)
    const visitorHash = await sha256Hex(`${env.WORKER_SECRET}|${day}|${ip}|${ua}|${hostname}`)
    const trim = (v: string | null) => (v ? v.slice(0, 200) : null)
    const res = await fetch(`${env.APP_URL}/api/worker/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': env.WORKER_SECRET },
      body: JSON.stringify({ events: [{
        siteId: meta.siteId, templateId: meta.templateId, eventType, visitorHash, host: hostname,
        path: u?.pathname ?? '/', source: null, referrerHost: null,
        utmSource: trim(u?.searchParams.get('utm_source') ?? null),
        utmMedium: trim(u?.searchParams.get('utm_medium') ?? null),
        utmCampaign: trim(u?.searchParams.get('utm_campaign') ?? null),
        device: null, browser: null, os: null,
        country: (request as Request & { cf?: { country?: string } }).cf?.country ?? null,
        meta: { ...extra, utm_content: trim(u?.searchParams.get('utm_content') ?? null) },
        eventId,
      }] }),
    })
    if (!res.ok) return false
    const json = await res.json().catch(() => ({})) as { duplicate?: string[] }
    return !!(eventId && json.duplicate?.includes(eventId))
  } catch (err) {
    console.error('recordEvent error:', err)
    return false
  }
}

// ─── Server-Übertragung (Conversions API / Events API) ───────────────────────

interface Secrets { active: boolean; metaPixelId?: string | null; metaToken?: string | null; tiktokPixelId?: string | null; tiktokToken?: string | null }
const SECRETS_MS = 5 * 60_000
const secretsMemo = new Map<string, { value: Secrets; expires: number }>()

async function getSecrets(env: Env, siteId: string): Promise<Secrets> {
  const memo = secretsMemo.get(siteId)
  if (memo && memo.expires > Date.now()) return memo.value
  const res = await fetch(`${env.APP_URL}/api/worker/tracking-secrets?siteId=${encodeURIComponent(siteId)}`, {
    headers: { 'x-worker-secret': env.WORKER_SECRET },
  })
  const value = res.ok ? await res.json() as Secrets : { active: false }
  if (secretsMemo.size > 500) secretsMemo.clear()
  secretsMemo.set(siteId, { value, expires: Date.now() + SECRETS_MS })
  return value
}

export interface ServerEventInput {
  name: TrackingEventName
  eventId: string
  sourceUrl: string
  formData?: Record<string, string>
}

/** Nur aufrufen, wenn Einwilligung vorliegt. Fehler landen in der Statusanzeige, nie beim Besucher. */
export async function sendServerEvent(env: Env, meta: SiteMeta, request: Request, input: ServerEventInput): Promise<void> {
  try {
    const s = await getSecrets(env, meta.siteId)
    if (!s.active) return
    const contact = input.formData ? pickContactFields(input.formData) : {}
    const h = async (v: string | undefined) => (v ? await sha256Hex(v) : null)
    const ev: ServerEvent = {
      name: input.name,
      eventId: input.eventId,
      time: Math.floor(Date.now() / 1000),
      sourceUrl: input.sourceUrl,
      ip: request.headers.get('cf-connecting-ip'),
      userAgent: request.headers.get('user-agent'),
      fbp: cookie(request, '_fbp'),
      fbc: cookie(request, '_fbc'),
      ttclid: cookie(request, '_fs_ttclid'),
      emailHash: await h(contact.email ? normalizeEmail(contact.email) : undefined),
      phoneHash: await h(contact.phone ? normalizePhone(contact.phone) : undefined),
      firstNameHash: await h(contact.firstName ? normalizeName(contact.firstName) : undefined),
      lastNameHash: await h(contact.lastName ? normalizeName(contact.lastName) : undefined),
      country: ((request as Request & { cf?: { country?: string } }).cf?.country ?? '').toLowerCase() || null,
    }
    const report = async (platform: string, ok: boolean, error?: string) => {
      await fetch(`${env.APP_URL}/api/worker/tracking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-secret': env.WORKER_SECRET },
        body: JSON.stringify({ siteId: meta.siteId, platform, ok, error, event: input.name }),
      }).catch(() => {})
    }
    const jobs: Promise<void>[] = []
    if (s.metaPixelId && s.metaToken) {
      jobs.push(sendMetaEvent(s.metaPixelId, s.metaToken, ev).then(r => report('meta', r.ok, r.error)))
    }
    if (s.tiktokPixelId && s.tiktokToken) {
      jobs.push(sendTikTokEvent(s.tiktokPixelId, s.tiktokToken, ev).then(r => report('tiktok', r.ok, r.error)))
    }
    await Promise.all(jobs)
  } catch (err) {
    console.error('sendServerEvent error:', err)
  }
}

// ─── Datenschutz-Abschnitt ────────────────────────────────────────────────────

export function privacySectionDe(t: PublicTrackingConfig | undefined): string {
  if (!t) {
    return `<section>
<h2>Cookies &amp; Tracking (§ 25 TDDDG)</h2>
<p>Diese Website verwendet <strong>keine Cookies</strong> und kein Tracking. Es werden keine Daten für Werbezwecke erhoben, keine Analyse-Tools eingesetzt und keine Daten an Dritte weitergegeben. Ein Cookie-Banner ist daher nicht erforderlich.</p>
</section>`
  }
  const providers: string[] = []
  if (t.meta) providers.push('<li><strong>Meta Pixel und Meta Conversions API</strong> (Meta Platforms Ireland Ltd., Merrion Road, Dublin 4, Irland). Zweck: Messung, ob Anzeigen auf Facebook und Instagram zu Kontaktaufnahmen führen. Bei einer Anfrage werden Kontaktdaten ausschließlich in gehashter Form übermittelt. Für die gemeinsame Verarbeitung besteht eine Vereinbarung über gemeinsame Verantwortlichkeit mit Meta (Art. 26 DSGVO). Datenschutz: <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener">facebook.com/privacy/policy</a></li>')
  if (t.google) providers.push('<li><strong>Google Ads Conversion-Tracking</strong> (Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland). Zweck: Messung, ob Google-Anzeigen zu Kontaktaufnahmen führen. Einwilligung wird über den Google Consent Mode übermittelt. Datenschutz: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a></li>')
  if (t.tiktok) providers.push('<li><strong>TikTok Pixel und TikTok Events API</strong> (TikTok Technology Ltd., 10 Earlsfort Terrace, Dublin, Irland). Zweck: Messung, ob TikTok-Anzeigen zu Kontaktaufnahmen führen. Datenschutz: <a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener">tiktok.com/legal/privacy-policy</a></li>')
  return `<section>
<h2>Cookies, Werbemessung &amp; Tracking (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO)</h2>
<p>Diese Website setzt Werbemess-Dienste <strong>nur mit deiner Einwilligung</strong> ein. Beim ersten Besuch kannst du über den Hinweis am unteren Rand zustimmen oder ablehnen. Ohne Zustimmung werden keine Cookies dieser Dienste gesetzt und keine Daten an sie übermittelt; die Website funktioniert uneingeschränkt. Deine Wahl wird im Browser gespeichert (Eintrag <code>fs_consent_v1</code>, Cookie <code>fs_mkt</code>) und gilt sechs Monate. Du kannst sie jederzeit über das Symbol unten links auf der Startseite ändern.</p>
<p>Eingesetzte Dienste:</p>
<ul>${providers.join('')}</ul>
<p>Gemessen werden der Seitenaufruf, Klicks auf Kontaktmöglichkeiten (WhatsApp, Telefon, E-Mail) und das Absenden des Kontaktformulars. Bei der Server-Übermittlung werden IP-Adresse und Browserkennung verarbeitet; E-Mail-Adresse, Telefonnummer und Name werden vorher gehasht (SHA-256). Die Anbieter können Daten in die USA übermitteln; sie sind unter dem EU-US Data Privacy Framework zertifiziert. Rechtsgrundlage ist deine Einwilligung, die du jederzeit mit Wirkung für die Zukunft widerrufen kannst.</p>
</section>`
}

export function privacySectionEn(t: PublicTrackingConfig | undefined): string {
  if (!t) {
    return `<section>
<h2>Cookies &amp; tracking (Section 25 TDDDG)</h2>
<p>This website uses <strong>no cookies</strong> and no tracking. No data is collected for advertising purposes, no analytics tools are used, and no data is shared with third parties. A cookie banner is therefore not required.</p>
</section>`
  }
  const providers: string[] = []
  if (t.meta) providers.push('<li><strong>Meta Pixel and Meta Conversions API</strong> (Meta Platforms Ireland Ltd., Dublin, Ireland): measures whether Facebook and Instagram ads lead to contact requests. Contact details from a request are transmitted in hashed form only. <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener">Privacy policy</a></li>')
  if (t.google) providers.push('<li><strong>Google Ads conversion tracking</strong> (Google Ireland Ltd., Dublin, Ireland): measures whether Google ads lead to contact requests; consent is passed via Google Consent Mode. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy policy</a></li>')
  if (t.tiktok) providers.push('<li><strong>TikTok Pixel and TikTok Events API</strong> (TikTok Technology Ltd., Dublin, Ireland): measures whether TikTok ads lead to contact requests. <a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener">Privacy policy</a></li>')
  return `<section>
<h2>Cookies, ad measurement &amp; tracking (Section 25 TDDDG, Art. 6(1)(a) GDPR)</h2>
<p>This website uses ad measurement services <strong>only with your consent</strong>. On your first visit you can accept or decline via the notice at the bottom of the page. Without consent no cookies of these services are set and no data is sent to them; the site works fully. Your choice is stored in your browser (<code>fs_consent_v1</code>, cookie <code>fs_mkt</code>) for six months and can be changed any time via the icon at the bottom left of the start page.</p>
<ul>${providers.join('')}</ul>
<p>Measured events: page view, clicks on contact options (WhatsApp, phone, email) and submitting the contact form. Server-side transmission processes IP address and browser identifier; email, phone number and name are hashed (SHA-256) beforehand. Providers may transfer data to the USA under the EU-US Data Privacy Framework. The legal basis is your consent, which you can withdraw at any time with effect for the future.</p>
</section>`
}
