#!/usr/bin/env python3
"""Sammelt alle deutschen Strings aus index.de-en.html (PM-Business-Template): Sprach-Span-Paare
(source.json, auch die innerHTML-Paare in Skripten), Attribute inkl. Meta-Titel/-Beschreibung,
fsLangAttrs und der CSS-Text „Und noch viel mehr …“ (attrs.json) sowie die alert()-Meldungen (js-strings.json).
Danach: translate.py (übersetzt nur Fehlendes), build.py. Gleicher Ablauf wie bei fitline-optimalset/i18n."""
import json, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
s=open(os.path.join(ROOT,'index.de-en.html'),encoding='utf-8').read()
INNER=r'(?:[^<]|<(?!/?(?:span|div)\b)[^>]*>|<span\b[^>]*>(?:[^<]|<(?!/?span\b)[^>]*>)*</span>)*?'
pairs=re.findall(r'<(?:span|div) class="l-de">('+INNER+r')</(?:span|div)>\s*<(?:span|div) class="l-en">('+INNER+r')</(?:span|div)>', s, flags=re.S)
uniq={}
for de,en in pairs:
    if de.startswith('{{{about_intro_'): continue          # Begrüßung kommt je Sprache aus about-intro.ts
    uniq.setdefault(de,en)
# JS-Strings: alert(de ? 'DE' : 'EN')
js={}
for m in re.finditer(r"alert\(de \? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)'\)", s): js[m.group(1).replace("\\'","'")]=m.group(2).replace("\\'","'")
old=json.load(open(os.path.join(HERE,'source.json'))) if os.path.exists(os.path.join(HERE,'source.json')) else []
known={x['de'] for x in old}
out=list(old)
for de,en in list(uniq.items())+list(js.items()):
    if de not in known: out.append({'id':len(out),'de':de,'en':en}); known.add(de)
json.dump(out,open(os.path.join(HERE,'source.json'),'w'),ensure_ascii=False,indent=1)
json.dump(js,open(os.path.join(HERE,'js-strings.json'),'w'),ensure_ascii=False,indent=1)
# Attribute (nur Text, keine Platzhalter), fsLangAttrs (Spalte DE), Meta, CSS-Text
attrs=sorted(set(re.findall(r'(?:placeholder|aria-label|title|alt)="([^"{}]{3,})"', s)))
skip={'Deutsch','English','Facebook','Instagram','WhatsApp','TikTok','YouTube','LinkedIn','FinestSites','PowerCocktail','Sprache / Language','Play/Pause','Navigation'}
attrs=[a for a in attrs if a not in skip and re.search(r'[A-Za-zÄÖÜäöüß]{3,}',a)]
for m in re.finditer(r"\['[^']+', '(?:placeholder|aria-label|title)', '((?:[^'\\]|\\.)*)', '(?:[^'\\]|\\.)*'\]", s): attrs.append(m.group(1).replace("\\'","'"))
m=re.search(r"const fsMetaTitle = \['([^']*)',",s); attrs.append(m.group(1))
m=re.search(r"const fsMetaDesc = \[\n\s*'((?:[^'\\]|\\.)*)',",s); attrs.append(m.group(1).replace("\\'","'"))
m=re.search(r'\.todo-fade \.und-mehr::before \{\n\s*content: "([^"]+)";',s); attrs.append(m.group(1))
oldattrs=json.load(open(os.path.join(HERE,'attrs.json'))) if os.path.exists(os.path.join(HERE,'attrs.json')) else []
for a in attrs:
    if a not in oldattrs: oldattrs.append(a)
json.dump(oldattrs,open(os.path.join(HERE,'attrs.json'),'w'),ensure_ascii=False,indent=1)
print('Paare:',len(uniq),'| JS-Strings:',len(js),'| source.json gesamt:',len(out),'| Attribute:',len(oldattrs))
