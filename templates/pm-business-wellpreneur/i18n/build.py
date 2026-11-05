#!/usr/bin/env python3
"""
Baut aus dem DE/EN-Template (index.de-en.html mit <span class="l-de">…</span><span class="l-en">…</span>)
die mehrsprachige Fassung des PM-Business-Templates: je Paar werden Spans für it, ru, uk, pl, bg, hi ergänzt
(aus i18n/{lang}.json), CSS/JS für Spracherkennung, Sprachmenü, Attribute, Ländernamen und Video werden auf
alle Sprachen erweitert. QUELLE ist index.de-en.html (nur DE/EN, hier wird das Template gepflegt);
index.html ist das Build-Ergebnis und wird nach R2 hochgeladen. Fehlt eine Übersetzung, bleibt DE.
Gleicher Ablauf wie templates/fitline-optimalset/i18n/build.py. Aufruf: python3 build.py [--check]
"""
import json, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
SRC=os.path.join(ROOT,'index.de-en.html'); OUT=os.path.join(ROOT,'index.html')
if not os.path.exists(SRC): raise SystemExit('index.de-en.html fehlt (DE/EN-Quelle)')
LANGS=['it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']   # neue Sprachen (de/en sind im Template); tr/sr/es/zh/ko seit 05.11.2026
ALL=['de','en']+LANGS
# Sprachen, für die videos/preview_01_{lang}.mp4 in R2 liegt (video/dub_auto.sh). Fehlt die Tonspur,
# läuft das englische Video (weiter verbreitet als Deutsch). Nach jedem Video-Upload hier ergänzen und neu bauen.
VIDEO_LANGS=['en','it','ru','uk','pl','bg','hi','tr','sr','es','zh','ko']   # videos/preview_01_{lang}.mp4 in R2 (ElevenLabs-Dubbing 14.10.2026; tr/sr/es/zh/ko VoiceStudio/OmniVoice 05.11.2026)
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


html=open(SRC,encoding='utf-8').read()
# lang-Attribut mit Schrift-Subtag (Han-Vereinheitlichung: zh-Hans wählt chinesische Glyphen, sr-Latn lateinisches Serbisch)
n_lang=html.count("document.documentElement.setAttribute('lang', l);"); assert n_lang==2, n_lang
html=html.replace("document.documentElement.setAttribute('lang', l);", "document.documentElement.setAttribute('lang', (%s)[l] || l);" % json.dumps(HTML_LANG))
tr={l:json.load(open(os.path.join(HERE,f'{l}.json'))) for l in LANGS if os.path.exists(os.path.join(HERE,f'{l}.json'))}
missing={l:0 for l in LANGS}

assert 'class="l-it"' not in html and 'var FS_I18N' not in html, 'Quelle enthält schon Build-Ergebnisse'

# 0b) JS-Strings VOR der Paar-Erweiterung: alert(de ? 'DE' : 'EN') → fsPick('DE', 'EN') (Wörterbuch für die anderen Sprachen)
html, n_alert = re.subn(r"alert\(de \? ('(?:[^'\\]|\\.)*') : ('(?:[^'\\]|\\.)*')\)", r"alert(fsPick(\1, \2))", html)
assert n_alert >= 4, n_alert

# 0c) Sprach-Span-Paare in Skripten (innerHTML-Strings) → fsJsSpans(...)
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
        if de=='{{{about_intro_de_html}}}':
            t='{{{about_intro_%s_html}}}'%l
        else:
            t=tr.get(l,{}).get('strings',{}).get(de)
            if t is None: missing[l]+=1; t=de
        out+=f'<{tag} class="l-{l}">{t}</{tag}>'
    return out
INNER=r'(?:[^<]|<(?!/?(?:span|div)\b)[^>]*>|<span\b[^>]*>(?:[^<]|<(?!/?span\b)[^>]*>)*</span>)*?'
html, n = re.subn(r'<(span|div) class="l-de">('+INNER+r')</\1>(\s*)<(?:span|div) class="l-en">('+INNER+r')</\1>',
                  lambda m: expand(type('M',(),{'group':lambda self,i: (m.group(0),m.group(1),m.group(2),m.group(4))[i]})()), html, flags=re.S)
print('Paare erweitert:', n, '| fehlende Übersetzungen:', missing)

