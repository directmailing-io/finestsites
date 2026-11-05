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
LANGS=['it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']   # neue Sprachen (de/en sind im Template); tr/sr/es/zh/ko seit 05.11.2026
ALL=['de','en']+LANGS
NAMES={'de':'Deutsch','en':'English','it':'Italiano','ru':'Русский','uk':'Українська','pl':'Polski','bg':'Български','hi':'हिन्दी','tr':'Türkçe','sr':'Srpski','es':'Español','zh':'中文','ko':'한국어'}
HTML_LANG={'zh':'zh-Hans','sr':'sr-Latn'}        # lang-Attribut (Glyphenwahl Han/Latin)
# Sprachname je Sprache: NAMES_IN[aktiv][sprache]
NAMES_IN={}
_ORDER=['de','en','it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']
for _a,_row in {
 'de':'Deutsch|Englisch|Italienisch|Russisch|Ukrainisch|Polnisch|Bulgarisch|Hindi|Türkisch|Serbisch|Spanisch|Chinesisch|Koreanisch',
 'en':'German|English|Italian|Russian|Ukrainian|Polish|Bulgarian|Hindi|Turkish|Serbian|Spanish|Chinese|Korean',
 'it':'Tedesco|Inglese|Italiano|Russo|Ucraino|Polacco|Bulgaro|Hindi|Turco|Serbo|Spagnolo|Cinese|Coreano',
 'ru':'Немецкий|Английский|Итальянский|Русский|Украинский|Польский|Болгарский|Хинди|Турецкий|Сербский|Испанский|Китайский|Корейский',
 'uk':'Німецька|Англійська|Італійська|Російська|Українська|Польська|Болгарська|Гінді|Турецька|Сербська|Іспанська|Китайська|Корейська',
 'pl':'Niemiecki|Angielski|Włoski|Rosyjski|Ukraiński|Polski|Bułgarski|Hindi|Turecki|Serbski|Hiszpański|Chiński|Koreański',
 'bg':'Немски|Английски|Италиански|Руски|Украински|Полски|Български|Хинди|Турски|Сръбски|Испански|Китайски|Корейски',
 'hi':'जर्मन|अंग्रेज़ी|इतालवी|रूसी|यूक्रेनी|पोलिश|बल्गेरियाई|हिन्दी|तुर्की|सर्बियाई|स्पेनिश|चीनी|कोरियाई',
 'tr':'Almanca|İngilizce|İtalyanca|Rusça|Ukraynaca|Lehçe|Bulgarca|Hintçe|Türkçe|Sırpça|İspanyolca|Çince|Korece',
 'sr':'Nemački|Engleski|Italijanski|Ruski|Ukrajinski|Poljski|Bugarski|Hindi|Turski|Srpski|Španski|Kineski|Korejski',
 'es':'Alemán|Inglés|Italiano|Ruso|Ucraniano|Polaco|Búlgaro|Hindi|Turco|Serbio|Español|Chino|Coreano',
 'zh':'德语|英语|意大利语|俄语|乌克兰语|波兰语|保加利亚语|印地语|土耳其语|塞尔维亚语|西班牙语|中文|韩语',
 'ko':'독일어|영어|이탈리아어|러시아어|우크라이나어|폴란드어|불가리아어|힌디어|터키어|세르비아어|스페인어|중국어|한국어',
}.items():
    NAMES_IN[_a]=dict(zip(_ORDER,_row.split('|'))); assert len(NAMES_IN[_a])==13
VIDEO_LANGS=['en','it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']   # videos/darm_{lang}.mp4 in R2 (tr/sr/es/zh/ko VoiceStudio/OmniVoice 05.11.2026); Sprachen ohne eigene Tonspur bekommen die englische
SHOP={'en':'en-us','it':'it-it','ru':'ru-ru','uk':'uk-ua','pl':'pl-pl','bg':'bg-bg','hi':'hi-in','tr':'tr-tr','sr':'sr-rs','es':'es-es','zh':'zh-cn','ko':'ko-kr'}
USER_FIELDS=['about_me_html']                   # Nutzertexte mit Sprachvarianten {key}_{lang}

html=open(SRC,encoding='utf-8').read()
n_lang=html.count("document.documentElement.setAttribute('lang', l);"); assert n_lang==2, n_lang
html=html.replace("document.documentElement.setAttribute('lang', l);", "document.documentElement.setAttribute('lang', (%s)[l] || l);" % json.dumps(HTML_LANG))

