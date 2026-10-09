#!/usr/bin/env python3
"""Übersetzt die Rechtstexte (de.json) in die Zielsprachen → translations.json {lang: {chunk: html}}.
Nur fehlende Chunks werden übersetzt. Aufruf: OPENAI_API_KEY=… python3 translate.py [lang ...]"""
import json, os, re, sys, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
MODEL='gpt-5.5-2026-04-23'; KEY=os.environ['OPENAI_API_KEY']
SYS="""You are a professional legal translator. Translate the German HTML of a website's legal notice / privacy policy into {lang}.
Rules: formal register appropriate for legal texts in {lang} (polite "you"); keep all HTML tags and attributes exactly; keep every placeholder exactly ({{vorname}}, {{#if firma}}, {{/if}}, {{#unless …}}, {{/unless}} etc.) and keep §§…§§ markers exactly; keep legal references (Art. 6 Abs. 1 lit. a DSGVO, § 5 TMG, § 25 TDDDG) with the German/EU law names, you may add the common local abbreviation for GDPR in brackets once; keep company names, addresses, e-mail addresses, URLs unchanged; translate the meaning precisely, do not add or drop anything.
Return ONLY the translated HTML, no explanations, no code fences."""
def call(lang, html):
    body={"model":MODEL,"messages":[{"role":"system","content":SYS.replace('{lang}',LANGS[lang])},{"role":"user","content":html}]}
    for a in range(3):
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=900)); return d['choices'][0]['message']['content'].strip().strip('`')
        except Exception as e: print('fehler',e,file=sys.stderr); time.sleep(5)
    raise SystemExit('fehlgeschlagen')
def ok(de, xx):
    f=lambda t: (sorted(re.findall(r'\{\{[^}]*\}\}',t)), sorted(re.findall(r'§§[A-Z]+§§',t)), len(re.findall(r'<[a-zA-Z/][^>]*>',t)))
    return f(de)==f(xx)
de=json.load(open(os.path.join(HERE,'de.json')))
out_path=os.path.join(HERE,'translations.json'); out=json.load(open(out_path)) if os.path.exists(out_path) else {}
for lang in (sys.argv[1:] or list(LANGS)):
    cur=out.setdefault(lang,{})
    for k,v in de.items():
        if k in cur: continue
        t=call(lang,v)
        if not ok(v,t): print(f'  WARN {lang}/{k}: Platzhalter/Tags weichen ab', file=sys.stderr)
        cur[k]=t; json.dump(out,open(out_path,'w'),ensure_ascii=False,indent=1); print(lang,k,'ok')
print('fertig')