# 1b) „Über mich“-Richtext: eigene Blöcke je Sprache, Fallback auf den deutschen Text
old_about='<div class="about-me-richtext l-de">{{{about_me_html}}}</div>\n        <div class="about-me-richtext l-en">{{{about_me_html_en}}}</div>'
assert old_about in html
html=html.replace(old_about, old_about+''.join(
    '\n        <div class="about-me-richtext l-%s">{{#if about_me_html_%s}}{{{about_me_html_%s}}}{{/if}}{{#unless about_me_html_%s}}{{{about_me_html}}}{{/unless}}</div>'%(l,l,l,l) for l in LANGS))

# 2) CSS-Regel
old_css='html[data-lang="en"] .l-de, html[data-lang="de"] .l-en { display: none !important; }'
rules=', '.join(f'html:not([data-lang="{l}"]) .l-{l}' for l in ALL)
assert old_css in html
html=html.replace(old_css, rules+' { display: none !important; }')

# 2b) CSS-Text „Und noch viel mehr …“ je Sprache
m=re.search(r'(  \.todo-fade \.und-mehr::before \{\n\s*content: "([^"]+)";\n  \}\n)', html)
assert m
und_mehr=m.group(2)
extra=''.join('  html[data-lang="%s"] .todo-fade .und-mehr::before {\n    content: %s;\n  }\n' % (l, json.dumps(tr[l]['attrs'].get(und_mehr, und_mehr), ensure_ascii=False)) for l in LANGS if l in tr)
html=html.replace(m.group(1), m.group(1)+extra)

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

# 4) fsApplyLang: Attribute, Video, Titel; Ländernamen über Intl.DisplayNames je Sprache
js=json.load(open(os.path.join(HERE,'js-strings.json')))
js_keys=list(js)+[k for k in JS_EXTRA if k not in js]
i18n={'attrs':{l:tr[l]['attrs'] for l in tr}, 'js':{l:{de:tr[l]['strings'].get(de,de) for de in js_keys} for l in tr}, 'names':NAMES, 'langs':ALL}
old_apply="  function fsApplyLang(l) {\n    const en = l === 'en';"
assert old_apply in html
html=html.replace(old_apply,
"""  var FS_I18N = %s;
  function fsT(l, de) { var d = FS_I18N.attrs[l]; return (d && d[de]) ? d[de] : de; }
  function fsJ(l, de) { var d = FS_I18N.js[l]; return (d && d[de]) ? d[de] : de; }
  function fsPick(de, en) { var l = document.documentElement.getAttribute('data-lang') || 'de'; return l === 'en' ? en : l === 'de' ? de : fsJ(l, de); }
  function fsJsSpans(de, en, vars) {
    function fill(t) { if (vars) { Object.keys(vars).forEach(function(k) { t = t.split("' + " + k + " + '").join(vars[k]); }); } return t; }
    var h = '<span class="l-de">' + fill(de) + '</span><span class="l-en">' + fill(en) + '</span>';
    FS_I18N.langs.slice(2).forEach(function(x) { h += '<span class="l-' + x + '">' + fill(fsJ(x, de)) + '</span>'; });
    return h;
  }
  window.fsJsSpans = fsJsSpans; window.fsJ = fsJ; window.fsT = fsT; window.fsPick = fsPick;
  function fsApplyLang(l) {
    const en = l === 'en';
    const other = FS_I18N.langs.indexOf(l) > 1;
    if (l === 'zh' || l === 'ko') fsCjkFonts(l);""" % json.dumps(i18n, ensure_ascii=False).replace('</', '<\\/'))
# Noto Sans SC/KR nur laden, wenn Chinesisch/Koreanisch aktiv ist (Google Fonts liefert Unicode-Range-Slices, lädt also nur benötigte Zeichen)
rep_fonts="""  window.fsJsSpans = fsJsSpans; window.fsJ = fsJ; window.fsT = fsT; window.fsPick = fsPick;"""
assert rep_fonts in html
html=html.replace(rep_fonts, rep_fonts+"""
  function fsCjkFonts(l) {
    var id = 'fs-cjk-' + l; if (document.getElementById(id)) return;
    var fam = l === 'zh' ? 'Noto+Sans+SC:wght@400;500;600;700' : 'Noto+Sans+KR:wght@400;500;600;700';
    var lk = document.createElement('link'); lk.id = id; lk.rel = 'stylesheet'; lk.href = 'https://fonts.googleapis.com/css2?family=' + fam + '&display=swap';
    document.head.appendChild(lk);
  }""")
