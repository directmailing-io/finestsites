#!/usr/bin/env python3
"""
Baut aus dem DE/EN-Template (index.de-en.html mit <span class="l-de">…</span><span class="l-en">…</span>)
die 13-sprachige Fassung index.html (cellRESET). Gepflegt wird NUR index.de-en.html; index.html ist Build-Ergebnis
und geht nach R2 (templates/b1d028a9-b4be-4d87-9178-9a92ebb2fb83/index.html). Fehlt eine Übersetzung, bleibt DE.
Aufruf: python3 build.py [--check]
"""
import json, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SRC=os.path.join(ROOT,'index.de-en.html'); OUT=os.path.join(ROOT,'index.html')
LANGS=['it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']
ALL=['de','en']+LANGS
NAMES={'de':'Deutsch','en':'English','it':'Italiano','ru':'Русский','uk':'Українська','pl':'Polski','bg':'Български','hi':'हिन्दी','tr':'Türkçe','sr':'Srpski','es':'Español','zh':'中文','ko':'한국어'}
HTML_LANG={'zh':'zh-Hans','sr':'sr-Latn'}
# Sprachname je Sprache (aus dem Wellpreneur-Build übernommen)
exec(open(os.path.join(ROOT,'..','pm-business-wellpreneur','i18n','build.py')).read().split('NAMES_IN={}')[1].split('\n\n')[0].replace('NAMES_IN[_a]','NAMES_IN[_a]',1).join(['NAMES_IN={}','']) if False else '')
_W=open(os.path.join(ROOT,'..','pm-business-wellpreneur','i18n','build.py')).read()
_blk=_W[_W.index('NAMES_IN={}'):]; _blk=_blk[:_blk.index('\n\n')]
exec(_blk)
MENU_ORDER=sorted(ALL, key=lambda l: (0 if NAMES[l][0].isascii() else 1, NAMES[l].casefold()))

html=open(SRC,encoding='utf-8').read()
assert 'class="l-it"' not in html and 'var FS_I18N' not in html, 'Quelle enthält schon Build-Ergebnisse'
tr={l:json.load(open(os.path.join(HERE,f'{l}.json'))) for l in LANGS if os.path.exists(os.path.join(HERE,f'{l}.json'))}
missing={l:0 for l in LANGS}

# 1) Paare erweitern
def expand(m):
    tag, de, en = m.group(1), m.group(2), m.group(3)
    assert '<span class="l-' not in de and '<div class="l-' not in de, 'verschachtelte Sprach-Spans: '+de[:60]
    out=m.group(0)
    for l in LANGS:
        if de.strip()=='{{about_me_html}}':
            t='{{#if about_me_html_%s}}{{about_me_html_%s}}{{/if}}{{#unless about_me_html_%s}}{{about_me_html}}{{/unless}}'%(l,l,l)
        elif de=='{{{about_intro_de_html}}}':
            t='{{{about_intro_%s_html}}}'%l
        else:
            t=tr.get(l,{}).get('strings',{}).get(de)
            if t is None: missing[l]+=1; t=de
        out+=f'<{tag} class="l-{l}">{t}</{tag}>'
    return out
INNER=r'(?:[^<]|<(?!/?(?:span|div)\b)[^>]*>|<span\b[^>]*>(?:[^<]|<(?!/?span\b)[^>]*>)*</span>)*?'
html, n = re.subn(r'<(span|div) class="l-de">('+INNER+r')</\1>\s*<(?:span|div) class="l-en">('+INNER+r')</\1>', expand, html, flags=re.S)
print('Paare erweitert:', n, '| fehlende Übersetzungen:', missing)

# 2) CSS-Regel
old_css='html[data-lang="en"] .l-de, html[data-lang="de"] .l-en { display: none !important; }'
assert old_css in html
html=html.replace(old_css, ', '.join(f'html:not([data-lang="{l}"]) .l-{l}' for l in ALL)+' { display: none !important; }')

