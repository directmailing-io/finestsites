#!/usr/bin/env python3
"""Zweite Meinung: prüft jede Übersetzung als muttersprachlicher Lektor und schlägt nur dort Korrekturen vor,
wo etwas falsch, unidiomatisch, zu formell oder nicht zum Thema passend ist.
Ergebnis: review_{lang}.json (de, alt, neu, grund). Vorschläge sichten, dann: python3 review.py --apply lang"""
import json, os, sys, urllib.request, re
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'en':'English','it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
KEY=os.environ.get('OPENAI_API_KEY'); MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23')
SYS="""You are a meticulous native-speaking copy editor for {lang}. You get German source strings from a warm, colloquial personal landing page (a PM-International team partner invites people to earn a side income by recommending wellness products they use themselves; informal "du", no selling, no pressure) and their {lang} translations.
Check every pair as a native reader would. Flag ONLY real problems: wrong meaning, grammar or spelling errors, unnatural, stiff or overly formal wording, wrong register (too formal, or "sales-y"/recruiter tone the source does not have), calques of German structure that nobody would say, wrong singular/plural in {{#if partner_modus=duo}} (two people) vs {{#unless partner_modus=duo}} (one person) blocks, broken placeholders/HTML, untranslated German, inconsistent product names, labels that got too long for a button or nav link. Do not flag matters of taste. Keep placeholders {{...}} and HTML tags exactly.
Return JSON: {"fixes": [{"id": "<id>", "fixed": "<corrected translation>", "reason": "<short>"}]} — only entries that need a change. Empty list if all good."""
def call(lang, items):
    body={"model":MODEL,"response_format":{"type":"json_object"},"messages":[{"role":"system","content":SYS.replace('{lang}',LANGS[lang])},{"role":"user","content":json.dumps(items,ensure_ascii=False)}]}
    for attempt in range(5):   # 429/5xx: warten und erneut
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=600)); return json.loads(d['choices'][0]['message']['content']).get('fixes',[])
        except Exception as e:
            print('  fehler',e,'(neuer Versuch)',file=sys.stderr); import time; time.sleep(20*(attempt+1))
    raise SystemExit('Lektorat fehlgeschlagen: '+lang)
def ok(de, xx):
    ph=lambda t: sorted(re.findall(r'\{\{[^}]*\}\}', t)); tg=lambda t: len(re.findall(r'<[a-zA-Z/][^>]*>', t))
    return ph(de)==ph(xx) and tg(de)==tg(xx)
if '--apply' in sys.argv:
    lang=sys.argv[-1]; path=os.path.join(HERE,f'{lang}.json'); cur=json.load(open(path)); rev=json.load(open(os.path.join(HERE,f'review_{lang}.json')))
    n=0
    for r in rev:
        if r.get('skip'): continue
        if r['de'] in cur['strings'] and ok(r['de'], r['neu']): cur['strings'][r['de']]=r['neu']; n+=1
        if r['de'] in cur['attrs']: cur['attrs'][r['de']]=r['neu']; n+=1   # Titel/alt stehen oft zusätzlich in attrs
    for k in cur['attrs']:   # gleicher DE-Text sichtbar und als Attribut: identisch halten
        if k in cur['strings']: cur['attrs'][k]=cur['strings'][k]
    json.dump(cur,open(path,'w'),ensure_ascii=False,indent=1); print(lang,'angewendet:',n); sys.exit()
for lang in sys.argv[1:]:
    cur=json.load(open(os.path.join(HERE,f'{lang}.json')))
    pairs=[(de,xx) for de,xx in cur['strings'].items()]+[(de,xx) for de,xx in cur['attrs'].items()]
    out=[]
    for i in range(0,len(pairs),40):
        chunk=pairs[i:i+40]
        items=[{'id':str(i+j),'de':de,'translation':xx} for j,(de,xx) in enumerate(chunk)]
        for f in call(lang, items):
            try: j=int(f['id'])-i
            except: continue
            if 0<=j<len(chunk) and isinstance(f.get('fixed'),str): out.append({'de':chunk[j][0],'alt':chunk[j][1],'neu':f['fixed'],'grund':f.get('reason','')})
        print(f'{lang}: {min(i+40,len(pairs))}/{len(pairs)} geprüft, {len(out)} Vorschläge', file=sys.stderr)
    json.dump(out,open(os.path.join(HERE,f'review_{lang}.json'),'w'),ensure_ascii=False,indent=1)
    print(lang,'Vorschläge:',len(out))