# Attribute: en → Spalte 3, andere → Wörterbuch, de → Spalte 2
old_attr="document.querySelectorAll(sel).forEach(el => el.setAttribute(attr, en ? enV : deV));"
assert old_attr in html
html=html.replace(old_attr,"document.querySelectorAll(sel).forEach(el => el.setAttribute(attr, en ? enV : other ? fsT(l, deV) : deV));")
# Titel/Beschreibung: en → EN, andere → Wörterbuch (fällt auf DE zurück)
for old,new in [("document.title = en ? fsMetaTitle[1] : fsMetaTitle[0];","document.title = en ? fsMetaTitle[1] : other ? fsT(l, fsMetaTitle[0]) : fsMetaTitle[0];"),
                ("if (m) m.setAttribute('content', en ? fsMetaTitle[1] : fsMetaTitle[0]);","if (m) m.setAttribute('content', en ? fsMetaTitle[1] : other ? fsT(l, fsMetaTitle[0]) : fsMetaTitle[0]);"),
                ("if (m) m.setAttribute('content', en ? fsMetaDesc[1] : fsMetaDesc[0]);","if (m) m.setAttribute('content', en ? fsMetaDesc[1] : other ? fsT(l, fsMetaDesc[0]) : fsMetaDesc[0]);")]:
    assert old in html, old
    html=html.replace(old,new)
# Video: Tonspur je Sprache
old_vid="const want = en ? 'videos/preview_01_en.mp4' : 'videos/preview_01.mp4';"
assert old_vid in html
html=html.replace(old_vid,"const want = l === 'de' ? 'videos/preview_01.mp4' : 'videos/preview_01_' + (%s.indexOf(l) >= 0 ? l : 'en') + '.mp4';" % json.dumps(VIDEO_LANGS))
# Ländernamen: statt nur Englisch über Intl.DisplayNames in der aktiven Sprache (Fallback Deutsch)
old_cn="""    const en = document.documentElement.getAttribute('data-lang') === 'en';
    const q = filter.toLowerCase().trim();
    list.innerHTML = countries.map((c, i) => {
      const name = en ? countryNamesEn[i] : c[0];"""
assert old_cn in html
html=html.replace(old_cn,"""    const names = fsCountryNames(document.documentElement.getAttribute('data-lang') || 'de');
    const q = filter.toLowerCase().trim();
    list.innerHTML = countries.map((c, i) => {
      const name = names ? names[i] : c[0];""")
old_cne="  function renderCountryList(filter = '') {"
assert old_cne in html
html=html.replace(old_cne,"""  const fsCountryNameCache = { en: countryNamesEn };
  function fsCountryNames(lang) {
    if (lang === 'de') return null;
    if (fsCountryNameCache[lang]) return fsCountryNameCache[lang];
    try {
      const dn = new Intl.DisplayNames([lang], { type: 'region' });
      fsCountryNameCache[lang] = countries.map(c => { const n = dn.of(c[2]); return (n && n !== c[2]) ? n : c[0]; });
    } catch(e) { fsCountryNameCache[lang] = countryNamesEn; }
    return fsCountryNameCache[lang];
  }
"""+old_cne)
# Initial anwenden (nicht nur bei en)
old_init="if (document.documentElement.getAttribute('data-lang') === 'en') fsApplyLang('en');"
assert old_init in html
html=html.replace(old_init,"(function(){ var cur = document.documentElement.getAttribute('data-lang'); if (cur && cur !== 'de') fsApplyLang(cur); })();")

