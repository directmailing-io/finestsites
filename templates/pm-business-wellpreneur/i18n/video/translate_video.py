#!/usr/bin/env python3
"""
Übersetzt das Voice-over des Business-Videos (transcript_de.json, Whisper-Segmente mit Zeiten) in die
Zielsprachen: je Sprache video_{lang}.json mit Segmenten {start, end, de, text}. Gesprochene Sprache,
Satzlänge etwa wie im Deutschen (die Tonspur muss in die Szenen passen). Danach review_video.py.
Aufruf: OPENAI_API_KEY=… python3 translate_video.py [lang ...]
"""
import json, os, sys, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23'); KEY=os.environ['OPENAI_API_KEY']
SYSTEM="""You translate the voice-over script of a short animated explainer video (about two minutes). A PM-International team partner explains, warmly and casually, how recommending wellness products you use yourself can become a side income: no selling, no pressure, 30-day money-back trial, a German family business founded in 1993. The German narration is spoken language: short sentences, "du", friendly, no corporate or sales tone.
Rules:
- Write it the way a native {lang} speaker would actually SAY it to a friend, not written language. Natural rhythm, contractions and particles where natural, nothing stiff or literal. It will be read aloud by a voice actor.
- Each segment is one scene of the animation and will be spoken in that exact time slot: keep each translation about as long as the German (same number of syllables, plus or minus 15 percent). Never longer than 120 percent.
- Keep the meaning exact: no added claims, no stronger promises, no health claims. "30 Tage" stays 30 days, "1993" stays.
- Keep sentence boundaries per segment; a segment may end mid-sentence when the German does (the next segment continues it), so make sure consecutive segments read as one flowing sentence.
- Write numbers as words only if a native speaker would say them that way; write "30 Tage" as digits.
- Informal register: informal "you" (Hindi: आप, warm; Russian/Ukrainian/Polish/Bulgarian: ты/ти/ty/ти).
- Return ONLY a JSON object {"segments": {"<id>": "<translation>"}} for every input id."""
def call(lang, items):
    body={"model":MODEL,"response_format":{"type":"json_object"},"messages":[{"role":"system","content":SYSTEM.replace('{lang}',LANGS[lang])},{"role":"user","content":f"Target language: {LANGS[lang]}. Full script in order (id, seconds, German):\n"+json.dumps(items,ensure_ascii=False)}]}
    for a in range(4):
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=600)); out=json.loads(d['choices'][0]['message']['content']).get('segments',{})
            if all(str(x['id']) in out for x in items): return out
            print('  fehlende ids, retry',file=sys.stderr)
        except Exception as e: print('  fehler',e,file=sys.stderr); time.sleep(5*(a+1))
    raise SystemExit('fehlgeschlagen '+lang)
segs=json.load(open(os.path.join(HERE,'transcript_de.json')))['segments']
items=[{'id':i,'start':round(s['start'],2),'end':round(s['end'],2),'de':s['text'].strip()} for i,s in enumerate(segs)]
for lang in (sys.argv[1:] or list(LANGS)):
    out=call(lang,items)
    res=[{'id':x['id'],'start':x['start'],'end':x['end'],'de':x['de'],'text':out[str(x['id'])].strip()} for x in items]
    json.dump(res,open(os.path.join(HERE,f'video_{lang}.json'),'w'),ensure_ascii=False,indent=1); print(lang,'ok',len(res),'Segmente')