# 3) Erkennung (früh im <head>) + lang-Attribut
old_detect="    var lang = stored || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'de');\n    document.documentElement.setAttribute('data-lang', lang);\n    document.documentElement.setAttribute('lang', lang);"
assert old_detect in html
html=html.replace(old_detect, """    var SUP = %s, lang = stored;
    if (SUP.indexOf(lang) < 0) {
      lang = 'de';
      var cand = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'de']);
      for (var i = 0; i < cand.length; i++) { var c = String(cand[i] || '').toLowerCase().split('-')[0]; if (SUP.indexOf(c) >= 0) { lang = c; break; } }
    }
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', (%s)[lang] || lang);""" % (json.dumps(ALL), json.dumps(HTML_LANG)))

# 4) Wörterbuch + fsSetLang für alle Sprachen (Attribute generisch, Platzhalter, alert)
js=json.load(open(os.path.join(HERE,'js-strings.json')))
src_en={x['de']:x['en'] for x in json.load(open(os.path.join(HERE,'source.json')))}
attrs_de=json.load(open(os.path.join(HERE,'attrs.json')))
rows_en=dict(re.findall(r'data-de-placeholder="([^"]*)" data-en-placeholder="([^"]*)"', html)); rows_en.update(dict(re.findall(r'data-en-placeholder="([^"]*)" data-de-placeholder="([^"]*)"', html)))
m=re.search(r'<meta name="description" content="([^"]*)"',html); META_DE=m.group(1) if m else ''
ATTRS_EN={'Cookie-Einstellungen':'Cookie settings','Cookie-Einstellungen öffnen':'Open cookie settings','Deutsche Flagge':'German flag','Dieses Bild wurde mit KI erstellt (EU Kennzeichnung)':'This image was created with AI (EU labelling)','Land oder Vorwahl suchen …':'Search country or dialling code …','Marketing-Cookies erlauben':'Allow marketing cookies','Menü schließen':'Close menu','Menü öffnen':'Open menu','Statistik-Cookies erlauben':'Allow statistics cookies','Technisch notwendig (immer aktiv)':'Technically necessary (always active)','Vielfalt an Nährstoff-Formaten':'A variety of nutrient formats','Vor- und Nachname':'First and last name','Was möchtest du wissen?':'What would you like to know?','Stoffwechselkur':'Metabolism reset','Deine Stoffwechselkur':'Your metabolism reset', META_DE:'A reset programme for your everyday life. Four phases back to more energy and a clear head.'}
def attr_dict(l):
    base={k:re.sub(r'<[^>]+>','',v) for k,v in tr[l]['strings'].items() if len(k)<=60 and '<' not in k and '{{' not in k}
    base.update(tr[l]['attrs']); return base