# 5) Sprachmenü statt DE/EN-Schalter (Nav mobil, Nav Desktop, Overlay-Menü)
def flag(l):
    F={'de':'<rect width="20" height="7" fill="#000"/><rect y="7" width="20" height="6" fill="#D00"/><rect y="13" width="20" height="7" fill="#FFCE00"/>',
       'en':'<rect width="20" height="20" fill="#012169"/><path d="M0 0L20 20M20 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L20 20M20 0L0 20" stroke="#C8102E" stroke-width="2"/><path d="M10 0V20M0 10H20" stroke="#fff" stroke-width="6"/><path d="M10 0V20M0 10H20" stroke="#C8102E" stroke-width="3"/>',
       'it':'<rect width="7" height="20" fill="#009246"/><rect x="7" width="6" height="20" fill="#fff"/><rect x="13" width="7" height="20" fill="#CE2B37"/>',
       'ru':'<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="6" fill="#0039A6"/><rect y="13" width="20" height="7" fill="#D52B1E"/>',
       'uk':'<rect width="20" height="10" fill="#0057B7"/><rect y="10" width="20" height="10" fill="#FFD700"/>',
       'pl':'<rect width="20" height="10" fill="#fff"/><rect y="10" width="20" height="10" fill="#DC143C"/>',
       'bg':'<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="6" fill="#00966E"/><rect y="13" width="20" height="7" fill="#D62612"/>',
       'hi':'<rect width="20" height="7" fill="#FF9933"/><rect y="7" width="20" height="6" fill="#fff"/><rect y="13" width="20" height="7" fill="#138808"/><circle cx="10" cy="10" r="2.2" fill="none" stroke="#000080" stroke-width="0.8"/>',
       'tr':'<rect width="20" height="20" fill="#E30A17"/><circle cx="8" cy="10" r="5" fill="#fff"/><circle cx="9.2" cy="10" r="4" fill="#E30A17"/><path d="M13.9 7.9l.7 1.8 1.9.1-1.5 1.2.5 1.9-1.6-1.1-1.6 1.1.5-1.9-1.5-1.2 1.9-.1z" fill="#fff"/>',
       'sr':'<rect width="20" height="7" fill="#C6363C"/><rect y="7" width="20" height="6" fill="#0C4076"/><rect y="13" width="20" height="7" fill="#fff"/>',
       'es':'<rect width="20" height="20" fill="#AA151B"/><rect y="5" width="20" height="10" fill="#F1BF00"/>',
       'zh':'<rect width="20" height="20" fill="#DE2910"/><path d="M6 3.4l1.2 3.4h3.6L7.9 8.9l1.1 3.4L6 10.2l-3 2.1 1.1-3.4-2.9-2.1h3.6z" fill="#FFDE00"/><circle cx="11.6" cy="3.6" r="1" fill="#FFDE00"/><circle cx="13.6" cy="6" r="1" fill="#FFDE00"/><circle cx="13.6" cy="9" r="1" fill="#FFDE00"/><circle cx="11.6" cy="11.4" r="1" fill="#FFDE00"/>',
       'ko':'<rect width="20" height="20" fill="#fff"/><path d="M5 10A5 5 0 0 1 15 10A2.5 2.5 0 0 1 10 10A2.5 2.5 0 0 0 5 10Z" fill="#CD2E3A"/><path d="M5 10A5 5 0 0 0 15 10A2.5 2.5 0 0 1 10 10A2.5 2.5 0 0 0 5 10Z" fill="#0047A0"/>'}
    return f'<span class="lang-flag"><svg viewBox="0 0 20 20" aria-hidden="true">{F[l]}</svg></span>'
def menu(variant, onpick=''):
    def sub(l):  # „(Polnisch)“ in der gerade aktiven Sprache, entfällt wenn gleich
        return '<small class="lang-sub">' + ''.join(f'<span class="l-{a}">({NAMES_IN[a][l]})</span>' for a in ALL if a != l) + '</small>'
    items=''.join(f'<button type="button" class="lang-item" data-lang="{l}" onclick="fsSetLang(\'{l}\');fsLangClose(){onpick}">{flag(l)}<span class="lang-name">{NAMES[l]}{sub(l)}</span></button>' for l in ALL)
    cur=''.join(f'<span class="lang-cur-flag" data-lang="{l}">{flag(l)}</span>' for l in ALL)
    return f'<div class="lang-menu lang-switch-{variant}"><button type="button" class="lang-cur" aria-haspopup="listbox" aria-label="Sprache wählen" onclick="fsLangToggle(this)">{cur}<span class="lang-cur-code"></span><svg class="lang-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><div class="lang-list" role="listbox">{items}</div></div>'