# 0a) „Über mich“ an zwei Positionen (Editor-Feld about_position: oben | leer/unten; „mitte“ am 27.10.2026 auf Daniels Wunsch gestrichen).
#     Die Quelle enthält die Sektion genau EINMAL (zwischen @@about:start/@@about:end) plus den Slot-Marker für oben;
#     hier wird sie an jede Stelle kopiert und per Bedingung nur an der gewählten gezeigt (ohne Wert = unten, wie bisher).
m=re.search(r'<!-- @@about:start[^>]*-->\n?(.*?)\n?<!-- @@about:end -->', html, flags=re.S)
assert m, 'about-Marker (@@about:start/@@about:end) fehlen'
about_block=m.group(1)
assert about_block.count('class="section about-wrap"')==1, 'about-Sektion ohne eindeutige Klasse'
def about_at(pos): return about_block.replace('class="section about-wrap"', 'class="section about-wrap about-pos-%s"'%pos, 1)
html=html.replace(m.group(0), '{{#unless about_position=oben}}\n'+about_at('unten')+'\n{{/unless}}')
for pos in ('oben',):
    slot='<!-- @@about-slot:%s -->'%pos
    assert html.count(slot)==1, slot+' fehlt oder mehrfach'
    html=html.replace(slot, '{{#if about_position=%s}}\n'%pos+about_at(pos)+'\n{{/if}}')
assert html.count('class="section about-wrap')==2
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

# 0c) Alle übrigen Sprach-Span-Paare in Skripten (innerHTML-Strings) → fsJsSpans(...)
JS_EXTRA=[]
def js_pairs(m):
    de, en = m.group(1), m.group(2); JS_EXTRA.append(de)
    varsm = re.findall(r"' \+ (\w+) \+ '", de)
    v = (', {' + ', '.join(f"{x}: {x}" for x in sorted(set(varsm))) + '}') if varsm else ''
    return f"fsJsSpans('{de}', '{en}'{v})"
scripts = list(re.finditer(r'<script[^>]*>.*?</script>', html, flags=re.S))
for sc in reversed(scripts):
    body = sc.group(0)
    body2 = re.sub(r"'<span class=\"l-de\">((?:[^'\\]|\\.|' \+ \w+ \+ ')*?)</span><span class=\"l-en\">((?:[^'\\]|\\.|' \+ \w+ \+ ')*?)</span>'", js_pairs, body)
    if body2 != body: html = html[:sc.start()] + body2 + html[sc.end():]
print('JS-Span-Paare ersetzt:', html.count('fsJsSpans('))

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
INNER=r'(?:[^<]|<(?!/?(?:span|div)\b)[^>]*>|<span\b[^>]*>(?:[^<]|<(?!/?span\b)[^>]*>)*</span>)*?'
html, n = re.subn(r'<(span|div) class="l-de">('+INNER+r')</\1><(?:span|div) class="l-en">('+INNER+r')</\1>', expand, html, flags=re.S)
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
js_keys=list(js)+[k for k in JS_EXTRA if k not in js]
src_en={x['de']:x['en'] for x in json.load(open(os.path.join(HERE,'source.json')))}
attrs_de=json.load(open(os.path.join(HERE,'attrs.json')))
rows_en=dict(re.findall(r"\['[^']+', '(?:placeholder|aria-label|title|alt)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'\]", html))   # fsLangAttrs: DE → EN
mt=re.search(r"var fsMetaTitle = \['([^']*)', '([^']*)'\]", html); md=re.search(r"var fsMetaDesc = \[\s*'([^']*)',\s*'([^']*)'", html)
for mm in (mt,md):
    if mm: rows_en[mm.group(1)]=mm.group(2)
attrs_en={a:(rows_en.get(a) or re.sub(r'<[^>]+>','',src_en.get(a,a))) for a in attrs_de}
# Attribute: zusätzlich alle kurzen sichtbaren Strings (ohne Tags/Platzhalter) als Wörterbuch, damit alt/title mit gleichem DE-Text (z. B. „Calcium“) mitübersetzt werden
def attr_dict(l):
    base={k:re.sub(r'<[^>]+>','',v) for k,v in tr[l]['strings'].items() if len(k)<=60 and '<' not in k and '{{' not in k}
    base.update(tr[l]['attrs']); return base
