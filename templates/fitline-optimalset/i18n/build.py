#!/usr/bin/env python3
"""
Baut aus dem DE/EN-Template (index.html mit <span class="l-de">…</span><span class="l-en">…</span>)
die mehrsprachige Fassung: je Paar werden Spans für it, ru, uk, pl, bg, hi ergänzt (aus i18n/{lang}.json),
CSS/JS für Spracherkennung, Sprachmenü, Attribute, Shop-Links und Video werden auf alle Sprachen erweitert.
QUELLE ist index.de-en.html (nur DE/EN, hier wird das Template gepflegt); index.html ist das Build-Ergebnis
und wird nach R2 hochgeladen. Fehlt eine Übersetzung, bleibt DE.
Aufruf: python3 build.py [--check]
"""
import json, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SRC=os.path.join(ROOT,'index.de-en.html'); OUT=os.path.join(ROOT,'index.html')
if not os.path.exists(SRC): raise SystemExit('index.de-en.html fehlt (DE/EN-Quelle)')
LANGS=['it','ru','uk','pl','bg','hi']           # neue Sprachen (de/en sind im Template)
ALL=['de','en']+LANGS
NAMES={'de':'Deutsch','en':'English','it':'Italiano','ru':'Русский','uk':'Українська','pl':'Polski','bg':'Български','hi':'हिन्दी'}
SHOP={'en':'en-us','it':'it-it','ru':'ru-ru','uk':'uk-ua','pl':'pl-pl','bg':'bg-bg','hi':'hi-in'}
USER_FIELDS=['about_me_html']                   # Nutzertexte mit Sprachvarianten {key}_{lang}

html=open(SRC,encoding='utf-8').read()
tr={l:json.load(open(os.path.join(HERE,f'{l}.json'))) for l in LANGS if os.path.exists(os.path.join(HERE,f'{l}.json'))}
missing={l:0 for l in LANGS}

assert 'class="l-it"' not in html and 'var FS_I18N' not in html, 'Quelle enthält schon Build-Ergebnisse'

# 0b) JS-Strings (VOR der Paar-Erweiterung, sonst werden die Spans in den JS-Strings mit erweitert): Formular-Optionen, Wechselwirkungs-Hinweise, Fehlermeldung
old_goal="""btn.innerHTML = '<span class="form-option-dot"></span><span class="l-de">' + g.label + '</span><span class="l-en">' + g.labelEn + '</span>';"""
assert old_goal in html
html=html.replace(old_goal,"""btn.innerHTML = '<span class="form-option-dot"></span>' + fsJsSpans(g.label, g.labelEn);""")
old_warn="""            warnItemEl.textContent = isEn ? w.enName : w.name;
            warnTextEl.textContent = isEn ? w.enText : w.text;"""
assert old_warn in html
html=html.replace(old_warn,"""            var curLang = document.documentElement.getAttribute('data-lang') || 'de';
            warnItemEl.textContent = isEn ? w.enName : curLang === 'de' ? w.name : fsJ(curLang, w.name);
            warnTextEl.textContent = isEn ? w.enText : curLang === 'de' ? w.text : fsJ(curLang, w.text);""")
old_alert="""alert(document.documentElement.getAttribute('data-lang') === 'en'
          ? 'Something went wrong. Please try again.'
          : 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');"""
assert old_alert in html
html=html.replace(old_alert,"""alert((function(){ var cl = document.documentElement.getAttribute('data-lang') || 'de'; return cl === 'en' ? 'Something went wrong. Please try again.' : cl === 'de' ? 'Etwas ist schiefgelaufen. Bitte versuche es erneut.' : fsJ(cl, 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'); })());""")

# 1) Paare erweitern
def expand(m):
    tag, de, en = m.group(1), m.group(2), m.group(3)
    assert '<span class="l-' not in de and '<div class="l-' not in de, 'verschachtelte Sprach-Spans: '+de[:60]
    out=m.group(0)
    for l in LANGS:
        if de=='{{about_me_html}}':
            t='{{#if about_me_html_%s}}{{about_me_html_%s}}{{/if}}{{#unless about_me_html_%s}}{{about_me_html}}{{/unless}}'%(l,l,l)
        elif de=='{{{about_intro_de_html}}}':
            t='{{{about_intro_%s_html}}}'%l
        else:
            t=tr.get(l,{}).get('strings',{}).get(de)
            if t is None: missing[l]+=1; t=de
        out+=f'<{tag} class="l-{l}">{t}</{tag}>'
    return out
html, n = re.subn(r'<(span|div) class="l-de">(.*?)</\1><(?:span|div) class="l-en">(.*?)</\1>', expand, html, flags=re.S)
print('Paare erweitert:', n, '| fehlende Übersetzungen:', missing)

# 2) CSS-Regel
old_css='html[data-lang="en"] .l-de, html[data-lang="de"] .l-en { display: none !important; }'
rules=', '.join(f'html:not([data-lang="{l}"]) .l-{l}' for l in ALL)
assert old_css in html
html=html.replace(old_css, rules+' { display: none !important; }')

