/**
 * Platzhalter-Editor für den Beispielmodus: zeigt, welche Brücken-Nachrichten der echte
 * Web-Editor im App-Modus schicken soll, und lässt jede einzeln auslösen.
 */
export function mockEditorHtml(next: string) {
  const siteId = (next.match(/\/sites\/([^/]+)\/edit/) ?? [])[1] ?? '';
  const url = 'https://sabine-keller.wellpreneur.io';
  return `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#FAFAFA;color:#111827}
.wrap{max-width:640px;margin:0 auto;padding:24px 20px}
h1{font-size:22px;margin:0 0 6px}p{color:#64748B;margin:0 0 20px;font-size:15px;line-height:1.5}
.card{background:#fff;border:1.5px solid #E2E8F0;border-radius:24px;padding:20px;margin-bottom:16px}
label{display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px}
input{width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:16px;padding:12px 16px;font-size:16px}
button{display:block;width:100%;min-height:48px;border:0;border-radius:16px;font-size:15px;font-weight:700;margin-top:10px}
.p{background:#111827;color:#fff}.s{background:#F1F5F9;color:#111827}.a{background:#7C3AED;color:#fff}
code{font-size:12px;color:#94A3B8}
</style></head><body><div class="wrap">
<h1>Editor (Beispiel)</h1>
<p>Hier lädt in der echten App der Web-Editor <code>${next}</code>. Die Knöpfe senden die Nachrichten, die der Editor im App-Modus schickt.</p>
<div class="card"><label>Überschrift</label><input id="t" value="Willkommen auf meiner Seite" oninput="post({type:'save-state',dirty:true})"></div>
<div class="card">
<button class="s" onclick="post({type:'save-state',dirty:false})">Speichern (save-state: false)</button>
<button class="a" onclick="post({type:'published',siteId:'${siteId}',url:'${url}',first:true})">Veröffentlichen (published)</button>
<button class="s" onclick="post({type:'publish-blocked',code:'site_limit'})">Veröffentlichen blockiert (publish-blocked)</button>
<button class="s" onclick="post({type:'share',url:'${url}',title:'Meine Seite'})">Link teilen (share)</button>
<button class="s" onclick="post({type:'qr',url:'${url}',title:'Meine Seite'})">QR-Code (qr)</button>
<button class="s" onclick="post({type:'open-url',url:'https://example.com'})">Externer Link (open-url)</button>
<button class="p" onclick="post({type:'close'})">Schließen (close)</button>
</div></div>
<script>function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}</script>
</body></html>`;
}
