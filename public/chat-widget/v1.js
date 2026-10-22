/*! FinestSites Besucher-Chat v1 — docs/chat/konzept.md. Vanilla JS (ES2018), Shadow DOM, kein externes Laden. */
(function () {
  'use strict';
  if (window.__fsChat) return;
  window.__fsChat = true;

  var API = '/.finestsites/chat/';
  var TOKEN_KEY = 'fs_chat_token';
  var EN = /^en/i.test(document.documentElement.lang || '');
  var LANG = EN ? 'en' : 'de';
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var T = {
    de: {
      open: 'Chat öffnen', close: 'Chat schließen', online: 'online', fast: 'Antwortet meist schnell',
      wa: 'Schreib mir direkt in WhatsApp', placeholder: 'Nachricht schreiben …', send: 'Senden',
      hint: 'Mit dem Senden wird dein Chat auf dieser Seite gespeichert.', privacy: 'Datenschutz',
      today: 'Heute', yesterday: 'Gestern', failed: 'Nicht gesendet', retry: 'Erneut senden',
      rejected: 'Diese Nachricht kann nicht gesendet werden.', wait: 'Bitte kurz warten.',
      blocked: 'Dieser Chat ist nicht verfügbar.', copied: 'Link kopiert', copy: 'Link kopieren',
      profile: 'Damit ich dich erreiche (optional)', name: 'Name', email: 'E-Mail', phone: 'Telefon / WhatsApp',
      notify: 'Antworten per E-Mail erhalten', save: 'Speichern', saved: 'Gespeichert',
      unsub: 'Du bekommst keine E-Mails mehr zu diesem Chat.', offline: 'Keine Verbindung.',
      sent: 'Gesendet', read: 'Gelesen', sending: 'Wird gesendet', unread: 'ungelesene Nachrichten', you: 'Du'
    },
    en: {
      open: 'Open chat', close: 'Close chat', online: 'online', fast: 'Usually replies quickly',
      wa: 'Message me directly on WhatsApp', placeholder: 'Write a message …', send: 'Send',
      hint: 'By sending, your chat is stored on this site.', privacy: 'Privacy',
      today: 'Today', yesterday: 'Yesterday', failed: 'Not sent', retry: 'Send again',
      rejected: 'This message cannot be sent.', wait: 'Please wait a moment.',
      blocked: 'This chat is not available.', copied: 'Link copied', copy: 'Copy link',
      profile: 'So I can reach you (optional)', name: 'Name', email: 'E-mail', phone: 'Phone / WhatsApp',
      notify: 'Receive replies by e-mail', save: 'Save', saved: 'Saved',
      unsub: 'You will no longer receive e-mails about this chat.', offline: 'No connection.',
      sent: 'Sent', read: 'Read', sending: 'Sending', unread: 'unread messages', you: 'You'
    }
  };
  var t = T[LANG];

  // ── Zustand ────────────────────────────────────────────────────────────────
  var cfg = null, token = null, tokenStored = false, convId = null, status = 'open';
  var visitor = { name: null, email: null, phone: null, notifyByEmail: false };
  var messages = [];          // {id, sender, body, createdAt, readAt, clientId, state}
  var ownerSeen = null;       // ISO
  var isOpen = false, pollTimer = null, started = false, blocked = false, mounted = false;
  var root, host, btn, badge, win, list, ta, sendBtn, hintEl, profileEl, statusEl, toastEl, errEl;

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
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function shade(rgb, f) { // f<0 dunkler, f>0 heller
    return 'rgb(' + rgb.map(function (v) { return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); }).join(',') + ')';
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
    var init = { method: opts.method || 'GET', headers: h, credentials: 'same-origin' };
    if (opts.body !== undefined) { h['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(API + name + (opts.query || ''), init).then(function (r) {
      return r.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (r.status === 403 && j && j.error === 'BLOCKED') { setBlocked(); }
        return { ok: r.ok, status: r.status, json: j || {} };
      });
    });
  }

  // ── Symbole ────────────────────────────────────────────────────────────────
  var ICON = {
    chat: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.9-.9L3 20l1.3-4.1A8 8 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.4-7.5c.8-.4.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.3-1.3 1l1.6 6.2 9.3 1.2-9.3 1.2-1.6 6.2c-.1.7.6 1.3 1.3 1z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6l.5-.5.3-.5v-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5h-.4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    tick: '<svg viewBox="0 0 16 12" width="16" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2"/></svg>',
    tick2: '<svg viewBox="0 0 20 12" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2M8 9.2l1.2 1.2L15.5 3.2"/></svg>',
    clock: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.3 1.4"/></svg>',
    warn: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/></svg>'
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  function css(brand, brandText, brandDark, brandSoft) {
    return ':host{all:initial;position:fixed;inset:auto 0 0 auto;z-index:2147483000;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;-webkit-font-smoothing:antialiased;--b:' + brand + ';--bt:' + brandText + ';--bd:' + brandDark + ';--bs:' + brandSoft + ';--wa:#128C7E;--wad:#075E54}' +
    '*,*::before,*::after{box-sizing:border-box}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;background:none;border:0;padding:0;margin:0}' +
    'a{color:inherit}' +
    '.fab{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.22),0 1px 3px rgba(0,0,0,.14);opacity:0;transform:scale(.6);transition:transform .35s cubic-bezier(.2,.9,.3,1.3),opacity .3s,box-shadow .2s}' +
    '.fab.in{opacity:1;transform:scale(1)}.fab:hover{box-shadow:0 10px 26px rgba(0,0,0,.26),0 2px 5px rgba(0,0,0,.16)}.fab:active{transform:scale(.95)}.fab:focus-visible,.x:focus-visible,.sb:focus-visible,.wab:focus-visible{outline:3px solid rgba(0,0,0,.35);outline-offset:3px}' +
    '.fab .i{display:flex;transition:transform .25s,opacity .2s}.fab.open .i.c0{transform:rotate(90deg) scale(.4);opacity:0;position:absolute}.fab .i.c1{position:absolute;transform:rotate(-90deg) scale(.4);opacity:0}.fab.open .i.c1{transform:none;opacity:1;position:static}' +
    '.badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#E53935;color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center;border:2px solid #fff;display:none}.badge.on{display:block}' +
    '.win{position:fixed;inset:0;background:#fff;display:none;flex-direction:column;overflow:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);opacity:0;transform:translateY(24px);transition:opacity .25s,transform .3s cubic-bezier(.2,.8,.3,1)}' +
    '.win.show{display:flex}.win.in{opacity:1;transform:none}' +
    '@media(min-width:640px){.win{inset:auto max(20px,env(safe-area-inset-right)) max(88px,calc(env(safe-area-inset-bottom) + 88px)) auto;width:380px;height:620px;max-height:calc(100vh - 110px);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.26),0 2px 8px rgba(0,0,0,.1);padding:0}}' +
    '.hd{display:flex;align-items:center;gap:12px;padding:14px 14px 12px 18px;background:var(--b);color:var(--bt);flex:none}' +
    '.av{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;overflow:hidden;flex:none;letter-spacing:.02em}.av img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.who{flex:1;min-width:0}.nm{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st{font-size:13px;opacity:.85;display:flex;align-items:center;gap:6px;margin-top:1px}.st .dot{width:8px;height:8px;border-radius:50%;background:#4ADE80;box-shadow:0 0 0 2px rgba(255,255,255,.35);display:none}.st.on .dot{display:block}' +
    '.x{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--bt);opacity:.9}.x:hover{background:rgba(255,255,255,.18)}' +
    '.list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 8px;background:#EFEAE2;background-image:radial-gradient(rgba(0,0,0,.035) 1px,transparent 1px);background-size:14px 14px;scroll-behavior:smooth}' +
    '@media(prefers-reduced-motion:reduce){.list{scroll-behavior:auto}.fab,.win,.m,.fab .i{transition:none!important}}' +
    '.day{display:flex;justify-content:center;margin:6px 0 12px}.day span{font-size:12px;font-weight:500;color:#54656F;background:#fff;border-radius:8px;padding:5px 10px;box-shadow:0 1px 1px rgba(0,0,0,.08)}' +
    '.m{display:flex;margin:0 0 6px;animation:up .22s ease-out both}@keyframes up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.m.me{justify-content:flex-end}.m+.m.same{margin-top:-2px}' +
    '.bb{max-width:78%;padding:8px 10px 6px 12px;border-radius:18px;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.08);font-size:16px;line-height:1.38;word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap;position:relative}' +
    '.m.them .bb{border-top-left-radius:6px}.m.me .bb{background:var(--b);color:var(--bt);border-top-right-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.14)}' +
    '.mt{display:inline-flex;align-items:center;gap:4px;float:right;margin:6px 0 0 10px;font-size:11.5px;line-height:1;opacity:.7;position:relative;top:2px}.m.me .mt{opacity:.8}.mt .tk{display:inline-flex}.mt .tk.rd{opacity:1}.mt .tk.sn{opacity:.6}' +
    '.lk a{text-decoration:underline;text-underline-offset:2px;word-break:break-all}.cp{display:inline-flex;vertical-align:-2px;margin-left:5px;padding:2px;border-radius:5px;opacity:.65}.cp:hover{opacity:1;background:rgba(0,0,0,.08)}.m.me .cp:hover{background:rgba(255,255,255,.2)}' +
    '.err{clear:both;display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:12.5px;color:#B3261E;margin:-2px 2px 8px}.err button{text-decoration:underline;font-weight:600;color:#B3261E}' +
    '.sys{display:flex;justify-content:center;margin:4px 0 12px}.sys span{font-size:13px;color:#54656F;background:#FDF5D7;border-radius:10px;padding:8px 12px;max-width:88%;text-align:center;box-shadow:0 1px 1px rgba(0,0,0,.08)}' +
    '.war{display:flex;margin:2px 0 12px}.war.mid{justify-content:center}.wab{display:inline-flex;align-items:center;gap:9px;padding:11px 16px 11px 14px;border-radius:14px;background:var(--wa);color:#fff;font-weight:600;font-size:15px;text-decoration:none;box-shadow:0 2px 6px rgba(7,94,84,.25);transition:background .15s,transform .15s}.wab:hover{background:var(--wad)}.wab:active{transform:scale(.98)}' +
    '.blk{text-align:center;padding:28px 20px;color:#54656F;font-size:15px}' +
    '.ft{flex:none;background:#F7F7F8;border-top:1px solid #E6E6E9}' +
    '.pf{border-bottom:1px solid #E6E6E9;background:#fff}.pf summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:11px 16px;font-size:14px;font-weight:600;color:#333;cursor:pointer;user-select:none}.pf summary::-webkit-details-marker{display:none}.pf summary .ar{transition:transform .2s;display:flex;color:#777}.pf[open] summary .ar{transform:rotate(180deg)}' +
    '.pf .fm{padding:0 16px 14px;display:grid;gap:9px}.pf input{width:100%;height:42px;border:1px solid #D6D6DB;border-radius:11px;padding:0 12px;font-size:15px;background:#fff}.pf input:focus{outline:none;border-color:var(--b);box-shadow:0 0 0 3px var(--bs)}' +
    '.pf label.sw{display:flex;align-items:center;gap:10px;font-size:14px;color:#333;margin:2px 0}.pf label.sw.off{opacity:.5}.pf input[type=checkbox]{appearance:none;-webkit-appearance:none;width:42px;height:26px;border-radius:13px;background:#C9CBD1;position:relative;flex:none;border:0;padding:0;transition:background .2s}.pf input[type=checkbox]::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}.pf input[type=checkbox]:checked{background:var(--b)}.pf input[type=checkbox]:checked::after{transform:translateX(16px)}' +
    '.pf .row{display:flex;align-items:center;gap:12px}.pf .sv{height:40px;padding:0 18px;border-radius:11px;background:var(--b);color:var(--bt);font-weight:600;font-size:14px}.pf .ok{font-size:13px;color:#1B8F5A;font-weight:500}' +
    '.cmp{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 10px 14px}' +
    '.ta{flex:1;min-height:44px;max-height:132px;resize:none;border:1px solid #D6D6DB;border-radius:22px;padding:11px 16px;font-size:16px;line-height:22px;background:#fff;overflow-y:auto;outline:none;transition:border-color .15s,box-shadow .15s}.ta:focus{border-color:var(--b);box-shadow:0 0 0 3px var(--bs)}' +
    '.sb{width:44px;height:44px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;flex:none;transition:transform .15s,opacity .15s}.sb:disabled{opacity:.45;cursor:default}.sb:not(:disabled):hover{transform:scale(1.06)}.sb svg{margin-left:2px}' +
    '.hint{font-size:12px;color:#6B7280;text-align:center;padding:0 16px 10px;margin-top:-2px}.hint a{color:#374151;font-weight:500}' +
    '.toast{position:absolute;left:50%;bottom:92px;transform:translateX(-50%) translateY(8px);background:rgba(17,17,17,.92);color:#fff;font-size:13px;font-weight:500;padding:9px 14px;border-radius:10px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;white-space:nowrap}.toast.on{opacity:1;transform:translateX(-50%)}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
  }

  // ── Aufbau ─────────────────────────────────────────────────────────────────
  function mount() {
    if (mounted) return; mounted = true;
    var rgb = hexToRgb(cfg.owner && cfg.owner.brandColor) || [17, 17, 17];
    var dark = luminance(rgb) < 0.45;
    var brand = 'rgb(' + rgb.join(',') + ')';
    var brandText = dark ? '#fff' : '#111';
    var brandSoft = 'rgba(' + rgb.join(',') + ',.22)';
    host = document.createElement('div');
    host.id = 'fs-chat';
    host.setAttribute('data-fs-chat-widget', '1');
    root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = css(brand, brandText, shade(rgb, -0.18), brandSoft);
    root.appendChild(style);

    var owner = cfg.owner || {};
    var avatar = owner.avatarUrl ? '<img src="' + esc(owner.avatarUrl) + '" alt="">' : esc(initials(owner.name));
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button type="button" class="fab" aria-label="' + t.open + '" aria-expanded="false" aria-haspopup="dialog" aria-controls="win">' +
        '<span class="i c0">' + ICON.chat + '</span><span class="i c1">' + ICON.down + '</span>' +
        '<span class="badge" aria-hidden="true"></span><span class="sr" id="sr"></span></button>' +
      '<section class="win" id="win" role="dialog" aria-modal="true" aria-label="Chat" tabindex="-1">' +
        '<div class="hd"><div class="av">' + avatar + '</div><div class="who"><div class="nm">' + esc(owner.name || 'Chat') + '</div>' +
        '<div class="st"><span class="dot"></span><span class="stt">' + t.fast + '</span></div></div>' +
        '<button type="button" class="x" aria-label="' + t.close + '">' + ICON.close + '</button></div>' +
        '<div class="list" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="toast" role="status"></div>' +
        '<div class="ft">' +
          '<details class="pf" hidden><summary><span>' + t.profile + '</span><span class="ar">' + ICON.down + '</span></summary>' +
          '<form class="fm" novalidate><input name="name" autocomplete="name" placeholder="' + t.name + '" maxlength="100">' +
          '<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="' + t.email + '" maxlength="200">' +
          '<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + t.phone + '" maxlength="40">' +
          '<label class="sw off"><input type="checkbox" name="notify" disabled><span>' + t.notify + '</span></label>' +
          '<div class="row"><button type="submit" class="sv">' + t.save + '</button><span class="ok" hidden>' + t.saved + '</span></div></form></details>' +
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
    });
    var form = profileEl.querySelector('form');
    var emailIn = form.email, notifyIn = form.notify;
    emailIn.addEventListener('input', function () {
      var has = !!emailIn.value.trim();
      notifyIn.disabled = !has; notifyIn.parentNode.classList.toggle('off', !has);
      if (has && !emailIn.dataset.touched) { notifyIn.checked = true; emailIn.dataset.touched = '1'; }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); saveProfile(form); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) schedulePoll(0); });

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
    schedulePoll(0);
  }
  function close() {
    if (!isOpen) return; isOpen = false;
    win.classList.remove('in'); btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', t.open);
    setTimeout(function () { if (!isOpen) win.classList.remove('show'); }, REDUCED ? 0 : 280);
    btn.focus();
    schedulePoll();
  }
  function scrollBottom(instant) {
    if (instant) list.style.scrollBehavior = 'auto';
    list.scrollTop = list.scrollHeight;
    if (instant) setTimeout(function () { list.style.scrollBehavior = ''; }, 50);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 1600);
  }
  function copyLink(url) {
    var done = function () { toast(t.copied); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
    else { fallbackCopy(url); done(); }
  }
  function fallbackCopy(txt) {
    var el = document.createElement('textarea'); el.value = txt; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
    root.appendChild(el); el.select(); try { document.execCommand('copy'); } catch (e) {} root.removeChild(el);
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
    var on = ownerSeen && (Date.now() - new Date(ownerSeen).getTime()) < 90000;
    statusEl.classList.toggle('on', !!on);
    statusEl.querySelector('.stt').textContent = on ? t.online : t.fast;
  }
  function ticks(m) {
    if (m.state === 'sending') return '<span class="tk" title="' + t.sending + '">' + ICON.clock + '</span>';
    if (m.state === 'failed') return '<span class="tk" title="' + t.failed + '">' + ICON.warn + '</span>';
    if (m.readAt) return '<span class="tk rd" title="' + t.read + '">' + ICON.tick2 + '</span>';
    return '<span class="tk sn" title="' + t.sent + '">' + ICON.tick + '</span>';
  }
  function bubble(m, same) {
    var me = m.sender === 'visitor';
    var h = '<div class="m ' + (me ? 'me' : 'them') + (same ? ' same' : '') + '" data-id="' + esc(m.id || m.clientId) + '"><div class="bb">' +
      linkify(m.body) + '<span class="mt">' + fmtTime(m.createdAt) + (me ? ticks(m) : '') + '</span></div></div>';
    if (me && m.state === 'failed') {
      h += '<div class="err">' + ICON.warn + ' ' + (m.errorText || t.failed) + (m.retryable
        ? ' · <button type="button" data-retry="' + esc(m.clientId) + '">' + t.retry + '</button>'
        : ' · <button type="button" data-drop="' + esc(m.clientId) + '" aria-label="OK">OK</button>') + '</div>';
    }
    return h;
  }
  function waButton() {
    if (!cfg.whatsappUrl) return '';
    return '<div class="war"><a class="wab" href="' + esc(cfg.whatsappUrl) + '" target="_blank" rel="noopener noreferrer">' + ICON.wa + '<span>' + t.wa + '</span></a></div>';
  }
  function renderAll() {
    var h = '';
    if (blocked) {
      h = '<div class="blk">' + esc(t.blocked) + '</div>' + waButton().replace('class="war"', 'class="war mid"');
    } else {
      // Begrüßung ohne Zeitstempel ganz oben, darunter der WhatsApp-Knopf (falls vorhanden)
      if (cfg.welcome) h += '<div class="m them"><div class="bb">' + linkify(cfg.welcome) + '</div></div>';
      h += waButton();
      var lastDay = null, prev = null;
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.sender === 'system') { h += '<div class="sys"><span>' + esc(m.body) + '</span></div>'; prev = null; continue; }
        var dk = dayKey(m.createdAt);
        if (dk !== lastDay) { h += '<div class="day"><span>' + esc(dayLabel(m.createdAt)) + '</span></div>'; lastDay = dk; prev = null; }
        h += bubble(m, prev && prev.sender === m.sender && (new Date(m.createdAt) - new Date(prev.createdAt)) < 120000);
        prev = m;
      }
    }
    list.innerHTML = h;
    renderBadge(); renderStatus();
    var hasConv = !!convId;
    hintEl.hidden = hasConv || blocked;
    profileEl.hidden = !hasConv || blocked;
    root.querySelector('.cmp').style.display = blocked ? 'none' : '';
    if (isOpen) scrollBottom();
  }
  function fillProfile() {
    var f = profileEl.querySelector('form');
    f.name.value = visitor.name || ''; f.email.value = visitor.email || ''; f.phone.value = visitor.phone || '';
    var has = !!(visitor.email || '').trim();
    f.notify.disabled = !has; f.notify.parentNode.classList.toggle('off', !has);
    f.notify.checked = has && !!visitor.notifyByEmail;
    if (has) f.email.dataset.touched = '1';
  }

  // ── Daten ──────────────────────────────────────────────────────────────────
  function applySession(j) {
    if (j.conversationId) convId = j.conversationId;
    if (j.visitorToken) { token = j.visitorToken; }
    if (j.status) status = j.status;
    if (j.visitor) { visitor = j.visitor; }
    if (Array.isArray(j.messages)) messages = j.messages.map(function (m) { m.state = 'sent'; return m; });
    if (j.ownerLastSeenAt !== undefined) ownerSeen = j.ownerLastSeenAt;
    if (status === 'blocked') blocked = true;
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
  function schedulePoll(ms) {
    clearTimeout(pollTimer);
    if (!mounted || blocked) return;
    if (ms === undefined) ms = isOpen ? 3000 : 20000;
    if (!isOpen && !convId) return;
    pollTimer = setTimeout(poll, ms);
  }
  function poll() {
    if (document.hidden || !convId || !token) { schedulePoll(); return; }
    var after = lastId();
    api('messages', { query: after ? '?after=' + encodeURIComponent(after) : '' }).then(function (r) {
      if (r.ok) {
        if (r.json.status) { status = r.json.status; if (status === 'blocked') { setBlocked(); return; } }
        if (r.json.ownerLastSeenAt !== undefined) ownerSeen = r.json.ownerLastSeenAt;
        var res = mergeNew(r.json.messages || []);
        if (res.added) renderAll(); else { renderStatus(); renderBadge(); }
        if (res.ownerNew && isOpen && !document.hidden) markRead();
      }
      schedulePoll();
    }, function () { schedulePoll(); });
  }
  function markRead() {
    if (!convId || !token || !unreadCount()) { renderBadge(); return; }
    api('read', { method: 'POST', body: {} }).then(function (r) {
      if (!r.ok) return;
      var now = new Date().toISOString();
      for (var i = 0; i < messages.length; i++) if (messages[i].sender === 'owner' && !messages[i].readAt) messages[i].readAt = now;
      renderBadge();
    }, function () {});
  }
  function setBlocked() {
    if (blocked) return; blocked = true; clearTimeout(pollTimer);
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
    api('messages', { method: 'POST', body: { body: m.body, clientId: m.clientId, pageUrl: location.href } }).then(function (r) {
      if (r.ok && r.json.message) {
        if (!tokenStored) storeToken(token);
        var first = !convId;
        if (r.json.conversationId) convId = r.json.conversationId;
        else if (r.json.message.conversationId) convId = r.json.message.conversationId;
        mergeNew([r.json.message]);
        renderAll();
        if (first) { fillProfile(); profileEl.open = true; }
        schedulePoll(isOpen ? 3000 : undefined);
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
      phone: form.phone.value.trim() || null, notifyByEmail: !!(form.email.value.trim() && form.notify.checked)
    };
    api('profile', { method: 'POST', body: body }).then(function (r) {
      if (!r.ok) return;
      if (r.json.visitor) visitor = r.json.visitor;
      var ok = form.querySelector('.ok'); ok.hidden = false;
      setTimeout(function () { ok.hidden = true; profileEl.open = false; }, 1200);
    }, function () {});
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
        schedulePoll();
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
          api('profile', { method: 'POST', body: { notifyByEmail: false } }).then(function (p) {
            if (p.ok) { visitor.notifyByEmail = false; fillProfile(); messages.push({ sender: 'system', body: t.unsub, createdAt: new Date().toISOString() }); renderAll(); }
          }, function () {});
        }
      }, function () { mountNow(false); });
    }, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