# 3) Spracherkennung
old_detect=re.search(r"if \(l !== 'de' && l !== 'en'\) \{\n\s*l = \(navigator\.language \|\| 'de'\)\.toLowerCase\(\)\.indexOf\('de'\) === 0 \? 'de' : 'en';\n\s*\}", html)
assert old_detect, 'Erkennung nicht gefunden'
html=html.replace(old_detect.group(0), """var SUP = %s;
  if (SUP.indexOf(l) < 0) {
    l = 'de';
    var cand = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'de']);
    for (var i = 0; i < cand.length; i++) {
      var c = String(cand[i] || '').toLowerCase().split('-')[0];
      if (SUP.indexOf(c) >= 0) { l = c; break; }
    }
  }""" % json.dumps(ALL))

# 4) fsApplyLang: Attribute, Shop-Links, Video, Titel
js=json.load(open(os.path.join(HERE,'js-strings.json')))
i18n={'attrs':{l:tr[l]['attrs'] for l in tr}, 'js':{l:{de:tr[l]['strings'].get(de,de) for de in js} for l in tr}, 'shop':SHOP, 'names':NAMES, 'langs':ALL}
html=html.replace("  function fsApplyLang(l) {\n    var en = l === 'en';",
"""  var FS_I18N = %s;
  function fsT(l, de) { var d = FS_I18N.attrs[l]; return (d && d[de]) ? d[de] : de; }
  function fsJ(l, de) { var d = FS_I18N.js[l]; return (d && d[de]) ? d[de] : de; }
  function fsJsSpans(de, en) { var h = '<span class="l-de">' + de + '</span><span class="l-en">' + en + '</span>'; FS_I18N.langs.slice(2).forEach(function(x) { h += '<span class="l-' + x + '">' + fsJ(x, de) + '</span>'; }); return h; }
  function fsApplyLang(l) {
    var en = l === 'en';
    var other = FS_I18N.langs.indexOf(l) > 1;""" % json.dumps(i18n, ensure_ascii=False).replace('</', '<\\/'))
# Attribute: en → Spalte 3, andere → Wörterbuch, de → Spalte 2
html=html.replace("document.querySelectorAll(row[0]).forEach(function(el) { el.setAttribute(row[1], en ? row[3] : row[2]); });",
                  "document.querySelectorAll(row[0]).forEach(function(el) { el.setAttribute(row[1], en ? row[3] : other ? fsT(l, row[2]) : row[2]); });")
# Titel/Beschreibung: en → EN, andere → Wörterbuch (fällt auf DE zurück)
html=html.replace("document.title = en ? fsMetaTitle[1] : fsMetaTitle[0];","document.title = en ? fsMetaTitle[1] : other ? fsT(l, fsMetaTitle[0]) : fsMetaTitle[0];")
html=html.replace("if (m) m.setAttribute('content', en ? fsMetaTitle[1] : fsMetaTitle[0]);","if (m) m.setAttribute('content', en ? fsMetaTitle[1] : other ? fsT(l, fsMetaTitle[0]) : fsMetaTitle[0]);")
html=html.replace("if (m) m.setAttribute('content', en ? fsMetaDesc[1] : fsMetaDesc[0]);","if (m) m.setAttribute('content', en ? fsMetaDesc[1] : other ? fsT(l, fsMetaDesc[0]) : fsMetaDesc[0]);")
# Shop-Links
old_shop="a.setAttribute('href', en ? de.replace('/de-de/', '/en-us/') : de);"
assert old_shop in html
html=html.replace(old_shop,"a.setAttribute('href', FS_I18N.shop[l] ? de.replace('/de-de/', '/' + FS_I18N.shop[l] + '/') : de);")
# Video
old_vid="var want = en ? 'videos/darm_en.mp4' : 'videos/darm.mp4';"
assert old_vid in html
html=html.replace(old_vid,"var want = l === 'de' ? 'videos/darm.mp4' : 'videos/darm_' + l + '.mp4';")
# Initial anwenden (nicht nur bei en)
html=html.replace("if (document.documentElement.getAttribute('data-lang') === 'en') fsApplyLang('en');",
                  "(function(){ var cur = document.documentElement.getAttribute('data-lang'); if (cur && cur !== 'de') fsApplyLang(cur); })();")

# 5) Sprachmenü statt DE/EN-Schalter
def flag(l):
    # Kreis-Flaggen als kleine SVGs
    F={'de':'<rect width="20" height="7" fill="#000"/><rect y="7" width="20" height="6" fill="#D00"/><rect y="13" width="20" height="7" fill="#FFCE00"/>',
       'en':'<rect width="20" height="20" fill="#012169"/><path d="M0 0L20 20M20 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L20 20M20 0L0 20" stroke="#C8102E" stroke-width="2"/><path d="M10 0V20M0 10H20" stroke="#fff" stroke-width="6"/><path d="M10 0V20M0 10H20" stroke="#C8102E" stroke-width="3"/>',
       'it':'<rect width="7" height="20" fill="#009246"/><rect x="7" width="6" height="20" fill="#fff"/><rect x="13" width="7" height="20" fill="#CE2B37"/>',
       'ru':'<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="6" fill="#0039A6"/><rect y="13" width="20" height="7" fill="#D52B1E"/>',
       'uk':'<rect width="20" height="10" fill="#0057B7"/><rect y="10" width="20" height="10" fill="#FFD700"/>',
       'pl':'<rect width="20" height="10" fill="#fff"/><rect y="10" width="20" height="10" fill="#DC143C"/>',
       'bg':'<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="6" fill="#00966E"/><rect y="13" width="20" height="7" fill="#D62612"/>',
       'hi':'<rect width="20" height="7" fill="#FF9933"/><rect y="7" width="20" height="6" fill="#fff"/><rect y="13" width="20" height="7" fill="#138808"/><circle cx="10" cy="10" r="2.2" fill="none" stroke="#000080" stroke-width="0.8"/>'}
    return f'<span class="lang-flag"><svg viewBox="0 0 20 20" aria-hidden="true">{F[l]}</svg></span>'
