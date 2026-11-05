/**
 * GET /api/chat-check — unsichtbare Cloudflare-Turnstile-Prüfung für den Besucher-Chat (Daniel 05.11.2026).
 *
 * Das Chat-Widget (public/chat-widget/v1.js) lädt diese Seite unsichtbar als iframe, bevor ein neues Gespräch
 * beginnt. Turnstile läuft hier auf app.finestsites.io (ein Widget erlaubt nur wenige Hostnamen, Kundenseiten
 * laufen auf vielen Domains) und meldet das Token per postMessage an die Kundenseite zurück:
 *   { type: 'fs-chat-check', token } bzw. { type: 'fs-chat-check', error }
 * Das Token gilt einmal und 5 Minuten; geprüft wird es in src/lib/chat/turnstile.ts.
 * Ohne TURNSTILE_SITE_KEY meldet die Seite sofort { error: 'off' } (Prüfung aus).
 * Darf auf fremden Seiten eingebettet werden (next.config.ts: frame-ancestors *).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? ''
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Prüfung</title></head><body style="margin:0;background:transparent">
<div id="c"></div>
<script>
(function () {
  var key = ${JSON.stringify(siteKey)};
  function send(m) { m.type = 'fs-chat-check'; try { parent.postMessage(m, '*'); } catch (e) {} }
  if (!key) { send({ error: 'off' }); return; }
  window.onTs = function () {
    try {
      turnstile.render('#c', {
        sitekey: key,
        action: 'chat',
        callback: function (t) { send({ token: t }); },
        'error-callback': function (code) { send({ error: String(code || 'error') }); return true; },
        'timeout-callback': function () { send({ error: 'timeout' }); }
      });
    } catch (e) { send({ error: 'render' }); }
  };
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTs&render=explicit';
  s.async = true;
  s.onerror = function () { send({ error: 'load' }); };
  document.head.appendChild(s);
})();
</script></body></html>`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