attrs_en_all={k:re.sub(r'<[^>]+>','',v) for k,v in src_en.items() if len(k)<=60 and '<' not in k and '{{' not in k}; attrs_en_all.update(rows_en); attrs_en_all.update({k:v for k,v in ATTRS_EN.items() if k})
i18n={'attrs':{**{l:attr_dict(l) for l in tr}, 'en':attrs_en_all}, 'js':{l:{de:tr[l]['strings'].get(de,de) for de in js} for l in tr}, 'names':NAMES, 'langs':ALL, 'metaDe':META_DE}
old_set="function fsSetLang(lang) {\n  if (lang !== 'de' && lang !== 'en') return;\n  document.documentElement.setAttribute('data-lang', lang);\n  document.documentElement.setAttribute('lang', lang);\n  try { localStorage.setItem('fs-lang', lang); } catch(e){}\n  document.querySelectorAll('[data-de-placeholder]').forEach(function(el){\n    var v = lang === 'en' ? el.getAttribute('data-en-placeholder') : el.getAttribute('data-de-placeholder');\n    if (v) el.setAttribute('placeholder', v);\n  });"
assert old_set in html, 'fsSetLang nicht gefunden'
html=html.replace(old_set, """var FS_I18N = %s;
function fsT(l, de) { var d = FS_I18N.attrs[l]; return (d && d[de]) ? d[de] : de; }
function fsJ(l, de) { var d = FS_I18N.js[l]; return (d && d[de]) ? d[de] : de; }
window.fsJ = fsJ; window.fsT = fsT;
function fsCjkFonts(l) {
  var id = 'fs-cjk-' + l; if (document.getElementById(id)) return;
  var fam = l === 'zh' ? 'Noto+Sans+SC:wght@400;500;600;700' : 'Noto+Sans+KR:wght@400;500;600;700';
  var lk = document.createElement('link'); lk.id = id; lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap';
  document.head.appendChild(lk);
}
var FS_ATTR_NAMES = ['alt', 'aria-label', 'placeholder', 'title'];
/* Alle Attribute mit Text in die Sprache l; Original (DE) wird beim ersten Lauf in data-fs-de-* gemerkt; auch später eingefügte Elemente (Observer) */
function fsAttrAll(l) {
  var dict = l === 'de' ? null : (FS_I18N.attrs[l] || null);
  if (l !== 'de' && !dict) return;
  document.querySelectorAll('[alt],[aria-label],[placeholder],[title]').forEach(function(el) {
    FS_ATTR_NAMES.forEach(function(a) {
      if (!el.hasAttribute(a)) return;
      var k = 'data-fs-de-' + a, de = el.getAttribute(k);
      if (de === null) { de = el.hasAttribute('data-de-' + a) ? el.getAttribute('data-de-' + a) : el.getAttribute(a); el.setAttribute(k, de); }
      var v = dict ? (dict[de] || de) : de;
      if (el.getAttribute(a) !== v) el.setAttribute(a, v);
    });
  });
  if (!window.FS_TITLE0) window.FS_TITLE0 = document.title;
  document.title = l === 'de' ? window.FS_TITLE0 : (window.FS_TITLE0.indexOf('Deine Stoffwechselkur') >= 0 ? window.FS_TITLE0.replace('Deine Stoffwechselkur', fsT(l, 'Deine Stoffwechselkur')) : window.FS_TITLE0.replace('Stoffwechselkur', fsT(l, 'Stoffwechselkur')));
  var md = document.querySelector('meta[name="description"]');
  if (md && FS_I18N.metaDe) md.setAttribute('content', l === 'de' ? FS_I18N.metaDe : fsT(l, FS_I18N.metaDe));
}
(function() {
  var pending = false;
  function run() { pending = false; var l = document.documentElement.getAttribute('data-lang') || 'de'; if (l !== 'de') fsAttrAll(l); }
  function arm() { if (!pending) { pending = true; requestAnimationFrame(run); } }
  function start() { new MutationObserver(arm).observe(document.body, { childList: true, subtree: true }); run(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
function fsSetLang(lang) {
  if (FS_I18N.langs.indexOf(lang) < 0) return;
  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', (%s)[lang] || lang);
  try { localStorage.setItem('fs-lang', lang); } catch(e){}
  if (lang === 'zh' || lang === 'ko') fsCjkFonts(lang);
  fsAttrAll(lang);""" % (json.dumps(i18n, ensure_ascii=False).replace('</', '<\\/'), json.dumps(HTML_LANG)))
old_init="(function initLang(){\n  var lang = document.documentElement.getAttribute('data-lang') || 'de';\n  document.querySelectorAll('[data-de-placeholder]').forEach(function(el){\n    var v = lang === 'en' ? el.getAttribute('data-en-placeholder') : el.getAttribute('data-de-placeholder');\n    if (v) el.setAttribute('placeholder', v);\n  });\n})();"
assert old_init in html
html=html.replace(old_init,"(function initLang(){\n  var lang = document.documentElement.getAttribute('data-lang') || 'de';\n  if (lang === 'zh' || lang === 'ko') fsCjkFonts(lang);\n  fsAttrAll(lang);\n})();")
old_alert="alert(lang === 'en' ? 'Something went wrong. Please try again.' : 'Da ist etwas schiefgegangen. Bitte versuch es noch einmal.');"
assert old_alert in html
html=html.replace(old_alert,"alert(lang === 'en' ? 'Something went wrong. Please try again.' : lang === 'de' ? 'Da ist etwas schiefgegangen. Bitte versuch es noch einmal.' : fsJ(lang, 'Da ist etwas schiefgegangen. Bitte versuch es noch einmal.'));")