def menu(variant):
    items=''.join(f'<button type="button" class="lang-item" data-lang="{l}" onclick="fsSetLang(\'{l}\');fsLangClose()">{flag(l)}<span>{NAMES[l]}</span></button>' for l in ALL)
    cur=''.join(f'<span class="lang-cur-flag" data-lang="{l}">{flag(l)}</span>' for l in ALL)
    return f'<div class="lang-menu lang-switch-{variant}"><button type="button" class="lang-cur" aria-haspopup="listbox" aria-label="Sprache wählen" onclick="fsLangToggle(this)">{cur}<span class="lang-cur-code"></span><svg class="lang-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><div class="lang-list" role="listbox">{items}</div></div>'
html, n1 = re.subn(r'<div class="lang-switch lang-switch-desktop".*?</div>', menu('desktop'), html, count=1, flags=re.S)
html, n2 = re.subn(r'<div class="lang-switch lang-switch-mobile".*?</div>', menu('mobile'), html, count=1, flags=re.S)
assert n1==1 and n2==1, (n1,n2)
css="""<style data-fs-i18n>
.lang-menu { position: relative; }
.lang-cur { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 10px 0 6px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.10); color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
.lang-cur:hover { background: rgba(255,255,255,0.18); }
.nav.scrolled .lang-cur { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.10); color: #1a1a1a; }
.nav.scrolled .lang-cur:hover { background: rgba(0,0,0,0.09); }
.lang-flag { display: block; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
.lang-flag svg { display: block; width: 100%; height: 100%; }
.lang-cur-flag { display: none; }
""" + ''.join(f'html[data-lang="{l}"] .lang-cur-flag[data-lang="{l}"] {{ display: block; }}\n' for l in ALL) + """
.lang-caret { width: 12px; height: 12px; opacity: .8; transition: transform .25s ease; }
.lang-menu.open .lang-caret { transform: rotate(180deg); }
.lang-list { position: absolute; right: 0; top: calc(100% + 8px); min-width: 196px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,0.16); border: 1px solid rgba(0,0,0,0.06); z-index: 1000; opacity: 0; visibility: hidden; transform: translateY(-6px) scale(.98); transform-origin: top right; transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s linear .22s; }
.lang-menu.open .lang-list { opacity: 1; visibility: visible; transform: translateY(0) scale(1); transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s; }
.lang-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; background: transparent; border-radius: 10px; color: #1a1a1a; font: inherit; font-size: 14px; cursor: pointer; text-align: left; transition: background .15s ease; }
.lang-item:hover { background: #F3F4F6; }
""" + ''.join(f'html[data-lang="{l}"] .lang-item[data-lang="{l}"] {{ background: #F3F4F6; font-weight: 600; }}\n' for l in ALL) + """
.lang-switch-mobile { margin-left: auto; margin-right: 10px; }
@media (prefers-reduced-motion: reduce) { .lang-list, .lang-caret, .lang-cur, .lang-item { transition: none; } }
</style>"""
html=html.replace('</head>', css+'\n</head>',1)
js="""<script data-fs-i18n>
function fsLangToggle(btn){ var m=btn.parentNode; var open=!m.classList.contains('open'); document.querySelectorAll('.lang-menu.open').forEach(function(x){x.classList.remove('open')}); if(open) m.classList.add('open'); }
function fsLangClose(){ document.querySelectorAll('.lang-menu.open').forEach(function(x){x.classList.remove('open')}); }
document.addEventListener('click', function(e){ if(!e.target.closest || !e.target.closest('.lang-menu')) fsLangClose(); });
(function(){ function code(){ var l=document.documentElement.getAttribute('data-lang')||'de'; document.querySelectorAll('.lang-cur-code').forEach(function(s){ s.textContent=l.toUpperCase(); }); } code(); new MutationObserver(code).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']}); })();
</script>"""
html=html.replace('</body>', js+'\n</body>',1)

if '--check' in sys.argv:
    open('/tmp/claude-501/index.i18n.html','w',encoding='utf-8').write(html); print('Testdatei: /tmp/claude-501/index.i18n.html', len(html)//1024,'KB'); sys.exit()
open(OUT,'w',encoding='utf-8').write(html); print('index.html geschrieben', len(html)//1024,'KB')