attrs_en_all={k:re.sub(r'<[^>]+>','',v) for k,v in src_en.items() if len(k)<=60 and '<' not in k and '{{' not in k}; attrs_en_all.update(attrs_en)
i18n={'attrs':{**{l:attr_dict(l) for l in tr}, 'en':attrs_en_all}, 'js':{l:{de:tr[l]['strings'].get(de,de) for de in js_keys} for l in tr}, 'shop':SHOP, 'names':NAMES, 'langs':ALL}
html=html.replace("  function fsApplyLang(l) {\n    var en = l === 'en';",
"""  var FS_I18N = %s;
  function fsT(l, de) { var d = FS_I18N.attrs[l]; return (d && d[de]) ? d[de] : de; }
  function fsJ(l, de) { var d = FS_I18N.js[l]; return (d && d[de]) ? d[de] : de; }
  function fsJsSpans(de, en, vars) {
    function fill(t) { if (vars) { Object.keys(vars).forEach(function(k) { t = t.split("' + " + k + " + '").join(vars[k]); }); } return t; }
    var h = '<span class="l-de">' + fill(de) + '</span><span class="l-en">' + fill(en) + '</span>';
    FS_I18N.langs.slice(2).forEach(function(x) { h += '<span class="l-' + x + '">' + fill(fsJ(x, de)) + '</span>'; });
    return h;
  }
  window.fsJsSpans = fsJsSpans; window.fsJ = fsJ; window.fsT = fsT;
  function fsCjkFonts(l) {
    var id = 'fs-cjk-' + l; if (document.getElementById(id)) return;
    var fam = l === 'zh' ? 'Noto+Sans+SC:wght@400;500;600;700' : 'Noto+Sans+KR:wght@400;500;600;700';
    var lk = document.createElement('link'); lk.id = id; lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap';
    document.head.appendChild(lk);
  }
  var FS_ATTR_NAMES = ['alt', 'aria-label', 'placeholder', 'title'];
  /* Alle Attribute mit Text in die Sprache l; Original (DE) wird beim ersten Lauf in data-fs-de-* gemerkt; auch spaeter eingefuegte Elemente (Observer) */
  function fsAttrAll(l) {
    var dict = l === 'de' ? null : (FS_I18N.attrs[l] || null);
    if (l !== 'de' && !dict) return;
    document.querySelectorAll('[alt],[aria-label],[placeholder],[title]').forEach(function(el) {
      FS_ATTR_NAMES.forEach(function(a) {
        if (!el.hasAttribute(a)) return;
        var k = 'data-fs-de-' + a, de = el.getAttribute(k);
        if (de === null) { de = el.getAttribute(a); el.setAttribute(k, de); }
        var v = dict ? (dict[de] || de) : de;
        if (el.getAttribute(a) !== v) el.setAttribute(a, v);
      });
    });
  }
  (function() {
    var pending = false;
    function run() { pending = false; var l = document.documentElement.getAttribute('data-lang') || 'de'; if (l !== 'de') fsAttrAll(l); }
    function arm() { if (!pending) { pending = true; requestAnimationFrame(run); } }
    function start() { new MutationObserver(arm).observe(document.body, { childList: true, subtree: true }); run(); }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  })();
  function fsApplyLang(l) {
    var en = l === 'en';
    var other = FS_I18N.langs.indexOf(l) > 1;
    fsAttrAll(l);
    if (l === 'zh' || l === 'ko') fsCjkFonts(l);""" % json.dumps(i18n, ensure_ascii=False).replace('</', '<\\/'))
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
html=html.replace(old_vid,"var want = l === 'de' ? 'videos/darm.mp4' : 'videos/darm_' + (%s.indexOf(l) >= 0 ? l : 'en') + '.mp4';" % json.dumps(VIDEO_LANGS))
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
       'tr':'<rect width="20" height="20" fill="#E30A17"/><circle cx="8" cy="10" r="5" fill="#fff"/><circle cx="9.2" cy="10" r="4" fill="#E30A17"/><path d="M13.9 7.9l.7 1.8 1.9.1-1.5 1.2.5 1.9-1.6-1.1-1.6 1.1.5-1.9-1.5-1.2 1.9-.1z" fill="#fff"/>',
       'sr':'<rect width="20" height="7" fill="#C6363C"/><rect y="7" width="20" height="6" fill="#0C4076"/><rect y="13" width="20" height="7" fill="#fff"/>',
       'es':'<rect width="20" height="20" fill="#AA151B"/><rect y="5" width="20" height="10" fill="#F1BF00"/>',
       'zh':'<rect width="20" height="20" fill="#DE2910"/><path d="M6 3.4l1.2 3.4h3.6L7.9 8.9l1.1 3.4L6 10.2l-3 2.1 1.1-3.4-2.9-2.1h3.6z" fill="#FFDE00"/><circle cx="11.6" cy="3.6" r="1" fill="#FFDE00"/><circle cx="13.6" cy="6" r="1" fill="#FFDE00"/><circle cx="13.6" cy="9" r="1" fill="#FFDE00"/><circle cx="11.6" cy="11.4" r="1" fill="#FFDE00"/>',
       'ko':'<rect width="20" height="20" fill="#fff"/><path d="M5 10A5 5 0 0 1 15 10A2.5 2.5 0 0 1 10 10A2.5 2.5 0 0 0 5 10Z" fill="#CD2E3A"/><path d="M5 10A5 5 0 0 0 15 10A2.5 2.5 0 0 1 10 10A2.5 2.5 0 0 0 5 10Z" fill="#0047A0"/>',
       'hi':'<rect width="20" height="7" fill="#FF9933"/><rect y="7" width="20" height="6" fill="#fff"/><rect y="13" width="20" height="7" fill="#138808"/><circle cx="10" cy="10" r="2.2" fill="none" stroke="#000080" stroke-width="0.8"/>'}
    return f'<span class="lang-flag"><svg viewBox="0 0 20 20" aria-hidden="true">{F[l]}</svg></span>'