html, n1 = re.subn(r'<div class="lang-switch lang-switch-mobile" role="group"[^>]*>.*?</div>', menu('mobile'), html, count=1, flags=re.S)
html, n2 = re.subn(r'<div class="lang-switch" role="group"[^>]*>.*?</div>', menu('desktop'), html, count=1, flags=re.S)
html, n3 = re.subn(r'<div class="lang-switch lang-switch-overlay" role="group"[^>]*>.*?</div>', menu('overlay'), html, count=1, flags=re.S)
assert n1==1 and n2==1 and n3==1, (n1,n2,n3)
assert 'class="lang-opt"' not in html
css="""<style data-fs-i18n>
/* Devanagari/CJK: Sperrung (Eyebrows, Labels) und negative Tracking reißen Matras/Ligaturen auseinander bzw. sind im Chinesischen/Koreanischen unüblich */
html[data-lang="hi"] body, html[data-lang="hi"] body *, html[data-lang="zh"] body, html[data-lang="zh"] body *, html[data-lang="ko"] body, html[data-lang="ko"] body * { letter-spacing: normal !important; }
/* Chinesisch/Koreanisch: moderne Verbraucherseiten dort sind durchgehend serifenlos (PingFang / Apple SD Gothic); kein Kursiv, etwas kleinere Titel, mehr Durchschuss */
html[data-lang="zh"] { --sans: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif; --serif: var(--sans); }
html[data-lang="ko"] { --sans: 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Source Han Sans KR', sans-serif; --serif: var(--sans); }
html[data-lang="zh"] body, html[data-lang="ko"] body { font-family: var(--sans); }
html[data-lang="zh"] h1, html[data-lang="zh"] h2, html[data-lang="zh"] h3, html[data-lang="zh"] em, html[data-lang="zh"] i, html[data-lang="zh"] .accent,
html[data-lang="ko"] h1, html[data-lang="ko"] h2, html[data-lang="ko"] h3, html[data-lang="ko"] em, html[data-lang="ko"] i, html[data-lang="ko"] .accent,
html[data-lang="zh"] body *, html[data-lang="ko"] body * { font-style: normal !important; }
html[data-lang="zh"] h1, html[data-lang="ko"] h1 { font-size: clamp(32px, 4.6vw, 56px); font-weight: 600; line-height: 1.25; }
html[data-lang="zh"] h2, html[data-lang="ko"] h2 { font-size: clamp(26px, 4vw, 48px); font-weight: 600; line-height: 1.3; }
html[data-lang="zh"] h3, html[data-lang="ko"] h3 { font-weight: 600; line-height: 1.35; }
html[data-lang="zh"] p, html[data-lang="zh"] li { line-height: 1.75; }
html[data-lang="ko"] p, html[data-lang="ko"] li { line-height: 1.7; }
html[data-lang="ko"] body { word-break: keep-all; overflow-wrap: break-word; }
.lang-menu { position: relative; }
.lang-cur { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 10px 0 6px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); color: #fff; font: inherit; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
.lang-cur:hover { background: rgba(255,255,255,0.16); }
.nav-links .lang-menu { margin-left: 10px; }
.lang-flag { display: block; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
.lang-flag svg { display: block; width: 100%; height: 100%; }
.lang-cur-flag { display: none; }
""" + ''.join(f'html[data-lang="{l}"] .lang-cur-flag[data-lang="{l}"] {{ display: block; }}\n' for l in ALL) + """
.lang-caret { width: 12px; height: 12px; opacity: .8; transition: transform .25s ease; }
.lang-menu.open .lang-caret { transform: rotate(180deg); }
.lang-list { position: absolute; right: 0; top: calc(100% + 8px); min-width: 196px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,0.16); border: 1px solid rgba(0,0,0,0.06); z-index: 1000; opacity: 0; visibility: hidden; transform: translateY(-6px) scale(.98); transform-origin: top right; transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s linear .22s; }
.lang-menu.open .lang-list { opacity: 1; visibility: visible; transform: translateY(0) scale(1); transition: opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility 0s; }
.lang-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; background: transparent; border-radius: 10px; color: #1a1a1a; font: inherit; font-size: 14px; font-weight: 500; letter-spacing: 0; cursor: pointer; text-align: left; transition: background .15s ease; }
.lang-item:hover { background: #F3F4F6; }
.lang-name { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.lang-sub { font-size: 11px; font-weight: 400; color: #9CA3AF; white-space: nowrap; }
""" + ''.join(f'html[data-lang="{l}"] .lang-item[data-lang="{l}"] {{ background: #F3F4F6; font-weight: 600; }}\n' for l in ALL) + """
.lang-switch-mobile { margin-left: auto; margin-right: 6px; }
.lang-switch-mobile .lang-cur { height: 34px; }
/* Im Overlay-Menü (unten) klappt die Liste nach oben auf, mittig */
.lang-switch-overlay { display: flex; width: max-content; margin: 0 auto 16px; }
.lang-switch-overlay .lang-list { top: auto; bottom: calc(100% + 8px); left: 50%; right: auto; transform: translate(-50%, 6px) scale(.98); transform-origin: bottom center; }
.lang-switch-overlay.open .lang-list { transform: translate(-50%, 0) scale(1); }
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
    p=os.path.join(os.environ.get('TMPDIR','/tmp'),'pm-business.i18n.html'); open(p,'w',encoding='utf-8').write(html); print('Testdatei:', p, len(html)//1024,'KB'); sys.exit()
open(OUT,'w',encoding='utf-8').write(html); print('index.html geschrieben', len(html)//1024,'KB')