# 5) Sprachmenü (Raster, alphabetisch) statt DE/EN-Schalter
_F=_W[_W.index("    F={'de':"):]; _F=_F[:_F.index("    return f'<span class=\"lang-flag\">")]
exec(_F.strip()) if False else None
F={}
for l in ALL:
    mm=re.search(r"'%s':'(<rect.*?)'(?=,\n|\}\n|\})"%l, _W, re.S); assert mm, l; F[l]=mm.group(1)
def flag(l): return f'<span class="lang-flag"><svg viewBox="0 0 20 20" aria-hidden="true">{F[l]}</svg></span>'
def menu(variant):
    def sub(l): return '<small class="lang-sub">' + ''.join(f'<span class="l-{a}">({NAMES_IN[a][l]})</span>' for a in ALL if a != l) + '</small>'
    items=''.join(f'<button type="button" class="lang-item" data-lang="{l}" onclick="fsSetLang(\'{l}\');fsLangClose()">{flag(l)}<span class="lang-name">{NAMES[l]}{sub(l)}</span></button>' for l in MENU_ORDER)
    cur=''.join(f'<span class="lang-cur-flag" data-lang="{l}">{flag(l)}</span>' for l in ALL)
    return f'<div class="lang-menu lang-switch-{variant}"><button type="button" class="lang-cur" aria-haspopup="listbox" aria-label="Sprache wählen" onclick="fsLangToggle(this)">{cur}<span class="lang-cur-code"></span><svg class="lang-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><div class="lang-list" role="listbox">{items}</div></div>'
