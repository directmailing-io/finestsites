#!/usr/bin/env python3
"""Sammelt alle deutschen Strings aus index.de-en.html (cellRESET-Template): Sprach-Span-Paare (source.json),
Attribute inkl. data-de-placeholder und Meta-Beschreibung (attrs.json), JS-Strings (alert) (js-strings.json).
Danach: translate.py (übersetzt nur Fehlendes), build.py. Gleicher Ablauf wie fitline-optimalset/i18n."""
import json, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
s=open(os.path.join(ROOT,'index.de-en.html'),encoding='utf-8').read()
INNER=r'(?:[^<]|<(?!/?(?:span|div)\b)[^>]*>|<span\b[^>]*>(?:[^<]|<(?!/?span\b)[^>]*>)*</span>)*?'
pairs=re.findall(r'<(?:span|div) class="l-de">('+INNER+r')</(?:span|div)>\s*<(?:span|div) class="l-en">('+INNER+r')</(?:span|div)>', s, flags=re.S)
uniq={}
for de,en in pairs:
    if de.startswith('{{{about_intro_') or de.strip()=='{{about_me_html}}': continue
    uniq.setdefault(de,en)
js={}
for m in re.finditer(r"alert\(lang === 'en' \? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)'\)", s): js[m.group(2).replace("\\'","'")]=m.group(1).replace("\\'","'")
old=json.load(open(os.path.join(HERE,'source.json'))) if os.path.exists(os.path.join(HERE,'source.json')) else []
known={x['de'] for x in old}; out=list(old)
for de,en in list(uniq.items())+list(js.items()):
    if de not in known: out.append({'id':len(out),'de':de,'en':en}); known.add(de)
json.dump(out,open(os.path.join(HERE,'source.json'),'w'),ensure_ascii=False,indent=1)
json.dump(js,open(os.path.join(HERE,'js-strings.json'),'w'),ensure_ascii=False,indent=1)
attrs=sorted(set(re.findall(r'(?<![\w-])(?:placeholder|aria-label|title|alt|data-de-placeholder)="([^"{}]{3,})"', s)))
skip={'Deutsch','English','finestsites','max@beispiel.de','Facebook','Instagram','WhatsApp','TikTok','YouTube','LinkedIn','FinestSites','Sprache / Language','Play/Pause','Navigation'}
attrs=[a for a in attrs if a not in skip and re.search(r'[A-Za-zÄÖÜäöüß]{3,}',a)]
m=re.search(r'<meta name="description" content="([^"]*)"',s)
if m and m.group(1) not in attrs: attrs.append(m.group(1))
if 'Stoffwechselkur' not in attrs: attrs.append('Stoffwechselkur')   # <title>-Wort, wird per JS je Sprache ersetzt
json.dump(attrs,open(os.path.join(HERE,'attrs.json'),'w'),ensure_ascii=False,indent=1)
print('Paare:',len(pairs),'| JS-Strings:',len(js),'| source.json gesamt:',len(out),'| Attribute:',len(attrs))
