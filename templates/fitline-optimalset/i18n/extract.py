#!/usr/bin/env python3
"""Sammelt alle deutschen Strings aus index.de-en.html: Sprach-Span-Paare (source.json),
Attribute (attrs.json) und JS-Strings (js-strings.json: Formular-Optionen, Wechselwirkungs-Hinweise, alert).
Danach: translate.py (übersetzt nur Fehlendes), build.py."""
import json, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
s=open(os.path.join(ROOT,'index.de-en.html'),encoding='utf-8').read()
pairs=re.findall(r'<(?:span|div) class="l-de">(.*?)</(?:span|div)>\s*<(?:span|div) class="l-en">(.*?)</(?:span|div)>', s, flags=re.S)
uniq={}
for de,en in pairs: uniq.setdefault(de,en)
# JS-Strings
js={}
for m in re.finditer(r"label: '((?:[^'\\]|\\.)*)', labelEn: '((?:[^'\\]|\\.)*)'", s): js[m.group(1).replace("\\'","'")]=m.group(2).replace("\\'","'")
for m in re.finditer(r"'([^']+)': \['((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'\]", s):
    key,en_name,de_text,en_text=[x.replace("\\'","'") for x in m.groups()]
    js[key]=en_name; js[de_text]=en_text
js['Etwas ist schiefgelaufen. Bitte versuche es erneut.']='Something went wrong. Please try again.'
old=json.load(open(os.path.join(HERE,'source.json'))) if os.path.exists(os.path.join(HERE,'source.json')) else []
known={x['de'] for x in old}
out=list(old)
for de,en in list(uniq.items())+list(js.items()):
    if de not in known: out.append({'id':len(out),'de':de,'en':en}); known.add(de)
json.dump(out,open(os.path.join(HERE,'source.json'),'w'),ensure_ascii=False,indent=1)
json.dump(js,open(os.path.join(HERE,'js-strings.json'),'w'),ensure_ascii=False,indent=1)
attrs=sorted(set(re.findall(r'(?:placeholder|aria-label|title|alt)="([^"{}]{3,})"', s)))
skip={'123 456 7890','Deutsch','English','Facebook','Instagram','WhatsApp','TikTok','YouTube','LinkedIn','FitLine','PowerCocktail','Guarana','Inulin','Calcium'}
attrs=[a for a in attrs if a not in skip and re.search(r'[A-Za-zÄÖÜäöüß]{3,}',a)]
m=re.search(r"var fsMetaTitle = \[\n\s*'([^']*)',",s); attrs.append(m.group(1))
m=re.search(r"var fsMetaDesc = \[\n\s*'((?:[^'\\]|\\.)*)',",s); attrs.append(m.group(1).replace("\\'","'"))
attrs+=['{{vorname}} {{nachname}} · Nährstoff-Empfehlung','Das FitLine Optimalset von {{vorname}} {{nachname}}']
oldattrs=json.load(open(os.path.join(HERE,'attrs.json'))) if os.path.exists(os.path.join(HERE,'attrs.json')) else []
for a in attrs:
    if a not in oldattrs: oldattrs.append(a)
json.dump(oldattrs,open(os.path.join(HERE,'attrs.json'),'w'),ensure_ascii=False,indent=1)
print('Paare:',len(uniq),'| JS-Strings:',len(js),'| source.json gesamt:',len(out),'| Attribute:',len(oldattrs))
