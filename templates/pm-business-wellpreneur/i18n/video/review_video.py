#!/usr/bin/env python3
"""Lektorat des Video-Skripts: prüft video_{lang}.json als muttersprachlicher Sprecher (klingt es gesprochen
natürlich, passt die Länge in die Szene, stimmt der Sinn?) und schlägt nur echte Korrekturen vor.
Ergebnis: review_video_{lang}.json; anwenden mit --apply lang."""
import json, os, sys, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
KEY=os.environ.get('OPENAI_API_KEY'); MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23')
SYS="""You are a native {lang} voice-over script editor. You get the German narration of a two-minute animated explainer (a PM-International team partner explains casually how recommending wellness products you use yourself can become a side income: no selling, no pressure, 30-day money-back trial, German family business founded 1993) and its {lang} translation, segment by segment with the seconds each segment must fit in.
Read every segment ALOUD in your head. Flag ONLY real problems: wrong meaning, grammar/spelling errors, wording nobody would say in speech (stiff, written-language, literal German structure), wrong register (formal "you", sales-y or recruiter tone), segments clearly too long for their time slot (more than about 20 percent more syllables than the German), broken flow between consecutive segments that form one sentence, added or stronger claims. Do not flag matters of taste.
Return JSON: {"fixes": [{"id": "<id>", "fixed": "<corrected translation>", "reason": "<short>"}]} — only entries that need a change."""
def call(lang, items):
    body={"model":MODEL,"response_format":{"type":"json_object"},"messages":[{"role":"system","content":SYS.replace('{lang}',LANGS[lang])},{"role":"user","content":json.dumps(items,ensure_ascii=False)}]}
    req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
    d=json.load(urllib.request.urlopen(req,timeout=600)); return json.loads(d['choices'][0]['message']['content']).get('fixes',[])
if '--apply' in sys.argv:
    lang=sys.argv[-1]; p=os.path.join(HERE,f'video_{lang}.json'); segs=json.load(open(p)); rev=json.load(open(os.path.join(HERE,f'review_video_{lang}.json')))
    by={s['id']:s for s in segs}; n=0
    for r in rev:
        if r.get('skip') or r['id'] not in by: continue
        by[r['id']]['text']=r['neu']; n+=1
    json.dump(segs,open(p,'w'),ensure_ascii=False,indent=1); print(lang,'angewendet:',n); sys.exit()
for lang in sys.argv[1:]:
    segs=json.load(open(os.path.join(HERE,f'video_{lang}.json')))
    items=[{'id':s['id'],'seconds':round(s['end']-s['start'],1),'de':s['de'],'translation':s['text']} for s in segs]
    out=[]
    for f in call(lang, items):
        try: i=int(f['id'])
        except: continue
        if 0<=i<len(segs) and isinstance(f.get('fixed'),str): out.append({'id':i,'de':segs[i]['de'],'alt':segs[i]['text'],'neu':f['fixed'],'grund':f.get('reason','')})
    json.dump(out,open(os.path.join(HERE,f'review_video_{lang}.json'),'w'),ensure_ascii=False,indent=1); print(lang,'Vorschläge:',len(out))
