/*! FinestSites Besucher-Chat v1 — docs/chat/konzept.md. Vanilla JS (ES2018), Shadow DOM, kein externes Laden. */
(function () {
  'use strict';
  if (window.__fsChat) return;
  window.__fsChat = true;

  var API = '/.finestsites/chat/';
  var TOKEN_KEY = 'fs_chat_token';
  var HO_KEY = 'fs_chat_handoff_dismissed';
  var EN = /^en/i.test(document.documentElement.lang || '');
  var LANG = EN ? 'en' : 'de';
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var UA = navigator.userAgent || '';
  // In-App-Browser (Instagram, Facebook, Threads, TikTok, …): eigener Speicher je Browser → Übergabe-Karte
  var IAB = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Threads|Barcelona|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest|Line\//i.exec(UA);
  var IOS = /iPhone|iPad|iPod/.test(UA), ANDROID = /Android/.test(UA);

  var T = {
    de: {
      open: 'Chat öffnen', close: 'Chat schließen', online: 'online',
      wa: 'Schreib mir direkt in WhatsApp', placeholder: 'Nachricht schreiben …', send: 'Senden',
      hint: 'Nur in diesem Browser gespeichert.', privacy: 'Datenschutz',
      notice: 'Dieser Chat wird in diesem Browser gespeichert. Nach deiner ersten Nachricht bekommst du einen Code, mit dem du ihn auf jedem Gerät wieder öffnen kannst. Wichtiges schickst du mir am besten {via}.',
      ccTitle: 'Dein Gesprächs-Code', ccText: 'Damit öffnest du dieses Gespräch auf jedem Gerät wieder – am besten einen Screenshot machen. Gib den Code nicht weiter.',
      ccCopy: 'Code kopieren', ccCopied: 'Code kopiert', rsQ: 'Schon ein Gespräch begonnen?', rsLink: 'Mit Code fortsetzen',
      rsPh: 'Code, z. B. 7K4M-2P9X', rsGo: 'Fortsetzen', rsBad: 'Code nicht gefunden – bitte prüfen.', rsOld: 'Dieser Code ist abgelaufen.',
      rsMany: 'Zu viele Versuche. Bitte in 10 Minuten nochmal.', rsDone: 'Gespräch fortgesetzt',
      viaWa: 'per WhatsApp oder über das Kontaktformular', viaForm: 'über das Kontaktformular',
      today: 'Heute', yesterday: 'Gestern', failed: 'Nicht gesendet', retry: 'Erneut senden',
      rejected: 'Diese Nachricht kann nicht gesendet werden.', wait: 'Bitte kurz warten.',
      blocked: 'Dieser Chat ist nicht verfügbar.', copied: 'Link kopiert', copy: 'Link kopieren',
      profile: 'Damit ich dich erreiche (optional)', name: 'Name', email: 'E-Mail', phone: 'Telefon / WhatsApp',
      notify: 'Antworten per E-Mail erhalten', save: 'Speichern', saved: 'Gespeichert',
      unsub: 'Du bekommst keine E-Mails mehr zu diesem Chat.', offline: 'Keine Verbindung.',
      sent: 'Gesendet', read: 'Gelesen', sending: 'Wird gesendet', unread: 'ungelesene Nachrichten', you: 'Du',
      mailLink: 'Chat-Link per E-Mail schicken', mailSent: 'E-Mail ist unterwegs', later: 'Bitte später nochmal',
      hoApp: 'In-App-Browser', hoBrowser: 'deinem Browser', hoTitle: 'Du bist im {app}-Browser.',
      hoText: 'Damit du später wieder in diesen Chat kommst, öffne ihn in {browser}.',
      hoOpenIos: 'In Safari öffnen', hoOpen: 'Im Browser öffnen', dismiss: 'Hinweis schließen',
      hoMenuIos: 'Oder tippe oben rechts auf ⋯ und „In Safari öffnen“.', hoMenu: 'Oder tippe oben rechts auf ⋮ und „Im Browser öffnen“.',
      hoFail: 'Link konnte nicht erstellt werden.', paused: 'Pausiert – tippe, um zu aktualisieren'
    },
    en: {
      open: 'Open chat', close: 'Close chat', online: 'online',
      wa: 'Message me directly on WhatsApp', placeholder: 'Write a message …', send: 'Send',
      hint: 'Stored only in this browser.', privacy: 'Privacy',
      notice: 'This chat is stored in this browser. After your first message you get a code that reopens it on any device. For anything important, use {via}.',
      ccTitle: 'Your conversation code', ccText: 'Use it to reopen this chat on any device – a screenshot is the easiest way to keep it. Do not share the code.',
      ccCopy: 'Copy code', ccCopied: 'Code copied', rsQ: 'Already started a chat?', rsLink: 'Continue with code',
      rsPh: 'Code, e.g. 7K4M-2P9X', rsGo: 'Continue', rsBad: 'Code not found – please check it.', rsOld: 'This code has expired.',
      rsMany: 'Too many attempts. Please try again in 10 minutes.', rsDone: 'Conversation restored',
      viaWa: 'WhatsApp or the contact form', viaForm: 'the contact form',
      today: 'Today', yesterday: 'Yesterday', failed: 'Not sent', retry: 'Send again',
      rejected: 'This message cannot be sent.', wait: 'Please wait a moment.',
      blocked: 'This chat is not available.', copied: 'Link copied', copy: 'Copy link',
      profile: 'So I can reach you (optional)', name: 'Name', email: 'E-mail', phone: 'Phone / WhatsApp',
      notify: 'Receive replies by e-mail', save: 'Save', saved: 'Saved',
      unsub: 'You will no longer receive e-mails about this chat.', offline: 'No connection.',
      sent: 'Sent', read: 'Read', sending: 'Sending', unread: 'unread messages', you: 'You',
      mailLink: 'Send chat link by e-mail', mailSent: 'E-mail is on its way', later: 'Please try again later',
      hoApp: 'in-app', hoBrowser: 'your browser', hoTitle: 'You are in the {app} browser.',
      hoText: 'To get back to this chat later, open it in {browser}.',
      hoOpenIos: 'Open in Safari', hoOpen: 'Open in browser', dismiss: 'Dismiss',
      hoMenuIos: 'Or tap ⋯ at the top right and choose “Open in Safari”.', hoMenu: 'Or tap ⋮ at the top right and choose “Open in browser”.',
      hoFail: 'The link could not be created.', paused: 'Paused – tap to refresh'
    }
  };
  var t = T[LANG];

  // ── Zustand ────────────────────────────────────────────────────────────────
  var cfg = null, token = null, tokenStored = false, convId = null, status = 'open';
  var ticket = null, sessionDone = false; // Ticket aus `session` (nur im Speicher), Header X-FS-Ticket bei schreibenden Aufrufen
  var lastActivity = Date.now();          // letzte Interaktion/Nachricht → Polling-Abstand (geschlossen) + Ruhestopp
  var visitor = { name: null, email: null, phone: null, notifyByEmail: false };
  var messages = [];          // {id, sender, body, createdAt, readAt, clientId, state}
  var ownerSeen = null;       // ISO
  var ownerRead = null;       // ISO: bis hierhin hat der Betreiber gelesen (Feld ownerReadAt)
  var isOpen = false, pollTimer = null, started = false, blocked = false, mounted = false;
  // Polling: offen = Long-Poll-Schleife (wait=25), geschlossen = Timer 20/60 s; Ruhestopp nach 15/30 min ohne Interaktion
  var LONG_WAIT = 25, IDLE_OPEN = 15 * 60000, IDLE_CLOSED = 30 * 60000;
  var polling = false, pollAgain = false, pollCtl = null, pollGen = 0, pollFails = 0;
  var paused = false, idleTimer = null, pauseEl = null;
  var hoUrl = null, hoBusy = false, hoGone = false; // Übergabe-Karte (In-App-Browser)
  var code = null, rsOpen = false, rsBusy = false, rsErr = null, rsVal = ''; // Gesprächs-Code (Karte) + „Mit Code fortsetzen“
  var root, host, btn, badge, win, list, ta, sendBtn, hintEl, profileEl, statusEl, toastEl;

  // ── Helfer ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rnd(bytes) {
    var a = new Uint8Array(bytes), out = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return out;
  }
  function readToken() {
    try { var v = localStorage.getItem(TOKEN_KEY); if (v) return v; } catch (e) {}
    var m = document.cookie.match(/(?:^|; )fs_chat_token=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function storeToken(v) {
    tokenStored = true;
    try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {}
    try { document.cookie = TOKEN_KEY + '=' + encodeURIComponent(v) + '; Max-Age=' + (180 * 86400) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
  }
  /** #rgb, #rrggbb, #rrggbbaa, rgb(…), rgba(…) → [r,g,b]; sonst null */
  function parseColor(v) {
    v = String(v || '').trim();
    var m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
    if (m) {
      var h = m[1];
      if (h.length <= 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(v);
    if (m) return [m[1], m[2], m[3]].map(function (n) { return Math.max(0, Math.min(255, Math.round(+n))); });
    return null;
  }
  /** Markenfarbe der Seite: erste gültige CSS-Variable auf body oder html, sonst brandColor des Kontos, sonst #111 */
  function pageBrand() {
    var names = ['--fs-primary', '--primary', '--accent', '--green', '--blue', '--brand'];
    var els = [document.body, document.documentElement];
    for (var i = 0; i < names.length; i++) for (var k = 0; k < els.length; k++) {
      try { var rgb = parseColor(getComputedStyle(els[k]).getPropertyValue(names[i])); if (rgb) return rgb; } catch (e) {}
    }
    return parseColor(cfg.owner && cfg.owner.brandColor) || [17, 17, 17];
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    try { return d.toLocaleTimeString(LANG === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  function dayKey(iso) { var d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(iso) {
    var d = new Date(iso), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(iso) === dayKey(now)) return t.today;
    if (dayKey(iso) === dayKey(y)) return t.yesterday;
    var o = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    try { return d.toLocaleDateString(LANG === 'en' ? 'en-GB' : 'de-DE', o); } catch (e) { return d.toLocaleDateString(); }
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  var LINK_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
  function linkify(text) {
    var out = '', last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      out += esc(text.slice(last, m.index));
      var url = m[1], href = /^www\./i.test(url) ? 'https://' + url : url;
      var shown = url.replace(/^https?:\/\//, '');
      if (shown.length > 42) shown = shown.slice(0, 40) + '…';
      out += '<span class="lk"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(shown) + '</a>' +
        '<button type="button" class="cp" data-copy="' + esc(href) + '" aria-label="' + t.copy + '" title="' + t.copy + '">' + ICON.copy + '</button></span>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  function api(name, opts) {
    opts = opts || {};
    var h = { Accept: 'application/json' };
    if (token) h['X-FS-Visitor'] = token;
    if (ticket && opts.method === 'POST' && name !== 'session') h['X-FS-Ticket'] = ticket;
    var init = { method: opts.method || 'GET', headers: h, credentials: 'same-origin' };
    if (opts.signal) init.signal = opts.signal;
    if (opts.body !== undefined) { h['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(API + name + (opts.query || ''), init).then(function (r) {
      return r.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (r.status === 403 && j && j.error === 'BLOCKED') { setBlocked(); }
        return { ok: r.ok, status: r.status, json: j || {} };
      });
    });
  }
  /** Ticket per `session` holen (fehlt es in der Antwort, läuft alles ohne Header weiter). Lehnt nie ab. */
  function fetchTicket() {
    sessionDone = true;
    return api('session', { method: 'POST', body: { visitorToken: token, pageUrl: location.href } }).then(function (s) {
      if (s.ok) {
        if (typeof s.json.ticket === 'string' && s.json.ticket) ticket = s.json.ticket;
        if (s.json.conversationId && !convId) convId = s.json.conversationId;
      }
    }, function () {});
  }
  /** Schreibender Aufruf mit Ticket; bei 403 TICKET_REQUIRED/TICKET_INVALID einmal neues Ticket holen und wiederholen. */
  function apiT(name, opts) {
    var pre = (ticket || sessionDone) ? Promise.resolve() : fetchTicket();
    return pre.then(function () { return api(name, opts); }).then(function (r) {
      if (r.status !== 403 || !r.json || (r.json.error !== 'TICKET_REQUIRED' && r.json.error !== 'TICKET_INVALID')) return r;
      ticket = null;
      return fetchTicket().then(function () { return api(name, opts); });
    });
  }
  function hp() {
    var f = profileEl && profileEl.querySelector('form');
    return f && f.website ? String(f.website.value || '') : '';
  }
  function appName() {
    var s = IAB ? IAB[0].toLowerCase() : '';
    if (s === 'instagram') return 'Instagram';
    if (s.indexOf('fb') === 0) return 'Facebook';
    if (s === 'threads' || s === 'barcelona') return 'Threads';
    if (s === 'tiktok' || s === 'musical_ly') return 'TikTok';
    if (s === 'snapchat') return 'Snapchat';
    if (s === 'linkedinapp') return 'LinkedIn';
    if (s === 'pinterest') return 'Pinterest';
    if (s === 'line/') return 'LINE';
    return t.hoApp;
  }

  // ── Symbole ────────────────────────────────────────────────────────────────
  var ICON = {
    chat: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.9-.9L3 20l1.3-4.1A8 8 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z"/></svg>',
    chatf: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 3C6.9 3 3 6.5 3 11c0 2 .8 3.8 2.1 5.2L4 21l4.6-1.7c1 .3 2.2.5 3.4.5 5.1 0 9-3.5 9-8s-3.9-8-9-8z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6l.5-.5.3-.5v-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5h-.4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    tick: '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2"/></svg>',
    tick2: '<svg viewBox="0 0 20 12" width="18" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2M8 9.2l1.2 1.2L15.5 3.2"/></svg>',
    clock: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.3 1.4"/></svg>',
    warn: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/></svg>'
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  function css(brand, brandText, brandSoft) {
    return ':host{all:initial;position:fixed;inset:auto 0 0 auto;z-index:2147483000;font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;-webkit-font-smoothing:antialiased;--b:' + brand + ';--bt:' + brandText + ';--bs:' + brandSoft + ';--fl:#F2F3F5;--hl:rgba(0,0,0,.06);--mu:#6B7280;--ln:#8A8F98}' +
    '*,*::before,*::after{box-sizing:border-box}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;background:none;border:0;padding:0;margin:0}a{color:inherit}' +
    'button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--b);outline-offset:2px}' +
    '.fab{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transform:scale(.8);transition:transform .3s cubic-bezier(.2,.8,.3,1),opacity .3s,box-shadow .2s}' +
    '.fab.photo{background:#fff;color:#111;box-shadow:0 8px 24px rgba(0,0,0,.2),0 0 0 2px #fff}.fab.photo.open{background:var(--b);color:var(--bt)}.fab .c0{position:relative;width:100%;height:100%;align-items:center;justify-content:center}.fab .ph{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}.fab .bd{position:absolute;right:-3px;bottom:-3px;width:24px;height:24px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2.5px #fff}.fab .bd svg{width:13px;height:13px}.fab .in{font-weight:600;font-size:17px;letter-spacing:.02em}' +
    '.fab.in{opacity:1;transform:scale(1)}.fab:hover{box-shadow:0 10px 28px rgba(0,0,0,.22)}.fab:active{transform:scale(.96)}.fab:focus-visible{outline-offset:3px}' +
    '.fab .i{display:flex;transition:transform .25s,opacity .2s}.fab.open .i.c0{transform:rotate(90deg) scale(.4);opacity:0;position:absolute}.fab .i.c1{position:absolute;transform:rotate(-90deg) scale(.4);opacity:0}.fab.open .i.c1{transform:none;opacity:1;position:static}' +
    '.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#E5484D;color:#fff;font-size:11px;font-weight:700;line-height:20px;text-align:center;border:2px solid #fff;display:none}.badge.on{display:block}' +
    '.win{position:fixed;inset:0;background:#fff;display:none;flex-direction:column;overflow:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);opacity:0;transform:scale(.96);transform-origin:50% 100%;transition:opacity .2s,transform .2s cubic-bezier(.2,.8,.3,1)}' +
    '.win.show{display:flex}.win.in{opacity:1;transform:none}' +
    '@media(min-width:640px){.win{inset:auto max(20px,env(safe-area-inset-right)) max(88px,calc(env(safe-area-inset-bottom) + 88px)) auto;width:380px;height:min(640px,calc(100vh - 40px));max-height:calc(100vh - 108px);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.04);padding:0;transform-origin:100% 100%}}' +
    '.hd{display:flex;align-items:center;gap:12px;padding:12px 8px 12px 16px;border-bottom:1px solid var(--hl);background:#fff;flex:none}' +
    '.av{width:36px;height:36px;border-radius:50%;background:var(--fl);color:#111;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;overflow:hidden;flex:none;letter-spacing:.02em}.av img{width:100%;height:100%;object-fit:cover;display:block}' +
    // Kopf: Höhe immer 40 px (Schließen-Knopf) → Name mittig; Statuszeile nur bei „online“, kein Springen
    '.who{flex:1;min-width:0}.nm{font-weight:600;font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st{display:none;font-size:12px;line-height:1.3;color:var(--mu);align-items:center;gap:6px;margin-top:2px}.st.on{display:flex}.st .dot{width:6px;height:6px;border-radius:50%;background:#22C55E;flex:none}' +
    '.x{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--mu);flex:none}.x:hover{background:var(--fl);color:#111}.x .c{display:none}.x .d{display:flex}@media(min-width:640px){.x .c{display:flex}.x .d{display:none}}' +
    '.list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 6px;background:#fff;scroll-behavior:smooth}' +
    '@media(prefers-reduced-motion:reduce){.list{scroll-behavior:auto}.fab,.win,.m,.ho,.fab .i{transition:none!important;animation:none!important}}' +
    '.day{text-align:center;font-size:12px;color:var(--ln);margin:10px 0 12px}' +
    '.m{display:flex;margin:0 0 8px;animation:up .2s ease-out both}@keyframes up{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.m.me{justify-content:flex-end}.m+.m.same{margin-top:-5px}' +
    '.bb{max-width:80%;padding:9px 12px 7px 13px;border-radius:18px;background:var(--fl);color:#111;font-size:15px;line-height:1.4;word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap;position:relative}' +
    '.m.them.tl .bb{border-bottom-left-radius:6px}.m.me .bb{background:var(--b);color:var(--bt)}.m.me.tl .bb{border-bottom-right-radius:6px}' +
    '.mt{display:inline-flex;align-items:center;gap:4px;float:right;margin:7px 0 0 10px;font-size:11px;line-height:1;opacity:.6;position:relative;top:1px}.m.me .mt{opacity:.78}.mt .tk{display:inline-flex}' +
    '.lk a{color:var(--b);text-decoration:underline;text-underline-offset:2px;word-break:break-all}.m.me .lk a{color:inherit}.cp{display:inline-flex;vertical-align:-2px;margin-left:5px;padding:2px;border-radius:5px;opacity:.6}.cp:hover{opacity:1;background:rgba(0,0,0,.08)}.m.me .cp:hover{background:rgba(255,255,255,.2)}' +
    '.err{clear:both;display:flex;justify-content:flex-end;align-items:center;gap:5px;font-size:12px;color:#C0392B;margin:-3px 2px 8px}.err button{text-decoration:underline;text-underline-offset:2px;font-weight:500;color:#C0392B}' +
    '.sys{text-align:center;font-size:12px;color:var(--ln);margin:6px 20px 12px}.sys.note{margin:0 6px 16px;line-height:1.45}.sys.pause{margin:4px 20px 10px;color:#9CA3AF}' +
    '.war{display:flex;margin:0 0 14px}.war.mid{justify-content:center}.wab{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px 0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.1);color:#111;font-weight:500;font-size:14px;text-decoration:none;transition:background .15s,border-color .15s}.wab svg{color:#25D366}.wab:hover{background:#FAFAFA;border-color:rgba(0,0,0,.18)}' +
    '.blk{text-align:center;padding:32px 20px 16px;color:var(--mu);font-size:14px}' +
    '.ft{flex:none;background:#fff;border-top:1px solid var(--hl)}' +
    '.pf{border-bottom:1px solid var(--hl)}.pf summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:9px 16px;font-size:13px;color:var(--mu);cursor:pointer;user-select:none}.pf[open] summary{color:#111}.pf summary::-webkit-details-marker{display:none}.pf summary .ar{display:flex;color:#9CA3AF;transition:transform .2s}.pf[open] summary .ar{transform:rotate(180deg)}' +
    '.pf .fm{padding:2px 16px 12px;display:grid;gap:8px}.pf input:not([type=checkbox]){width:100%;height:40px;border:0;border-radius:12px;padding:0 12px;font-size:15px;background:var(--fl);outline:none;transition:box-shadow .15s}.pf input:focus{box-shadow:0 0 0 3px var(--bs)}' +
    // Honeypot: für Menschen unsichtbar (nicht display:none, sonst lassen Bots es aus), nie im Tab-Fluss
    '.pf input.hp{position:absolute;left:-9999px;top:0;width:1px;height:0;opacity:0;pointer-events:none}' +
    '.sw{display:flex;align-items:center;gap:10px;font-size:13px;color:#374151;margin:2px 0}.sw.off{opacity:.5}.pf input[type=checkbox]{appearance:none;-webkit-appearance:none;width:36px;height:22px;border-radius:11px;background:#D1D5DB;position:relative;flex:none;border:0;padding:0;margin:0;cursor:pointer;transition:background .2s}.pf input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .2s}.pf input[type=checkbox]:checked{background:var(--b)}.pf input[type=checkbox]:checked::after{transform:translateX(14px)}' +
    '.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.pb{height:34px;padding:0 16px;border-radius:999px;background:var(--b);color:var(--bt);font-weight:600;font-size:13px;transition:opacity .15s}.pb:hover{opacity:.9}.pb:disabled{opacity:.5;cursor:default}.ok{font-size:12px;color:#16A34A}' +
    '.lnk{font-size:13px;color:var(--mu);text-decoration:underline;text-underline-offset:2px;margin-left:auto}.lnk:hover{color:#111}.lnk:disabled{opacity:.5}' +
    '.cmp{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 8px 16px}' +
    '.ta{flex:1;min-height:44px;max-height:132px;resize:none;border:0;border-radius:22px;padding:11px 16px;font-size:16px;line-height:22px;background:var(--fl);overflow-y:auto;outline:none;transition:box-shadow .15s}.ta:focus{box-shadow:0 0 0 3px var(--bs)}.ta::placeholder{color:#9CA3AF}@media(min-width:640px){.ta{font-size:15px}}' +
    '.sb{width:38px;height:38px;margin-bottom:3px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;flex:none;transition:transform .15s,opacity .15s}.sb:disabled{opacity:.4;cursor:default}.sb:not(:disabled):hover{transform:scale(1.06)}' +
    '.hint{font-size:11px;color:var(--ln);text-align:center;padding:0 16px 10px}.hint a{text-decoration:underline;text-underline-offset:2px}' +
    '.toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%) translateY(6px);background:rgba(17,17,17,.9);color:#fff;font-size:12.5px;font-weight:500;padding:8px 14px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;white-space:nowrap}.toast.on{opacity:1;transform:translateX(-50%)}' +
    '.ho{position:relative;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px 14px;margin:4px 0 14px;font-size:13px;line-height:1.45;color:#374151;animation:up .2s ease-out both}.ho b{display:block;color:#111;font-weight:600;padding-right:26px;margin-bottom:1px}' +
    '.hx{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9CA3AF}.hx:hover{background:var(--fl);color:#111}.hx svg{width:15px;height:15px}' +
    '.hb{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sec{height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;color:#111;font-size:13px;font-weight:500}.sec:hover{background:#FAFAFA}.sec:disabled{opacity:.5;cursor:default}' +
    '.fb{display:grid;gap:6px;margin-top:10px}.fb input{width:100%;height:36px;border:0;border-radius:10px;padding:0 10px;font-size:12px;background:var(--fl);color:#374151;outline:none}.fb input:focus{box-shadow:0 0 0 3px var(--bs)}.fb p{margin:0;font-size:12px;color:var(--mu)}' +
    '.cc{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px 14px;margin:0 0 14px;font-size:13px;line-height:1.45;color:#374151;animation:up .2s ease-out both}.cc b{display:block;color:#111;font-weight:600;margin-bottom:6px}.cv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.cd{font:600 20px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:var(--b);user-select:all;-webkit-user-select:all}.cc p{margin:0;font-size:12px;color:var(--mu)}' +
    '.rs{margin:0 0 14px;font-size:13px;color:var(--mu);text-align:center}.rs .lk2{color:var(--b);font-weight:500;text-decoration:underline;text-underline-offset:2px}.rf{display:flex;gap:8px;margin-top:8px}.rf input{flex:1;min-width:0;height:40px;border:0;border-radius:12px;padding:0 12px;font:600 16px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;background:var(--fl);color:#111;outline:none}.rf input:focus{box-shadow:0 0 0 3px var(--bs)}.rf input::placeholder{font-weight:400;letter-spacing:0;text-transform:none;color:#9CA3AF}.rf .pb{height:40px}.re{color:#C0392B;font-size:12px;margin-top:6px;text-align:left}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
  }

  // ── Aufbau ─────────────────────────────────────────────────────────────────
  function mount() {
    if (mounted) return; mounted = true;
    var rgb = pageBrand();
    // sehr helle Markenfarbe: für Blasen/Knöpfe abdunkeln, damit der Text lesbar bleibt
    if (luminance(rgb) > 0.75) rgb = rgb.map(function (v) { return Math.round(v * 0.78); });
    var brand = 'rgb(' + rgb.join(',') + ')';
    var brandText = luminance(rgb) < 0.45 ? '#fff' : '#111';
    var brandSoft = 'rgba(' + rgb.join(',') + ',.28)';
    host = document.createElement('div');
    host.id = 'fs-chat';
    host.setAttribute('data-fs-chat-widget', '1');
    root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = css(brand, brandText, brandSoft);
    root.appendChild(style);

    var owner = cfg.owner || {};
    var avatar = owner.avatarUrl ? '<img src="' + esc(owner.avatarUrl) + '" alt="">' : esc(initials(owner.name));
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button type="button" class="fab' + (owner.avatarUrl ? ' photo' : '') + '" aria-label="' + t.open + '" aria-expanded="false" aria-haspopup="dialog" aria-controls="win">' +
        // Starter: Profilbild + kleiner Chat-Punkt in der Seitenfarbe; ohne Bild Initialen auf der Seitenfarbe
        '<span class="i c0">' + (owner.avatarUrl ? '<img class="ph" src="' + esc(owner.avatarUrl) + '" alt=""><span class="bd">' + ICON.chatf + '</span>' : '<span class="in">' + esc(initials(owner.name)) + '</span>') + '</span><span class="i c1">' + ICON.down + '</span>' +
        '<span class="badge" aria-hidden="true"></span><span class="sr" id="sr"></span></button>' +
      '<section class="win" id="win" role="dialog" aria-modal="true" aria-label="Chat" tabindex="-1">' +
        '<div class="hd"><div class="av">' + avatar + '</div><div class="who"><div class="nm">' + esc(owner.name || 'Chat') + '</div>' +
        '<div class="st"><span class="dot"></span><span class="stt">' + t.online + '</span></div></div>' +
        '<button type="button" class="x" aria-label="' + t.close + '"><span class="d">' + ICON.down + '</span><span class="c">' + ICON.close + '</span></button></div>' +
        '<div class="list" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="toast" role="status"></div>' +
        '<div class="ft">' +
          '<details class="pf" hidden><summary><span>' + t.profile + '</span><span class="ar">' + ICON.down + '</span></summary>' +
          '<form class="fm" novalidate><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<input name="name" autocomplete="name" placeholder="' + t.name + '" maxlength="100">' +
          '<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="' + t.email + '" maxlength="200">' +
          '<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + t.phone + '" maxlength="40">' +
          '<label class="sw off"><input type="checkbox" name="notify" disabled><span>' + t.notify + '</span></label>' +
          '<div class="row"><button type="submit" class="pb">' + t.save + '</button><span class="ok" hidden>' + t.saved + '</span>' +
          '<button type="button" class="lnk ml" hidden>' + t.mailLink + '</button></div></form></details>' +
          '<div class="cmp"><textarea class="ta" rows="1" placeholder="' + t.placeholder + '" aria-label="' + t.placeholder + '" maxlength="2000"></textarea>' +
          '<button type="button" class="sb" aria-label="' + t.send + '" disabled>' + ICON.send + '</button></div>' +
          '<div class="hint">' + t.hint + ' <a href="/datenschutz">' + t.privacy + '</a></div>' +
        '</div>' +
      '</section>';
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    document.body.appendChild(host);

    btn = root.querySelector('.fab'); badge = root.querySelector('.badge'); win = root.querySelector('.win');
    list = root.querySelector('.list'); ta = root.querySelector('.ta'); sendBtn = root.querySelector('.sb');
    hintEl = root.querySelector('.hint'); profileEl = root.querySelector('.pf'); statusEl = root.querySelector('.st');
    toastEl = root.querySelector('.toast');

    btn.addEventListener('click', function () { isOpen ? close() : open(); });
    root.querySelector('.x').addEventListener('click', close);
    win.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    ta.addEventListener('input', function () { grow(); sendBtn.disabled = !ta.value.trim() || blocked; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    sendBtn.addEventListener('click', submit);
    list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.dataset.copy) { copyLink(b.dataset.copy); }
      else if (b.dataset.retry) { retry(b.dataset.retry); }
      else if (b.dataset.drop) { dropMessage(b.dataset.drop); }
      else if (b.dataset.ho) { handoff(b.dataset.ho); }
      else if (b.dataset.cc) { copyLink(code, null, t.ccCopied); }
      else if (b.dataset.rs === 'open') { rsOpen = true; rsErr = null; renderAll(); focusRs(); }
      else if (b.dataset.rs === 'go') { resumeByCode(); }
    });
    list.addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp || !inp.classList || !inp.classList.contains('ri')) return;
      var v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      rsVal = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
      if (inp.value !== rsVal) inp.value = rsVal;
    });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('ri')) { e.preventDefault(); resumeByCode(); }
    });
    var form = profileEl.querySelector('form');
    var emailIn = form.email, notifyIn = form.notify;
    emailIn.addEventListener('input', function () {
      var has = !!emailIn.value.trim();
      notifyIn.disabled = !has; notifyIn.parentNode.classList.toggle('off', !has);
      if (has && !emailIn.dataset.touched) { notifyIn.checked = true; emailIn.dataset.touched = '1'; }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); saveProfile(form); });
    form.querySelector('.ml').addEventListener('click', mailLink);
    // Ruhestopp: jede Interaktion im Widget zählt (kein `scroll`: das feuert auch bei programmatischem scrollBottom);
    // Tab versteckt → alles anhalten (laufenden Long-Poll abbrechen); sichtbar/Fokus → weiter
    var evs = ['pointerdown', 'touchstart', 'keydown', 'input', 'wheel'];
    for (var i = 0; i < evs.length; i++) root.addEventListener(evs[i], interact, { passive: true, capture: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopPoll(); else wake(); });
    window.addEventListener('focus', function () { touch(); if (paused) wake(); });

    renderAll();
    setTimeout(function () { btn.classList.add('in'); }, REDUCED ? 0 : 1500);
  }

  function grow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 132) + 'px';
  }

  function open() {
    if (isOpen) return; isOpen = true;
    win.classList.add('show'); btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', t.close);
    requestAnimationFrame(function () { requestAnimationFrame(function () { win.classList.add('in'); }); });
    scrollBottom(true);
    setTimeout(function () { if (!blocked && window.innerWidth >= 640) ta.focus(); else win.focus(); }, REDUCED ? 0 : 80);
    markRead();
    wake(); // Öffnen = sofort eine Anfrage, dann Long-Poll-Schleife
  }
  function close() {
    if (!isOpen) return; isOpen = false;
    win.classList.remove('in'); btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', t.open);
    setTimeout(function () { if (!isOpen) win.classList.remove('show'); }, REDUCED ? 0 : 220);
    btn.focus();
    stopPoll(); touch(); schedulePoll(); // Long-Poll abbrechen, geschlossen weiter mit 20 s
  }
  function scrollBottom(instant) {
    if (instant) list.style.scrollBehavior = 'auto';
    list.scrollTop = list.scrollHeight;
    if (instant) setTimeout(function () { list.style.scrollBehavior = ''; }, 50);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }
  function copyLink(url, fail, msg) {
    var done = function () { toast(msg || t.copied); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url) ? done() : fail && fail(); });
    else { fallbackCopy(url) ? done() : fail && fail(); }
  }
  function fallbackCopy(txt) {
    var el = document.createElement('textarea'), ok = false; el.value = txt; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
    root.appendChild(el); el.select(); try { ok = document.execCommand('copy'); } catch (e) {} root.removeChild(el);
    return ok;
  }

  // ── Darstellung ────────────────────────────────────────────────────────────
  function unreadCount() {
    var n = 0;
    for (var i = 0; i < messages.length; i++) if (messages[i].sender === 'owner' && !messages[i].readAt) n++;
    return n;
  }
  function renderBadge() {
    var n = unreadCount();
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.classList.toggle('on', n > 0 && !isOpen);
    root.getElementById('sr').textContent = n > 0 ? n + ' ' + t.unread : '';
  }
  function renderStatus() {
    var on = !paused && ownerSeen && (Date.now() - new Date(ownerSeen).getTime()) < 90000;
    statusEl.classList.toggle('on', !!on);
  }
  function ticks(m) {
    if (m.state === 'sending') return '<span class="tk" title="' + t.sending + '">' + ICON.clock + '</span>';
    if (m.state === 'failed') return '<span class="tk" title="' + t.failed + '">' + ICON.warn + '</span>';
    if (m.readAt) return '<span class="tk rd" title="' + t.read + '">' + ICON.tick2 + '</span>';
    return '<span class="tk sn" title="' + t.sent + '">' + ICON.tick + '</span>';
  }
  function near(a, b) { return a && b && a.sender === b.sender && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < 120000; }
  function bubble(m, same, tail) {
    var me = m.sender === 'visitor';
    var h = '<div class="m ' + (me ? 'me' : 'them') + (same ? ' same' : '') + (tail ? ' tl' : '') + '" data-id="' + esc(m.id || m.clientId) + '"><div class="bb">' +
      linkify(m.body) + '<span class="mt">' + fmtTime(m.createdAt) + (me ? ticks(m) : '') + '</span></div></div>';
    if (me && m.state === 'failed') {
      h += '<div class="err">' + ICON.warn + ' ' + (m.errorText || t.failed) + (m.retryable
        ? ' · <button type="button" data-retry="' + esc(m.clientId) + '">' + t.retry + '</button>'
        : ' · <button type="button" data-drop="' + esc(m.clientId) + '" aria-label="OK">OK</button>') + '</div>';
    }
    return h;
  }
  function waButton(mid) {
    if (!cfg.whatsappUrl) return '';
    return '<div class="war' + (mid ? ' mid' : '') + '"><a class="wab" href="' + esc(cfg.whatsappUrl) + '" target="_blank" rel="noopener noreferrer">' + ICON.wa + '<span>' + t.wa + '</span></a></div>';
  }
  function hoDismissed() {
    if (hoGone) return true;
    try { return localStorage.getItem(HO_KEY) === convId; } catch (e) { return false; }
  }
  /** Hinweiskarte im In-App-Browser: Gespräch in Safari/Browser übernehmen (Konzept „Übergabe“) */
  function handoffCard() {
    if (!IAB || !convId || blocked || hoDismissed()) return '';
    var h = '<div class="ho" role="note"><button type="button" class="hx" data-ho="x" aria-label="' + t.dismiss + '">' + ICON.close + '</button>' +
      '<b>' + esc(t.hoTitle.replace('{app}', appName())) + '</b>' + esc(t.hoText.replace('{browser}', IOS ? 'Safari' : t.hoBrowser)) +
      '<div class="hb"><button type="button" class="pb" data-ho="open"' + (hoBusy ? ' disabled' : '') + '>' + (IOS ? t.hoOpenIos : t.hoOpen) + '</button>' +
      '<button type="button" class="sec" data-ho="copy"' + (hoBusy ? ' disabled' : '') + '>' + t.copy + '</button></div>';
    if (hoUrl) h += '<div class="fb"><input readonly value="' + esc(hoUrl) + '" aria-label="Link"><p>' + esc(IOS ? t.hoMenuIos : t.hoMenu) + '</p></div>';
    return h + '</div>';
  }
  /** Karte „Dein Gesprächs-Code“ (mit Gespräch, ganz oben) */
  function codeCard() {
    if (!convId || !code) return '';
    return '<div class="cc" role="note"><b>' + t.ccTitle + '</b><div class="cv"><span class="cd" aria-label="' + t.ccTitle + '">' + esc(code) + '</span>' +
      '<button type="button" class="sec" data-cc="copy">' + ICON.copy + ' ' + t.ccCopy + '</button></div><p>' + esc(t.ccText) + '</p></div>';
  }
  /** „Schon ein Gespräch begonnen? Mit Code fortsetzen“ (ohne Gespräch, unter der Begrüßung) */
  function resumeCard() {
    if (convId) return '';
    var h = '<div class="rs">' + esc(t.rsQ) + ' ';
    if (!rsOpen) return h + '<button type="button" class="lk2" data-rs="open">' + t.rsLink + '</button></div>';
    h += '<div class="rf"><input class="ri" value="' + esc(rsVal) + '" placeholder="' + t.rsPh + '" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="' + t.rsPh + '"' + (rsBusy ? ' disabled' : '') + '>' +
      '<button type="button" class="pb" data-rs="go"' + (rsBusy ? ' disabled' : '') + '>' + t.rsGo + '</button></div>';
    if (rsErr) h += '<div class="re" role="alert">' + esc(rsErr) + '</div>';
    return h + '</div>';
  }
  function focusRs() {
    var inp = list.querySelector('.ri');
    if (inp) { try { inp.focus(); } catch (e) {} }
  }
  function renderAll() {
    var h = '';
    if (blocked) {
      h = '<div class="blk">' + esc(t.blocked) + '</div>' + waButton(true);
    } else {
      // Mit Gespräch: Karte „Dein Gesprächs-Code“ ganz oben; davor ehrlicher Hinweis (dieser Browser, Code kommt, Wichtiges per WhatsApp/Kontaktformular).
      // Dann Begrüßung ohne Zeitstempel, WhatsApp-Knopf (falls vorhanden), ohne Gespräch „Mit Code fortsetzen“.
      h += codeCard() || '<div class="sys note">' + esc(t.notice.replace('{via}', cfg.whatsappUrl ? t.viaWa : t.viaForm)) + '</div>';
      if (cfg.welcome) h += '<div class="m them tl"><div class="bb">' + linkify(cfg.welcome) + '</div></div>';
      h += waButton() + resumeCard();
      var lastDay = null, prev = null;
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.sender === 'system') { h += '<div class="sys">' + esc(m.body) + '</div>'; prev = null; continue; }
        var dk = dayKey(m.createdAt);
        if (dk !== lastDay) { h += '<div class="day">' + esc(dayLabel(m.createdAt)) + '</div>'; lastDay = dk; prev = null; }
        var next = messages[i + 1];
        h += bubble(m, near(prev, m), !(next && next.sender !== 'system' && near(m, next) && dayKey(next.createdAt) === dk));
        prev = m;
      }
      h += handoffCard();
    }
    list.innerHTML = h;
    if (paused && pauseEl) list.appendChild(pauseEl);
    renderBadge(); renderStatus();
    var hasConv = !!convId;
    hintEl.hidden = hasConv || blocked;
    profileEl.hidden = !hasConv || blocked;
    root.querySelector('.ft').hidden = blocked;
    if (isOpen) scrollBottom();
  }
  function fillProfile() {
    var f = profileEl.querySelector('form');
    f.name.value = visitor.name || ''; f.email.value = visitor.email || ''; f.phone.value = visitor.phone || '';
    var has = !!(visitor.email || '').trim();
    f.notify.disabled = !has; f.notify.parentNode.classList.toggle('off', !has);
    f.notify.checked = has && !!visitor.notifyByEmail;
    if (has) f.email.dataset.touched = '1';
    f.querySelector('.ml').hidden = !has || !convId;
  }

  // ── Daten ──────────────────────────────────────────────────────────────────
  function applySession(j) {
    sessionDone = true;
    if (typeof j.ticket === 'string' && j.ticket) ticket = j.ticket;
    if (j.conversationId) convId = j.conversationId;
    if (j.visitorToken) { token = j.visitorToken; }
    if (j.status) status = j.status;
    if (j.visitor) { visitor = j.visitor; }
    if (Array.isArray(j.messages)) messages = j.messages.map(function (m) { m.state = 'sent'; return m; });
    if (j.ownerLastSeenAt !== undefined) ownerSeen = j.ownerLastSeenAt;
    if (typeof j.resumeCode === 'string') code = j.resumeCode;
    applyOwnerRead(j.ownerReadAt);
    if (status === 'blocked') blocked = true;
  }
  /** ownerReadAt vom Server: eigene Nachrichten bis zu diesem Zeitpunkt gelten als gelesen (✓✓). Fehlt das Feld, bleibt die Heuristik in mergeNew. */
  function applyOwnerRead(iso) {
    if (iso === undefined) return;
    ownerRead = iso || null;
    if (!ownerRead) return;
    var changed = false;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.sender === 'visitor' && m.state === 'sent' && !m.readAt && m.createdAt <= ownerRead) { m.readAt = ownerRead; changed = true; }
    }
    return changed;
  }
  function lastId() {
    for (var i = messages.length - 1; i >= 0; i--) if (messages[i].id && messages[i].state === 'sent') return messages[i].id;
    return null;
  }
  function mergeNew(arr) {
    var added = 0, ownerNew = 0;
    for (var i = 0; i < arr.length; i++) {
      var m = arr[i], found = false;
      for (var k = 0; k < messages.length; k++) {
        if ((m.id && messages[k].id === m.id) || (m.clientId && messages[k].clientId === m.clientId && messages[k].sender === m.sender)) {
          messages[k] = m; messages[k].state = 'sent'; found = true; break;
        }
      }
      if (!found) {
        m.state = 'sent'; messages.push(m); added++;
        if (m.sender === 'owner') {
          ownerNew++;
          // Antwort des Betreibers ⇒ frühere eigene Nachrichten gelten als gelesen (✓✓)
          for (var j = 0; j < messages.length - 1; j++) if (messages[j].sender === 'visitor' && !messages[j].readAt && messages[j].createdAt <= m.createdAt) messages[j].readAt = m.createdAt;
        }
      }
    }
    return { added: added, ownerNew: ownerNew };
  }
  // ── Polling ────────────────────────────────────────────────────────────────
  // Offen: Long-Poll-Schleife `GET messages?after=&wait=25` (Server antwortet sofort bei Neuem, sonst nach ≤ 25 s),
  //   300 ms Pause zwischen den Anfragen; kommt die Antwort trotz wait in < 1 s (alter Server/Proxy) → 3 s Abstand.
  // Geschlossen mit Gespräch: 20 s, nach 10 min 60 s (ohne wait). Fehler: 5 → 10 → 20 → 30 s.
  // Ruhestopp: 15 min (offen) / 30 min (geschlossen) ohne Interaktion → keine Anfragen mehr, Hinweis im Verlauf.
  // Nur eine Anfrage gleichzeitig (polling); stopPoll() bricht sie ab (AbortController) und entwertet die Antwort (pollGen).
  function pollDelay() { return Date.now() - lastActivity > 600000 ? 60000 : 20000; }
  function idleLimit() {
    var h = window.__fsChatIdleMs; // Test-Hook: nur wirksam, wenn gesetzt
    if (typeof h === 'number' && h > 0) return isOpen ? h : h * 2;
    return isOpen ? IDLE_OPEN : IDLE_CLOSED;
  }
  function backoff() { return Math.min(30000, 5000 * Math.pow(2, Math.min(pollFails, 4) - 1)); }
  function schedulePoll(ms) {
    clearTimeout(pollTimer); pollTimer = null;
    if (!mounted || blocked || paused) return;
    if (!isOpen && !convId) return;
    if (ms === undefined) ms = pollDelay();
    pollTimer = setTimeout(poll, ms);
  }
  function stopPoll() {
    clearTimeout(pollTimer); pollTimer = null;
    pollGen++; polling = false; pollAgain = false;
    if (pollCtl) { try { pollCtl.abort(); } catch (e) {} pollCtl = null; }
  }
  function touch() { lastActivity = Date.now(); armIdle(); }
  function interact() { touch(); if (paused) wake(); }
  function armIdle() {
    clearTimeout(idleTimer); idleTimer = null;
    if (!mounted || paused || blocked) return;
    idleTimer = setTimeout(checkIdle, Math.max(50, idleLimit() - (Date.now() - lastActivity) + 50));
  }
  function checkIdle() {
    idleTimer = null;
    if (paused || !convId) return;
    if (Date.now() - lastActivity >= idleLimit()) pause(); else armIdle();
  }
  /** Ruhestopp: keine Anfragen mehr, Status wie offline, grauer Hinweis ganz unten im Verlauf */
  function pause() {
    if (paused) return; paused = true;
    stopPoll(); clearTimeout(idleTimer); idleTimer = null;
    if (!pauseEl) { pauseEl = document.createElement('div'); pauseEl.className = 'sys pause'; pauseEl.setAttribute('role', 'status'); pauseEl.textContent = t.paused; }
    list.appendChild(pauseEl);
    renderStatus();
    if (isOpen) scrollBottom();
  }
  /** Wiederaufnahme (Interaktion, Öffnen, sichtbar, Fokus): Hinweis weg, sofort eine Anfrage */
  function wake() {
    if (paused) { paused = false; if (pauseEl && pauseEl.parentNode) pauseEl.parentNode.removeChild(pauseEl); renderStatus(); }
    touch(); stopPoll(); schedulePoll(0);
  }
  function poll() {
    clearTimeout(pollTimer); pollTimer = null;
    if (!mounted || blocked || paused || document.hidden || !convId || !token) return;
    if (Date.now() - lastActivity >= idleLimit()) { pause(); return; }
    if (polling) { pollAgain = true; return; }
    var wait = isOpen ? LONG_WAIT : 0, after = lastId(), gen = pollGen, t0 = Date.now();
    var q = after ? '?after=' + encodeURIComponent(after) : '';
    if (wait) q += (q ? '&' : '?') + 'wait=' + wait;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    pollCtl = ctl; polling = true;
    api('messages', { query: q, signal: ctl && ctl.signal }).then(function (r) {
      if (gen !== pollGen) return; // abgebrochen/veraltet
      polling = false; pollCtl = null;
      var again = pollAgain; pollAgain = false;
      if (r.ok) {
        pollFails = 0;
        if (r.json.status) { status = r.json.status; if (status === 'blocked') { setBlocked(); return; } }
        if (r.json.ownerLastSeenAt !== undefined) ownerSeen = r.json.ownerLastSeenAt;
        var res = mergeNew(r.json.messages || []);
        var readChanged = applyOwnerRead(r.json.ownerReadAt);
        if (res.ownerNew) touch();
        if (res.added || readChanged) renderAll(); else { renderStatus(); renderBadge(); }
        if (res.ownerNew && isOpen && !document.hidden) markRead();
        // Schnelle Antwort ohne Änderung trotz wait (Server/Proxy kennt kein wait) → 3 s statt 300 ms, kein Dauerfeuer
        var fast = wait && Date.now() - t0 < 1000 && !res.added && !readChanged;
        schedulePoll(again ? 0 : isOpen ? (fast ? 3000 : 300) : undefined);
        return;
      }
      pollFails++;
      schedulePoll(Math.max(backoff(), isOpen ? 0 : pollDelay()));
    }, function () {
      if (gen !== pollGen) return;
      polling = false; pollCtl = null; pollAgain = false; pollFails++;
      schedulePoll(Math.max(backoff(), isOpen ? 0 : pollDelay()));
    });
  }
  function markRead() {
    if (!convId || !token || !unreadCount()) { renderBadge(); return; }
    apiT('read', { method: 'POST', body: {} }).then(function (r) {
      if (!r.ok) return;
      var now = new Date().toISOString();
      for (var i = 0; i < messages.length; i++) if (messages[i].sender === 'owner' && !messages[i].readAt) messages[i].readAt = now;
      renderBadge();
    }, function () {});
  }
  function setBlocked() {
    if (blocked) return; blocked = true; stopPoll(); clearTimeout(idleTimer);
    if (mounted) renderAll();
  }

  function submit() {
    var text = ta.value.trim();
    if (!text || blocked) return;
    ta.value = ''; grow(); sendBtn.disabled = true;
    var m = { clientId: 'c' + rnd(8), sender: 'visitor', body: text, createdAt: new Date().toISOString(), readAt: null, state: 'sending' };
    messages.push(m); renderAll(); scrollBottom();
    send(m);
    if (window.innerWidth >= 640) ta.focus();
  }
  function send(m) {
    if (!token) token = rnd(32);
    // Vor der ersten Nachricht holt apiT einmal `session` (Ticket); hp = Honeypot, wd = Automations-Signal
    apiT('messages', { method: 'POST', body: { body: m.body, clientId: m.clientId, pageUrl: location.href, hp: hp(), wd: !!navigator.webdriver } }).then(function (r) {
      if (r.ok && r.json.message) {
        if (!tokenStored) storeToken(token);
        var first = !convId;
        if (r.json.conversationId) convId = r.json.conversationId;
        else if (r.json.message.conversationId) convId = r.json.message.conversationId;
        if (typeof r.json.resumeCode === 'string') code = r.json.resumeCode;
        mergeNew([r.json.message]);
        renderAll();
        if (first) { fillProfile(); profileEl.open = true; }
        touch();
        // laufende Long-Poll-Anfrage nicht abbrechen (Antwort kam über den POST); lastId() gilt beim nächsten Durchlauf
        if (!polling) schedulePoll(isOpen ? 300 : undefined);
        return;
      }
      if (r.status === 403 && r.json.error === 'BLOCKED') return;
      m.state = 'failed';
      if (r.status === 422) { m.errorText = t.rejected; m.retryable = false; }
      else if (r.status === 429) { m.errorText = t.wait; m.retryable = true; }
      else { m.errorText = t.failed; m.retryable = true; }
      renderAll();
    }, function () {
      m.state = 'failed'; m.errorText = t.offline; m.retryable = true; renderAll();
    });
  }
  function retry(clientId) {
    for (var i = 0; i < messages.length; i++) if (messages[i].clientId === clientId) {
      messages[i].state = 'sending'; messages[i].errorText = null; renderAll(); send(messages[i]); return;
    }
  }
  function dropMessage(clientId) {
    messages = messages.filter(function (m) { return m.clientId !== clientId; }); renderAll();
  }
  function saveProfile(form) {
    var body = {
      name: form.name.value.trim() || null, email: form.email.value.trim() || null,
      phone: form.phone.value.trim() || null, notifyByEmail: !!(form.email.value.trim() && form.notify.checked), hp: hp()
    };
    apiT('profile', { method: 'POST', body: body }).then(function (r) {
      if (!r.ok) return;
      if (r.json.visitor) visitor = r.json.visitor;
      form.querySelector('.ml').hidden = !(visitor.email || '').trim();
      var ok = form.querySelector('.ok'); ok.hidden = false;
      setTimeout(function () { ok.hidden = true; profileEl.open = false; }, 1200);
    }, function () {});
  }

  // ── Gespräch per Code fortsetzen (`POST resume`): dieser Browser kommt als weiterer Zugang dazu ──
  function resumeByCode() {
    var v = rsVal.replace('-', '');
    if (rsBusy) return;
    if (v.length !== 8) { rsErr = t.rsBad; renderAll(); focusRs(); return; }
    rsBusy = true; rsErr = null; renderAll();
    if (!token) token = rnd(32);
    apiT('resume', { method: 'POST', body: { code: v, visitorToken: token } }).then(function (r) {
      rsBusy = false;
      if (r.ok && r.json.conversationId) {
        applySession(r.json); storeToken(token);
        rsOpen = false; rsVal = '';
        renderAll(); fillProfile(); toast(t.rsDone); wake();
        return;
      }
      if (r.status === 403 && r.json.error === 'BLOCKED') return;
      rsErr = r.status === 404 ? t.rsBad : r.status === 410 ? t.rsOld : r.status === 429 ? t.rsMany : t.failed;
      renderAll(); focusRs();
    }, function () { rsBusy = false; rsErr = t.offline; renderAll(); });
  }

  // ── Übergabe (In-App-Browser → Safari/Browser, Desktop → Handy per Mail) ───
  /** Holt einen frischen Einmal-Link (`?fs_chat=<token>`) für diese Seite; null bei Fehler. */
  function handoffLink() {
    if (!convId || !token) return Promise.resolve(null);
    return apiT('handoff', { method: 'POST', body: { via: 'link', pageUrl: location.href } }).then(function (r) {
      return r.ok && typeof r.json.url === 'string' && r.json.url.indexOf(location.origin + '/') === 0 ? r.json.url : null; // nur same-origin
    }, function () { return null; });
  }
  function handoff(action) {
    if (action === 'x') {
      hoGone = true;
      try { localStorage.setItem(HO_KEY, convId); } catch (e) {}
      renderAll(); return;
    }
    if (hoBusy) return;
    hoBusy = true; renderAll();
    handoffLink().then(function (url) {
      hoBusy = false;
      if (!url) { renderAll(); toast(t.hoFail); return; }
      if (action === 'copy') {
        copyLink(url, function () { hoUrl = url; renderAll(); selectHoLink(); });
        renderAll(); return;
      }
      // Jeder Klick holt einen frischen Link; der Link wird nur hier (nach Klick) in die URL geschrieben,
      // damit auch der ⋯-Menüpunkt „In Safari öffnen“ des In-App-Browsers den Token mitnimmt.
      if (IOS) {
        try { history.replaceState(null, '', url); } catch (e) {}
        try { window.open('x-safari-' + url, '_blank'); } catch (e) {}
      } else if (ANDROID) {
        try { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;end'; } catch (e) {}
      } else {
        try { window.open(url, '_blank', 'noopener'); } catch (e) {}
      }
      renderAll();
      setTimeout(function () {
        if (document.visibilityState === 'visible') { hoUrl = url; renderAll(); }
      }, 1200);
    });
  }
  function selectHoLink() {
    var inp = list.querySelector('.fb input');
    if (inp) { try { inp.focus(); inp.select(); } catch (e) {} }
  }
  function mailLink() {
    var b = profileEl.querySelector('.ml');
    if (b.disabled) return;
    b.disabled = true;
    apiT('handoff', { method: 'POST', body: { via: 'email' } }).then(function (r) {
      b.disabled = false;
      if (r.ok) { toast(t.mailSent); profileEl.open = false; }
      else if (r.status === 429) toast(t.later);
      else if (r.status === 400) toast(t.email + '?');
      else toast(t.failed);
    }, function () { b.disabled = false; toast(t.offline); });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  function start() {
    if (started) return; started = true;
    var q = location.search.match(/[?&]fs_chat=([^&]+)/);
    var resume = q ? decodeURIComponent(q[1]) : null;
    var unsub = /[?&]unsubscribe=1(?:&|$)/.test(location.search);
    api('config').then(function (r) {
      if (!r.ok || !r.json.enabled) return;
      cfg = r.json;
      token = readToken(); tokenStored = !!token;
      var mountNow = function (openAfter) {
        mount();
        if (openAfter) setTimeout(open, REDUCED ? 0 : 300);
        touch(); schedulePoll();
      };
      if (!token && !resume) { mountNow(false); return; }
      if (resume && !token) token = rnd(32);
      var body = { visitorToken: token, pageUrl: location.href };
      if (resume) body.resumeToken = resume;
      api('session', { method: 'POST', body: body }).then(function (s) {
        if (s.ok && s.json.enabled !== false) {
          applySession(s.json);
          if (resume && convId) {
            storeToken(token);
            try { var u = new URL(location.href); u.searchParams.delete('fs_chat'); u.searchParams.delete('unsubscribe'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
          }
        } else if (s.status === 404 || (s.json && s.json.enabled === false)) { return; }
        mountNow(!!(resume && convId));
        fillProfile();
        if (unsub && resume && convId) {
          apiT('profile', { method: 'POST', body: { notifyByEmail: false, hp: hp() } }).then(function (p) {
            if (p.ok) { visitor.notifyByEmail = false; fillProfile(); messages.push({ sender: 'system', body: t.unsub, createdAt: new Date().toISOString() }); renderAll(); }
          }, function () {});
        }
      }, function () { mountNow(false); });
    }, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