def menu(variant):
    def sub(l):  # „(Polnisch)“ in der gerade aktiven Sprache, entfällt wenn gleich
        return '<small class="lang-sub">' + ''.join(f'<span class="l-{a}">({NAMES_IN[a][l]})</span>' for a in ALL if a != l) + '</small>'
    items=''.join(f'<button type="button" class="lang-item" data-lang="{l}" onclick="fsSetLang(\'{l}\');fsLangClose()">{flag(l)}<span class="lang-name">{NAMES[l]}{sub(l)}</span></button>' for l in ALL)
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
.lang-name { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.lang-sub { font-size: 11px; font-weight: 400; color: #9CA3AF; white-space: nowrap; }
""" + ''.join(f'html[data-lang="{l}"] .lang-item[data-lang="{l}"] {{ background: #F3F4F6; font-weight: 600; }}\n' for l in ALL) + """
.lang-switch-mobile { margin-left: auto; margin-right: 10px; }
/* CJK/Hindi: keine Sperrung, kein Kursiv, serifenlose Systemschrift (Noto Sans SC/KR wird nur bei aktiver Sprache nachgeladen), ruhigere Titelgroessen */
html[data-lang="hi"] body, html[data-lang="hi"] body *, html[data-lang="zh"] body, html[data-lang="zh"] body *, html[data-lang="ko"] body, html[data-lang="ko"] body * { letter-spacing: normal !important; }
html[data-lang="zh"] { --font-heading: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif; --font-body: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif; }
html[data-lang="ko"] { --font-heading: 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Source Han Sans KR', sans-serif; --font-body: 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Source Han Sans KR', sans-serif; }
html[data-lang="zh"] body *, html[data-lang="ko"] body * { font-style: normal !important; }
html[data-lang="zh"] h1, html[data-lang="ko"] h1, html[data-lang="zh"] h2, html[data-lang="ko"] h2, html[data-lang="zh"] h3, html[data-lang="ko"] h3 { font-weight: 600; }
html[data-lang="zh"] h1, html[data-lang="ko"] h1 { line-height: 1.25; }
html[data-lang="zh"] h2, html[data-lang="ko"] h2 { line-height: 1.3; }
html[data-lang="zh"] p, html[data-lang="zh"] li { line-height: 1.75; }
html[data-lang="ko"] p, html[data-lang="ko"] li { line-height: 1.7; }
html[data-lang="ko"] body { word-break: keep-all; overflow-wrap: break-word; }
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