html, n1 = re.subn(r'<div class="lang-switch" role="group" aria-label="Sprache / Language">(?:(?!</div>).)*?</div>', lambda m: menu('desktop'), html, count=1, flags=re.S)
assert n1==1, 'Desktop-Schalter nicht gefunden'
n2=html.count('class="lang-switch lang-switch-mobile"')
html=re.sub(r'<div class="lang-switch lang-switch-mobile"[^>]*>.*?</div>\s*</div>', lambda m: menu('mobile'), html, count=1, flags=re.S) if n2 else html
# Der eine Schalter steht außerhalb von .nav-links und ist auch mobil sichtbar (wie der alte DE/EN-Schalter); kein zweites Menü nötig
print('Sprachmenüs:', 1+n2)
css="""<style data-fs-i18n>
.lang-menu { position: relative; }
.lang-cur { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 10px 0 6px; border-radius: 9999px; border: 1px solid var(--line); background: rgba(255,255,255,0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.lang-cur:hover { background: rgba(255,255,255,0.85); }
.lang-flag { display: block; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
.lang-flag svg { display: block; width: 100%; height: 100%; }
.lang-cur-flag { display: none; }
""" + ''.join(f'html[data-lang="{l}"] .lang-cur-flag[data-lang="{l}"] {{ display: block; }}\n' for l in ALL) + """
.lang-caret { width: 12px; height: 12px; opacity: .8; transition: transform .25s ease; }
.lang-menu.open .lang-caret { transform: rotate(180deg); }
.lang-list { position: absolute; right: 0; top: calc(100% + 8px); width: min(520px, calc(100vw - 24px)); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,0.16); border: 1px solid rgba(0,0,0,0.06); z-index: 1000; opacity: 0; visibility: hidden; transform: translateY(-6px) scale(.98); transform-origin: top right; transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s linear .22s; }
.lang-menu.open .lang-list { opacity: 1; visibility: visible; transform: translateY(0) scale(1); transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s; }
.lang-item { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; padding: 9px 10px; border: 0; background: transparent; border-radius: 10px; color: #1a1a1a; font: inherit; font-size: 14px; letter-spacing: 0; cursor: pointer; text-align: left; transition: background .15s ease; }
.lang-item:hover { background: #F3F4F6; }
.lang-name { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.2; }
.lang-sub { font-size: 11px; font-weight: 400; color: #9CA3AF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
""" + ''.join(f'html[data-lang="{l}"] .lang-item[data-lang="{l}"] {{ background: #F3F4F6; font-weight: 600; }}\n' for l in ALL) + """
@media (max-width: 640px) { .lang-list { position: fixed; left: 12px; right: 12px; width: auto; top: var(--lang-top, 72px); grid-template-columns: repeat(2, minmax(0, 1fr)); transform-origin: top center; } }
@media (prefers-reduced-motion: reduce) { .lang-list, .lang-caret, .lang-cur, .lang-item { transition: none; } }
/* CJK/Hindi: keine Sperrung, kein Kursiv, serifenlose Systemschrift (Noto Sans SC/KR nur bei aktiver Sprache), ruhigere Titel */
html[data-lang="hi"] body, html[data-lang="hi"] body *, html[data-lang="zh"] body, html[data-lang="zh"] body *, html[data-lang="ko"] body, html[data-lang="ko"] body * { letter-spacing: normal !important; }
html[data-lang="zh"] { --font: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif; }
html[data-lang="ko"] { --font: 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Source Han Sans KR', sans-serif; }
html[data-lang="zh"] body *, html[data-lang="ko"] body * { font-style: normal !important; }
html[data-lang="zh"] h1, html[data-lang="ko"] h1 { font-size: clamp(32px, 4.8vw, 60px); font-weight: 600; line-height: 1.22; }
html[data-lang="zh"] h2, html[data-lang="ko"] h2 { font-weight: 600; line-height: 1.3; }
html[data-lang="zh"] p, html[data-lang="zh"] li { line-height: 1.75; }
html[data-lang="ko"] p, html[data-lang="ko"] li { line-height: 1.7; }
html[data-lang="ko"] body { word-break: keep-all; overflow-wrap: break-word; }
</style>"""
html=html.replace('</head>', css+'\n</head>',1)
jsm="""<script data-fs-i18n>
function fsLangToggle(btn){ var m=btn.parentNode; var r=btn.getBoundingClientRect(); m.style.setProperty('--lang-top',(r.bottom+8)+'px'); var open=!m.classList.contains('open'); document.querySelectorAll('.lang-menu.open').forEach(function(x){x.classList.remove('open')}); if(open) m.classList.add('open'); }
function fsLangClose(){ document.querySelectorAll('.lang-menu.open').forEach(function(x){x.classList.remove('open')}); }
document.addEventListener('click', function(e){ if(!e.target.closest || !e.target.closest('.lang-menu')) fsLangClose(); });
(function(){ function code(){ var l=document.documentElement.getAttribute('data-lang')||'de'; document.querySelectorAll('.lang-cur-code').forEach(function(s){ s.textContent=l.toUpperCase(); }); } code(); new MutationObserver(code).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']}); })();
</script>"""
html=html.replace('</body>', jsm+'\n</body>',1)
# alte Schalter-Regeln: .lang-switch (Pille) nicht mehr auf das Menü anwenden, Sichtbarkeits-Regeln bleiben über lang-switch-desktop/-mobile
html=html.replace('.nav-links .lang-switch { display: none; }','.nav-links .lang-switch-desktop { display: none; }')

if '--check' in sys.argv:
    open('/tmp/claude-501/index.cr.i18n.html','w',encoding='utf-8').write(html); print('Testdatei: /tmp/claude-501/index.cr.i18n.html', len(html)//1024,'KB'); sys.exit()
open(OUT,'w',encoding='utf-8').write(html); print('index.html geschrieben', len(html)//1024,'KB')
